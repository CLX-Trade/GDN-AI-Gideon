// The rules of a spoken conversation with Gideon. Pure functions with no browser or
// Node dependencies, so the page runs the same code the tests check.
//
// Three questions live here: what should be said aloud, did the person really speak
// or did the microphone hear Gideon, and has the person finished their thought.

// Everything after this line in an answer shows on screen and is not read aloud.
export const SCREEN_MARKER = '[screen]';

export function splitScreen(text) {
  const source = String(text ?? '');
  const at = source.indexOf(SCREEN_MARKER);
  if (at < 0) return { spoken: source, screen: '' };
  return { spoken: source.slice(0, at), screen: source.slice(at + SCREEN_MARKER.length) };
}

export function displayText(text) {
  return String(text ?? '').replace(/^[ \t]*\[screen\][ \t]*\n?/m, '');
}

// Markdown read aloud sounds like a robot reading punctuation.
export function speakable(raw) {
  return String(raw ?? '')
    .split('\n')
    .filter((line) => !/^\s*\|/.test(line) && !/^\s*[:|-]+\s*$/.test(line))
    .map((line) => line
      .replace(/^\s{0,3}#{1,6}\s+/, '')
      .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
      .replace(/^\s*>\s?/, ''))
    .join(' ')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/`+/g, '')
    .replace(/\*+/g, '')
    .replace(/(^|\s)_+|_+(?=\s|$)/g, '$1')
    .replace(/\s+[—–]\s+/g, ', ')
    .replace(/\s+/g, ' ')
    .trim();
}

// A full stop after one of these does not end a sentence.
const ABBREVIATION = /(?:^|[\s(])(?:mr|mrs|ms|dr|st|no|nos|vs|etc|ltd|pty|pte|inc|co|corp|approx|e\.g|i\.e|u\.s|u\.k|mv|m\.v|fig|art|ref|para|cl)\.$/i;
const INITIAL = /(?:^|[\s.(])[A-Z]\.$/;
const SENTENCE_END = /[.!?…]+["'”’)\]]*(?=\s)|\n/g;

// Cuts a streaming answer into pieces to speak. The first piece goes out as early as
// it reasonably can, because how fast Gideon starts talking is what makes this feel
// like a conversation. Speech stops at the screen marker or at any code block.
export class SpeechChunker {
  constructor({ minChars = 16, firstClause = 48, softMax = 220 } = {}) {
    this.minChars = minChars;
    this.firstClause = firstClause;
    this.softMax = softMax;
    this.buffer = '';
    this.ended = false;
    this.count = 0;
  }

  findCut(text) {
    SENTENCE_END.lastIndex = 0;
    let match;
    while ((match = SENTENCE_END.exec(text))) {
      const end = match.index + match[0].length;
      const head = text.slice(0, end);
      if (match[0] === '\n') return end;
      if (ABBREVIATION.test(head) || INITIAL.test(head)) continue;
      if (speakable(head).length < this.minChars) continue;
      return end;
    }
    if (this.count === 0 && text.length >= this.firstClause) {
      const clause = text.slice(this.minChars).search(/[,;:]\s/);
      if (clause >= 0) return this.minChars + clause + 1;
    }
    if (text.length >= this.softMax) {
      const window = text.slice(0, this.softMax);
      const soft = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(': '));
      if (soft > this.minChars) return soft + 1;
      const space = window.lastIndexOf(' ');
      return space > 0 ? space : this.softMax;
    }
    return -1;
  }

  drain() {
    const out = [];
    let cut;
    while ((cut = this.findCut(this.buffer)) >= 0) {
      const piece = speakable(this.buffer.slice(0, cut));
      this.buffer = this.buffer.slice(cut).replace(/^\s+/, '');
      if (piece) { out.push(piece); this.count++; }
    }
    return out;
  }

  feed(delta) {
    if (this.ended) return [];
    this.buffer += delta;
    const stops = [this.buffer.indexOf(SCREEN_MARKER), this.buffer.indexOf('```')].filter((i) => i >= 0);
    if (stops.length) {
      this.buffer = this.buffer.slice(0, Math.min(...stops));
      return this.flush();
    }
    return this.drain();
  }

  flush() {
    if (this.ended) return [];
    const out = this.drain();
    const last = speakable(this.buffer);
    this.buffer = '';
    this.ended = true;
    if (last) out.push(last);
    return out;
  }
}

const wordsOf = (s) => String(s ?? '').toLowerCase().normalize('NFKD')
  .replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean);

