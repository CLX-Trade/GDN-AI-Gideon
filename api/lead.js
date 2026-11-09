// Every enquiry form on the site: pilot, Enterprise, investor. A lead is both stored
// and emailed, so one failing does not lose it. Only if both fail is the visitor told
// to try again. /api/register-interest is rewritten here for the investor page.
import { json, originAllowed, isEmail, normalEmail, ipHash } from '../lib/http.js';
import { store } from '../lib/deps.js';
import { rateLimit } from '../lib/quota.js';
import { metric } from '../lib/metrics.js';
import { sendEmail, emailShell, escapeHtml, OWNER_EMAIL } from '../lib/email.js';

const KINDS = { pilot: 'Founding pilot', enterprise: 'Enterprise', investor: 'Investor / partner', other: 'General' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const b = req.body && typeof req.body === 'object' ? req.body : {};
  // Hidden field that people never see and bots fill in. Pretend it worked.
  if (b.website) return json(res, 200, { ok: true });

  const kind = Object.hasOwn(KINDS, b.kind) ? b.kind : (b.kind ? 'other' : 'investor');
  const name = String(b.name || '').trim().slice(0, 200);
  const email = normalEmail(b.email).slice(0, 200);
  const company = String(b.company || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 3000);
  const source = String(b.source || '').replace(/[^\w.:/-]/g, '').slice(0, 120);
  if (!name || !isEmail(email)) return json(res, 400, { error: 'Please give your name and a valid email address.' });

  try {
    if (!(await rateLimit('lead', ipHash(req), 8, 3600))) return json(res, 429, { error: 'Too many messages. Please try again later.' });
  } catch { /* never lose a lead because the limiter is down */ }

  const lead = { kind, name, email, company, message, source, at: new Date().toISOString() };
  let saved = false;
  let emailed = false;
  try {
    await store().set(`lead:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`, lead);
    saved = true;
  } catch (e) { console.error('lead save failed', e && e.message); }

  try {
    const row = (label, value) => `<tr><td style="padding:6px 10px;color:#7a8290;width:110px;vertical-align:top">${label}</td><td style="padding:6px 10px;white-space:pre-wrap">${escapeHtml(value) || '&mdash;'}</td></tr>`;
    await sendEmail({
      to: OWNER_EMAIL(),
      replyTo: email,
      subject: `Gideon lead (${KINDS[kind]}): ${name}`,
      html: emailShell(`New lead: ${KINDS[kind]}`, `<table style="border-collapse:collapse;width:100%;font-size:14px">${row('Name', name)}${row('Email', email)}${row('Company', company)}${row('Message', message)}${row('Source', source)}</table>`),
    });
    emailed = true;
  } catch (e) { console.error('lead email failed', e && e.message); }

  if (!saved && !emailed) return json(res, 502, { error: 'That did not send. Please email gnardo@gdngroup.com.au directly.' });
  await metric(`lead_${kind}`);
  return json(res, 200, { ok: true });
}
