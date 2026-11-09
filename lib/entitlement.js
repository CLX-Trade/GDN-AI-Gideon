// Who has paid for what.
//
// Stripe is the source of truth and Redis is a cache in front of it. The old
// design stored a permanent member flag in Redis and nothing else, so when that
// database was uninstalled on 16 Oct 2026 every paying customer would have lost
// access, and every later payment was silently dropped. With Stripe as the truth,
// a member whose cache is empty or unreachable is simply looked up again, and a
// cancelled subscription drops out within CACHE_SECONDS even if its webhook is
// missed.
import { store, stripe } from './deps.js';
import { planForPrice, TIERS } from './plans.js';

const CACHE_SECONDS = 60 * 60;
const NEGATIVE_CACHE_SECONDS = 60 * 5;
const LIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

function key(email) { return `ent:${email}`; }

export function cacheKey(email) { return key(email); }

const safeSearchValue = (value) => value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export async function rememberCustomer(email, customerId) {
  await store().set(`cust:${email}`, customerId);
}

// Every Stripe customer id for an address. customers.list is case-sensitive on email,
// and people type "John@Company.com" at checkout while we sign them in as lower case,
// so a plain list would lose a paying customer the moment the cache expired. Search is
// case-insensitive but can lag by a minute, which the remembered id covers.
export async function findCustomerIds(email) {
  const ids = new Set();
  try {
    const remembered = await store().get(`cust:${email}`);
    if (remembered) ids.add(remembered);
  } catch (e) {
    console.error('customer id cache read failed', e && e.message);
  }
  const listed = await stripe().customers.list({ email, limit: 10 });
  listed.data.forEach((c) => ids.add(c.id));
  if (!ids.size) {
    const found = await stripe().customers.search({ query: `email:'${safeSearchValue(email)}'`, limit: 10 });
    found.data.forEach((c) => ids.add(c.id));
  }
  return [...ids];
}

async function lookUpInStripe(email) {
  let best = null;
  for (const customerId of await findCustomerIds(email)) {
    const subs = await stripe().subscriptions.list({ customer: customerId, status: 'all', limit: 20 });
    for (const sub of subs.data) {
      if (!LIVE_STATUSES.has(sub.status)) continue;
      for (const item of sub.items.data) {
        const plan = planForPrice(item.price && item.price.id);
        if (!plan || plan.kind !== 'membership') continue;
        if (!best || plan.tier === 'pro') best = { tier: plan.tier, source: 'stripe', plan: plan.key, customer: customerId };
      }
    }
  }
  return best;
}

// Returns { tier, source, until? } or null. Throws only if both Redis and Stripe
// are unreachable; callers decide what that means for them.
export async function getEntitlement(email) {
  if (!email) return null;
  let cached;
  try {
    cached = await store().get(key(email));
    if (cached && cached.none) return null;
    if (cached && cached.tier) {
      if (cached.until && cached.until < Date.now()) cached = null;
      else return cached;
    }
  } catch (e) {
    console.error('entitlement cache read failed', e && e.message);
  }

  const found = await lookUpInStripe(email);
  try {
    if (found) await store().set(key(email), found, { ex: CACHE_SECONDS });
    else await store().set(key(email), { none: true }, { ex: NEGATIVE_CACHE_SECONDS });
  } catch (e) {
    console.error('entitlement cache write failed', e && e.message);
  }
  return found;
}

export async function grantMembership(email, plan, customer) {
  const value = { tier: plan.tier, source: 'stripe', plan: plan.key, customer: customer || null };
  await store().set(key(email), value, { ex: CACHE_SECONDS });
  return value;
}

// Access codes live only in Redis, with their own expiry.
export async function grantVoucher(email, days) {
  const until = Date.now() + days * 86400000;
  const value = { tier: 'voucher', source: 'voucher', until };
  await store().set(key(email), value, { ex: days * 86400 });
  return value;
}

export async function forgetEntitlement(email) {
  await store().del(key(email));
}

export function tierInfo(entitlement) {
  return entitlement ? TIERS[entitlement.tier] || TIERS.simple : null;
}
