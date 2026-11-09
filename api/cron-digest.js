// Runs every morning. Tests the things that must work and emails the numbers, so a
// dead database can never again go unnoticed for 24 days.
import { store, stripe, anthropic } from '../lib/deps.js';
import { MODEL } from '../lib/claude.js';
import { PLANS, CURRENCY } from '../lib/plans.js';
import { FUNNEL, readMetrics } from '../lib/metrics.js';
import { sendEmail, emailShell, escapeHtml, OWNER_EMAIL } from '../lib/email.js';
import { json, today } from '../lib/http.js';

// Opus 5.5 list prices in US dollars. A guide to margin, not an invoice.
const COST = { input: 4 / 1e6, output: 20 / 1e6, search: 10 / 1000 };

async function attempt(name, fn) {
  try {
    const detail = await fn();
    return { name, ok: true, detail: detail || 'OK' };
  } catch (e) {
    return { name, ok: false, detail: (e && e.message) || 'failed' };
  }
}

export async function runHealthChecks() {
  return Promise.all([
    attempt('Database', async () => {
      const key = `health:${Date.now()}`;
      await store().set(key, 1, { ex: 60 });
      if (Number(await store().get(key)) !== 1) throw new Error('read back failed');
    }),
    attempt('Claude', async () => { await anthropic().models.retrieve(MODEL()); return MODEL(); }),
    attempt('Stripe prices', async () => {
      const drift = [];
      for (const [key, plan] of Object.entries(PLANS)) {
        const price = await stripe().prices.retrieve(plan.price);
        const good = price.active && price.unit_amount === plan.amount * 100 && String(price.currency).toUpperCase() === CURRENCY;
        if (!good) drift.push(`${key}: ${price.active ? 'active' : 'INACTIVE'} ${price.currency} ${price.unit_amount / 100}, site says ${CURRENCY} ${plan.amount}`);
      }
      if (drift.length) throw new Error(drift.join('; '));
    }),
    attempt('Sign-in key', async () => { if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is not set'); }),
    attempt('Email', async () => { if (!process.env.RESEND_API_KEY) throw new Error('RESEND_API_KEY is not set'); }),
  ]);
}

export default async function handler(req, res) {
  const secret = (process.env.CRON_SECRET || '').trim();
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return json(res, 401, { error: 'Unauthorized' });

  const yesterday = today(new Date(Date.now() - 86400000));
  const [health, numbers, usage] = await Promise.all([
    runHealthChecks(),
    readMetrics(yesterday, FUNNEL),
    readMetrics(yesterday, ['ai_input_tokens', 'ai_output_tokens', 'ai_web_searches']),
  ]);
  const aiCost = (usage.ai_input_tokens || 0) * COST.input + (usage.ai_output_tokens || 0) * COST.output + (usage.ai_web_searches || 0) * COST.search;
  const failing = health.filter((h) => !h.ok);

  const healthRows = health.map((h) => `<tr><td style="padding:5px 10px">${h.ok ? '&#10003;' : '<strong style="color:#c0262d">FAIL</strong>'}</td><td style="padding:5px 10px">${escapeHtml(h.name)}</td><td style="padding:5px 10px;color:#7a8290">${escapeHtml(h.detail)}</td></tr>`).join('');
  const shown = Object.entries(numbers).filter(([, v]) => v !== 0);
  const numberRows = shown.length
    ? shown.map(([k, v]) => `<tr><td style="padding:5px 10px">${escapeHtml(k.replace(/_/g, ' '))}</td><td style="padding:5px 10px;font-weight:700">${v === null ? 'unavailable' : v}</td></tr>`).join('')
    : '<tr><td style="padding:5px 10px;color:#7a8290">No activity recorded.</td></tr>';

  const subject = failing.length
    ? `ACTION NEEDED: Gideon ${failing.map((f) => f.name).join(', ')} failing`
    : `Gideon daily: ${numbers.trial_chat || 0} trial chats, ${numbers.trial_pack || 0} pack checks, ${numbers.checkout_paid || 0} sales`;

  let emailed = true;
  try {
    await sendEmail({
      to: OWNER_EMAIL(),
      subject,
      html: emailShell(`Gideon, ${yesterday}`, `<h2 style="font-size:14px;margin:18px 0 6px">Systems</h2><table style="border-collapse:collapse;font-size:13px;width:100%">${healthRows}</table><h2 style="font-size:14px;margin:22px 0 6px">Yesterday</h2><table style="border-collapse:collapse;font-size:13px;width:100%">${numberRows}</table><p style="font-size:13px;color:#7a8290;margin-top:14px">Estimated AI cost: US$${aiCost.toFixed(2)}. ${(usage.ai_input_tokens || 0).toLocaleString()} tokens in, ${(usage.ai_output_tokens || 0).toLocaleString()} out, ${usage.ai_web_searches || 0} web searches.</p>`),
    });
  } catch (e) {
    emailed = false;
    console.error('digest email failed', e && e.message);
  }
  return json(res, failing.length ? 500 : 200, { day: yesterday, health, numbers, aiCostUsd: Number(aiCost.toFixed(2)), emailed });
}
