// AudioWorklet: taps the 6-channel dome mix and hands it on in 10 ms interleaved blocks
// (480 frames at 48 kHz), straight to the network worker (lib/bridge-net-worker.js) once
// lib/bridgeout.js has given it that port; until then to the page.
class BridgeTap extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.ch = options.processorOptions?.channels ?? 6;
    this.frames = options.processorOptions?.frames ?? 480;
    this.buf = new Float32Array(this.frames * this.ch);
    this.n = 0;
    this.on = true;
    this.sink = this.port;
    this.port.onmessage = (e) => {
      if ('on' in e.data) this.on = !!e.data.on;
      if (e.data.sink) this.sink = e.data.sink;
    };
  }
  process(inputs) {
    if (!this.on) return true;
    const inp = inputs[0] || [];
    const len = inp[0] ? inp[0].length : 128;   // nothing connected: keep sending silence
    const ch = this.ch;
    let buf = this.buf;   // re-read after every hand-off: the old buffer is transferred (detached)
    for (let i = 0; i < len; i++) {
      const o = this.n * ch;
      for (let c = 0; c < ch; c++) { const x = inp[c]; buf[o + c] = x ? x[i] : 0; }
      if (++this.n === this.frames) {
        this.sink.postMessage(buf, [buf.buffer]);
        buf = this.buf = new Float32Array(this.frames * ch);
        this.n = 0;
      }
    }
    return true;
  }
}
registerProcessor('bridge-tap', BridgeTap);
