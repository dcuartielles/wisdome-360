// EX-12 · the custom synth. ONE AudioWorkletNode makes every sound of the instrument:
// notes (keyboard, drums, guitar), hums, 5.1 panning and a limiter, all as plain arithmetic on
// the audio thread. The page only sends messages: "play this note at this time, with these six
// speaker gains" and "these hums should sound like this now".
//
// Why: in EX-11 every note is a little graph of Web Audio nodes (oscillators, gains, filters,
// a panner). The browser handles a few hundred of those at once. Here a voice is a few numbers in
// an array, so the limit is how much arithmetic fits in 2.7 ms (128 samples at 48 kHz) — thousands
// of simple voices on a laptop.
//
// Messages in:  { type: 'notes', list: [{ when, bank, kind, f, len, vol, g: [6], line }] }
//               { type: 'hums',  list: [{ id, bank, f, gain, g: [6] }] }   (missing ids fade out)
//               { type: 'reset' }
// Messages out: { voices, hums, peak, reduction (dB), notesPerSec } about 4 times a second.

const TAU = Math.PI * 2;
const MAX_VOICES = 2048;
// speed: a sine table (phase 0..1, linear interpolation) and a rational tanh are much cheaper than
// Math.sin / Math.tanh, and inaudibly different here
const SN = 4096, SIN = new Float32Array(SN + 1);
for (let i = 0; i <= SN; i++) SIN[i] = Math.sin(TAU * i / SN);
const sinT = (p) => { const x = p * SN, i = x | 0; return SIN[i] + (SIN[i + 1] - SIN[i]) * (x - i); };
const ftanh = (x) => (x > 3 ? 1 : x < -3 ? -1 : x * (27 + x * x) / (27 + 9 * x * x));

// a cheap state-variable filter (Zavalishin's TPT form): lp / bp / hp from one structure
class SVF {
  constructor(f, q, mode) { this.ic1 = 0; this.ic2 = 0; this.mode = mode; this.set(f, q); }
  set(f, q) {
    const g = Math.tan(Math.PI * Math.min(f, sampleRate * 0.45) / sampleRate);
    this.k = 1 / q; this.a1 = 1 / (1 + g * (g + this.k)); this.a2 = g * this.a1; this.a3 = g * this.a2;
  }
  run(v0) {
    const v3 = v0 - this.ic2;
    const v1 = this.a1 * this.ic1 + this.a2 * v3;
    const v2 = this.ic2 + this.a2 * this.ic1 + this.a3 * v3;
    this.ic1 = 2 * v1 - this.ic1; this.ic2 = 2 * v2 - this.ic2;
    return this.mode === 'lp' ? v2 : this.mode === 'bp' ? v1 : v0 - this.k * v1 - v2;
  }
}
let seed = 22222;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) / 4294967296) * 2 - 1; };

// drums: pitched ones are a sine with a falling pitch, the rest filtered noise
const PITCHED = { Kick: [130, 0.32, 0.35, 0.95], 'Tom low': [95, 0.6, 0.45, 0.6], 'Tom mid': [140, 0.6, 0.45, 0.6], 'Tom high': [200, 0.6, 0.4, 0.6],
  'Conga low': [210, 0.85, 0.3, 0.5], 'Conga high': [320, 0.85, 0.25, 0.5], Bongo: [420, 0.8, 0.18, 0.45], Woodblock: [900, 0.95, 0.08, 0.5], Clave: [2500, 1, 0.06, 0.4] };
const NOISY = { Snare: ['bp', 1800, 0.8, 0.55, 0.22], Clap: ['bp', 1200, 1.5, 0.6, 0.16], Hat: ['hp', 7500, 0.7, 0.3, 0.05], 'Open hat': ['hp', 6500, 0.7, 0.3, 0.38],
  Ride: ['bp', 5200, 3, 0.25, 0.9], Rim: ['bp', 1700, 4, 0.6, 0.04], Shaker: ['hp', 5000, 0.7, 0.25, 0.09], Tambourine: ['bp', 8000, 2, 0.35, 0.22], Crash: ['hp', 3500, 0.5, 0.35, 1.6] };

