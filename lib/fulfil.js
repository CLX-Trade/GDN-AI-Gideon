// Turns a paid Stripe Checkout session into access. Called from both the webhook
// and the buyer's return from Checkout, whichever arrives first, so everything here
// must be safe to run twice.
import { store, stripe } from './deps.js';
import { planForPrice, CURRENCY, brisbaneDate } from './plans.js';
import { grantMembership, rememberCustomer } from './entitlement.js';
import { readPass, writePass } from './pass.js';
import { metric } from './metrics.js';
import { sendEmail, emailShell, escapeHtml, OWNER_EMAIL } from './email.js';

export function sessionEmail(session) {
  return String((session.customer_details && session.customer_details.email) || session.customer_email || '').trim().toLowerCase();
}

export function isPaid(session) {
  return session.status === 'complete' && session.payment_status !== 'unpaid';
}

export async function planOfSession(session) {
  const items = await stripe().checkout.sessions.listLineItems(session.id, { limit: 5 });
  for (const item of items.data) {
    const plan = planForPrice(item.price && item.price.id);
    if (plan) return plan;
  }
  return null;
}

export async function fulfilCheckoutSession(session) {
  const email = sessionEmail(session);
  if (!email) throw new Error(`Checkout session ${session.id} has no email`);
  const plan = await planOfSession(session);
  if (!plan) throw new Error(`Checkout session ${session.id} has no known price`);

  // Access is granted first, in a way that is safe to repeat. Only then is the sale
  // marked as done, so a failure here leaves Stripe's retry able to finish the job.
  if (session.customer) await rememberCustomer(email, session.customer);
  if (plan.kind === 'membership') await grantMembership(email, plan, session.customer);
  if (plan.kind === 'pass') await grantPass(email, plan, session.id);

  const first = await store().set(`fulfil:${session.id}`, 1, { nx: true, ex: 60 * 60 * 24 * 45 });
  if (first !== 'OK') return { email, plan, alreadyDone: true };

  const trialEnd = await trialEndOf(session);
  if (trialEnd) {
    await metric('trial_started');
    await notifyTrial(session, email, plan, trialEnd);
    return { email, plan, alreadyDone: false, trialEnd };
  }
  await metric('checkout_paid');
  await metric(`paid_${plan.key}`);
  await notifySale(session, email, plan);
  return { email, plan, alreadyDone: false };
}

// Each checkout adds its sessions once, even if the webhook and the buyer's return both
// run this. A second pass bought before the first is used adds to it, not over it.
async function grantPass(email, plan, sessionId) {
  const existing = await readPass(email);
  const seen = (existing && existing.sessions) || [];
  if (seen.includes(sessionId)) return;
  await writePass(email, {
    type: plan.pass === 'monthly' || (existing && existing.type === 'monthly') ? 'monthly' : 'daily',
    purchasedAt: Date.now(),
    startedAt: existing ? existing.startedAt : null,
    passesRemaining: ((existing && existing.passesRemaining) || 0) + (plan.pass === 'monthly' ? 4 : 1),
    sessions: [...seen, sessionId].slice(-20),
  });
}

// When a subscription checkout started a free trial, the ms its trial ends; else 0.
async function trialEndOf(session) {
  if (session.mode !== 'subscription' || session.amount_total !== 0 || !session.subscription) return 0;
  const id = typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
  const sub = typeof session.subscription === 'object' && session.subscription.trial_end
    ? session.subscription : await stripe().subscriptions.retrieve(id);
  return sub && sub.status === 'trialing' && sub.trial_end ? sub.trial_end * 1000 : 0;
}

