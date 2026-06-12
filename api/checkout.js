import Stripe from 'stripe';

// Only these price IDs may be charged. From your Stripe products.
const ALLOWED = new Set([
  'price_1TczRdFDVJ23RHCnpLU6lkAf', // Gideon Simple Access - monthly
  'price_1TczW2FDVJ23RHCnwRGRc2Kf', // Gideon Simple Access - annual
  'price_1TczVZFDVJ23RHCnhSs461kt', // Gideon Professional - monthly

  'price_1TczVZFDVJ23RHCn8bJl925S',  // Gideon Professional - annual
  'price_1Td6sTFDVJ23RHCn3pOpFSx8', // Meeting Room Access - daily (one-time)
  'price_1Td6vUFDVJ23RHCnFN69OQMb' // Meeting Room Access - monthly (one-time)
]);

// One-time Meeting Room passes are charged as a single payment, not a subscription.
// One-time prices use Stripe 'payment' mode; recurring prices use 'subscription'.
// The daily Meeting Room pass is one-time; the monthly pass is a recurring subscription.
const ONE_TIME_PRICES = new Set(['price_1Td6sTFDVJ23RHCn3pOpFSx8']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const key = (process.env.STRIPE_SECRET_KEY || '').trim();
  if (!key) {
    console.error('STRIPE_SECRET_KEY is missing or empty at runtime');
    return res.status(500).json({ error: 'Stripe is not configured (missing secret key).' });
  }

  const body = req.body || {};
  const priceId = body.priceId;
  const email = body.email;
  if (!ALLOWED.has(priceId)) return res.status(400).json({ error: 'Unknown price' });

  try {
    const stripe = new Stripe(key);
    const base = process.env.PUBLIC_BASE_URL || ('https://' + req.headers.host);
    // Meeting Room pass purchases redirect to the room, not the Gideon portal.
    // ONE_TIME_PRICES covers the daily pass; the monthly pass is a subscription
    // so its price ID is listed explicitly here. Add any new pass IDs to this check.
    const session = await stripe.checkout.sessions.create({
      mode: ONE_TIME_PRICES.has(priceId) ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: (ONE_TIME_PRICES.has(priceId) || priceId === 'price_1Td6vUFDVJ23RHCnFN69OQMb') ? base + '/gdn-ai-meeting-room.html?paid=1&session_id={CHECKOUT_SESSION_ID}' : base + '/gdn-ai-portal.html?paid=1&session_id={CHECKOUT_SESSION_ID}',
      cancel_url: base + '/gdn-ai-membership-portal.html?canceled=1',
      allow_promotion_codes: true
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout error:', e && e.message, e && e.type);
    return res.status(500).json({ error: 'Checkout failed', detail: (e && e.message) || 'unknown' });
  }
}
