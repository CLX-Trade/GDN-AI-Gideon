// Who is this browser, and what do they have left. Read-only and never errors: a
// page should still render for someone whose status cannot be determined.
import { json } from '../lib/http.js';
import { resolveIdentity } from '../lib/identity.js';
import { currentUsage } from '../lib/quota.js';
import { readPass } from '../lib/pass.js';
import { TIERS, TRIAL } from '../lib/plans.js';

export default async function handler(req, res) {
  const identity = await resolveIdentity(req);
  const usage = await currentUsage(identity);
  let pass = null;
  if (identity.email) {
    try { pass = await readPass(identity.email); } catch { /* shown as no pass */ }
  }
  const tier = identity.entitlement ? identity.entitlement.tier : null;
  return json(res, 200, {
    signedIn: Boolean(identity.email),
    email: identity.email,
    member: Boolean(identity.entitlement),
    tier,
    tierLabel: tier ? TIERS[tier].label : null,
    used: usage.used,
    limit: usage.limit,
    maxDocsPerPack: tier ? TIERS[tier].maxDocsPerPack : TRIAL.maxDocsPerPack,
    pass,
    // Older cached pages read these two names.
    trialUsed: tier ? 0 : usage.used,
    trialLimit: TRIAL.queries(),
  });
}
