// Resolves a request to the person behind it. Used by every endpoint that spends
// money, so the rules for "member or trial" live in exactly one place.
import { parseCookies, ipHash } from './http.js';
import { readEmail, readOrMintSid } from './session.js';
import { getEntitlement } from './entitlement.js';

export async function resolveIdentity(req) {
  const cookies = parseCookies(req);
  const email = readEmail(cookies);
  let entitlement = null;
  if (email) {
    try {
      entitlement = await getEntitlement(email);
    } catch (e) {
      // Redis and Stripe both unreachable. Treat as not a member for this one
      // request rather than granting access we cannot confirm.
      console.error('entitlement lookup failed', e && e.message);
    }
  }
  const { sid, setCookie } = readOrMintSid(cookies);
  return { email, entitlement, sid, setCookie, ipHash: ipHash(req) };
}
