// Pack check, in three calls so each stays inside the platform's request size limit
// and the browser can show real progress document by document:
//
//   start     -> charges one query per document, returns a signed run token
//   extract   -> reads one document into structured fields (called once per document)
//   reconcile -> rule engine over all documents, then the model's judgement on top
//
// Documents are read to text or page images in the browser first. Nothing is
// written to disk or to Redis on this side; the contents exist only in the request.
import crypto from 'node:crypto';
import { json, addCookie, originAllowed, query, randomToken } from '../lib/http.js';
import { resolveIdentity } from '../lib/identity.js';
import { consume, refund, rateLimit } from '../lib/quota.js';
import { structured, ModelError, alertIfOutOfCredit } from '../lib/claude.js';
import { EXTRACT_SYSTEM, EXTRACT_SCHEMA, RECONCILE_SYSTEM, RECONCILE_SCHEMA } from '../lib/prompts.js';
import { reconcile, FIELDS } from '../shared/reconcile.js';
import { TIERS, TRIAL } from '../lib/plans.js';
import { metric } from '../lib/metrics.js';
import { store } from '../lib/deps.js';

const RUN_SECONDS = 45 * 60;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function signingKey() {
  const direct = (process.env.SESSION_SECRET || '').trim();
  if (direct) return direct;
  return crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'gideon-dev').update('gideon-pack-v1').digest('hex');
}

function sign(payload) {
  return crypto.createHmac('sha256', signingKey()).update(payload).digest('base64url');
}

