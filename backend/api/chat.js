import { kv } from '@vercel/kv';
import { parse, serialize } from 'cookie';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const MODEL_PRO = process.env.CLAUDE_MODEL_PRO || MODEL; // set CLAUDE_MODEL_PRO to upgrade the Professional tier
const FREE_LIMIT = parseInt(process.env.FREE_TRIAL_LIMIT || '3', 10);

const SYSTEM = "You are Gideon, a sharp, capable and broad business assistant. You help across strategy, operations, finance, marketing and sales, trade and commodities, research, writing, drafting documents, and general analysis, and you are glad to help with everyday questions too. Your voice is precise, professional, warm and commercially direct. Lead with the answer, stay concise, and use clean prose with no dash punctuation. Do not describe yourself as any particular company's AI, and do not bring up who operates you unless the user directly asks; if they ask who is behind you, you may say you are provided by GDN. When a question turns on legal, tax, regulatory or financial certainty, give your best analysis and note that a qualified professional should review before acting.";

function randomId() {
  if (globalThis.crypto && globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, '');
  return (Date.now().toString(36) + Math.random().toString(36).slice(2));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const cookies = parse(req.headers.cookie || '');
  let sid = cookies.gid_sid;
  if (!sid) {
    sid = randomId();
    res.setHeader('Set-Cookie', serialize('gid_sid', sid, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 365 }));
  }
  const email = cookies.gid_email || null;

  let isMember = false;
  if (email) { try { isMember = (await kv.get('member:' + email.toLowerCase())) === true; } catch (e) {} }
  let proTier = false;
  if (email) { try { proTier = (await kv.get('tier:' + email.toLowerCase())) === 'professional'; } catch (e) {} }

  if (!isMember) {
    let used = 0;
    try { used = (await kv.get('trial:' + sid)) || 0; } catch (e) {}
    if (used >= FREE_LIMIT) {
      return res.status(402).json({ paywall: true, message: 'Free trial complete' });
    }
  }

  const body = req.body || {};
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({ model: (proTier ? MODEL_PRO : MODEL), max_tokens: 4096, system: SYSTEM, messages })
    });
    const data = await r.json();
    if (!r.ok) { console.error('Claude error', data); return res.status(502).json({ error: 'Upstream error' }); }
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();

    let trialUsed = 0;
    if (!isMember) {
      try {
        const cur = (await kv.get('trial:' + sid)) || 0;
        trialUsed = cur + 1;
        await kv.set('trial:' + sid, trialUsed);
      } catch (e) {}
    }
    return res.status(200).json({ text, member: isMember, trialUsed, trialLimit: FREE_LIMIT });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error' });
  }
}
