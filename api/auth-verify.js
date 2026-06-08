import { kv } from '@vercel/kv';
import { serialize } from 'cookie';

// Verifies a one-time magic-link token, issues the signed-in cookie, and
// redirects into the app. Tokens are single-use and expire in 15 minutes.
export default async function handler(req, res) {
  const host = req.headers.host;
  const base = (process.env.APP_URL || ('https://' + host)).replace(/\/$/, '');
  const bounce = (q) => { res.statusCode = 302; res.setHeader('Location', base + q); res.end(); };

  let token = '';
  try { token = new URL(req.url, 'https://' + host).searchParams.get('token') || ''; } catch (e) {}
  if (!token) return bounce('/gdn-ai-membership-portal.html?signin=invalid');

  let rec = null;
  try { rec = await kv.get('magic:' + token); } catch (e) { console.error('kv get magic failed:', e && e.message); }
  if (!rec || !rec.email) return bounce('/gdn-ai-membership-portal.html?signin=expired');

  try { await kv.del('magic:' + token); } catch (e) {}

  res.setHeader('Set-Cookie', serialize('gid_email', rec.email, {
    httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
  }));
  return bounce('/gdn-ai-portal.html?signed_in=1');
}
