// 5.1 audio for the dome: channel order L R C LFE Ls Rs (venue + SMPTE order).
// A sound gets an azimuth/elevation in ROOM degrees (az + = right) and is panned between the
// two nearest speakers on the ring (constant power). Going up, it spreads over all five,
// so a sound at the zenith comes from everywhere.
export const CH = ['L', 'R', 'C', 'LFE', 'Ls', 'Rs'];
export const SPEAKERS = [ // ITU-R BS.775 positions
  { ch: 4, name: 'Ls', az: -110 },
  { ch: 0, name: 'L', az: -30 },
  { ch: 2, name: 'C', az: 0 },
  { ch: 1, name: 'R', az: 30 },
  { ch: 5, name: 'Rs', az: 110 },
];

export function gains51(az, el = 0, spread = 0) {
  const g = new Float32Array(6);
  let a = ((az + 180) % 360 + 360) % 360 - 180;
  const ring = SPEAKERS;
  let i = 0;
  if (a < ring[0].az) a += 360; // between Rs (110) and Ls (250 = -110)
  for (i = 0; i < ring.length; i++) {
    const s1 = ring[i], s2 = ring[(i + 1) % ring.length];
    const a1 = s1.az, a2 = i === ring.length - 1 ? s2.az + 360 : s2.az;
    if (a >= a1 && a <= a2) {
      const t = (a - a1) / (a2 - a1);
      g[s1.ch] = Math.cos((t * Math.PI) / 2);
      g[s2.ch] = Math.sin((t * Math.PI) / 2);
      break;
    }
  }
  const w = Math.max(spread, Math.pow(Math.max(0, Math.min(1, el / 90)), 1.3));
  for (const s of ring) g[s.ch] = Math.sqrt((1 - w) * g[s.ch] * g[s.ch] + w / 5);
  return g;
}

export class AudioEngine {
  constructor(ctx) {
    this.ctx = ctx;
    const d = ctx.destination;
    this.configureDestination();
    this.merger = ctx.createChannelMerger(6);
    this.master = ctx.createGain();
    this.delay = ctx.createDelay(1.0);
    // monitor = what this computer's own output plays. Turned down when the sound goes out
    // through the UNO Q bridge instead (the bridge taps this.delay, before the monitor).
    this.monitor = ctx.createGain();
    this.merger.connect(this.master).connect(this.delay).connect(this.monitor).connect(d);
    this.inputs = CH.map((_, i) => { const g = ctx.createGain(); g.connect(this.merger, 0, i); return g; });

    // meters
    this.splitter = ctx.createChannelSplitter(6);
    this.delay.connect(this.splitter);
    this.analysers = CH.map((_, i) => { const a = ctx.createAnalyser(); a.fftSize = 512; this.splitter.connect(a, i); return a; });
    this._buf = new Float32Array(512);
    this.noise = makePinkNoise(ctx, 4);
  }
  /** 6 discrete channels if the device has them (Dante VSC set to 5.1), otherwise a 5.1→stereo downmix */
  configureDestination() {
    const d = this.ctx.destination;
    this.discrete = d.maxChannelCount >= 6;
    if (this.discrete) {
      d.channelCount = 6; d.channelCountMode = 'explicit'; d.channelInterpretation = 'discrete';
    } else {
      d.channelCount = Math.max(1, d.maxChannelCount); d.channelCountMode = 'explicit'; d.channelInterpretation = 'speakers';
    }
  }
  setDelay(ms) { this.delay.delayTime.setTargetAtTime(Math.max(0, ms) / 1000, this.ctx.currentTime, 0.05); }
  setMute(m) { this.master.gain.setTargetAtTime(m ? 0 : 1, this.ctx.currentTime, 0.05); }
  setMonitor(on) { this.monitor.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.05); }
  levels() {
    return this.analysers.map((a) => {
      a.getFloatTimeDomainData(this._buf);
      let s = 0; for (const v of this._buf) s += v * v;
      return Math.sqrt(s / this._buf.length);
    });
  }
  /** a slide's own sub-mix, faded in/out on slide changes */
  group() {
    const ctx = this.ctx, g = ctx.createGain();
    g.gain.value = 0; g.gain.setTargetAtTime(1, ctx.currentTime, 0.08);
    const outs = this.inputs.map((inp) => { const n = ctx.createGain(); n.connect(inp); return n; });
    return {
      ctx, engine: this, gain: g,
      panner: () => new Panner51(ctx, outs),
      channel: (i) => outs[i],
      noise: () => { const s = ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; return s; },
      dispose(fade = 0.25) {
        for (const o of outs) o.gain.setTargetAtTime(0, ctx.currentTime, fade / 3);
        setTimeout(() => outs.forEach((o) => o.disconnect()), fade * 1000 + 200);
      },
    };
  }
}

export class Panner51 {
  constructor(ctx, outs) {
    this.ctx = ctx;
    this.input = ctx.createGain();
    this.gains = [0, 1, 2, 4, 5].map((ch) => { const g = ctx.createGain(); g.gain.value = 0; this.input.connect(g).connect(outs[ch]); return { ch, g }; });
    this.lfeSend = ctx.createGain(); this.lfeSend.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
    this.input.connect(this.lfeSend).connect(lp).connect(outs[3]);
    this.last = new Float32Array(6);
  }
  set(az, el = 0, spread = 0, smooth = 0.03, when = this.ctx.currentTime) {
    const g = gains51(az, el, spread);
    for (const { ch, g: node } of this.gains) node.gain.setTargetAtTime(g[ch], when, smooth);
    this.last = g;
    return g;
  }
  lfe(v) { this.lfeSend.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  disconnect() { this.input.disconnect(); }
}

export function makePinkNoise(ctx, seconds = 4) {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < n; i++) { // Paul Kellet's filter
    const w = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852;
    b3 = 0.8665 * b3 + w * 0.3104856; b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898;
    d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
  }
  return buf;
}

/** channel ident: pink-noise bursts L, C, R, Rs, Ls, then LFE. Returns the schedule. */
export const IDENT_ORDER = [0, 2, 1, 5, 4, 3];
export const IDENT_STEP = 1.0;
export function identSchedule(start) { return IDENT_ORDER.map((ch, i) => ({ ch, t0: start + i * IDENT_STEP, t1: start + i * IDENT_STEP + 0.8 })); }
export function playIdent(group, ctxStart) {
  const { ctx } = group;
  for (const { ch, t0 } of identSchedule(ctxStart)) {
    if (t0 < ctx.currentTime - 0.05) continue;
    const src = group.noise();
    const env = ctx.createGain(); env.gain.value = 0;
    let node = src;
    if (ch === 3) { const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90; src.connect(lp); node = lp; }
    node.connect(env).connect(group.channel(ch));
    env.gain.setValueAtTime(0, t0); env.gain.linearRampToValueAtTime(ch === 3 ? 0.9 : 0.35, t0 + 0.02);
    env.gain.setValueAtTime(ch === 3 ? 0.9 : 0.35, t0 + 0.78); env.gain.linearRampToValueAtTime(0, t0 + 0.8);
    src.start(t0, Math.random() * 3); src.stop(t0 + 0.85);
  }
}
