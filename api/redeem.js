// Access codes. Codes live in the VOUCHER_CODES environment variable, as
// CODE:DAYS,CODE:DAYS, and never in this repository.
import { json, originAllowed, isEmail, normalEmail, addCookie, ipHash } from '../lib/http.js';
import { grantVoucher, getEntitlement } from '../lib/entitlement.js';
import { sessionCookie, sessionConfigured } from '../lib/session.js';
import { rateLimit } from '../lib/quota.js';
import { metric } from '../lib/metrics.js';
import { sendSignInLink } from './auth.js';

export function parseCodes(raw = process.env.VOUCHER_CODES || '') {
  const map = new Map();
  for (const part of raw.split(',')) {
    const [code, days] = part.split(':').map((s) => (s || '').trim());
    if (code) map.set(code.toUpperCase(), Math.max(1, parseInt(days || '7', 10) || 7));
  }
  return map;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const email = normalEmail(req.body && req.body.email);
  const code = String((req.body && req.body.code) || '').trim().toUpperCase();
  if (!isEmail(email)) return json(res, 400, { error: 'A valid email is required.' });
  if (!code) return json(res, 400, { error: 'An access code is required.' });

  try {
    if (!(await rateLimit('redeem', ipHash(req), 5, 3600))) return json(res, 429, { error: 'Too many attempts. Please try again later.' });
  } catch {
    return json(res, 503, { error: 'Could not apply the code, please try again.' });
  }

  const days = parseCodes().get(code);
  if (!days) return json(res, 400, { error: 'That access code is not valid.' });

  try {
    // Never sign a browser in to a paying customer's account just because someone
    // typed their address next to a code. They get an emailed link instead, and a
    // paid plan is never replaced by a shorter voucher.
    const existing = await getEntitlement(email);
    if (existing && existing.source === 'stripe') {
      await sendSignInLink(req, email);
      return json(res, 200, { ok: true, member: true, emailed: true });
    }
    await grantVoucher(email, days);
    await metric('voucher_redeemed');
    if (!sessionConfigured()) throw new Error('No session signing key');
    addCookie(res, sessionCookie(email));
    return json(res, 200, { ok: true, member: true, days });
  } catch (e) {
    console.error('redeem failed', e && e.message);
    return json(res, 503, { error: 'Could not apply the code, please try again.' });
  }
}