function makeRun(owner, docs) {
  const payload = Buffer.from(JSON.stringify({ id: randomToken(12), owner, docs, exp: Date.now() + RUN_SECONDS * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

function readRun(token, owner) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const given = Buffer.from(parts[1]);
  const want = Buffer.from(sign(parts[0]));
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  try {
    const run = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return run.exp > Date.now() && run.owner === owner ? run : null;
  } catch {
    return null;
  }
}

// Allows a little retry headroom per document, but not unlimited free reads on one
// charge. If Redis is down, members proceed and the trial does not.
async function spendRunStep(run, step, max, isMember) {
  try {
    const key = `run:${run.id}:${step}`;
    const value = await store().incrby(key, 1);
    if (value === 1) await store().expire(key, RUN_SECONDS);
    return value <= max;
  } catch (e) {
    console.error('run counter failed', e && e.message);
    return isMember;
  }
}

async function modelFailure(res, e, fallback) {
  console.error('pack model call failed', e && e.kind, e && e.message);
  await alertIfOutOfCredit(e);
  if (e instanceof ModelError && e.kind === 'too_long') return json(res, 413, { error: 'This document is too long to read in one pass. Split it and try again.', code: 'too_long' });
  if (e instanceof ModelError && e.kind === 'refusal') return json(res, 422, { error: 'Gideon could not process this document.', code: 'refused' });
  return json(res, 502, { error: fallback, code: 'upstream' });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const identity = await resolveIdentity(req);
  if (identity.setCookie) addCookie(res, identity.setCookie);
  const isMember = Boolean(identity.entitlement);
  const owner = identity.email || identity.sid;

  try {
    const allowed = await rateLimit('pack', identity.email || identity.ipHash, isMember ? 120 : 30, 60);
    if (!allowed) return json(res, 429, { error: 'Too many requests. Please wait a moment.', code: 'rate' });
  } catch { /* each step below applies its own rule for a store outage */ }

  const action = query(req).get('action');
  if (action === 'start') return start(res, body, identity, isMember, owner);
  if (action === 'extract') return extract(req, res, body, isMember, owner);
  if (action === 'reconcile') return finish(req, res, body, identity, isMember, owner);
  if (action === 'cancel') return cancel(res, body, identity, owner);
  return json(res, 400, { error: 'Unknown action' });
}

async function start(res, body, identity, isMember, owner) {
  const docs = Number(body.documents);
  const maxDocs = isMember ? TIERS[identity.entitlement.tier].maxDocsPerPack : TRIAL.maxDocsPerPack;
  if (!Number.isInteger(docs) || docs < 2) return json(res, 400, { error: 'A pack check needs at least two documents.', code: 'too_few' });
  if (docs > maxDocs) {
    return json(res, 400, {
      error: isMember
        ? `Your plan checks up to ${maxDocs} documents per pack. Remove some, or upgrade to Professional for 20.`
        : `The free trial checks up to ${maxDocs} documents. Remove some, or join to check up to 20.`,
      code: 'too_many', maxDocs,
    });
  }
  const quota = await consume(identity, docs);
  if (!quota.ok) {
    if (quota.reason === 'paywall') {
      await metric('paywall_hit');
      return json(res, 402, { paywall: true, reason: 'trial_used', used: quota.used, limit: quota.limit, error: 'This pack would use more free queries than you have left.' });
    }
    if (quota.reason === 'quota') {
      await metric('quota_hit');
      return json(res, 429, { error: `This pack needs ${docs} queries, and you have ${quota.limit - quota.used} left this month.`, code: 'quota', used: quota.used, limit: quota.limit });
    }
    await metric(quota.reason === 'busy' ? 'trial_busy' : 'store_error');
    return json(res, 503, { error: 'Pack checks are very busy right now. Please try again shortly.', code: 'busy' });
  }
  await metric(isMember ? 'member_pack' : 'trial_pack');
  return json(res, 200, { run: makeRun(owner, docs), used: quota.used, limit: quota.limit });
}

// A free check should cover a normal trade document, not a free reading of a book.
const MAX_DOC_CHARS = { member: 600000, trial: 150000 };

function documentContent(doc, isMember) {
  const name = String(doc.name || 'document').slice(0, 200);
  const blocks = [];
  if (Array.isArray(doc.images)) {
    if (doc.images.length > 20) return { error: 'Too many page images in one document.' };
    for (const image of doc.images) {
      if (!image || !IMAGE_TYPES.has(image.media_type) || typeof image.data !== 'string') return { error: 'Unsupported image.' };
      blocks.push({ type: 'image', source: { type: 'base64', media_type: image.media_type, data: image.data } });
    }
  }
  const text = typeof doc.text === 'string' ? doc.text : '';
  if (text.length > (isMember ? MAX_DOC_CHARS.member : MAX_DOC_CHARS.trial)) {
    return { error: isMember ? 'This document is too long to read in one pass. Split it and try again.' : 'This document is too long for the free trial. Send the key pages, or join to check longer documents.' };
  }
  if (!text.trim() && !blocks.length) return { error: 'This document appears to be empty.' };
  blocks.push({ type: 'text', text: `File name: ${name}\n\n<document>\n${text || '(see the page images above)'}\n</document>\n\nExtract the facts from this document.` });
  return { blocks, name };
}

async function extract(req, res, body, isMember, owner) {
  const run = readRun(body.run, owner);
  if (!run) return json(res, 401, { error: 'This check has expired. Please start again.', code: 'expired' });
  if (!(await spendRunStep(run, 'extract', run.docs * 2, isMember))) return json(res, 429, { error: 'Too many read attempts for this pack. Please start again.', code: 'rate' });

  const content = documentContent(body.doc || {}, isMember);
  if (content.error) return json(res, 400, { error: content.error, code: 'bad_doc' });

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });
  try {
    const result = await structured({ system: EXTRACT_SYSTEM, content: content.blocks, schema: EXTRACT_SCHEMA, effort: 'low', signal: controller.signal });
    if (body.retry === true) await noteFailure(run, -1);
    return json(res, 200, { name: content.name, ...result });
  } catch (e) {
    await metric('ai_error');
    if (!controller.signal.aborted) await noteFailure(run, 1);
    return modelFailure(res, e, 'Gideon could not read this document. Please try again.');
  }
}

// Documents we failed to read are not charged for. Failures are counted here and
// handed back once when the run ends, either at reconcile or on cancel.
async function noteFailure(run, delta) {
  try {
    const key = `run:${run.id}:failed`;
    await store().incrby(key, delta);
    await store().expire(key, RUN_SECONDS);
  } catch (e) { console.error('failure count failed', e && e.message); }
}

async function settleFailures(run, identity) {
  try {
    const first = await store().set(`run:${run.id}:settled`, 1, { nx: true, ex: RUN_SECONDS });
    if (first !== 'OK') return 0;
    const failed = Math.min(Math.max(Number(await store().get(`run:${run.id}:failed`)) || 0, 0), run.docs);
    if (failed > 0) await refund(identity, failed);
    return failed;
  } catch (e) {
    console.error('settling failures failed', e && e.message);
    return 0;
  }
}

async function cancel(res, body, identity, owner) {
  const run = readRun(body.run, owner);
  if (!run) return json(res, 401, { error: 'This check has expired.', code: 'expired' });
  return json(res, 200, { refunded: await settleFailures(run, identity) });
}

// Only fields the schema allows, and short ones, go back through the model.
function cleanDocs(input) {
  if (!Array.isArray(input) || input.length < 2 || input.length > 25) return null;
  return input.map((doc) => ({
    name: String((doc && doc.name) || 'document').slice(0, 200),
    doc_type: String((doc && doc.doc_type) || 'other').slice(0, 40),
    doc_title: String((doc && doc.doc_title) || '').slice(0, 200),
    readability: String((doc && doc.readability) || 'clear').slice(0, 10),
    fields: (Array.isArray(doc && doc.fields) ? doc.fields : [])
      .filter((f) => f && FIELDS[f.key] && typeof f.value === 'string')
      .slice(0, 300)
      .map((f) => ({ key: f.key, value: f.value.slice(0, 500), page: Number.isInteger(f.page) ? f.page : null, quote: String(f.quote || '').slice(0, 300) })),
    other_facts: (Array.isArray(doc && doc.other_facts) ? doc.other_facts : []).slice(0, 40)
      .map((f) => ({ label: String((f && f.label) || '').slice(0, 120), value: String((f && f.value) || '').slice(0, 600) })),
  }));
}

function verdictFor(counts, aiFindings) {
  const high = counts.high + aiFindings.filter((f) => f.severity === 'high').length;
  const medium = counts.medium + aiFindings.filter((f) => f.severity === 'medium').length;
  if (high > 0) return 'stop';
  if (medium > 0) return 'review';
  return 'no_conflicts';
}

async function finish(req, res, body, identity, isMember, owner) {
  const run = readRun(body.run, owner);
  if (!run) return json(res, 401, { error: 'This check has expired. Please start again.', code: 'expired' });
  if (!(await spendRunStep(run, 'reconcile', 2, isMember))) return json(res, 429, { error: 'This pack has already been reconciled. Please start a new check.', code: 'rate' });

  const docs = cleanDocs(body.docs);
  if (!docs) return json(res, 400, { error: 'A pack check needs at least two readable documents.', code: 'too_few' });
  await settleFailures(run, identity);

  const rules = reconcile(docs);
  const brief = JSON.stringify({
    documents: docs.map((d) => ({ name: d.name, type: d.doc_type, title: d.doc_title, readability: d.readability, fields: d.fields.map((f) => ({ field: FIELDS[f.key].label, value: f.value })), other_facts: d.other_facts })),
    rule_findings: rules.findings.map((f) => ({ severity: f.severity, title: f.title, detail: f.detail })),
  });

  let ai = null;
  try {
    ai = await structured({
      system: RECONCILE_SYSTEM,
      content: [{ type: 'text', text: `Review this pack. The rule findings are final.\n\n<pack>\n${brief}\n</pack>` }],
      schema: RECONCILE_SCHEMA,
      effort: 'high',
    });
  } catch (e) {
    // The rule engine's result is still valid and worth showing without the AI layer.
    console.error('reconcile judgement failed', e && e.message);
    await metric('ai_error');
  }

  const aiFindings = ai ? ai.findings.map((f) => ({ ...f, source: 'ai' })) : [];
  return json(res, 200, {
    verdict: verdictFor(rules.counts, aiFindings),
    summary: ai ? ai.summary : null,
    judgementAvailable: Boolean(ai),
    rules,
    aiFindings,
    questions: ai ? ai.questions : [],
    missingDocuments: ai ? ai.missing_documents : [],
    checkedAt: new Date().toISOString(),
  });
}

