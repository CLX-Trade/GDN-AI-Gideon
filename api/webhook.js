// Stripe events. A failure here returns 500 so Stripe retries. The old handler caught
// every error and answered 200, so when the database died, payments were reported
// as delivered while the customer received nothing.
import { stripe, store } from '../lib/deps.js';
import { fulfilCheckoutSession, isPaid } from '../lib/fulfil.js';
import { forgetEntitlement } from '../lib/entitlement.js';
import { planForPrice } from '../lib/plans.js';
import { readPass, writePass } from '../lib/pass.js';

export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

async function emailForCustomer(customerId) {
  if (!customerId) return '';
  const customer = await stripe().customers.retrieve(customerId);
  return customer && !customer.deleted && customer.email ? customer.email.toLowerCase() : '';
}

function subscriptionPlan(subscription) {
  for (const item of (subscription.items && subscription.items.data) || []) {
    const plan = planForPrice(item.price && item.price.id);
    if (plan) return plan;
  }
  return null;
}

export async function handleEvent(event) {
  const object = event.data.object;
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded':
      if (isPaid(object)) await fulfilCheckoutSession(object);
      return;

    case 'invoice.payment_succeeded': {
      // A monthly Meeting Room renewal restores its four sessions. The first invoice
      // is skipped because checkout.session.completed already issued that pass.
      if (object.billing_reason !== 'subscription_cycle') return;
      const email = (object.customer_email || '').toLowerCase() || await emailForCustomer(object.customer);
      if (!email) return;
      const pass = await readPass(email);
      if (pass && pass.type === 'monthly') await writePass(email, { ...pass, startedAt: null, passesRemaining: 4 });
      return;
    }

    case 'invoice.payment_failed': {
      // Stripe retries on its own schedule and cancels if the card never recovers,
      // which arrives below. One failed charge is not a cancellation.
      console.warn('Payment failed', { invoice: object.id, attempt: object.attempt_count });
      return;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const email = await emailForCustomer(object.customer);
      if (!email) return;
      // Drop the cache: the next request re-reads the truth from Stripe.
      await forgetEntitlement(email);
      if (event.type === 'customer.subscription.deleted') {
        const plan = subscriptionPlan(object);
        if (plan && plan.pass === 'monthly') await store().del(`pass:${email}`);
      }
      return;
    }

    default:
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  let event;
  try {
    const raw = await readRaw(req);
    event = stripe().webhooks.constructEvent(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature rejected:', e && e.message);
    res.statusCode = 400;
    return res.end('Bad signature');
  }
  try {
    await handleEvent(event);
  } catch (e) {
    console.error('Webhook handling failed, Stripe will retry', event.type, e && e.message);
    res.statusCode = 500;
    return res.end('Retry');
  }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  return res.end('{"received":true}');
}
