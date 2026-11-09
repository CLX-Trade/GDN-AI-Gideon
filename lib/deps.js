// Single place that builds the three external clients, so tests and the local
// dev server can swap them without any request-handling code knowing.
import Anthropic from '@anthropic-ai/sdk';
import Stripe from 'stripe';
import { Redis } from '@upstash/redis';

let overrides = {};
let cached = {};

export function setDepsForTest(next) {
  overrides = next || {};
  cached = {};
}

export function store() {
  if (overrides.store) return overrides.store;
  if (!cached.store) {
    const url = (process.env.KV_REST_API_URL || '').trim();
    const token = (process.env.KV_REST_API_TOKEN || '').trim();
    if (!url || !token) throw new Error('KV_REST_API_URL / KV_REST_API_TOKEN are not set');
    cached.store = new Redis({ url, token, retry: { retries: 1 } });
  }
  return cached.store;
}

export function stripe() {
  if (overrides.stripe) return overrides.stripe;
  if (!cached.stripe) {
    const key = (process.env.STRIPE_SECRET_KEY || '').trim();
    if (!key) throw new Error('STRIPE_SECRET_KEY is not set');
    cached.stripe = new Stripe(key);
  }
  return cached.stripe;
}

export function anthropic() {
  if (overrides.anthropic) return overrides.anthropic;
  if (!cached.anthropic) {
    cached.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 });
  }
  return cached.anthropic;
}

// Outbound email is injectable too, so tests can assert on what would be sent.
export function emailSender() {
  return overrides.sendEmail || null;
}