const sameWord = (a, b) => a === b || (a.length >= 5 && b.length >= 5 && a.slice(0, 5) === b.slice(0, 5));

// How much of what the microphone heard appears, in order, in what Gideon just said.
// Order matters: a person using a few of the same words is not an echo, but the
// transcript of Gideon's own voice follows his sentence even when it mishears a word.
export function echoShare(heard, spoken) {
  const h = wordsOf(heard);
  const s = wordsOf(spoken).slice(-120);
  if (!h.length || !s.length) return 0;
  let previous = new Array(s.length + 1).fill(0);
  for (const word of h) {
    const row = [0];
    for (let j = 1; j <= s.length; j++) {
      row[j] = sameWord(word, s[j - 1]) ? previous[j - 1] + 1 : Math.max(previous[j], row[j - 1]);
    }
    previous = row;
  }
  return previous[s.length] / h.length;
}

export const isEcho = (heard, spoken) => echoShare(heard, spoken) >= 0.7;

// What people say to show they are following. Nobody means it as "stop talking".
const BACKCHANNEL = new Set(['mm', 'mmm', 'mhm', 'hmm', 'hm', 'uh', 'um', 'ah', 'oh', 'yeah', 'yep', 'yes', 'right', 'okay', 'ok', 'sure', 'uhhuh', 'mmhmm', 'cool', 'good', 'great', 'nice', 'thanks']);
const INTERRUPT_WORDS = new Set(['stop', 'wait', 'hold', 'hang', 'sorry', 'no', 'nope', 'actually', 'excuse', 'pardon', 'gideon', 'but', 'what', 'why', 'how']);

export function isBackchannel(text) {
  const words = wordsOf(text).map((w) => w.replace(/'/g, ''));
  return words.length > 0 && words.length <= 3 && words.every((w) => BACKCHANNEL.has(w));
}

// Should this partial transcript make Gideon stop talking?
export function isBargeIn(heard, spoken) {
  const words = wordsOf(heard);
  if (!words.length || isBackchannel(heard)) return false;
  if (words.length === 1 && !INTERRUPT_WORDS.has(words[0])) return false;
  return !isEcho(heard, spoken);
}

// How long to wait after the transcriber says a segment ended. Someone who stops on
// "and" or "because" has not finished, however long the pause.
export function endOfTurnDelay(text) {
  const t = String(text ?? '').trim();
  if (/\?["')]*$/.test(t)) return 50;
  if (/\b(and|but|so|because|or|the|a|an|to|of|with|if|that|for|um|uh|er)[,.…]*$/i.test(t)) return 1100;
  if (/[.!]["')]*$/.test(t)) return 150;
  return 500;
}

// Transcribers mark sounds such as (coughs) or [music]. Those are not words said to Gideon.
export function cleanTranscript(text) {
  return String(text ?? '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/["“”]/g, '').replace(/\s+/g, ' ').trim();
}

export const wordCount = (text) => wordsOf(text).length;

// The headline of something written to be read, cut down to what works said aloud.
export function headline(text, maxChars = 200) {
  const chunker = new SpeechChunker({ firstClause: Infinity });
  let out = '';
  for (const piece of [...chunker.feed(String(text ?? '')), ...chunker.flush()]) {
    if (out && out.length + piece.length > maxChars) break;
    out = `${out} ${piece}`.trim();
  }
  return out;
}

// A long call must not resend everything forever or hit the message limit, but a
// document pasted early still has to be there thirty turns later.
export function windowMessages(messages, keep = 40) {
  if (messages.length <= keep) return messages;
  const cut = messages.length - keep;
  const isDocument = (m) => Array.isArray(m.content) || (typeof m.content === 'string' && m.content.length > 2000);
  const kept = [...messages.slice(0, cut).filter(isDocument), ...messages.slice(cut)];
  while (kept.length && kept[0].role !== 'user') kept.shift();
  return kept;
}

// "Go ahead and check them" with a pack waiting is an instruction, not a question for
// the model. A question about the documents is not.
export function wantsPackCheck(text) {
  if (wordCount(text) > 10) return false;
  if (/^\s*(what|how|why|which|when|where|who|is|are|does|do|did)\b/i.test(text)) return false;
  return /\b(check|run|compare|go ahead|start)\b/i.test(text);
}

// What the model should remember about an answer that was cut off.
export function annotateInterrupted(full, heard) {
  const note = heard
    ? `[The user interrupted you here. They only heard this much aloud: "${heard}"]`
    : '[The user interrupted you before hearing any of this aloud.]';
  return `${full}\n\n${note}`;
}
