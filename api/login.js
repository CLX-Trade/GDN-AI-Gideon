import { kv } from '@vercel/kv';
import { parse, serialize } from 'cookie';

// MVP identity only. This trusts whatever email is entered.
// Before public launch, replace with verified auth (magic link, Clerk, or Auth0)
// so a non-member cannot type a paying member's email to gain access.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const email = (body.email || '').toLowerCase();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  let member = false;
  try { member = (await kv.get('member:' + email)) === true; } catch (e) {}

  res.setHeader('Set-Cookie', serialize('gid_email', email, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 }));
  return res.status(200).json({ member });
}
