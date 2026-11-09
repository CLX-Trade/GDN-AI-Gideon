// Gideon chat. Streams the answer as server-sent events so people see it being
// written instead of watching a spinner for a minute. `stream:false` returns one
// JSON object for the Meeting Room's Gideon seat.
import { json, addCookie, originAllowed } from '../lib/http.js';
import { resolveIdentity } from '../lib/identity.js';
import { consume, refund, rateLimit } from '../lib/quota.js';
import { sanitizeMessages, streamAnswer, ModelError } from '../lib/claude.js';
import { CHAT_SYSTEM } from '../lib/prompts.js';
import { metric } from '../lib/metrics.js';
import { activePass } from '../lib/pass.js';

const MEMBER_LIMITS = { maxMessages: 80, maxChars: 900000, maxImages: 40 };
const TRIAL_LIMITS = { maxMessages: 10, maxChars: 200000, maxImages: 12 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const identity = await resolveIdentity(req);
  if (identity.setCookie) addCookie(res, identity.setCookie);
  const isMember = Boolean(identity.entitlement);

  const checked = sanitizeMessages(body.messages, isMember ? MEMBER_LIMITS : TRIAL_LIMITS);
  if (checked.error) return json(res, 400, { error: checked.error, code: checked.code || 'invalid' });

  try {
    const allowed = await rateLimit('chat', identity.email || identity.ipHash, isMember ? 40 : 15, 60);
    if (!allowed) return json(res, 429, { error: 'Too many requests. Please wait a moment.', code: 'rate' });
  } catch { /* the quota step below decides what a store outage means */ }

  // A live Meeting Room pass covers its own Gideon seat, within a daily ceiling.
  let quota = null;
  const roomSeat = body.room === true && !isMember && identity.email;
  if (roomSeat) {
    const pass = await activePass(identity.email);
    const within = pass && await rateLimit('room', identity.email, 100, 86400).catch(() => false);
    if (!within) return json(res, 402, { paywall: true, reason: 'pass' });
    quota = { ok: true, used: null, limit: null };
  } else {
    quota = await consume(identity, 1);
  }

  if (!quota.ok) {
    if (quota.reason === 'paywall') { await metric('paywall_hit'); return json(res, 402, { paywall: true, reason: 'trial_used', trialUsed: quota.limit, trialLimit: quota.limit }); }
    if (quota.reason === 'quota') { await metric('quota_hit'); return json(res, 429, { error: `You have used all ${quota.limit} queries for this month.`, code: 'quota', used: quota.used, limit: quota.limit }); }
    await metric(quota.reason === 'busy' ? 'trial_busy' : 'store_error');
    return json(res, 503, { error: 'The free trial is very busy right now. Please try again shortly, or email gnardo@gdngroup.com.au.', code: 'busy' });
  }
  await metric(isMember ? 'member_chat' : 'trial_chat');

  const meta = { member: isMember, tier: identity.entitlement ? identity.entitlement.tier : null, used: quota.used, limit: quota.limit };
  const options = {
    system: CHAT_SYSTEM,
    messages: checked.messages,
    webSearchUses: isMember ? 5 : 2,
    maxTokens: isMember ? 16000 : 4000,
    effort: 'medium',
  };
  const giveBack = () => { if (!roomSeat) return refund(identity, 1); return null; };

  if (body.stream === false) return respondWhole(res, options, meta, giveBack);
  return respondStream(req, res, options, meta, giveBack);
}

async function respondWhole(res, options, meta, giveBack) {
  let text = '';
  try {
    const result = await streamAnswer({ ...options, onText: (t) => { text += t; } });
    return json(res, 200, { text: text.trim(), truncated: result.truncated, sources: result.sources, ...meta, trialUsed: meta.used, trialLimit: meta.limit });
  } catch (e) {
    console.error('chat failed', e && e.message);
    await giveBack();
    await metric('ai_error');
    return json(res, 502, { error: 'Gideon could not answer just now. You have not been charged for this query.' });
  }
}

async function respondStream(req, res, options, meta, giveBack) {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-transform');
  res.setHeader('X-Accel-Buffering', 'no');
  const send = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); };
  send('meta', meta);

  const controller = new AbortController();
  res.on('close', () => { if (!res.writableEnded) controller.abort(); });

  let produced = false;
  try {
    const result = await streamAnswer({
      ...options,
      signal: controller.signal,
      onText: (text) => { produced = true; send('delta', { text }); },
      onSearch: () => send('status', { searching: true }),
    });
    send('done', { truncated: result.truncated, sources: result.sources });
  } catch (e) {
    if (!controller.signal.aborted) {
      console.error('chat stream failed', e && e.message);
      await metric('ai_error');
      if (!produced) await giveBack();
      send('error', {
        message: e instanceof ModelError && e.kind === 'refusal'
          ? 'Gideon cannot help with that request. You have not been charged for it.'
          : 'Gideon lost the connection to the model. Please try again.',
        reset: true,
      });
    }
  }
  res.end();
}
