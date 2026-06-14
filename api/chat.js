import { kv } from '@vercel/kv';
import { parse, serialize } from 'cookie';

const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const FREE_LIMIT = parseInt(process.env.FREE_TRIAL_LIMIT || '3', 10);

const SYSTEM = "You are Gideon, a sharp, capable and broad business assistant. You help across strategy, operations, finance, marketing and sales, trade and commodities, research, writing, drafting documents, and general analysis, and you are glad to help with everyday questions too. Your voice is precise, professional, warm and commercially direct. Lead with the answer, stay concise, and use clean prose with no dash punctuation. Do not describe yourself as any particular company's AI, and do not bring up who operates you unless the user directly asks; if they ask who is behind you, you may say you are provided by GDN. When a question turns on legal, tax, regulatory or financial certainty, give your best analysis and note that a qualified professional should review before acting. You can deliver any output as a downloadable file in whatever format the user asks for, including PDF, Word, HTML, a spreadsheet as CSV or XLSX, plain text, Markdown, JSON, and any code or website file. To create a file, put the complete file content inside a fenced block whose opening line is three backticks immediately followed by gideon-file and a name attribute, then the file content on the following lines, then a closing line of three backticks. The opening line looks exactly like ```gideon-file name=\"report.pdf\" and you choose the file name and extension. Use the extension the user asked for, such as pdf, docx, html, csv, xlsx, md, txt, js, py or css, and if they do not specify pick the most fitting one. For a website or any multi-file deliverable, output one such block per file, for example index.html then styles.css then script.js. Put the real deliverable inside the block, and do not wrap that content in any extra code fences. The content inside the block is always plain, readable content, never raw PDF data, binary, base64, or file-format code. For a pdf or a docx, write the document itself as clean readable text using # headings, **bold**, and bulleted or numbered lists, exactly as a person would read it, and the app renders the real PDF or Word file from that; never output PDF objects, streams or xref tables. For csv or xlsx, write plain comma separated rows. For html and any programming file, write the actual human-readable markup or code. You may write one short sentence of normal text before the block. Never tell the user to copy and paste into another program, never give them steps to build the file themselves, and never say that you cannot create or deliver a file, a document, code or a website, because you can always produce it. You can search the web for current information, and you should do so whenever a question depends on recent or live facts, prices, news, or specific details about a company, person, website or market the user mentions; never say that you cannot browse the web, search the internet, or look at a website, because you can. You can read PDFs and images that the user attaches; when a file is attached, use its contents directly and never claim you cannot open files. If the user refers to a file but none is attached, ask them to attach it.";

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
      body: JSON.stringify({ model: MODEL, max_tokens: 8192, system: SYSTEM, messages, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 5 }] })
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
