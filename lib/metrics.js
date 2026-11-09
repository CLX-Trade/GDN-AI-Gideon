// First-party funnel counters. They need no cookie or consent because they count
// events, not people, and they survive ad blockers because they run on the server.
// Never let a metrics failure affect the request that triggered it.
import { store } from './deps.js';
import { today } from './http.js';

const KEEP_SECONDS = 60 * 60 * 24 * 120;

export async function metric(name, n = 1) {
  try {
    const key = `m:${today()}:${name}`;
    const value = await store().incrby(key, n);
    if (value === n) await store().expire(key, KEEP_SECONDS);
  } catch (e) {
    console.warn('metric failed', name, e && e.message);
  }
}

export async function readMetrics(day, names) {
  const out = {};
  await Promise.all(names.map(async (name) => {
    try { out[name] = Number(await store().get(`m:${day}:${name}`)) || 0; }
    catch { out[name] = null; }
  }));
  return out;
}

export const FUNNEL = [
  'trial_chat', 'trial_pack', 'paywall_hit', 'trial_busy',
  'member_chat', 'member_pack', 'quota_hit',
  'checkout_started', 'checkout_paid',
  'login_requested', 'login_completed',
  'lead_pilot', 'lead_enterprise', 'lead_investor', 'lead_other',
  'talk_session', 'voice_turn',
  'voucher_redeemed', 'ai_error', 'store_error',
];