function makeVoice(m) {
  const v = { when: m.when, g: Float32Array.from(m.g), vol: m.vol, line: m.line, bank: m.bank, rel: Infinity, done: false, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0 };
  if (m.bank === 0) { v.f = m.f; v.len = m.len; v.end = m.len + 0.06; }
  else if (m.bank === 1) {
    v.kind = m.kind;
    if (PITCHED[m.kind]) { [v.f0, v.drop, v.dur, v.pk] = PITCHED[m.kind]; v.end = v.dur + 0.02; v.type = 'pitched'; }
    else if (m.kind === 'Cowbell') { v.type = 'cowbell'; v.svf = new SVF(800, 2, 'bp'); v.end = 0.4; }
    else { const n = NOISY[m.kind] || NOISY.Hat; v.type = 'noise'; v.svf = new SVF(n[1], n[2], n[0]); v.pk = n[3]; v.dur = n[4]; v.end = v.dur + 0.05; v.att = m.kind === 'Shaker' ? 0.03 : 0.002; }
  } else {
    v.f = m.f; v.dur = Math.max(1.8, m.len * 4); v.end = v.dur + 0.02;
    v.lp = new SVF(3200, 0.9, 'lp'); v.hp = 0; v.hpx = 0;
  }
  return v;
}

// one block of a note voice into buf[i0 … n): everything that changes slowly (FM depth, pitch drops,
// vibrato, envelopes) is worked out once per block (128 samples = 2.7 ms) and glided across it;
// only phases and filters run per sample. That is most of the speed.
const lerpEnv = (a, b, i, n) => a + (b - a) * (i / n);
function blockNote(v, tb, i0, n, dt, buf) {
  const te = tb + n * dt;
  if (v.bank === 0) {                                     // keyboard: 2-operator FM electric piano + a tine
    const f = v.f, idx0 = f * (0.25 + 1.95 * Math.exp(-Math.max(0, tb) / 0.12)), idx1 = f * (0.25 + 1.95 * Math.exp(-te / 0.12));
    const amp = (t) => (t < 0 ? 0 : t < 0.004 ? t / 0.004 : t < v.len * 0.7 ? 1 : Math.max(0, 1 - (t - v.len * 0.7) / (v.len * 0.3)));
    const a0 = amp(tb + i0 * dt) * 0.42 * v.vol, a1 = amp(te) * 0.42 * v.vol;
    const tn0 = 0.06 * Math.exp(-Math.max(0, tb) / 0.06) * v.vol, tn1 = 0.06 * Math.exp(-te / 0.06) * v.vol;
    const dm = f * dt, dtn = f * 4.02 * dt;
    for (let i = i0; i < n; i++) {
      v.p2 += dm; if (v.p2 > 1) v.p2 -= 1;
      const mod = sinT(v.p2) * lerpEnv(idx0, idx1, i, n);
      v.p1 += (f + mod) * dt; v.p1 -= Math.floor(v.p1); if (v.p1 >= 1) v.p1 = 0;
      v.p3 += dtn; if (v.p3 > 1) v.p3 -= 1;
      buf[i] = sinT(v.p1) * lerpEnv(a0, a1, i - i0, n - i0) + sinT(v.p3) * lerpEnv(tn0, tn1, i, n);
    }
    return;
  }
  if (v.bank === 1) {
    const ex = (t, d) => Math.exp(-Math.max(0, t) * 6.9 / d);
    if (v.type === 'pitched') {
      const fr = (t) => v.f0 * Math.pow(v.drop, Math.min(Math.max(0, t) / (v.dur * 0.5), 1));
      const f0 = fr(tb), f1 = fr(te), e0 = ex(tb, v.dur) * v.pk * v.vol, e1 = ex(te, v.dur) * v.pk * v.vol;
      for (let i = i0; i < n; i++) {
        v.p1 += lerpEnv(f0, f1, i, n) * dt; if (v.p1 > 1) v.p1 -= 1;
        const t = tb + i * dt;
        buf[i] = sinT(v.p1) * lerpEnv(e0, e1, i, n) * (t < 0.002 ? t / 0.002 : 1);
      }
      return;
    }
    if (v.type === 'cowbell') {
      const e0 = ex(tb, 0.35) * 0.3 * v.vol, e1 = ex(te, 0.35) * 0.3 * v.vol;
      for (let i = i0; i < n; i++) {
        v.p1 += 540 * dt; v.p2 += 800 * dt; v.p1 -= Math.floor(v.p1); v.p2 -= Math.floor(v.p2);
        buf[i] = v.svf.run(((v.p1 < 0.5 ? 1 : -1) + (v.p2 < 0.5 ? 1 : -1)) * 0.5) * lerpEnv(e0, e1, i, n);
      }
      return;
    }
    const env = (t) => { if (t < 0) return 0; let a = (t < v.att ? t / v.att : 1) * ex(t, v.dur); if (v.kind === 'Clap') for (const d of [0.012, 0.024]) if (t > d) a += 0.6 * ex(t - d, 0.05); return a * v.pk * v.vol; };
    const e0 = env(tb + i0 * dt), e1 = env(te);
    const snare = v.kind === 'Snare', s0 = snare ? 0.35 * ex(tb, 0.12) * v.vol : 0, s1 = snare ? 0.35 * ex(te, 0.12) * v.vol : 0;
    for (let i = i0; i < n; i++) {
      let x = v.svf.run(rnd()) * lerpEnv(e0, e1, i - i0, n - i0);
      if (snare) { v.p1 += 185 * dt; if (v.p1 > 1) v.p1 -= 1; x += sinT(v.p1) * lerpEnv(s0, s1, i, n); }
      buf[i] = x;
    }
    return;
  }
  // guitar: four detuned saws (root, fifth, octave), slow vibrato, into a tanh "amp" and a cabinet filter
  const tm = Math.max(0, tb + n * dt * 0.5);
  const vib = Math.min(1, tm / 0.9) * 14 * Math.sin(TAU * 5.2 * tm);
  const c = (cents) => Math.pow(2, (cents + vib) / 1200);
  const d1 = v.f * c(0) * dt, d2 = v.f * c(7) * dt, d3 = v.f * 1.5 * c(-5) * dt, d4 = v.f * 2 * c(3) * dt;
  const d = v.dur;
  const envAt = (t) => (t < 0 ? 0 : t < 0.012 ? 0.9 * t / 0.012 : t < 0.5 ? 0.9 - 0.35 * (t - 0.012) / 0.488 : t < d - 0.4 ? 0.55 - 0.15 * (t - 0.5) / Math.max(0.01, d - 0.9) : Math.max(0, 0.4 * (d - t) / 0.4));
  const g0 = envAt(tb + i0 * dt) * 8.4, g1 = envAt(te) * 8.4, out = 0.16 * v.vol;
  for (let i = i0; i < n; i++) {
    v.p1 += d1; v.p2 += d2; v.p3 += d3; v.p4 += d4;
    if (v.p1 > 1) v.p1 -= 1; if (v.p2 > 1) v.p2 -= 1; if (v.p3 > 1) v.p3 -= 1; if (v.p4 > 1) v.p4 -= 1;
    const saw = (v.p1 + v.p2 + v.p3) * 0.8 - 1.2 + v.p4 * 0.5 - 0.25;
    const x = ftanh(saw * lerpEnv(g0, g1, i - i0, n - i0));
    v.hp = 0.995 * (v.hp + x - v.hpx); v.hpx = x;              // high-pass ~40 Hz
    buf[i] = v.lp.run(v.hp) * out;
  }
}

