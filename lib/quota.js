// Spend control: who may make a paid model call right now, atomically.
//
// Counters are incremented BEFORE the model call and handed back if the call
// fails, so several requests sent at once cannot overshoot a limit. The trial
// fails closed when Redis is down, because an open trial with a dead counter is
// exactly how Gideon gave away unlimited free AI from 16 Oct to 9 Nov 2026.
// Paying members fail open: they have paid, and a Redis outage is our problem.
import { store } from './deps.js';
import { TRIAL } from './plans.js';
import { today, thisMonth } from './http.js';
import { tierInfo } from './entitlement.js';

const MONTH_SECONDS = 60 * 60 * 24 * 40;
const DAY_SECONDS = 60 * 60 * 26;
const TRIAL_KEEP_SECONDS = 60 * 60 * 24 * 90;

async function incrementWithExpiry(key, n, seconds) {
  const value = await store().incrby(key, n);
  if (value === n) await store().expire(key, seconds);
  return value;
}

// A fixed-window limiter. Returns true when the action is allowed.
export async function rateLimit(name, id, max, windowSeconds) {
  const window = Math.floor(Date.now() / 1000 / windowSeconds);
  const key = `rl:${name}:${id}:${window}`;
  const value = await incrementWithExpiry(key, 1, windowSeconds + 5);
  return value <= max;
}

// Identity is { email, entitlement } for members or { sid, ipHash } for the trial.
export async function consume(identity, n = 1) {
  if (identity.entitlement) return consumeMember(identity, n);
  return consumeTrial(identity, n);
}

async function consumeMember({ email, entitlement }, n) {
  const limit = tierInfo(entitlement).monthlyQueries;
  const key = `usage:${email}:${thisMonth()}`;
  try {
    const used = await incrementWithExpiry(key, n, MONTH_SECONDS);
    if (used > limit) {
      await store().decrby(key, n);
      return { ok: false, reason: 'quota', used: used - n, limit };
    }
    return { ok: true, used, limit };
  } catch (e) {
    console.error('member quota store failed, allowing', e && e.message);
    return { ok: true, used: null, limit, degraded: true };
  }
}

async function consumeTrial({ sid, ipHash }, n) {
  const limit = TRIAL.queries();
  const trialKey = `trial:${sid}`;
  const ipKey = `trialip:${ipHash}:${today()}`;
  const dayKey = `trialday:${today()}`;
  try {
    const used = await incrementWithExpiry(trialKey, n, TRIAL_KEEP_SECONDS);
    if (used > limit) {
      await store().decrby(trialKey, n);
      return { ok: false, reason: 'paywall', used: used - n, limit };
    }
    const ipUsed = await incrementWithExpiry(ipKey, n, DAY_SECONDS);
    if (ipUsed > TRIAL.perIpPerDay()) {
      await store().decrby(trialKey, n);
      await store().decrby(ipKey, n);
      return { ok: false, reason: 'paywall', used: limit, limit };
    }
    const dayUsed = await incrementWithExpiry(dayKey, n, DAY_SECONDS);
    if (dayUsed > TRIAL.globalPerDay()) {
      await store().decrby(trialKey, n);
      await store().decrby(ipKey, n);
      await store().decrby(dayKey, n);
      return { ok: false, reason: 'busy', used: used - n, limit };
    }
    return { ok: true, used, limit };
  } catch (e) {
    console.error('trial quota store failed, refusing', e && e.message);
    return { ok: false, reason: 'unavailable', used: null, limit };
  }
}

// Hand queries back when the model call failed, so nobody pays for our outage.
export async function refund(identity, n = 1) {
  try {
    if (identity.entitlement) {
      await store().decrby(`usage:${identity.email}:${thisMonth()}`, n);
    } else {
      await store().decrby(`trial:${identity.sid}`, n);
      await store().decrby(`trialip:${identity.ipHash}:${today()}`, n);
      await store().decrby(`trialday:${today()}`, n);
    }
  } catch (e) {
    console.error('refund failed', e && e.message);
  }
}

export async function currentUsage(identity) {
  if (identity.entitlement) {
    const limit = tierInfo(identity.entitlement).monthlyQueries;
    try {
      return { used: Number(await store().get(`usage:${identity.email}:${thisMonth()}`)) || 0, limit };
    } catch {
      return { used: null, limit };
    }
  }
  const limit = TRIAL.queries();
  if (!identity.sid) return { used: 0, limit };
  try {
    return { used: Number(await store().get(`trial:${identity.sid}`)) || 0, limit };
  } catch {
    return { used: null, limit };
  }
}
