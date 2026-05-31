import { kv } from '@vercel/kv';
import { parse } from 'cookie';

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parse(req.headers.cookie || '');
  const email = (cookies.gid_email || '').toLowerCase();
  if (!email) return res.status(401).json({ ok: false, reason: 'not_signed_in' });

  let pass;
  try {
    pass = await kv.get('pass:' + email);
  } catch (e) {
    console.error('pass-start kv.get failed:', e && e.message);
    return res.status(500).json({ ok: false, reason: 'kv_error' });
  }
  if (!pass) return res.status(200).json({ ok: false, reason: 'no_pass' });

  const now = Date.now();

  // An active 24h window is already running — return it, do NOT consume another session.
  if (pass.startedAt && now < pass.startedAt + DAY_MS) {
    return res.status(200).json({
      ok: true,
      active: true,
      startedAt: pass.startedAt,
      expiresAt: pass.startedAt + DAY_MS,
      passesRemaining: pass.passesRemaining
    });
  }

  // No active window. Need at least one session left to start a new one.
  if (!pass.passesRemaining || pass.passesRemaining < 1) {
    return res.status(200).json({ ok: false, reason: 'no_sessions_left' });
  }

  // Consume one session: stamp startedAt, decrement remaining.
  pass.startedAt = now;
  pass.passesRemaining = pass.passesRemaining - 1;

  try {
    await kv.set('pass:' + email, pass);
  } catch (e) {
    console.error('pass-start kv.set failed:', e && e.message);
    return res.status(500).json({ ok: false, reason: 'kv_error' });
  }

  return res.status(200).json({
    ok: true,
    active: true,
    consumed: true,
    startedAt: pass.startedAt,
    expiresAt: pass.startedAt + DAY_MS,
    passesRemaining: pass.passesRemaining
  });
}
