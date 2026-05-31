// Natural voice via ElevenLabs. Optional and non-blocking:
// if the env vars are not set, this returns 501 and the front end
// falls back to the basic browser voice, so the site never breaks.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!key || !voiceId) return res.status(501).json({ error: 'TTS not configured' });

  const text = ((req.body && req.body.text) || '').toString().slice(0, 2500);
  if (!text) return res.status(400).json({ error: 'text required' });
  const model = process.env.ELEVENLABS_MODEL || 'eleven_turbo_v2_5';

  try {
    const r = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + voiceId, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'content-type': 'application/json', 'accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: model, voice_settings: { stability: 0.5, similarity_boost: 0.75 } })
    });
    if (!r.ok) { console.error('TTS upstream', r.status, await r.text()); return res.status(502).json({ error: 'TTS upstream error' }); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(buf);
  } catch (e) { console.error(e); return res.status(500).json({ error: 'TTS server error' }); }
}
