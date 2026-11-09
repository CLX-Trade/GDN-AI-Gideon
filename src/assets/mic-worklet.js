// Runs on the browser's audio thread. Turns the microphone into 16 kHz 16-bit mono
// PCM in 100 ms frames, which is what the transcriber takes, whatever rate the
// device runs at. Averaging while decimating is a crude filter, and enough for speech.
const OUT_RATE = 16000;
const FRAME = OUT_RATE / 10;

class MicCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.ratio = sampleRate / OUT_RATE;
    this.frame = new Int16Array(FRAME);
    this.written = 0;
    this.position = 0;
    this.sum = 0;
    this.taken = 0;
    this.energy = 0;
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!channel) return true;
    for (let i = 0; i < channel.length; i++) {
      this.sum += channel[i];
      this.taken++;
      this.position++;
      if (this.position < this.ratio) continue;
      this.position -= this.ratio;
      const sample = Math.max(-1, Math.min(1, this.sum / this.taken));
      this.sum = 0;
      this.taken = 0;
      this.energy += sample * sample;
      this.frame[this.written++] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      if (this.written === FRAME) {
        const pcm = this.frame.buffer.slice(0);
        this.port.postMessage({ pcm, level: Math.sqrt(this.energy / FRAME) }, [pcm]);
        this.written = 0;
        this.energy = 0;
      }
    }
    return true;
  }
}

registerProcessor('mic-capture', MicCapture);
