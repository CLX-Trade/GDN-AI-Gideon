// Gideon's voice and ears, through ElevenLabs.
//
// POST /api/speak turns one sentence into speech. It used to be open to anyone with no
// limit, so any script could burn the voice credit. Now it needs a member or a visitor
// who has used the trial, and spending is capped in characters per day, because a call
// asks for many short sentences rather than one long answer. Any non-200 tells the
// browser to fall back to its built-in voice.
//
// POST /api/speak?action=token hands the browser a single-use token for live
// transcription, because a serverless function cannot hold a socket open. A token
// lasts 15 minutes and opens one connection, so minting is what gets limited.
import { json, addCookie, originAllowed, query } from '../lib/http.js';
import { resolveIdentity } from '../lib/identity.js';
import { rateLimit, currentUsage } from '../lib/quota.js';
import { store } from '../lib/deps.js';
import { metric } from '../lib/metrics.js';

const API = 'https://api.elevenlabs.io/v1';
const MAX_CHARS = 1500;
const MAX_CONTEXT_CHARS = 300;
const DAY = 86400;
const MEMBER_CHARS_PER_DAY = 60000;
const TRIAL_CHARS_PER_DAY = 6000;
const TRIAL_CHARS_ALL_VISITORS_PER_DAY = 150000;
const MEMBER_SESSIONS_PER_DAY = 60;
const TRIAL_SESSIONS_PER_DAY = 20;
const TRIAL_SESSIONS_ALL_VISITORS_PER_DAY = 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'Method not allowed' });
  if (!originAllowed(req)) return json(res, 403, { error: 'Forbidden' });

  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voiceId) return json(res, 501, { error: 'Voice is not configured' });

  const identity = await resolveIdentity(req);
  if (query(req).get('action') === 'token') return mintToken(res, identity, key);
  return synthesize(req, res, identity, key, voiceId);
}

async function mintToken(res, identity, key) {
  const member = Boolean(identity.entitlement);
  try {
    if (member) {
      if (!await rateLimit('talk', identity.email, MEMBER_SESSIONS_PER_DAY, DAY)) return json(res, 429, { error: 'That is enough conversations for one day. You can still type to Gideon.' });
    } else {
      const { used, limit } = await currentUsage(identity);
      if (used !== null && used >= limit) return json(res, 402, { paywall: true, reason: 'trial_used' });
      const allowed = await rateLimit('talk', identity.ipHash, TRIAL_SESSIONS_PER_DAY, DAY)
        && await rateLimit('talk', 'all-visitors', TRIAL_SESSIONS_ALL_VISITORS_PER_DAY, DAY);
      if (!allowed) return json(res, 429, { error: 'Live conversation is very busy right now. You can still type to Gideon.' });
    }
  } catch (e) {
    console.error('talk limit check failed', e && e.message);
    if (!member) return json(res, 503, { error: 'Live conversation is unavailable right now.' });
  }

  try {
    const r = await fetch(`${API}/single-use-token/realtime_scribe`, { method: 'POST', headers: { 'xi-api-key': key } });
    if (!r.ok) {
      console.error('Transcription token error', r.status);
      return json(res, 502, { error: 'Live conversation is unavailable right now.' });
    }
    const { token } = await r.json();
    await metric('talk_session');
    if (identity.setCookie) addCookie(res, identity.setCookie);
    return json(res, 200, { token });
  } catch (e) {
    console.error('Transcription token failed', e && e.message);
    return json(res, 502, { error: 'Live conversation is unavailable right now.' });
  }
}

async function synthesize(req, res, identity, key, voiceId) {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const text = String(body.text || '').slice(0, MAX_CHARS);
  const member = Boolean(identity.entitlement);

  try {
    // A visitor id costs nothing to make up, so a trial visitor must have actually
    // used the trial before their voice calls are allowed.
    if (!member) {
      const used = identity.sid ? Number(await store().get(`trial:${identity.sid}`)) || 0 : 0;
      if (used < 1) return json(res, 401, { error: 'No session' });
    }
    if (!text.trim()) return json(res, 400, { error: 'text required' });
    const allowed = member
      ? await rateLimit('speakchars', identity.email, MEMBER_CHARS_PER_DAY, DAY, text.length)
      : await rateLimit('speakchars', identity.ipHash, TRIAL_CHARS_PER_DAY, DAY, text.length)
        && await rateLimit('speakchars', 'all-visitors', TRIAL_CHARS_ALL_VISITORS_PER_DAY, DAY, text.length);
    if (!allowed) return json(res, 429, { error: 'Voice limit reached for today' });
  } catch {
    return json(res, 503, { error: 'Voice is unavailable' });
  }

  try {
    const r = await fetch(`${API}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: process.env.ELEVENLABS_MODEL || 'eleven_flash_v2_5',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        // The sentence before keeps the voice flowing rather than restarting each time.
        ...(body.previous ? { previous_text: String(body.previous).slice(-MAX_CONTEXT_CHARS) } : {}),
      }),
    });
    if (!r.ok) {
      console.error('Voice upstream error', r.status);
      return json(res, 502, { error: 'Voice upstream error' });
    }
    const audio = Buffer.from(await r.arrayBuffer());
    await metric('voice_chars', text.length);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.end(audio);
  } catch (e) {
    console.error('Voice failed', e && e.message);
    return json(res, 500, { error: 'Voice failed' });
  }
}
