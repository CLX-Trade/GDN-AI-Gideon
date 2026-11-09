// Gideon's voice through ElevenLabs. This was open to anyone with no limit, so any
// script could burn the voice credit. Now it needs a session and has a daily ceiling.
// Any non-200 tells the browser to fall back to its built-in voice.
import { json, parseCookies, originAllowed, ipHash } from '../lib/http.js';
import { readEmail } from '../lib/session.js';
import { rateLimit } from '../lib/quota.js';
import { store } from '../lib/deps.js';

const MAX_CHARS = 1500;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voiceId) return json(res, 501, { error: 'Voice is not configured' });

  const cookies = parseCookies(req);
  const email = readEmail(cookies);
  const sid = cookies.gid_sid;

  try {
    // A visitor id costs nothing to make up, so a trial visitor must have actually
    // used the trial before their voice calls are allowed.
    if (!email) {
      const used = sid ? Number(await store().get(`trial:${sid}`)) || 0 : 0;
      if (used < 1) return json(res, 401, { error: 'No session' });
    }
    const allowed = await rateLimit('speak', email || ipHash(req), email ? 300 : 8, 86400);
    if (!allowed) return json(res, 429, { error: 'Voice limit reached for today' });
  } catch {
    return json(res, 503, { error: 'Voice is unavailable' });
  }

  const text = String((req.body && req.body.text) || '').slice(0, MAX_CHARS);
  if (!text.trim()) return json(res, 400, { error: 'text required' });

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5', voice_settings: { stability: 0.5, similarity_boost: 0.75 } }),
    });
    if (!r.ok) {
      console.error('Voice upstream error', r.status);
      return json(res, 502, { error: 'Voice upstream error' });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(audio);
  } catch (e) {
    console.error('Voice failed', e && e.message);
    return json(res, 500, { error: 'Voice failed' });
  }
}
