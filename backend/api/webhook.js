import Stripe from 'stripe';
import { kv } from '@vercel/kv';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw body to verify the signature.
export const config = { api: { bodyParser: false } };

function readRaw(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  let event;
  try {
    const raw = await readRaw(req);
    const sig = req.headers['stripe-signature'];
    event = stripe.webhooks.constructEvent(raw, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('Webhook signature verification failed:', e.message);
    return res.status(400).send('Bad signature');
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const s = event.data.object;
      const email = (s.customer_email || (s.customer_details && s.customer_details.email) || '').toLowerCase();
      if (email) await kv.set('member:' + email, true);
        try { const amt = s.amount_total || 0; const proTier = (amt === 21000 || amt === 176400); if (email) await kv.set('tier:' + email, proTier ? 'professional' : 'simple'); } catch (e) {}
    }
    if (event.type === 'customer.subscription.deleted') {
      // To revoke on cancellation, look up the customer email via the Stripe API
      // using event.data.object.customer, then kv.del('member:' + email).
    }
  } catch (e) {
    console.error('Webhook handling error:', e);
  }
  return res.status(200).json({ received: true });
}
