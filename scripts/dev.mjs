// Local development server: serves public/ the way Vercel does and runs the real API
// handlers against in-memory fakes, so the whole product works offline with no keys
// and no spend. Test members: run `/dev/member` in the browser to sign in as one.
import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDepsForTest } from '../lib/deps.js';
import { MemoryStore, fakeStripe, fakeAnthropic } from '../test/support/fakes.js';
import { PLANS } from '../lib/plans.js';
import { sessionCookie } from '../lib/session.js';

process.env.SESSION_SECRET ||= 'local-dev-only';
process.env.VOUCHER_CODES ||= 'DEVCODE:5';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pub = join(root, 'public');
const config = JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
const PORT = Number(process.env.PORT || 4178);

const DEV_MEMBER = 'member@dev.test';
setDepsForTest({
  store: new MemoryStore(),
  stripe: fakeStripe({ customers: { [DEV_MEMBER]: { id: 'cus_dev', subs: [{ status: 'active', items: { data: [{ price: { id: PLANS['pro-monthly'].price } }] } }] } } }),
  anthropic: fakeAnthropic({ slowMs: 12, replyText: 'A **bill of lading** does three jobs:\n\n1. It is a receipt for the goods.\n2. It evidences the contract of carriage.\n3. It is a document of title.\n\n| Check | Why |\n|---|---|\n| Shipper name | Must match the seller |\n| On board date | Must fall inside the L/C window |\n\nThis answer came from the local fake model.' }),
  sendEmail: async (m) => { console.log(`[dev email] to ${m.to}: ${m.subject}\n${(m.html.match(/href="([^"]+)"/) || [])[1] || ''}`); },
});

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.xml': 'application/xml', '.txt': 'text/plain', '.mp4': 'video/mp4' };

function matches(source, path) {
  const pattern = `^${source.replace(/\//g, '\\/').replace(/:\w+\*/g, '.*').replace(/:\w+/g, '[^/]+')}$`;
  return new RegExp(pattern).test(path);
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks);
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString()); } catch { return {}; }
}

async function serveFile(res, file, status = 200) {
  const data = await readFile(file);
  res.writeHead(status, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(data);
}

async function exists(file) {
  try { return (await stat(file)).isFile(); } catch { return false; }
}

http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let path = url.pathname;
  try {
    if (path === '/dev/member') {
      res.writeHead(302, { 'Set-Cookie': sessionCookie(DEV_MEMBER).replace('; Secure', ''), Location: '/app' });
      return res.end();
    }
    for (const r of config.redirects || []) {
      if (matches(r.source, path)) { res.writeHead(r.permanent ? 301 : 302, { Location: r.destination + url.search }); return res.end(); }
    }
    for (const r of config.rewrites || []) {
      if (matches(r.source, path)) { path = r.destination; break; }
    }
    if (path.startsWith('/api/')) {
      const name = path.slice(5).replace(/[^\w-]/g, '');
      const mod = await import(join(root, 'api', `${name}.js`)).catch(() => null);
      if (!mod) { res.writeHead(404); return res.end('no such api'); }
      req.url = path + url.search;
      req.body = await readBody(req);
      const setHeader = res.setHeader.bind(res);
      res.setHeader = (k, v) => setHeader(k, k.toLowerCase() === 'set-cookie' ? [].concat(v).map((c) => c.replace('; Secure', '')) : v);
      return await mod.default(req, res);
    }
    const candidates = path === '/' ? ['index.html'] : [path.slice(1), `${path.slice(1)}.html`];
    for (const c of candidates) {
      const file = join(pub, c);
      if (file.startsWith(pub) && await exists(file)) return await serveFile(res, file);
    }
    return await serveFile(res, join(pub, '404.html'), 404);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) { res.writeHead(500); res.end('dev server error'); }
  }
}).listen(PORT, () => console.log(`Gideon dev server on http://localhost:${PORT}`));
