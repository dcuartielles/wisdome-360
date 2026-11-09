import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

const BINS = 64, ROWS = 160;

export default {
  title: 'Live sound, all the way round',
  act: ACT1,
  notes: `<p>The laptop microphone, analysed live: 64 frequency bands from low (60 Hz) to high (12 kHz), wrapped around the whole room and turning.</p>
<ul><li><b>Ring</b>: bars around the dome, standing on the screen edge, so the whole ring is visible (low in front, high behind: the dome is tilted). <i>Ring sits on → Eye level</i> shows the old way: behind the audience the screen only starts 36° up, and the back half of the ring disappears under the rim. Talk, clap, whistle, and ask the room to make noise.</li>
<li><b>Waterfall</b>: the same bands scrolling up the dome over time, the dome as a spectrogram, with time running towards the zenith.</li>
<li>Spinning it makes everyone turn their heads: the whole room is the canvas, not just the front.</li></ul>
<p>The microphone is read on the <b>audio page</b> (or the rehearsal tab) and sent to the picture. <b>Source → Demo track</b> plays a short beat through the dome's speakers instead (kick and bass from the front, hi-hats from the back, a melody that circles the room with the ring) and the ring shows its real spectrum. Good when the room is quiet, or as a warm-up before asking people to make noise.</p>`,
  params: {
    view: { type: 'select', label: 'View', options: [{ value: 'ring', label: 'Ring' }, { value: 'fall', label: 'Waterfall' }, { value: 'both', label: 'Both' }], value: 'ring' },
    source: { type: 'select', label: 'Source', options: [{ value: 'mic', label: 'Microphone' }, { value: 'demo', label: 'Demo track (plays in the dome)' }], value: 'mic' },
    demoVol: { type: 'range', label: 'Demo track volume', min: 0, max: 1.2, step: 0.05, value: 0.6 },
    spin: { type: 'range', label: 'Spin', min: -90, max: 90, step: 1, value: 15, unit: '°/s' },
    follow: { type: 'select', label: 'Ring sits on', options: [{ value: 'screen', label: 'The screen edge (whole ring visible)' }, { value: 'room', label: 'Eye level (back half under the rim)' }], value: 'screen' },
    base: { type: 'range', label: 'Ring height above that', min: 0, max: 50, step: 1, value: 8, unit: '°' },
    height: { type: 'range', label: 'Bar height', min: 5, max: 60, step: 1, value: 30, unit: '°' },
    gain: { type: 'range', label: 'Sensitivity', min: 0.3, max: 4, step: 0.05, value: 1.4 },
    mirror: { type: 'toggle', label: 'Mirror (low end at the front and back)', value: true },
  },

  video({ THREE, comp, AngleCanvas, view, onStream }) {
    const data = new Uint8Array(BINS * ROWS);
    const tex = new THREE.DataTexture(data, BINS, ROWS, THREE.RedFormat, THREE.UnsignedByteType);
    tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.wrapS = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    let head = 0, lastMic = -1e9;
    const push = (arr) => {
      head = (head + 1) % ROWS;
      data.set(arr.subarray ? arr.subarray(0, BINS) : arr.slice(0, BINS), head * BINS);
      tex.needsUpdate = true;
    };
    onStream((m) => {
      if (m.name !== 'mic') return;
      const src = m.data?.src ?? 'mic', bins = m.data?.bins ?? m.data;
      if (src !== view.p('source')) return;
      lastMic = performance.now(); push(Uint8Array.from(bins));
    });

    const ac = new AngleCanvas(2048);
    ac.text('waiting for the microphone: start sound on the audio page', 0, DOME.sweetSpot, { size: 1.6, color: C.mute, weight: 500 }).commit();

    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uHist; uniform float uHead, uSpin, uBase, uHeight, uGain, uMirror, uView, uWait, uFollow;
      float band(float x){ return x; }
      vec3 pal(float t){ return mix(mix(vec3(0.15, 0.25, 0.9), vec3(0.42, 0.78, 1.0), smoothstep(0.0, 0.4, t)), mix(vec3(1.0, 0.71, 0.28), vec3(1.0, 0.36, 0.2), smoothstep(0.7, 1.0, t)), smoothstep(0.35, 0.75, t)); }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.35);
        // Wisdome is tilted 26°: the screen edge is 16° below eye level in front but 36° ABOVE it
        // behind. A ring at a fixed room elevation loses its back half under the rim, so by default
        // the ring is measured in the dome's own frame: 'el' = height above the screen edge.
        vec3 d = uFollow > 0.5 ? local : room;
        float rimOff = uFollow > 0.5 ? 90.0 - min(uOpening, uVFov) / DEG * 0.5 : 0.0;   // the screen edge
        float az = azOf(d), el = elOf(d) - rimOff;
        float topEl = 90.0 - rimOff;               // the pole: dome axis (screen) or zenith (room)
        float a = fract((az - uSpin) / 360.0 + 1.0);
        float x = uMirror > 0.5 ? 1.0 - abs(a * 2.0 - 1.0) : a;     // 0..1 across the bands
        float bi = x * ${BINS}.0;
        float gap = smoothstep(0.08, 0.16, fract(bi)) * (1.0 - smoothstep(0.84, 0.92, fract(bi)));
        float u = (floor(bi) + 0.5) / ${BINS}.0;
        float rowNow = (uHead + 0.5) / ${ROWS}.0;
        if (uView < 0.5 || uView > 1.5) {          // ring
          float v = clamp(texture(uHist, vec2(u, rowNow)).r * uGain, 0.0, 1.0);
          float top = uBase + v * uHeight;
          float inBar = step(uBase, el) * (1.0 - smoothstep(top - 0.15, top + 0.15, el)) * gap;
          vec3 col = pal(v) * (0.55 + 0.45 * smoothstep(uBase, top, el));
          c = mix(c, col, inBar);
          c += pal(v) * 0.25 * exp(-max(0.0, el - top) / 4.0) * gap * step(uBase, el) * v;
        }
        if (uView > 0.5) {                          // waterfall from just above the ring towards the zenith
          float start = uView > 1.5 ? uBase + uHeight + 3.0 : uBase;
          float age = (el - start) / (topEl - start);
          if (age > 0.0 && age < 1.0) {
            float row = (uHead - age * ${ROWS - 1}.0 + 0.5) / ${ROWS}.0;
            float v = clamp(texture(uHist, vec2(x, fract(row + 1.0))).r * uGain, 0.0, 1.0);
            c = mix(c, pal(v) * v * 1.2, smoothstep(0.02, 0.2, v) * (1.0 - age * 0.6));
          }
        }
        if (uWait > 0.5) { vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a); }
        return vec4(c, 1.0);
      }`, { uHist: { value: tex }, uEq: { value: ac.texture }, uHead: { value: 0 }, uSpin: { value: 0 }, uBase: { value: 12 }, uHeight: { value: 30 }, uGain: { value: 1.4 }, uMirror: { value: 1 }, uView: { value: 0 }, uWait: { value: 0 }, uFollow: { value: 1 } });

    const demo = new Uint8Array(BINS);
    let demoAcc = 0;
    return {
      render(t, dt) {
        const u = mat.uniforms;
        const src = view.p('source');
        if (src === 'demo' && performance.now() - lastMic > 1500) { // no sound page running: draw a stand-in
          demoAcc += dt;
          while (demoAcc > 1 / 30) {
            demoAcc -= 1 / 30;
            const ts = view.t();
            for (let i = 0; i < BINS; i++) {
              const x = i / BINS;
              const beat = Math.pow(Math.max(0, Math.sin(ts * Math.PI * 2 * 1.9)), 8) * Math.exp(-x * 5);
              const melody = Math.exp(-Math.pow((x - 0.35 - 0.2 * Math.sin(ts * 0.7)) * 18, 2));
              const v = 0.18 * (1 - x) + 0.65 * beat + 0.55 * melody + 0.08 * Math.random();
              demo[i] = Math.min(255, v * 200);
            }
            push(demo);
          }
        }
        u.uHead.value = head;
        u.uSpin.value = view.integrate('spin');
        u.uBase.value = view.p('base'); u.uHeight.value = view.p('height'); u.uGain.value = view.p('gain');
        u.uMirror.value = view.p('mirror') ? 1 : 0;
        u.uFollow.value = view.p('follow') === 'room' ? 0 : 1;
        u.uView.value = { ring: 0, fall: 1, both: 2 }[view.p('view')] ?? 0;
        u.uWait.value = src === 'mic' && performance.now() - lastMic > 1500 ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); tex.dispose(); ac.dispose(); },
    };
  },

  // The sound page: reads the microphone, or plays the demo track through the dome's speakers.
  // Either way it analyses what it gets into 64 log-spaced bands and sends them 30 times a second.
  audio({ ctx, view, bus, group }) {
    let stream = null, micSrc = null, timer = null, sched = null, stopped = false;
    const anMic = ctx.createAnalyser(), anDemo = ctx.createAnalyser();
    for (const a of [anMic, anDemo]) { a.fftSize = 2048; a.smoothingTimeConstant = 0.6; a.minDecibels = -90; a.maxDecibels = -20; }
    anDemo.minDecibels = -85; anDemo.maxDecibels = -12; // the demo is louder than a room mic
    const freq = new Uint8Array(1024);
    const edges = Array.from({ length: BINS + 1 }, (_, i) => 60 * Math.pow(12000 / 60, i / BINS));

    // ---- microphone (never sent to the speakers) ----
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }).then((s) => {
      if (stopped) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s; micSrc = ctx.createMediaStreamSource(s); micSrc.connect(anMic);
    }).catch((e) => console.warn('no microphone', e));

    // ---- demo track: 112 bpm, kick + clap + hats + bass + a melody that circles the room ----
    const master = ctx.createGain(); master.gain.value = 0; // feeds the analyser only
    master.connect(anDemo);
    const centre = group.panner(); centre.set(0, 15, 0.35); centre.lfe(0.6);
    const mel = group.panner();
    const rearL = group.panner(); rearL.set(-120, 25); const rearR = group.panner(); rearR.set(120, 25);
    // each voice -> a gate -> its panner (the speakers), and -> master -> analyser (the picture)
    const gates = [];
    const route = (p) => { const v = ctx.createGain(); const gate = ctx.createGain(); gate.gain.value = 0; v.connect(gate).connect(p.input); v.connect(master); gates.push(gate); return v; };
    const C = route(centre), M = route(mel), L = route(rearL), R = route(rearR);
    const echo = ctx.createDelay(1); echo.delayTime.value = 60 / 112 * 0.75; const fb = ctx.createGain(); fb.gain.value = 0.32;
    const ef = ctx.createBiquadFilter(); ef.type = 'lowpass'; ef.frequency.value = 3000;
    echo.connect(ef).connect(fb).connect(echo); ef.connect(M);
    const noise = (() => { const b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
    const env = (g, t, a, peak, dec) => { g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
    const kick = (t) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.frequency.setValueAtTime(130, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.18); env(g, t, 0.003, 0.9, 0.32); o.connect(g).connect(C); o.start(t); o.stop(t + 0.4); };
    const hit = (t, dest, hp, peak, dec, bp) => { const n = ctx.createBufferSource(); n.buffer = noise; const f = ctx.createBiquadFilter(); f.type = bp ? 'bandpass' : 'highpass'; f.frequency.value = hp; f.Q.value = bp ? 1.2 : 0.7; const g = ctx.createGain(); env(g, t, 0.002, peak, dec); n.connect(f).connect(g).connect(dest); n.start(t, Math.random() * 0.5); n.stop(t + dec + 0.05); };
    const note = (t, f, dur, type, dest, peak, lp) => { const o = ctx.createOscillator(); o.type = type; o.frequency.value = f; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(lp, t); fl.frequency.exponentialRampToValueAtTime(Math.max(200, lp / 4), t + dur); const g = ctx.createGain(); env(g, t, 0.01, peak, dur); o.connect(fl).connect(g).connect(dest); o.start(t); o.stop(t + dur + 0.05); return g; };
    const A = 55, bassLine = [1, 0, 0, 1.189, 0, 0, 1.335, 0, 1, 0, 0, 1.498, 0, 0, 1.782, 0];
    const penta = [440, 523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.7, 1318.5];
    const melody = [0, 2, 4, 2, 5, 4, 2, 1, 0, 3, 5, 7, 6, 4, 3, 2, 0, 2, 4, 6, 8, 6, 4, 2, 1, 3, 4, 3, 2, 1, 0, -1];
    const spb = 60 / 112 / 4; // seconds per 16th
    let step = 0, nextT = 0, playing = false;
    function scheduleAhead() {
      const on = view.p('source') === 'demo';
      for (const g of gates) g.gain.setTargetAtTime(on ? view.p('demoVol') : 0, ctx.currentTime, 0.08);
      master.gain.setTargetAtTime(on ? 0.35 : 0, ctx.currentTime, 0.08);
      if (!on) { playing = false; return; }
      if (!playing) { playing = true; nextT = ctx.currentTime + 0.1; step = 0; }
      // the melody sits on the ring, a little ahead of the bars' spin
      mel.set(view.integrate('spin') + 30, view.p('base') + view.p('height') * 0.6, 0, 0.1);
      while (nextT < ctx.currentTime + 0.15) {
        const s16 = step % 16, bar = Math.floor(step / 16) % 2;
        if (s16 % 4 === 0) kick(nextT);
        if (s16 === 4 || s16 === 12) hit(nextT, C, 1800, 0.5, 0.16, true);
        if (s16 % 2 === 1) hit(nextT, s16 % 4 === 1 ? L : R, 7000, 0.18, 0.04);
        if (bassLine[s16]) note(nextT, A * bassLine[s16] * (bar ? 1.122 : 1), spb * 2.5, 'sawtooth', C, 0.35, 700);
        if (s16 % 2 === 0) {
          const i = melody[(step / 2) % melody.length];
          if (i >= 0) { const g = note(nextT, penta[i] * (bar ? 1 : 1), spb * 1.8, 'triangle', M, 0.22, 5000); g.connect(echo); }
        }
        nextT += spb; step++;
      }
    }
    sched = setInterval(scheduleAhead, 25);

    timer = setInterval(() => {
      const srcName = view.p('source');
      const an = srcName === 'demo' ? anDemo : anMic;
      if (srcName === 'mic' && !micSrc) return;
      an.getByteFrequencyData(freq);
      const hz = ctx.sampleRate / an.fftSize;
      const out = new Array(BINS);
      for (let b = 0; b < BINS; b++) {
        const i0 = Math.max(1, Math.floor(edges[b] / hz)), i1 = Math.max(i0 + 1, Math.ceil(edges[b + 1] / hz));
        let m = 0; for (let i = i0; i < i1 && i < freq.length; i++) m = Math.max(m, freq[i]);
        out[b] = m;
      }
      bus.stream('mic', { src: srcName, bins: out });
    }, 33);
    return {
      dispose() {
        stopped = true; clearInterval(timer); clearInterval(sched);
        micSrc?.disconnect(); stream?.getTracks().forEach((t) => t.stop());
        for (const g of gates) g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      },
    };
  },
};
