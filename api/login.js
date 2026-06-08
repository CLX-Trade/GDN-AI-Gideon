import { kv } from '@vercel/kv';
import { serialize } from 'cookie';

// Gideon sign-in.
// RESEND_API_KEY set  -> SECURE magic-link: emails a one-time 15-minute link and
//   does NOT trust the typed email. The cookie is only issued after the link is
//   clicked (see api/auth-verify.js).
// RESEND_API_KEY unset -> legacy fallback (sets the cookie directly) so sign-in
//   keeps working until email is configured. Add the key to upgrade to secure auth.

function makeToken() {
  const c = globalThis.crypto;
  if (c && c.randomUUID) return (c.randomUUID() + c.randomUUID()).replace(/-/g, '');
  return Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const body = req.body || {};
  const email = (body.email || '').toLowerCase().trim();
  if (!email || !email.includes('@')) return res.status(400).json({ error: 'Valid email required' });

  const RESEND = (process.env.RESEND_API_KEY || '').trim();

  // ---- Legacy fallback: no email provider configured yet ----
  if (!RESEND) {
    let member = false;
    try { member = (await kv.get('member:' + email)) === true; } catch (e) {}
    res.setHeader('Set-Cookie', serialize('gid_email', email, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365
    }));
    return res.status(200).json({ member, magic: false });
  }

  // ---- Secure magic-link mode ----
  try {
    if (await kv.get('magiccd:' + email)) return res.status(200).json({ sent: true, magic: true, throttled: true });
    await kv.set('magiccd:' + email, 1, { ex: 30 });
  } catch (e) {}

  const token = makeToken();
  try {
    await kv.set('magic:' + token, { email, at: Date.now() }, { ex: 900 });
  } catch (e) {
    console.error('kv set magic failed:', e && e.message);
    return res.status(500).json({ error: 'Could not start sign-in' });
  }

  const base = (process.env.APP_URL || ('https://' + req.headers.host)).replace(/\/$/, '');
  const link = base + '/api/auth-verify?token=' + encodeURIComponent(token);
  const from = process.env.AUTH_FROM_EMAIL || 'Gideon <onboarding@resend.dev>';

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;padding:28px;color:#0E2748">' +
      '<div style="font-size:18px;font-weight:800;color:#0A4FB0;letter-spacing:.4px">GDN &middot; GIDEON</div>' +
      '<h1 style="font-size:20px;color:#0E2748;margin:18px 0 8px">Your secure sign-in link</h1>' +
      '<p style="color:#5C7393;line-height:1.6;margin:0 0 22px">Click the button below to sign in to Gideon. ' +
      'This link works once and expires in 15 minutes. If you did not request it, you can safely ignore this email.</p>' +
      '<a href="' + link + '" style="display:inline-block;background:#0A4FB0;color:#fff;text-decoration:none;' +
      'font-weight:700;padding:13px 26px;border-radius:8px">Sign in to Gideon</a>' +
      '<p style="color:#90A4BE;font-size:12px;line-height:1.6;margin:24px 0 0">Or paste this link into your browser:<br>' + link + '</p>' +
      '<p style="color:#90A4BE;font-size:11px;margin:22px 0 0">GDN Enterprise Pty Ltd &middot; Brisbane &middot; Dubai &middot; Orlando &middot; Sao Paulo</p>' +
    '</div>';

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: email, subject: 'Your Gideon sign-in link', html })
    });
    if (!r.ok) {
      console.error('Resend error', r.status, await r.text());
      return res.status(502).json({ error: 'Could not send the sign-in email' });
    }
  } catch (e) {
    console.error('Resend fetch failed:', e && e.message);
    return res.status(502).json({ error: 'Could not send the sign-in email' });
  }

  return res.status(200).json({ sent: true, magic: true });
}
