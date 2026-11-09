// Gideon's voice and ears in the browser. The Speaker turns a streaming answer into
// speech a sentence at a time, and can stop, wait or carry on mid-word. Talk keeps the
// microphone open and decides when the person has started and finished speaking.
//
// The transcriber connection goes straight from the browser to ElevenLabs on a
// single-use token, because a serverless function cannot hold a socket open. Speech
// goes through /api/speak so the API key and the daily spending limits stay on the server.
import { SpeechChunker, speakable, isEcho, isBargeIn, isBackchannel, endOfTurnDelay, cleanTranscript } from './speech.js';

const SCRIBE_URL = 'wss://api.elevenlabs.io/v1/speech-to-text/realtime';
// The transcriber hears these trade terms properly when it is told to expect them.
const KEYTERMS = ['Gideon', 'bill of lading', 'letter of credit', 'packing list', 'Incoterms', 'EN590', 'ICUMSA', 'demurrage', 'laycan', 'charter party', 'SWIFT', 'IBAN', 'IMO number', 'UCP 600', 'FOB', 'CIF', 'CFR', 'SGS', 'FCO', 'ICPO', 'SPA'];
const SYNTH_AHEAD = 2;       // sentences paid for before they are needed
const HOLD_MS = 2200;        // how long Gideon waits after a possible interruption
const DUCK_LEVEL = 0.08;     // how quiet he goes the instant someone might be talking
const DUCK_MS = 1800;        // and how long he stays quiet if no words follow
const MIN_SPEECH_LEVEL = 0.015;
const SETTLE_MS = 1500;      // echo cancelling needs a moment when a call starts
const ECHO_TAIL_MS = 2500;   // the transcriber can report his voice after he has stopped
const IDLE_MS = 180000;      // nobody has spoken: close the microphone
const FATAL = new Set(['auth_error', 'quota_exceeded', 'unaccepted_terms']);

const CLIP_TEXT = {
  'greet-1': "Hi, it's Gideon. What are you working on?",
  'greet-2': 'Gideon here. What have you got for me?',
  'okay': 'Okay.',
  'right': 'Right.',
  'mhm': 'Mm-hm.',
  'moment': 'One moment.',
  'checking': 'Let me check that.',
  'got-it': 'Got it. What would you like me to look at?',
  'busy': "I'm still going through the documents. Give me a moment.",
  'sorry': 'Sorry, I lost that. Could you say it again?',
  'paused': "I'll pause the microphone for now. Tap resume when you want me.",
};

let context = null;
let analyser = null;
let master = null;
export function audio() {
  if (!context) {
    context = new (window.AudioContext || window.webkitAudioContext)();
    analyser = context.createAnalyser();
    analyser.fftSize = 512;
    analyser.connect(context.destination);
    master = context.createGain();
    master.connect(analyser);
  }
  if (context.state === 'suspended') context.resume().catch(() => {});
  return context;
}

export const talkSupported = () => Boolean(
  navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  && window.WebSocket && window.AudioWorkletNode
  && (window.AudioContext || window.webkitAudioContext),
);

export class Speaker {
  constructor({ onChange = () => {} } = {}) {
    this.onChange = onChange;
    this.items = [];
    this.current = null;
    this.held = false;
    this.open = false;
    this.heard = [];
    this.history = [];
    this.lastPlayedAt = 0;
    this.playedThisTurn = false;
    this.spent = 0;
    this.maxChars = Infinity;
    this.chunker = null;
    this.abort = new AbortController();
    this.previous = '';
    this.clips = new Map();
    this.ducked = false;
  }

  get playing() { return Boolean(this.current); }
  get active() { return this.open || this.items.length > 0; }

  // What the microphone might be hearing right now, for the echo check.
  recent() {
    return [...this.history.slice(-6), ...this.items.slice(0, 2).map((i) => i.text)].join(' ');
  }
  heardText() { return this.heard.join(' ').trim(); }

