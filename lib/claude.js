// Every model call goes through here.
//
// Default model is Claude Opus 5.5, overridable with CLAUDE_MODEL. Server-side
// refusal fallback is on: a false-positive safety decline on an ordinary trade
// document is retried on Anthropic's recommended model instead of failing.
import { anthropic } from './deps.js';
import { metric } from './metrics.js';

export const MODEL = () => (process.env.CLAUDE_MODEL || 'claude-opus-5-5').trim();
const BETAS = ['server-side-fallback-2026-07-01'];
const MAX_CONTINUATIONS = 3;

export class ModelError extends Error {
  constructor(message, kind) { super(message); this.kind = kind; }
}

// Prefer what the answer actually cited. If it cited nothing, list what it searched,
// so anyone can still follow the answer back to where it came from.
function collectSources(content, into) {
  for (const block of content) {
    if (block.type !== 'text' || !Array.isArray(block.citations)) continue;
    for (const c of block.citations) {
      if (c.url && !into.has(c.url)) into.set(c.url, c.title || c.url);
    }
  }
  if (into.size) return;
  for (const block of content) {
    if (block.type !== 'web_search_tool_result' || !Array.isArray(block.content)) continue;
    for (const r of block.content) {
      if (r.url && !into.has(r.url) && into.size < 5) into.set(r.url, r.title || r.url);
    }
  }
}

// Running totals for the daily digest, so the cost per customer is visible.
function recordUsage(usage) {
  if (!usage) return;
  const input = (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0);
  metric('ai_input_tokens', input);
  metric('ai_output_tokens', usage.output_tokens || 0);
  const searches = usage.server_tool_use && usage.server_tool_use.web_search_requests;
  if (searches) metric('ai_web_searches', searches);
}

// Streams a chat answer. Web search can pause a turn, in which case the request
// is continued with the partial assistant message appended, as the API requires.
export async function streamAnswer({ system, messages, webSearchUses = 0, maxTokens = 16000, effort = 'medium', onText, onSearch, signal }) {
  const params = {
    model: MODEL(),
    max_tokens: maxTokens,
    system,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort },
    cache_control: { type: 'ephemeral' },
  };
  if (webSearchUses > 0) params.tools = [{ type: 'web_search_20260209', name: 'web_search', max_uses: webSearchUses }];

  const sources = new Map();
  let conversation = messages;
  for (let attempt = 0; ; attempt++) {
    const stream = anthropic().beta.messages.stream({ ...params, messages: conversation });
    const abort = () => stream.abort();
    if (signal) {
      if (signal.aborted) abort();
      signal.addEventListener('abort', abort, { once: true });
    }
    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block.type === 'server_tool_use') {
          if (onSearch) onSearch();
        } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          onText(event.delta.text);
        }
      }
      const final = await stream.finalMessage();
      recordUsage(final.usage);
      collectSources(final.content, sources);
      if (final.stop_reason === 'pause_turn' && attempt < MAX_CONTINUATIONS) {
        conversation = [...conversation, { role: 'assistant', content: final.content }];
        continue;
      }
      if (final.stop_reason === 'refusal') throw new ModelError('The model declined this request.', 'refusal');
      return {
        truncated: final.stop_reason === 'max_tokens',
        sources: [...sources].map(([url, title]) => ({ url, title })),
        usage: final.usage,
      };
    } finally {
      if (signal) signal.removeEventListener('abort', abort);
    }
  }
}

// One JSON object conforming to `schema`. Streams under the hood so long documents
// cannot hit an HTTP timeout, and fails loudly rather than returning partial data.
export async function structured({ system, content, schema, effort = 'low', maxTokens = 16000, signal }) {
  const stream = anthropic().beta.messages.stream({
    model: MODEL(),
    max_tokens: maxTokens,
    system,
    betas: BETAS,
    fallbacks: 'default',
    output_config: { effort, format: { type: 'json_schema', schema } },
    messages: [{ role: 'user', content }],
  });
  if (signal) signal.addEventListener('abort', () => stream.abort(), { once: true });
  const final = await stream.finalMessage();
  recordUsage(final.usage);
  if (final.stop_reason === 'refusal') throw new ModelError('The model declined this document.', 'refusal');
  if (final.stop_reason === 'max_tokens') throw new ModelError('The document was too long to finish reading.', 'too_long');
  const text = final.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  try {
    return JSON.parse(text);
  } catch {
    throw new ModelError('The model returned an unreadable result.', 'bad_json');
  }
}

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// Validates a browser-supplied conversation. Only user/assistant turns get through,
// so a caller cannot inject a system message or use the endpoint as an open proxy
// with arbitrary tools or parameters.
export function sanitizeMessages(input, { maxMessages, maxChars, maxImages }) {
  if (!Array.isArray(input) || input.length === 0) return { error: 'messages array required' };
  if (input.length > maxMessages) return { error: 'This conversation is too long. Please start a new one.', code: 'too_long' };
  let chars = 0;
  let images = 0;
  const clean = [];

  for (const message of input) {
    if (!message || (message.role !== 'user' && message.role !== 'assistant')) return { error: 'invalid message role' };
    if (typeof message.content === 'string') {
      if (!message.content.trim()) return { error: 'empty message' };
      chars += message.content.length;
      clean.push({ role: message.role, content: message.content });
      continue;
    }
    if (!Array.isArray(message.content) || message.content.length === 0 || message.role !== 'user') return { error: 'invalid message content' };
    const blocks = [];
    for (const block of message.content) {
      if (block && block.type === 'text' && typeof block.text === 'string' && block.text.trim()) {
        chars += block.text.length;
        blocks.push({ type: 'text', text: block.text });
      } else if (block && block.type === 'image' && block.source && block.source.type === 'base64'
        && IMAGE_TYPES.has(block.source.media_type) && typeof block.source.data === 'string') {
        images++;
        blocks.push({ type: 'image', source: { type: 'base64', media_type: block.source.media_type, data: block.source.data } });
      } else {
        return { error: 'unsupported content block' };
      }
    }
    if (!blocks.length) return { error: 'empty message' };
    clean.push({ role: 'user', content: blocks });
  }

  if (clean[clean.length - 1].role !== 'user') return { error: 'the last message must be from the user' };
  if (chars > maxChars) return { error: 'That is too much text for one request. Please send less at a time.', code: 'too_long' };
  if (images > maxImages) return { error: 'Too many images in this conversation. Please start a new one.', code: 'too_long' };
  return { messages: clean };
}
