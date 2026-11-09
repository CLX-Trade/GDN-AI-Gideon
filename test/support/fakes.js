// In-memory stand-ins for Redis, Stripe and Claude, used by the tests and by the
// local dev server. Nothing here is imported by production code.
import { DEMO_PACK } from '../../shared/demo-pack.js';

export class MemoryStore {
  constructor() { this.data = new Map(); this.failing = false; }
  guard() { if (this.failing) throw new Error('fetch failed'); }
  live(key) {
    const e = this.data.get(key);
    if (!e) return undefined;
    if (e.expires && e.expires < Date.now()) { this.data.delete(key); return undefined; }
    return e;
  }
  async get(key) { this.guard(); const e = this.live(key); return e === undefined ? null : e.value; }
  async set(key, value, opts = {}) {
    this.guard();
    if (opts.nx && this.live(key)) return null;
    this.data.set(key, { value, expires: opts.ex ? Date.now() + opts.ex * 1000 : null });
    return 'OK';
  }
  async del(key) { this.guard(); return this.data.delete(key) ? 1 : 0; }
  async incrby(key, n) {
    this.guard();
    const e = this.live(key);
    const value = (e ? Number(e.value) : 0) + n;
    this.data.set(key, { value, expires: e ? e.expires : null });
    return value;
  }
  async decrby(key, n) { return this.incrby(key, -n); }
  async expire(key, seconds) { this.guard(); const e = this.live(key); if (e) e.expires = Date.now() + seconds * 1000; return 1; }
}

export function fakeStripe({ customers = {}, sessions = {}, lineItems = {} } = {}) {
  const calls = { customersList: 0, created: [] };
  return {
    calls,
    customers: {
      // Mirrors the real API: list is case-sensitive on email, search is not.
      list: async ({ email }) => { calls.customersList++; return { data: customers[email] ? [{ id: customers[email].id, email }] : [] }; },
      search: async ({ query }) => {
        const wanted = (query.match(/email:'(.+)'/) || [])[1] || '';
        const hit = Object.entries(customers).find(([e]) => e.toLowerCase() === wanted.toLowerCase());
        return { data: hit ? [{ id: hit[1].id, email: hit[0] }] : [] };
      },
      retrieve: async (id) => { const hit = Object.entries(customers).find(([, c]) => c.id === id); return hit ? { id, email: hit[0] } : { deleted: true }; },
    },
    subscriptions: {
      list: async ({ customer }) => {
        const hit = Object.values(customers).find((c) => c.id === customer);
        return { data: (hit && hit.subs) || [] };
      },
    },
    prices: { retrieve: async () => ({ active: true, unit_amount: 6000, currency: 'aud' }) },
    checkout: {
      sessions: {
        create: async (params) => { calls.created.push(params); return { id: 'cs_test_new', url: 'https://checkout.example/session' }; },
        retrieve: async (id) => { if (!sessions[id]) throw new Error('No such session'); return sessions[id]; },
        listLineItems: async (id) => ({ data: (lineItems[id] || []).map((price) => ({ price: { id: price } })) }),
      },
    },
    billingPortal: { sessions: { create: async () => ({ url: 'https://billing.example/portal' }) } },
    webhooks: {
      constructEvent: (raw, sig) => {
        if (sig !== 'valid') throw new Error('bad signature');
        return JSON.parse(raw.toString());
      },
    },
  };
}

// Reads "field_key: value" lines so dev and tests get predictable extraction. The
// app's built-in sample documents map onto the demo pack so reports look real locally.
const SAMPLE_DOCS = [['COMMERCIAL INVOICE', 0], ['PACKING LIST', 1], ['BILL OF LADING', 2]];
function fakeExtraction(params) {
  const text = params.messages[0].content.map((b) => b.text || '').join('\n');
  const sample = SAMPLE_DOCS.find(([marker]) => text.includes(marker));
  if (sample) {
    const doc = DEMO_PACK[sample[1]];
    return { doc_type: doc.doc_type, doc_title: doc.name, readability: 'clear', fields: doc.fields.map((f) => ({ ...f, quote: f.value })), other_facts: [] };
  }
  const fields = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^([a-z_]+):\s*(.+)$/);
    if (m && m[1] !== 'file') fields.push({ key: m[1], value: m[2].trim(), page: 1, quote: line.trim() });
  }
  return { doc_type: 'other', doc_title: 'Test document', readability: 'clear', fields, other_facts: [] };
}