async function notifyTrial(session, email, plan, trialEnd) {
  const ends = brisbaneDate(trialEnd);
  const source = (session.metadata && session.metadata.ref) || 'unknown';
  try {
    await sendEmail({
      to: OWNER_EMAIL(),
      replyTo: email,
      subject: `Gideon free trial started: ${plan.label}, first charge ${ends}`,
      html: emailShell('New Gideon free trial', `<p><strong>${escapeHtml(plan.label)}</strong>, free until ${escapeHtml(ends)}, then ${CURRENCY} ${escapeHtml(String(plan.amount))} a month.</p><p>Customer: ${escapeHtml(email)}<br>Source: ${escapeHtml(source)}<br>Stripe session: ${escapeHtml(session.id)}</p>`),
    });
  } catch (e) { console.error('trial notification failed', e && e.message); }

  try {
    await sendEmail({
      to: email,
      subject: 'Your free week of Gideon has started',
      html: emailShell('You are in', `<p style="line-height:1.6">Your free week of Gideon ${escapeHtml(plan.label)} has started. You have 100 queries and pack checks of up to 5 documents.</p><p style="line-height:1.6">Open <a href="https://www.gdn-ai.com/app">gdn-ai.com/app</a>. If it asks you to sign in on another device, use this email address and we will send you a link.</p><p style="line-height:1.6"><strong>Nothing is charged until ${escapeHtml(ends)}.</strong> On that day your card is charged ${CURRENCY} ${escapeHtml(String(plan.amount))}, then monthly. To stop before then, open Manage billing from your account menu in Gideon and cancel; you keep access until the free week ends. We will remind you 3 days before.</p><p style="line-height:1.6">Reply to this email if anything is not working and a person at GDN will answer.</p>`),
    });
  } catch (e) { console.error('trial welcome email failed', e && e.message); }
}

// Stripe sends customer.subscription.trial_will_end three days before a trial ends.
export async function remindTrialEnding(subscription, email) {
  if (!email || subscription.status !== 'trialing' || !subscription.trial_end) return;
  const first = await store().set(`trialremind:${subscription.id}`, 1, { nx: true, ex: 60 * 60 * 24 * 30 });
  if (first !== 'OK') return;
  const plan = (subscription.items && subscription.items.data || []).map((i) => planForPrice(i.price && i.price.id)).find(Boolean);
  const amount = plan ? plan.amount : 60;
  const ends = brisbaneDate(subscription.trial_end * 1000);
  try {
    await sendEmail({
    to: email,
    subject: `Your Gideon free week ends ${ends}`,
    html: emailShell('Your free week is ending', `<p style="line-height:1.6">Your free week of Gideon ends on <strong>${escapeHtml(ends)}</strong>. On that day your card will be charged ${CURRENCY} ${escapeHtml(String(amount))}, then monthly.</p><p style="line-height:1.6">Nothing to do if you want to keep going. To cancel, open Manage billing from your account menu at <a href="https://www.gdn-ai.com/app">gdn-ai.com/app</a> before then, and you will not be charged.</p><p style="line-height:1.6">Questions? Reply to this email and a person at GDN will answer.</p>`),
    });
  } catch (e) {
    // Let Stripe's retry send it again.
    await store().del(`trialremind:${subscription.id}`);
    throw e;
  }
}

async function notifySale(session, email, plan) {
  const amount = typeof session.amount_total === 'number' ? (session.amount_total / 100).toFixed(2) : String(plan.amount);
  const source = (session.metadata && session.metadata.ref) || 'unknown';
  try {
    await sendEmail({
      to: OWNER_EMAIL(),
      replyTo: email,
      subject: `Gideon sale: ${plan.label}, ${CURRENCY} ${amount}`,
      html: emailShell('New Gideon sale', `<p><strong>${escapeHtml(plan.label)}</strong> for ${CURRENCY} ${escapeHtml(amount)}.</p><p>Customer: ${escapeHtml(email)}<br>Source: ${escapeHtml(source)}<br>Stripe session: ${escapeHtml(session.id)}</p>`),
    });
  } catch (e) { console.error('sale notification failed', e && e.message); }

  try {
    const where = plan.kind === 'pass' ? 'https://www.gdn-ai.com/meeting-room' : 'https://www.gdn-ai.com/app';
    await sendEmail({
      to: email,
      subject: 'Welcome to Gideon',
      html: emailShell('You are in', `<p style="line-height:1.6">Thanks for joining. Your ${escapeHtml(plan.label)} is active.</p><p style="line-height:1.6">Open <a href="${where}">${where.replace('https://www.', '')}</a>. If it asks you to sign in on another device, use this email address and we will send you a link.</p><p style="line-height:1.6">Manage or cancel any time from your account menu inside Gideon. Reply to this email if anything is not working and a person at GDN will answer.</p>`),
    });
  } catch (e) { console.error('welcome email failed', e && e.message); }
}