class Ex12Synth extends AudioWorkletProcessor {
  constructor() {
    super();
    this.voices = [];
    this.hums = new Map();
    this.env = 0; this.gain = 1; this.minGain = 1; this.peak = 0;
    this.lfeLp = 0;
    this.started = 0; this.lastStats = 0;
    this.port.onmessage = (e) => this.onMessage(e.data);
  }
  onMessage(m) {
    if (m.type === 'reset') { this.voices = []; for (const h of this.hums.values()) h.target = 0; return; }
    if (m.type === 'notes') {
      for (const n of m.list) {
        if (n.bank === 2) for (const v of this.voices) if (v.bank === 2 && v.line === n.line && v.rel > n.when) v.rel = n.when;   // one note per string
        this.voices.push(makeVoice(n));
        this.started++;
      }
      if (this.voices.length > MAX_VOICES) this.voices.splice(0, this.voices.length - MAX_VOICES);
      return;
    }
    if (m.type === 'hums') {
      const seen = new Set();
      for (const h of m.list) {
        seen.add(h.id);
        let x = this.hums.get(h.id);
        if (!x) { x = { gain: 0, g: Float32Array.from(h.g), p1: 0, p2: 0, svf: new SVF(h.f * 6, 6, 'bp'), lp: 0 }; this.hums.set(h.id, x); }
        x.bank = h.bank; x.f = h.f; x.target = h.gain; x.gt = h.g;
        x.svf.set(h.bank === 1 ? h.f * 20 : h.f * 6, h.bank === 1 ? 2 : 6);
      }
      for (const [id, x] of this.hums) if (!seen.has(id)) x.target = 0;
    }
  }
  process(inputs, outputs) {
    const out = outputs[0];
    const n = out[0].length, ch = out.length;
    const dt = 1 / sampleRate;
    const t0 = currentTime;
    for (let c = 0; c < ch; c++) out[c].fill(0);
    // notes, a block at a time
    const buf = this.buf || (this.buf = new Float32Array(n));
    for (let vi = 0; vi < this.voices.length; vi++) {
      const v = this.voices[vi];
      const tb = t0 - v.when;
      if (tb + n * dt < 0) continue;                         // not yet
      if (tb > v.end || t0 > v.rel + 0.03) { v.done = true; continue; }
      const i0 = tb < 0 ? Math.min(n, Math.ceil(-tb / dt)) : 0;
      blockNote(v, tb, i0, n, dt, buf);
      let r0 = 1, r1 = 1;                                    // a quick fade when a string is played again
      if (t0 + n * dt > v.rel) { r0 = Math.max(0, 1 - (t0 - v.rel) / 0.03); r1 = Math.max(0, 1 - (t0 + n * dt - v.rel) / 0.03); }
      const g0 = v.g[0], g1 = v.g[1], g2 = v.g[2], g3 = v.g[3], g4 = v.g[4], g5 = v.g[5];
      const o0 = out[0], o1 = out[1], o2 = ch > 2 ? out[2] : null, o3 = ch > 3 ? out[3] : null, o4 = ch > 4 ? out[4] : null, o5 = ch > 5 ? out[5] : null;
      for (let i = i0; i < n; i++) {
        const x = buf[i] * (r0 + (r1 - r0) * i / n);
        o0[i] += x * g0; o1[i] += x * g1;
        if (o2) { o2[i] += x * g2; o3[i] += x * g3; o4[i] += x * g4; o5[i] += x * g5; }
      }
      if (tb + n * dt > v.end) v.done = true;
    }
    if (this.voices.some((v) => v.done)) this.voices = this.voices.filter((v) => !v.done);
    // hums: two sines (or a saw for the guitar) + a breath of noise; gain and panning glide
    const a = 1 - Math.exp(-dt / 0.08);
    for (const [id, h] of this.hums) {
      for (let i = 0; i < n; i++) {
        h.gain += (h.target - h.gain) * a;
        if ((i & 15) === 0) for (let c = 0; c < 6; c++) h.g[c] += (h.gt[c] - h.g[c]) * a * 16;
        const f = h.f;
        h.p1 += f * dt; h.p2 += f * 1.004 * dt; h.p1 -= Math.floor(h.p1); h.p2 -= Math.floor(h.p2);
        let tone = h.bank === 2 ? ((h.p1 * 2 - 1) + (h.p2 * 2 - 1)) * 0.35 : h.bank === 1 ? 0 : sinT(h.p1) + sinT(h.p2);
        h.lp += (tone - h.lp) * (h.bank === 2 ? 0.054 : 0.083);   // ~420 / ~650 Hz
        const s = (h.lp + h.svf.run(rnd()) * (h.bank === 1 ? 0.5 : 0.22)) * h.gain;
        for (let c = 0; c < ch; c++) out[c][i] += s * h.g[c];
      }
      if (h.target === 0 && h.gain < 1e-4) this.hums.delete(id);
    }
    // the LFE only gets the lows; then one limiter for all six channels (linked, so the image holds)
    const rel = Math.exp(-dt / 0.15), att = 1 - Math.exp(-dt / 0.001), thr = 0.5;
    for (let i = 0; i < n; i++) {
      if (ch > 3) { this.lfeLp += (out[3][i] - this.lfeLp) * 0.0143; out[3][i] = this.lfeLp; }
      let pk = 0;
      for (let c = 0; c < ch; c++) { const x = Math.abs(out[c][i]); if (x > pk) pk = x; }
      this.env = pk > this.env ? pk : this.env * rel;
      const want = this.env > thr ? thr / this.env : 1;
      this.gain += (want - this.gain) * (want < this.gain ? att * 8 : att * 0.05);
      if (this.gain < this.minGain) this.minGain = this.gain;
      for (let c = 0; c < ch; c++) { let x = out[c][i] * this.gain * 1.3; if (x > 0.95 || x < -0.95) x = Math.tanh(x); out[c][i] = x; if (Math.abs(x) > this.peak) this.peak = Math.abs(x); }
    }
    if (t0 - this.lastStats > 0.25) {
      const span = t0 - this.lastStats;
      this.port.postMessage({ voices: this.voices.length, hums: this.hums.size, peak: +this.peak.toFixed(3), reduction: +(20 * Math.log10(Math.max(1e-4, this.minGain))).toFixed(1), notesPerSec: Math.round(this.started / span) });
      this.lastStats = t0; this.peak = 0; this.minGain = 1; this.started = 0;
    }
    return true;
  }
}
registerProcessor('ex12-synth', Ex12Synth);
