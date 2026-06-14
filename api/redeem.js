import { kv } from '@vercel/kv';
import { serialize } from 'cookie';

// Gideon access-code redemption.
// Grants temporary membership (the SAME flag Stripe sets: member:<email>=true)
// for a number of days, then it expires on its own and access reverts.
//
// Codes are NOT stored in this file (the repo is public). They live in a Vercel
// environment variable so they stay private:
//
//   VOUCHER_CODES = "GIDEONTEST5:5,GIDEONWEEK:7"
//
// Format is CODE:DAYS, comma separated. If a code has no :DAYS it defaults to 7.
// To change, add or revoke codes, just edit the env var in Vercel and redeploy.

function parseCodes() {
  const raw = (process.env.VOUCHER_CODES || '').trim();
  const map = {};
  if (!raw) return map;
  for (const part of raw.split(',')) {
    const [code, days] = part.split(':').map((s) => (s || '').trim());
    if (code) map[code.toUpperCase()] = Math.max(1, parseInt(days || '7', 10) || 7);
  }
  return map;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const body = req.body || {};
  const email = (body.email || '').toLowerCase().trim();
  const code = (body.code || '').toUpperCase().trim();

  if (!email || !email.includes('@')) return res.status(400).json({ error: 'A valid email is required.' });
  if (!code) return res.status(400).json({ error: 'An access code is required.' });

  const codes = parseCodes();
  const days = codes[code];
  if (!days) return res.status(400).json({ error: 'That access code is not valid.' });

  // Grant membership with an expiry. Do not overwrite an existing member
  // (so a paying member who enters a code is never downgraded to a short window).
  try {
    const already = (await kv.get('member:' + email)) === true;
    if (!already) {
      await kv.set('member:' + email, true, { ex: days * 24 * 60 * 60 });
    }
  } catch (e) {
    console.error('redeem kv error:', e && e.message);
    return res.status(500).json({ error: 'Could not apply the code, please try again.' });
  }

  // Sign this browser in as that email so the chat and app see the membership.
  res.setHeader('Set-Cookie', serialize('gid_email', email, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  }));

  return res.status(200).json({ ok: true, member: true, days });
}
