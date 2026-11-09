// Sign-in, sign-out, and the buyer's return from Stripe Checkout.
//
//   POST ?action=login     {email}   emails a one-time link
//   POST ?action=verify    {token}   exchanges the link for a session
//   POST ?action=logout
//   GET  ?action=complete&session_id=...   Stripe success_url
//
// The emailed link opens /signin, where the visitor presses a button to POST the
// token. A direct GET would let corporate mail scanners (Outlook Safe Links and the
// like) burn the single-use token before the person ever clicks.
import crypto from 'node:crypto';
import { json, redirect, addCookie, query, originAllowed, isEmail, normalEmail, randomToken, baseUrl, ipHash } from '../lib/http.js';
import { sessionCookie, clearSessionCookie, sessionConfigured } from '../lib/session.js';
import { store, stripe } from '../lib/deps.js';
import { rateLimit } from '../lib/quota.js';
import { metric } from '../lib/metrics.js';
import { sendEmail, emailShell } from '../lib/email.js';
import { fulfilCheckoutSession, isPaid, sessionEmail, planOfSession } from '../lib/fulfil.js';
import { getEntitlement } from '../lib/entitlement.js';

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');
const LINK_SECONDS = 900;

export default async function handler(req, res) {
  const action = query(req).get('action');
  if (action === 'complete' && req.method === 'GET') return complete(req, res);
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });
  if (action === 'login') return login(req, res);
  if (action === 'verify') return verify(req, res);
  if (action === 'logout') { addCookie(res, clearSessionCookie()); return json(res, 200, { ok: true }); }
  return json(res, 400, { error: 'Unknown action' });
}

export async function sendSignInLink(req, email) {
  const token = randomToken(32);
  await store().set(`magic:${hash(token)}`, { email }, { ex: LINK_SECONDS });
  const link = `${baseUrl(req)}/signin?token=${encodeURIComponent(token)}`;
  await sendEmail({
    to: email,
    subject: 'Your Gideon sign-in link',
    html: emailShell('Your sign-in link', `<p style="color:#4b5361;line-height:1.6;margin:0 0 22px">This link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.</p>
<a href="${link}" style="display:inline-block;background:#1f6bff;color:#fff;text-decoration:none;font-weight:700;padding:13px 26px;border-radius:8px">Sign in to Gideon</a>`),
  });
}

async function login(req, res) {
  const email = normalEmail(req.body && req.body.email);
  if (!isEmail(email)) return json(res, 400, { error: 'Please enter a valid email address.' });
  if (!sessionConfigured()) return json(res, 503, { error: 'Sign-in is unavailable right now. Please email gnardo@gdngroup.com.au.' });

  try {
    if (!(await rateLimit('login', ipHash(req), 8, 600))) return json(res, 429, { error: 'Too many attempts. Please wait a few minutes.' });
    const fresh = await store().set(`magiccd:${email}`, 1, { nx: true, ex: 30 });
    // The same answer whether this address is a member or not, so the form cannot
    // be used to discover who the customers are.
    if (fresh !== 'OK') return json(res, 200, { sent: true });
    await sendSignInLink(req, email);
    await metric('login_requested');
    return json(res, 200, { sent: true });
  } catch (e) {
    console.error('login failed', e && e.message);
    await metric('store_error');
    return json(res, 503, { error: 'We could not send your sign-in link. Please try again, or email gnardo@gdngroup.com.au.' });
  }
}

async function verify(req, res) {
  const token = String((req.body && req.body.token) || '');
  if (!token) return json(res, 400, { error: 'This link is not valid.', code: 'invalid' });
  let record = null;
  try {
    record = await store().get(`magic:${hash(token)}`);
    if (record) await store().del(`magic:${hash(token)}`);
  } catch (e) {
    console.error('verify failed', e && e.message);
    return json(res, 503, { error: 'Sign-in is unavailable right now. Please try again shortly.' });
  }
  if (!record || !record.email) return json(res, 400, { error: 'This link has expired or was already used. Please request a new one.', code: 'expired' });

  addCookie(res, sessionCookie(record.email));
  await metric('login_completed');
  let member = false;
  try { member = Boolean(await getEntitlement(record.email)); } catch { /* the app re-checks */ }
  return json(res, 200, { ok: true, email: record.email, member });
}

// The session id is unguessable and only reaches the buyer's browser, so holding one
// proves this browser just completed that checkout. It signs them in on the spot,
// which is what makes paying lead straight into the product. Used once only: a
// shared or logged URL must not become a permanent way in.
async function complete(req, res) {
  const id = query(req).get('session_id') || '';
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return redirect(res, '/pricing?checkout=invalid');

  let session;
  try {
    session = await stripe().checkout.sessions.retrieve(id);
  } catch (e) {
    console.error('checkout session lookup failed', e && e.message);
    return redirect(res, '/signin?checkout=pending');
  }
  if (!isPaid(session)) return redirect(res, '/pricing?checkout=unpaid');

  let plan = null;
  let fulfilled = true;
  try {
    ({ plan } = await fulfilCheckoutSession(session));
  } catch (e) {
    // The webhook retries this. Membership still resolves from Stripe directly.
    fulfilled = false;
    console.error('fulfil on return failed', e && e.message);
    try { plan = await planOfSession(session); } catch { /* handled below */ }
  }

  let firstUse = true;
  try {
    firstUse = (await store().set(`csused:${id}`, 1, { nx: true, ex: 60 * 60 * 24 * 7 })) === 'OK';
  } catch (e) {
    console.error('single-use check failed', e && e.message);
  }

  const email = sessionEmail(session);
  if (firstUse && email && sessionConfigured()) addCookie(res, sessionCookie(email));

  const isPass = plan && plan.kind === 'pass';
  const params = new URLSearchParams({ welcome: plan ? plan.key : 'member' });
  if (firstUse) {
    if (typeof session.amount_total === 'number') params.set('v', (session.amount_total / 100).toFixed(2));
    params.set('tid', id.slice(-16));
  }
  if (!fulfilled) params.set('pending', '1');
  return redirect(res, `${isPass ? '/meeting-room' : '/app'}?${params}`);
}
