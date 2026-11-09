// What GDN sells. Amounts are in AUD and were read off the live Stripe checkout
// pages on 9 Nov 2026; the daily digest re-checks them against Stripe and flags
// any drift, so this table and the dashboard cannot quietly disagree.
export const PLANS = {
  'simple-monthly': { price: 'price_1TczRdFDVJ23RHCnpLU6lkAf', kind: 'membership', tier: 'simple', mode: 'subscription', amount: 60, label: 'Simple, monthly' },
  'simple-annual': { price: 'price_1TczW2FDVJ23RHCnwRGRc2Kf', kind: 'membership', tier: 'simple', mode: 'subscription', amount: 504, label: 'Simple, annual' },
  'pro-monthly': { price: 'price_1TczVZFDVJ23RHCnhSs461kt', kind: 'membership', tier: 'pro', mode: 'subscription', amount: 210, label: 'Professional, monthly' },
  'pro-annual': { price: 'price_1TczVZFDVJ23RHCn8bJl925S', kind: 'membership', tier: 'pro', mode: 'subscription', amount: 1764, label: 'Professional, annual' },
  'room-day': { price: 'price_1Td6sTFDVJ23RHCn3pOpFSx8', kind: 'pass', pass: 'daily', mode: 'payment', amount: 26, label: 'Meeting Room day pass' },
  'room-month': { price: 'price_1Td6vUFDVJ23RHCnFN69OQMb', kind: 'pass', pass: 'monthly', mode: 'subscription', amount: 85, label: 'Meeting Room monthly pass' },
};

export const CURRENCY = 'AUD';

// A query is one chat message, or one document in a pack check.
export const TIERS = {
  simple: { label: 'Simple', monthlyQueries: 100, maxDocsPerPack: 5 },
  pro: { label: 'Professional', monthlyQueries: 1000, maxDocsPerPack: 20 },
  voucher: { label: 'Access code', monthlyQueries: 100, maxDocsPerPack: 5 },
};

export const TRIAL = {
  queries: () => parseInt(process.env.FREE_TRIAL_LIMIT || '3', 10),
  maxDocsPerPack: 3,
  perIpPerDay: () => parseInt(process.env.TRIAL_IP_DAILY_LIMIT || '9', 10),
  globalPerDay: () => parseInt(process.env.TRIAL_GLOBAL_DAILY_LIMIT || '200', 10),
};

export function planForPrice(priceId) {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.price === priceId) return { key, ...plan };
  }
  return null;
}
