// Starts a Stripe Checkout, or opens the Stripe billing portal for an existing
// customer (?action=portal). The browser only ever names a plan key: which price
// that maps to is decided here.
import { json, query, originAllowed, isEmail, normalEmail, baseUrl, parseCookies, ipHash } from '../lib/http.js';
import { PLANS, planForPrice } from '../lib/plans.js';
import { stripe } from '../lib/deps.js';
import { readEmail } from '../lib/session.js';
import { rateLimit } from '../lib/quota.js';
import { metric } from '../lib/metrics.js';
import { findCustomerIds } from '../lib/entitlement.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });
  if (query(req).get('action') === 'portal') return portal(req, res);
  return checkout(req, res);
}

async function checkout(req, res) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const key = typeof body.plan === 'string' ? body.plan : null;
  const plan = key && Object.hasOwn(PLANS, key)
    ? { key, ...PLANS[key] }
    : planForPrice(body.priceId); // older cached pages still post a price id
  if (!plan) return json(res, 400, { error: 'Unknown plan' });

  try {
    if (!(await rateLimit('checkout', ipHash(req), 20, 600))) return json(res, 429, { error: 'Too many attempts. Please wait a few minutes.' });
  } catch { /* never block a sale because the limiter is down */ }

  const typed = normalEmail(body.email);
  const signedIn = readEmail(parseCookies(req));
  const email = signedIn || (isEmail(typed) ? typed : undefined);
  const ref = String(body.ref || '').replace(/[^\w.:/-]/g, '').slice(0, 120);
  const base = baseUrl(req);

  try {
    const session = await stripe().checkout.sessions.create({
      mode: plan.mode,
      line_items: [{ price: plan.price, quantity: 1 }],
      customer_email: email,
      allow_promotion_codes: true,
      success_url: `${base}/api/auth?action=complete&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${base}/pricing?checkout=canceled`,
      metadata: { plan: plan.key, ref },
      ...(plan.mode === 'subscription' ? { subscription_data: { metadata: { plan: plan.key, ref } } } : {}),
    });
    await metric('checkout_started');
    return json(res, 200, { url: session.url });
  } catch (e) {
    console.error('checkout failed', e && e.type, e && e.message);
    return json(res, 502, { error: 'Checkout could not start. Please try again, or email gnardo@gdngroup.com.au.' });
  }
}

async function portal(req, res) {
  const email = readEmail(parseCookies(req));
  if (!email) return json(res, 401, { error: 'Please sign in first.' });
  try {
    const customerIds = await findCustomerIds(email);
    if (!customerIds.length) return json(res, 404, { error: 'No billing account found for this email.', code: 'no_customer' });
    const session = await stripe().billingPortal.sessions.create({ customer: customerIds[0], return_url: `${baseUrl(req)}/app` });
    return json(res, 200, { url: session.url });
  } catch (e) {
    console.error('billing portal failed', e && e.message);
    return json(res, 502, { error: 'The billing page is unavailable. Email gnardo@gdngroup.com.au and we will change or cancel your plan.', code: 'portal_unavailable' });
  }
}
