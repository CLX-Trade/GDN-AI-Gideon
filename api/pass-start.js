// Opens (or reports) the 24-hour Meeting Room window for a signed-in pass holder.
import { json, parseCookies, originAllowed } from '../lib/http.js';
import { readEmail } from '../lib/session.js';
import { readPass, writePass, DAY_MS } from '../lib/pass.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const email = readEmail(parseCookies(req));
  if (!email) return json(res, 401, { ok: false, reason: 'not_signed_in' });

  let pass;
  try {
    pass = await readPass(email);
  } catch (e) {
    console.error('pass read failed', e && e.message);
    return json(res, 500, { ok: false, reason: 'store_error' });
  }
  if (!pass) return json(res, 200, { ok: false, reason: 'no_pass' });

  const now = Date.now();
  if (pass.startedAt && now < pass.startedAt + DAY_MS) {
    return json(res, 200, { ok: true, active: true, startedAt: pass.startedAt, expiresAt: pass.startedAt + DAY_MS, passesRemaining: pass.passesRemaining });
  }
  if (!pass.passesRemaining || pass.passesRemaining < 1) return json(res, 200, { ok: false, reason: 'no_sessions_left' });

  const updated = { ...pass, startedAt: now, passesRemaining: pass.passesRemaining - 1 };
  try {
    await writePass(email, updated);
  } catch (e) {
    console.error('pass write failed', e && e.message);
    return json(res, 500, { ok: false, reason: 'store_error' });
  }
  return json(res, 200, { ok: true, active: true, consumed: true, startedAt: now, expiresAt: now + DAY_MS, passesRemaining: updated.passesRemaining });
}