  level() {
    if (!analyser) return 0;
    const data = new Uint8Array(analyser.fftSize);
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const v of data) sum += ((v - 128) / 128) ** 2;
    return Math.sqrt(sum / data.length);
  }

  begin({ maxChars = Infinity } = {}) {
    this.discard();
    this.abort = new AbortController();
    this.chunker = new SpeechChunker();
    this.open = true;
    this.heard = [];
    this.spent = 0;
    this.maxChars = maxChars;
    this.previous = '';
    this.playedThisTurn = false;
    this.onChange();
  }

  feed(delta) {
    if (!this.open) return;
    for (const text of this.chunker.feed(delta)) this.push(text);
  }

  finish() {
    if (!this.open) return;
    for (const text of this.chunker.flush()) this.push(text);
    this.open = false;
    this.pump();
    this.onChange();
  }

  // Something Gideon says that did not come from the model.
  say(text) {
    const piece = speakable(text);
    if (!piece) return;
    this.heard = [];
    this.spent = 0;
    this.maxChars = Infinity;
    this.playedThisTurn = false;
    const chunker = new SpeechChunker();
    for (const sentence of [...chunker.feed(piece), ...chunker.flush()]) this.push(sentence);
  }

  push(text) {
    if (this.spent + text.length > this.maxChars) { this.open = false; return; }
    this.spent += text.length;
    this.items.push({ kind: 'speech', text, previous: this.previous });
    this.previous = text;
    this.pump();
  }

  async loadClips() {
    if (this.clips.size) return;
    await Promise.all(Object.keys(CLIP_TEXT).map(async (name) => {
      try {
        const res = await fetch(`/media/voice/${name}.mp3`);
        if (!res.ok) return;
        this.clips.set(name, await audio().decodeAudioData(await res.arrayBuffer()));
      } catch { /* Gideon can do without a filler word */ }
    }));
  }

  // Short recorded phrases, so saying "Right." costs nothing and takes no time.
  clip(name) {
    const buffer = this.clips.get(name);
    if (!buffer || this.held) return;
    this.items.splice(this.current ? 1 : 0, 0, { kind: 'clip', text: CLIP_TEXT[name], buffer, ready: true });
    this.pump();
  }

  async synth(item) {
    const { signal } = this.abort;
    try {
      const res = await fetch('/api/speak', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: item.text, previous: item.previous }),
        signal,
      });
      if (!res.ok) throw new Error(`voice ${res.status}`);
      item.buffer = await audio().decodeAudioData(await res.arrayBuffer());
    } catch (e) {
      if (signal.aborted) return;
      item.fallback = true;
      console.warn('voice fell back to the browser', e && e.message);
    }
    item.ready = true;
    this.pump();
  }

  pump() {
    let ahead = 0;
    for (const item of this.items) {
      if (item.kind === 'speech' && !item.started) { item.started = true; this.synth(item); }
      if (++ahead > SYNTH_AHEAD) break;
    }
    if (this.current || this.held) return;
    const head = this.items[0];
    if (head && head.ready) this.play(head);
    this.onChange();
  }

  play(item) {
    if (item.fallback) { this.playWithBrowser(item); return; }
    const source = audio().createBufferSource();
    source.buffer = item.buffer;
    source.connect(master);
    const offset = item.offset || 0;
    this.current = { item, source, startedAt: audio().currentTime - offset };
    source.onended = () => {
      if (!this.current || this.current.source !== source) return;
      this.finished(item);
    };
    source.start(0, offset);
    if (item.kind === 'speech') this.playedThisTurn = true;
    this.onChange();
  }

  playWithBrowser(item) {
    if (!('speechSynthesis' in window)) { this.items.shift(); this.pump(); return; }
    const utterance = new SpeechSynthesisUtterance(item.text);
    this.current = { item, utterance };
    utterance.onend = () => {
      if (!this.current || this.current.utterance !== utterance) return;
      this.finished(item);
    };
    speechSynthesis.speak(utterance);
    this.playedThisTurn = true;
    this.onChange();
  }

  finished(item) {
    if (item.kind === 'speech') this.heard.push(item.text);
    this.history.push(item.text);
    this.lastPlayedAt = Date.now();
    this.current = null;
    this.items.shift();
    this.pump();
    this.onChange();
  }

  silence() {
    const now = this.current;
    if (!now) return null;
    this.current = null;
    this.lastPlayedAt = Date.now();
    if (now.source) {
      now.source.onended = null;
      try { now.source.stop(); } catch { /* it had already ended */ }
      return audio().currentTime - now.startedAt;
    }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    return 0;
  }

  // The microphone heard something. Transcription takes a second or two to say whether
  // it was words, and a person who starts talking should not have to wait that long, so
  // Gideon drops almost to silence right away and keeps his place.
  duck(quiet) {
    if (!master || quiet === this.ducked) return;
    this.ducked = quiet;
    master.gain.setTargetAtTime(quiet ? DUCK_LEVEL : 1, audio().currentTime, 0.03);
  }

  // The person has started talking. Stop now, and keep the rest in case it comes to nothing.
  hold() {
    if (this.held) return;
    this.held = true;
    this.duck(false);
    const item = this.current && this.current.item;
    const position = this.silence();
    if (item && position !== null) item.offset = Math.max(0, position - 0.3);
    this.onChange();
  }

  release() {
    if (!this.held) return;
    this.held = false;
    this.pump();
    this.onChange();
  }

  // They did. What was never said is thrown away, and what they heard is kept for the record.
  discard() {
    const item = this.current && this.current.item;
    const position = this.silence();
    const stopped = item || this.items[0];
    if (stopped && stopped.kind === 'speech') {
      const at = position !== null ? position : stopped.offset || 0;
      const length = stopped.buffer ? stopped.buffer.duration : 0;
      if (length && at > 0.2) {
        const words = stopped.text.split(' ');
        this.heard.push(words.slice(0, Math.ceil(words.length * Math.min(1, at / length))).join(' '));
      }
      this.history.push(stopped.text);
    }
    this.abort.abort();
    this.abort = new AbortController();
    this.items = [];
    this.open = false;
    this.held = false;
    this.duck(false);
    this.onChange();
  }
}

