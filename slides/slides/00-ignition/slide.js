import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

// The opening. Dark dome, a slow breathing glow while people come in.
// IGNITE (presenter, or the launch console): rings of light rush in from the edge to the dome's
// zenith, a soft flash and a sub boom, then a warp of light streaks out from the front and the
// title settles. About 8 s. One soft flash only, no strobing.
const RISE = 2.0;  // seconds from IGNITE to the hit

export default {
  title: 'Ignition',
  act: ACT1,
  notes: `<p>The dome is dark and breathing while people come in. When everyone is seated, press <b>IGNITE</b> (here or on the launch console).</p>
<p>2 s riser circling the room → hit (sub boom on the LFE) → warp → "WISDOME LIVE". Then press Next for the title.</p>
<p>Turn the sound up for this one. There is one soft flash, no strobing.</p>`,
  params: {
    go: { type: 'button', label: 'IGNITE', hint: 'riser · hit · warp, about 8 seconds' },
    line1: { type: 'select', label: 'Big words', options: [{ value: 'WISDOME LIVE', label: 'WISDOME LIVE' }, { value: 'SYSTEMS ONLINE', label: 'SYSTEMS ONLINE' }, { value: 'WELCOME', label: 'WELCOME' }], value: 'WISDOME LIVE' },
  },

  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    const S = DOME.sweetSpot;  // the words and the glow they come out of sit on the venue's sweet spot
    let words = null;
    const write = (w) => {
      words = w;
      ac.clear().text(w, 0, S + 4, { size: 5.2, weight: 800, color: C.ink, letter: 0.9 })
        .text('360°  ·  5.1  ·  REAL TIME', 0, S - 3, { size: 1.6, weight: 600, color: C.warm, letter: 0.8 })
        .commit();
    };
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uTau, uWarp, uTextA, uBreath;
      float h1(float n){ return fract(sin(n * 127.1) * 43758.5453); }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.0);
        float tau = uTau;
        vec3 W = dirRoom(0.0, uSweet);
        float alpha = angleBetween(room, W);
        // idle: a slow breathing glow at the front, nothing else
        if (tau < 0.0) {
          c += vec3(1.0, 0.7, 0.35) * exp(-alpha * alpha / 30.0) * (0.10 + 0.08 * uBreath);
          c += vec3(1.0, 0.8, 0.5) * (1.0 - smoothstep(0.4, 0.7, alpha)) * (0.5 + 0.3 * uBreath);
          return vec4(c, 1.0);
        }
        float th = acos(clamp(local.z, -1.0, 1.0)) / DEG;   // angle from the dome's zenith
        // 1. rings rushing in from the edge to the zenith (0 .. RISE)
        for (int k = 0; k < 6; k++) {
          float t0 = float(k) * 0.22;
          float p = clamp((tau - t0) / (${RISE.toFixed(2)} - t0), 0.0, 1.0);
          float a = 80.0 * (1.0 - p * p);                      // accelerating inwards
          float on = step(t0, tau) * step(tau, ${RISE.toFixed(2)} + 0.05);
          float w = 0.6 + 2.0 * p;
          vec3 col = mix(vec3(1.0, 0.55, 0.2), vec3(1.0, 0.95, 0.85), p);
          c += col * exp(-pow((th - a) / w, 2.0)) * on * (0.35 + 0.65 * p);
        }
        c += vec3(1.0, 0.85, 0.6) * exp(-th * th / 40.0) * smoothstep(0.3, ${RISE.toFixed(2)}, tau) * step(tau, ${RISE.toFixed(2)} + 0.4) * 0.8;
        float th2 = tau - ${RISE.toFixed(2)};
        // 2. the hit: one soft flash + two shockwaves
        c += vec3(1.0, 0.92, 0.82) * 0.32 * exp(-pow(th2 / 0.14, 2.0));
        if (th2 > 0.0) {
          float R = th2 * 75.0;
          c += vec3(0.55, 0.85, 1.0) * exp(-pow((alpha - R) / (2.0 + th2 * 3.0), 2.0)) * exp(-th2 / 1.3) * 1.2;
          float R2 = th2 * 50.0;
          c += vec3(1.0, 0.7, 0.35) * exp(-pow((th - R2) / (1.5 + th2 * 2.0), 2.0)) * exp(-th2 / 1.0) * 0.8;
        }
        // 3. the warp: streaks of light flying out of the front
        float env = smoothstep(${RISE.toFixed(2)} - 0.2, ${RISE.toFixed(2)} + 0.3, tau) * (1.0 - 0.8 * smoothstep(4.5, 7.5, tau));
        if (env > 0.001) {
          vec3 f = W, r = normalize(cross(f, vec3(0.0, 0.0, 1.0))), u = cross(r, f);
          float beta = atan(dot(room, u), dot(room, r));
          float lanes = 420.0;
          float lf = (beta + PI) / (2.0 * PI) * lanes;
          float lane = floor(lf), lb = fract(lf);
          float hh = h1(lane), s = 0.4 + h1(lane + 17.0) * 1.3;
          float head = 2.0 + fract(h1(lane + 31.0) + uWarp * s * 0.22) * 160.0;
          float L = (3.0 + 70.0 * env) * s * (0.4 + head / 160.0);
          float along = clamp((alpha - (head - L)) / L, 0.0, 1.0) * step(alpha, head) * step(head - L, alpha);
          float wid = 1.0 - smoothstep(0.08, 0.32, abs(lb - 0.5));
          vec3 col = mix(vec3(0.45, 0.75, 1.0), vec3(1.0, 0.85, 0.65), h1(lane + 5.0));
          c += col * pow(along, 1.6) * wid * step(0.35, hh) * env * 2.2;
        }
        // 4. settle: stars and the words
        c += stars(room) * smoothstep(4.0, 7.0, tau) * 0.8;
        c += vec3(0.10, 0.045, 0.015) * exp(-max(elOf(room), 0.0) / 28.0) * smoothstep(5.0, 8.0, tau);
        vec4 e = sampleEq(uEq, room);
        c = mix(c, e.rgb, e.a * uTextA);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uTau: { value: -1 }, uWarp: { value: 0 }, uTextA: { value: 0 }, uBreath: { value: 0 } });
    let lastGo = -Infinity, warp = 0;
    return {
      render(t, dt) {
        if (view.p('line1') !== words) write(view.p('line1'));
        const go = view.lastPress('go');
        const tau = go > -Infinity ? t - go : -1;
        if (go !== lastGo) { lastGo = go; warp = 0; }
        if (tau > 0) {
          const sp = 0.15 + 1.25 * smoothstep(RISE - 0.2, RISE + 0.3, tau) * (1 - 0.85 * smoothstep(4.5, 7.5, tau));
          warp += sp * dt;
        }
        const u = mat.uniforms;
        u.uTau.value = tau < 0 ? -1 : tau;
        u.uWarp.value = warp;
        u.uTextA.value = tau < 0 ? 0 : smoothstep(5.0, 7.0, tau);
        u.uBreath.value = 0.5 + 0.5 * Math.sin(t * 1.1);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  audio({ group, ctx, view, ctxTime }) {
    const done = new Set();
    const live = []; // { T, panner } for moving the riser
    function fire(T) {
      const t0 = ctxTime(T);
      if (t0 < ctx.currentTime - 1) return; // an old press: don't replay
      const hit = t0 + RISE;
      // riser: noise through a sweeping band-pass + two saws gliding up, circling faster and faster
      const p = group.panner();
      const n = group.noise();
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
      bp.frequency.setValueAtTime(180, t0); bp.frequency.exponentialRampToValueAtTime(5200, hit);
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.7, hit - 0.05); g.gain.linearRampToValueAtTime(0, hit + 0.02);
      n.connect(bp).connect(g).connect(p.input);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.setValueAtTime(300, t0); lp.frequency.exponentialRampToValueAtTime(6000, hit);
      const sg = ctx.createGain(); sg.gain.setValueAtTime(0.0001, t0); sg.gain.exponentialRampToValueAtTime(0.16, hit - 0.05); sg.gain.linearRampToValueAtTime(0, hit + 0.02);
      const saws = [55, 55.6].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(f, t0); o.frequency.exponentialRampToValueAtTime(f * 8, hit); o.connect(lp); o.start(t0); o.stop(hit + 0.1); return o; });
      lp.connect(sg).connect(p.input);
      n.start(t0, Math.random() * 2); n.stop(hit + 0.1);
      live.push({ T, p });
      // the hit: sub drop on the LFE + centre, and a wide burst everywhere
      const boom = ctx.createOscillator(); boom.type = 'sine';
      boom.frequency.setValueAtTime(62, hit); boom.frequency.exponentialRampToValueAtTime(26, hit + 1.6);
      const bg = ctx.createGain(); bg.gain.setValueAtTime(0, hit); bg.gain.linearRampToValueAtTime(1.0, hit + 0.01); bg.gain.exponentialRampToValueAtTime(0.001, hit + 3.2);
      boom.connect(bg); bg.connect(group.channel(3)); // LFE
      const bc = ctx.createGain(); bc.gain.value = 0.35; bg.connect(bc).connect(group.channel(2));
      boom.start(hit); boom.stop(hit + 3.3);
      const wide = group.panner(); wide.set(0, 90, 1, 0.001);
      const bn = group.noise(); const blp = ctx.createBiquadFilter(); blp.type = 'lowpass';
      blp.frequency.setValueAtTime(5000, hit); blp.frequency.exponentialRampToValueAtTime(200, hit + 2.5);
      const bng = ctx.createGain(); bng.gain.setValueAtTime(0, hit); bng.gain.linearRampToValueAtTime(0.8, hit + 0.01); bng.gain.exponentialRampToValueAtTime(0.001, hit + 2.6);
      bn.connect(blp).connect(bng).connect(wide.input); bn.start(hit); bn.stop(hit + 2.7);
      // the tail: a bright chord circling slowly, fading over ~7 s
      const tail = group.panner();
      const tg = ctx.createGain(); tg.gain.setValueAtTime(0, hit); tg.gain.linearRampToValueAtTime(0.09, hit + 0.8); tg.gain.exponentialRampToValueAtTime(0.0005, hit + 8);
      [440, 659.3, 880.4, 1318.5].forEach((f, i) => { const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f * (1 + (i - 1.5) * 0.002); o.connect(tg); o.start(hit); o.stop(hit + 8.2); });
      tg.connect(tail.input);
      live.push({ T, p: tail, tail: true });
    }
    return {
      update(t) {
        for (const at of view.presses('go')) if (!done.has(at)) { done.add(at); fire(at); }
        for (const l of live) {
          const tau = t - l.T;
          if (l.tail) l.p.set((tau - RISE) * 25, 35, 0.2);
          else if (tau < RISE + 0.1) l.p.set(tau * tau * 260, 10 + tau * 20);  // accelerating circle, rising
        }
      },
    };
  },
};

function smoothstep(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
