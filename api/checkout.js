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
const PASS_PRICES = new Set(['price_1Td6sTFDVJ23RHCn3pOpFSx8', 'price_1Td6vUFDVJ23RHCnFN69OQMb']);

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
    const session = await stripe.checkout.sessions.create({
      mode: PASS_PRICES.has(priceId) ? 'payment' : 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email || undefined,
      success_url: base + '/gdn-ai-portal.html?paid=1',
      cancel_url: base + '/gdn-ai-membership-portal.html?canceled=1',
      allow_promotion_codes: true
    });
    return res.status(200).json({ url: session.url });
  } catch (e) {
    console.error('Stripe checkout error:', e && e.message, e && e.type);
    return res.status(500).json({ error: 'Checkout failed', detail: (e && e.message) || 'unknown' });
  }
}