export class TalkError extends Error {
  constructor(message, kind, status) { super(message); this.kind = kind; this.status = status; }
}

function toBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export class Talk {
  constructor({ speaker, onState = () => {}, onLive = () => {}, onTurn = () => {}, onLost = () => {}, onIdle = () => {} }) {
    this.speaker = speaker;
    this.onState = onState;
    this.onLive = onLive;
    this.onTurn = onTurn;
    this.onLost = onLost;
    this.onIdle = onIdle;
    this.active = false;
    this.paused = false;
    this.muted = false;
    this.busy = null;
    this.pending = '';
    this.partial = '';
    this.micLevel = 0;
    this.lastActivity = 0;
    this.reconnects = 0;
    this.loudFrames = 0;
    this.echoFloor = 0.005;
    this.margin = 3;
    this.listenAfter = 0;
  }

  state() {
    if (!this.active) return 'off';
    if (this.paused) return 'paused';
    if (this.partial || this.pending) return 'hearing';
    if (this.speaker.playing) return 'speaking';
    if (this.busy) return this.busy;
    if (this.muted) return 'muted';
    return 'listening';
  }
  refresh() { this.onState(this.state()); }
  touch() { this.lastActivity = Date.now(); }
  setBusy(phase) { this.busy = phase; this.refresh(); }

  async start() {
    audio();
    this.active = true;
    this.paused = false;
    this.muted = false;
    this.reconnects = 0;
    this.onState('connecting');
    try {
      await this.openMic();
      await this.connect();
    } catch (e) {
      this.stop();
      throw e;
    }
    this.touch();
    this.listenAfter = Date.now() + SETTLE_MS;
    this.idleTimer = setInterval(() => this.checkIdle(), 5000);
    this.refresh();
  }

  async openMic() {
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      throw new TalkError('Microphone access is needed to talk to Gideon.', 'mic');
    }
    this.stream = stream;
    const ctx = audio();
    await ctx.audioWorklet.addModule('/assets/mic-worklet.js');
    this.micSource = ctx.createMediaStreamSource(stream);
    this.micNode = new AudioWorkletNode(ctx, 'mic-capture');
    this.micNode.port.onmessage = ({ data }) => this.frame(data);
    // Silent on purpose: an audio node only runs if it leads to the speakers.
    this.micSink = ctx.createGain();
    this.micSink.gain.value = 0;
    this.micSource.connect(this.micNode);
    this.micNode.connect(this.micSink);
    this.micSink.connect(ctx.destination);
  }

  closeMic() {
    if (this.micNode) this.micNode.port.onmessage = null;
    for (const node of [this.micSource, this.micNode, this.micSink]) { try { if (node) node.disconnect(); } catch { /* already gone */ } }
    if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    this.micSource = this.micNode = this.micSink = this.stream = null;
    this.micLevel = 0;
  }

  async connect() {
    const res = await fetch('/api/speak?action=token', { method: 'POST' });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new TalkError(data.error || 'Live conversation is unavailable right now.', res.status === 402 ? 'paywall' : 'server', res.status);
    }
    const { token } = await res.json();
    const params = new URLSearchParams({
      model_id: 'scribe_v2_realtime',
      token,
      audio_format: 'pcm_16000',
      commit_strategy: 'vad',
      vad_silence_threshold_secs: '0.5',
    });
    for (const term of KEYTERMS) params.append('keyterms', term);

    await new Promise((resolve, reject) => {
      const socket = new WebSocket(`${SCRIBE_URL}?${params}`);
      this.socket = socket;
      this.ready = false;
      this.backlog = [];
      const giveUp = setTimeout(() => reject(new TalkError('The voice service did not answer.', 'server')), 8000);
      socket.onmessage = (event) => {
        let message;
        try { message = JSON.parse(event.data); } catch { return; }
        if (message.message_type === 'session_started') {
          clearTimeout(giveUp);
          this.ready = true;
          for (const frame of this.backlog) socket.send(frame);
          this.backlog = [];
          resolve();
          return;
        }
        this.message(message);
      };
      socket.onerror = () => {};
      socket.onclose = () => {
        clearTimeout(giveUp);
        if (this.socket !== socket) return;
        this.socket = null;
        if (!this.ready) { reject(new TalkError('The voice service closed the connection.', 'server')); return; }
        this.ready = false;
        this.dropped();
      };
    });
  }

  // A dropped socket should not end the conversation if a new one can be had.
  async dropped() {
    if (!this.active || this.paused) return;
    if (++this.reconnects > 4) { this.onLost(new TalkError('The connection to the voice service was lost.', 'lost')); return; }
    await new Promise((r) => setTimeout(r, 400 * this.reconnects));
    if (!this.active || this.paused) return;
    try {
      await this.connect();
    } catch (e) {
      this.onLost(e);
    }
  }

  // Runs on every 100 ms of microphone audio while Gideon is talking. The bar it has to
  // clear is set by what the microphone hears of his own voice, so a laptop with weak
  // echo cancelling needs someone to speak up a little rather than cutting him off at
  // random, and it rises further each time it fires and no words turn up.
  listenForVoice(level) {
    if (!this.speaker.playing || this.muted || Date.now() < this.listenAfter) { this.loudFrames = 0; return; }
    if (level <= Math.max(MIN_SPEECH_LEVEL, this.echoFloor * this.margin)) {
      this.loudFrames = 0;
      this.echoFloor = this.echoFloor * 0.9 + level * 0.1;
      return;
    }
    if (++this.loudFrames < 2) return;
    this.speaker.duck(true);
    clearTimeout(this.duckTimer);
    this.duckTimer = setTimeout(() => {
      this.speaker.duck(false);
      this.margin = Math.min(8, this.margin * 1.3);
    }, DUCK_MS);
  }

  frame({ pcm, level }) {
    this.micLevel = level;
    this.listenForVoice(level);
    const message = JSON.stringify({ message_type: 'input_audio_chunk', audio_base_64: toBase64(pcm), commit: false, sample_rate: 16000 });
    if (this.socket && this.ready && this.socket.readyState === WebSocket.OPEN) this.socket.send(message);
    else if (this.backlog && this.backlog.length < 30) this.backlog.push(message);
  }

  message(message) {
    switch (message.message_type) {
      case 'partial_transcript': this.heardPartial(message.text); break;
      case 'committed_transcript': this.heardFinal(message.text); break;
      case 'warning': console.warn('voice service:', message.warning); break;
      default:
        console.warn('voice service:', message.message_type, message.error);
        if (FATAL.has(message.message_type)) this.onLost(new TalkError('The voice service refused the connection.', 'lost'));
        else if (this.socket) this.socket.close();
    }
  }

  // Gideon's own voice can leak into the microphone, so anything heard while or just
  // after he speaks has to prove it is not him before it counts.
  mightBeEcho() {
    return this.speaker.playing || Date.now() - this.speaker.lastPlayedAt < ECHO_TAIL_MS;
  }

  heardPartial(raw) {
    const text = cleanTranscript(raw);
    if (!text) return;
    if (this.mightBeEcho() && !isBargeIn(text, this.speaker.recent())) return;
    this.touch();
    if (this.speaker.active || this.busy) {
      clearTimeout(this.duckTimer);
      this.speaker.hold();
      this.armRelease();
    }
    clearTimeout(this.endTimer);
    this.partial = text;
    this.onLive(`${this.pending} ${text}`.trim());
    this.refresh();
  }

  heardFinal(raw) {
    const text = cleanTranscript(raw);
    this.partial = '';
    if (!text) { this.refresh(); return; }
    if (this.mightBeEcho() && isEcho(text, this.speaker.recent())) { this.refresh(); return; }
    // "Mm-hm" while Gideon talks means carry on. On its own, "yes" is an answer.
    if (isBackchannel(text) && (this.speaker.playing || this.speaker.held)) {
      clearTimeout(this.duckTimer);
      this.speaker.duck(false);
      this.speaker.release();
      this.refresh();
      return;
    }
    this.touch();
    this.reconnects = 0;
    clearTimeout(this.releaseTimer);
    this.pending = `${this.pending} ${text}`.trim();
    this.onLive(this.pending);
    clearTimeout(this.endTimer);
    this.endTimer = setTimeout(() => this.endOfTurn(), endOfTurnDelay(this.pending));
    this.refresh();
  }

  armRelease() {
    clearTimeout(this.releaseTimer);
    this.releaseTimer = setTimeout(() => {
      if (this.pending) return;
      // Nothing came of it. Gideon picks up from just before where he stopped.
      this.partial = '';
      this.onLive('');
      this.speaker.release();
      this.refresh();
    }, HOLD_MS);
  }

  endOfTurn() {
    const text = this.pending;
    this.pending = '';
    this.partial = '';
    this.onLive('');
    this.refresh();
    if (text) this.onTurn(text);
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.stream) this.stream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    this.touch();
    this.refresh();
  }

  checkIdle() {
    if (this.paused || Date.now() - this.lastActivity < IDLE_MS) return;
    if (this.speaker.active || this.busy) { this.touch(); return; }
    this.pause();
    this.onIdle();
  }

  pause() {
    this.paused = true;
    this.closeSocket();
    this.closeMic();
    this.refresh();
  }

  async resume() {
    audio();
    this.paused = false;
    this.muted = false;
    this.reconnects = 0;
    this.onState('connecting');
    try {
      await this.openMic();
      await this.connect();
    } catch (e) {
      this.paused = true;
      this.closeMic();
      this.refresh();
      throw e;
    }
    this.touch();
    this.refresh();
  }

  closeSocket() {
    const socket = this.socket;
    this.socket = null;
    this.ready = false;
    if (socket) { socket.onclose = null; try { socket.close(); } catch { /* already closed */ } }
  }

  stop() {
    this.active = false;
    this.paused = false;
    this.busy = null;
    this.pending = '';
    this.partial = '';
    clearInterval(this.idleTimer);
    clearTimeout(this.endTimer);
    clearTimeout(this.releaseTimer);
    clearTimeout(this.duckTimer);
    this.closeSocket();
    this.closeMic();
    this.onLive('');
    this.onState('off');
  }
}
