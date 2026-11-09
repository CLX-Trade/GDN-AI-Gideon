// Small request/response helpers shared by every endpoint.
import crypto from 'node:crypto';

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export function redirect(res, location, status = 302) {
  res.statusCode = status;
  res.setHeader('Location', location);
  res.setHeader('Cache-Control', 'no-store');
  res.end();
}

// Set-Cookie accumulates: a single response can set both a session and a sid.
export function addCookie(res, value) {
  const existing = res.getHeader('Set-Cookie');
  if (!existing) res.setHeader('Set-Cookie', value);
  else res.setHeader('Set-Cookie', Array.isArray(existing) ? [...existing, value] : [existing, value]);
}

export function parseCookies(req) {
  const out = {};
  const header = req.headers && req.headers.cookie;
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!name || name in out) continue;
    let value = part.slice(eq + 1).trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    try { out[name] = decodeURIComponent(value); } catch { out[name] = value; }
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, httpOnly = true } = {}) {
  let s = `${name}=${encodeURIComponent(value)}; Path=/; Secure; SameSite=Lax`;
  if (httpOnly) s += '; HttpOnly';
  if (typeof maxAge === 'number') s += `; Max-Age=${Math.floor(maxAge)}`;
  return s;
}

export function query(req) {
  try { return new URL(req.url, 'https://local').searchParams; }
  catch { return new URLSearchParams(); }
}

export function baseUrl(req) {
  const fixed = (process.env.PUBLIC_BASE_URL || '').trim().replace(/\/$/, '');
  if (fixed) return fixed;
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
  const proto = host.startsWith('localhost') || host.startsWith('127.') ? 'http' : 'https';
  return `${proto}://${host}`;
}

// Cross-site browsers are already stopped by SameSite=Lax. This additionally
// rejects other websites calling our paid endpoints from their own pages.
export function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true; // same-origin navigations and server-to-server calls
  try {
    const originHost = new URL(origin).host;
    const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toString().split(',')[0].trim();
    return originHost === host;
  } catch {
    return false;
  }
}

export function clientIp(req) {
  const h = req.headers;
  const raw = h['x-real-ip'] || h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || '';
  return raw.toString().split(',')[0].trim() || 'unknown';
}

// IPs are only ever stored as a keyed hash: we need "same visitor", not "who".
export function ipHash(req) {
  const salt = process.env.SESSION_SECRET || process.env.STRIPE_WEBHOOK_SECRET || 'gideon';
  return crypto.createHmac('sha256', salt).update(clientIp(req)).digest('base64url').slice(0, 22);
}

export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function isEmail(value) {
  const s = String(value || '').trim();
  return s.length <= 254 && /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[^\s@<>"',;]{2,}$/.test(s);
}

export function normalEmail(value) {
  return String(value || '').trim().toLowerCase();
}

export function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

export function thisMonth(now = new Date()) {
  return now.toISOString().slice(0, 7);
}
