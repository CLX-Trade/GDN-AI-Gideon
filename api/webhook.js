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
      if (email) {
        // Determine whether this purchase was a Meeting Room pass (one-time) or a membership.
        const DAILY = 'price_1Td6sTFDVJ23RHCn3pOpFSx8';
        const MONTHLY = 'price_1Td6vUFDVJ23RHCnFN69OQMb';
        let passType = null;
        try {
          const items = await stripe.checkout.sessions.listLineItems(s.id, { limit: 1 });
          const priceId = items && items.data && items.data[0] && items.data[0].price && items.data[0].price.id;
          if (priceId === DAILY) passType = 'daily';
          else if (priceId === MONTHLY) passType = 'monthly';
        } catch (e) { console.error('listLineItems failed:', e && e.message); }
        if (passType) {
          await kv.set('pass:' + email, {
            type: passType,
            purchasedAt: Date.now(),
            startedAt: null,
            passesRemaining: passType === 'monthly' ? 4 : 1
          });
        } else {
          await kv.set('member:' + email, true);
        }
      }
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
