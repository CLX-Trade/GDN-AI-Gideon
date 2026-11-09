// Outbound email through Resend.
import { emailSender } from './deps.js';

export const OWNER_EMAIL = () => (process.env.LEADS_EMAIL || 'gnardo@gdngroup.com.au').trim();
const FROM = () => (process.env.AUTH_FROM_EMAIL || 'Gideon <onboarding@resend.dev>').trim();

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export async function sendEmail({ to, subject, html, replyTo }) {
  const injected = emailSender();
  if (injected) return injected({ to, subject, html, replyTo });

  const key = (process.env.RESEND_API_KEY || '').trim();
  if (!key) throw new Error('RESEND_API_KEY is not set');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM(), to, subject, html, reply_to: replyTo || OWNER_EMAIL() }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 300)}`);
}

export function emailShell(title, bodyHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:28px;color:#14171d">
<div style="font-size:13px;font-weight:800;letter-spacing:.18em;color:#1f6bff">GIDEON</div>
<h1 style="font-size:20px;margin:14px 0 12px;color:#14171d">${escapeHtml(title)}</h1>
${bodyHtml}
<p style="color:#7a8290;font-size:11px;line-height:1.6;margin:26px 0 0">GDN Enterprise Pty Ltd &middot; ACN 666 495 263 &middot; gdn-ai.com</p>
</div>`;
}
