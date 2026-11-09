// Signed sign-in cookie.
//
// The cookie is "<base64url email>.<expiry seconds>.<hmac>". Before this the
// cookie was the bare email address, so sending Cookie: gid_email=<a member's
// address> was full impersonation. Every identity read goes through readEmail().
//
// Key material: SESSION_SECRET if set, otherwise a key derived from
// STRIPE_WEBHOOK_SECRET through HMAC with a fixed label, which can never be
// worked back to the Stripe secret. With neither, everyone is anonymous; the raw
// cookie is never trusted.
import crypto from 'node:crypto';
import { serializeCookie, randomToken } from './http.js';

const COOKIE = 'gid_session';
const SID_COOKIE = 'gid_sid';
const SESSION_SECONDS = 60 * 60 * 24 * 90;

function signingKey() {
  const direct = (process.env.SESSION_SECRET || '').trim();
  if (direct) return direct;
  const base = (process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  if (!base) return '';
  return crypto.createHmac('sha256', base).update('gideon-session-v2').digest('hex');
}

function mac(payload, key) {
  return crypto.createHmac('sha256', key).update(payload).digest('base64url');
}

export function sessionConfigured() {
  return signingKey() !== '';
}

export function sessionCookie(email, now = Date.now()) {
  const key = signingKey();
  if (!key) throw new Error('No session signing key');
  const clean = String(email).trim().toLowerCase();
  const exp = Math.floor(now / 1000) + SESSION_SECONDS;
  const payload = `${Buffer.from(clean).toString('base64url')}.${exp}`;
  return serializeCookie(COOKIE, `${payload}.${mac(payload, key)}`, { maxAge: SESSION_SECONDS });
}

export function clearSessionCookie() {
  return serializeCookie(COOKIE, '', { maxAge: 0 });
}

export function readEmail(cookies, now = Date.now()) {
  const raw = cookies && cookies[COOKIE];
  const key = signingKey();
  if (!raw || !key) return null;
  const parts = String(raw).split('.');
  if (parts.length !== 3) return null;
  const [b64, exp, sig] = parts;
  const given = Buffer.from(sig);
  const want = Buffer.from(mac(`${b64}.${exp}`, key));
  if (given.length !== want.length || !crypto.timingSafeEqual(given, want)) return null;
  if (!/^\d+$/.test(exp) || Number(exp) * 1000 < now) return null;
  try {
    const email = Buffer.from(b64, 'base64url').toString('utf8');
    return email.includes('@') ? email : null;
  } catch {
    return null;
  }
}

// Anonymous visitor id used to count free-trial queries. Returns the id and,
// when a new one was minted, the cookie that must be set before the body starts.
export function readOrMintSid(cookies) {
  const existing = cookies && cookies[SID_COOKIE];
  if (existing && /^[A-Za-z0-9_-]{16,64}$/.test(existing)) return { sid: existing, setCookie: null };
  const sid = randomToken(18);
  return { sid, setCookie: serializeCookie(SID_COOKIE, sid, { maxAge: 60 * 60 * 24 * 365 }) };
}