export function fakeAnthropic({ replyText = 'A bill of lading is a receipt, a contract of carriage and a document of title.', fail = false, slowMs = 0, outputTokens = 0 } = {}) {
  const failure = () => new Error(client.failMessage || 'upstream exploded');
  const calls = [];
  const client = {
    calls,
    fail,
    slowMs,
    outputTokens,
    toolCall: null, // set to { kind, value } and the next turn asks for that check first
    models: { retrieve: async (id) => ({ id }) },
    beta: {
      messages: {
        stream(params) {
          calls.push(params);
          const failNow = client.fail;
          if (client.toolCall) {
            const input = client.toolCall;
            client.toolCall = null;
            const content = [{ type: 'text', text: 'Let me run that.' }, { type: 'tool_use', id: 'toolu_1', name: 'check_identifier', input }];
            return {
              abort() {},
              async *[Symbol.asyncIterator]() { yield { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Let me run that.' } }; },
              async finalMessage() { return { stop_reason: 'tool_use', content, usage: {} }; },
            };
          }
          const delay = client.slowMs;
          const isJson = params.output_config && params.output_config.format;
          let content;
          if (isJson) {
            const isExtract = String(params.system).includes('extract its facts');
            content = JSON.stringify(isExtract
              ? fakeExtraction(params)
              : { summary: 'Stop and verify the flagged items before any funds move.', findings: [{ severity: 'medium', title: 'No inspection certificate in the pack', detail: 'The contract calls for one, and none was supplied.', documents: [], next_step: 'Ask the seller for it.' }], questions: ['Who issued the certificate of origin?'], missing_documents: ['Inspection certificate'] });
          } else {
            content = replyText;
          }
          const words = content.split(/(?<= )/);
          let aborted = false;
          return {
            abort() { aborted = true; },
            async *[Symbol.asyncIterator]() {
              if (failNow) throw failure();
              yield { type: 'content_block_start', content_block: { type: 'text' } };
              for (const w of words) {
                if (delay) await new Promise((r) => setTimeout(r, delay));
                if (aborted) throw new Error('Request was aborted.');
                yield { type: 'content_block_delta', delta: { type: 'text_delta', text: w } };
              }
            },
            async finalMessage() {
              if (failNow) throw failure();
              return { stop_reason: 'end_turn', content: [{ type: 'text', text: content }], usage: { output_tokens: client.outputTokens } };
            },
          };
        },
      },
    },
  };
  return client;
}

// Minimal Node req/res pair for calling a handler directly.
export function mockRequest({ method = 'POST', url = '/', headers = {}, body, cookies } = {}) {
  const h = { host: 'www.gdn-ai.com', ...headers };
  if (cookies) h.cookie = Object.entries(cookies).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ');
  return { method, url, headers: h, body };
}

export function mockResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    chunks: [],
    writableEnded: false,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    getHeader(k) { return this.headers[k.toLowerCase()]; },
    write(c) { this.chunks.push(String(c)); return true; },
    end(c) { if (c) this.chunks.push(c instanceof Buffer ? c.toString() : String(c)); this.writableEnded = true; },
    handlers: {},
    on(event, fn) { this.handlers[event] = fn; },
    get body() { return this.chunks.join(''); },
    get json() { return JSON.parse(this.body); },
    cookie(name) {
      const raw = this.headers['set-cookie'];
      const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
      const hit = list.find((c) => c.startsWith(`${name}=`));
      if (!hit) return null;
      return decodeURIComponent(hit.slice(name.length + 1).split(';')[0]);
    },
  };
  return res;
}
