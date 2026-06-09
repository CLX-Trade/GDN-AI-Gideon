import { kv } from '@vercel/kv';

// Captures investor / partner interest from the Gideon page.
// Always stores the lead (so none are lost) and, when RESEND_API_KEY is set,
// emails it to the GDN inbox (LEADS_EMAIL, default gnardo@gdngroup.com.au).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const b = req.body || {};
  const name = String(b.name || '').trim().slice(0, 200);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  const company = String(b.company || '').trim().slice(0, 200);
  const message = String(b.message || '').trim().slice(0, 2000);
  if (!name || !email || !email.includes('@')) return res.status(400).json({ error: 'Name and a valid email are required' });

  const at = new Date().toISOString();
  const lead = { name, email, company, message, at };

  // Persist every lead so nothing is lost, even before email is configured.
  try { await kv.set('lead:' + Date.now() + ':' + Math.random().toString(36).slice(2, 8), lead); } catch (e) { console.error('kv lead save failed:', e && e.message); }

  const RESEND = (process.env.RESEND_API_KEY || '').trim();
  const TO = process.env.LEADS_EMAIL || 'gnardo@gdngroup.com.au';
  const FROM = process.env.AUTH_FROM_EMAIL || 'Gideon <onboarding@resend.dev>';

  if (RESEND) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const html =
      '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#0E2748">' +
        '<div style="font-size:16px;font-weight:800;color:#0A4FB0;letter-spacing:.4px">GDN &middot; GIDEON</div>' +
        '<h1 style="font-size:19px;margin:14px 0 16px">New investor / partner interest</h1>' +
        '<table style="border-collapse:collapse;width:100%;font-size:14px">' +
          '<tr><td style="padding:6px 10px;color:#5C7393;width:120px">Name</td><td style="padding:6px 10px;font-weight:600">' + esc(name) + '</td></tr>' +
          '<tr><td style="padding:6px 10px;color:#5C7393">Email</td><td style="padding:6px 10px"><a href="mailto:' + esc(email) + '">' + esc(email) + '</a></td></tr>' +
          '<tr><td style="padding:6px 10px;color:#5C7393">Company / fund</td><td style="padding:6px 10px">' + (esc(company) || '&mdash;') + '</td></tr>' +
          '<tr><td style="padding:6px 10px;color:#5C7393;vertical-align:top">Message</td><td style="padding:6px 10px;white-space:pre-wrap">' + (esc(message) || '&mdash;') + '</td></tr>' +
          '<tr><td style="padding:6px 10px;color:#5C7393">Received</td><td style="padding:6px 10px">' + esc(at) + '</td></tr>' +
        '</table>' +
        '<p style="color:#90A4BE;font-size:12px;margin:20px 0 0">Submitted via the Gideon investor page &middot; gdn-ai.com</p>' +
      '</div>';
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: FROM, to: TO, reply_to: email, subject: 'Gideon interest \u2014 ' + name, html })
      });
      if (!r.ok) console.error('Resend lead email error', r.status, await r.text());
    } catch (e) { console.error('Resend lead email failed:', e && e.message); }
  }

  return res.status(200).json({ ok: true });
}
