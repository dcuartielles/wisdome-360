import { NOISE_GLSL } from '../_common.js';
import { ACT6, header } from '../_lab.js';

// how far we are into world B (0..1) and the yaw of each world, from the presses — same on both pages
function mixState(view, t) {
  const n = view.count('go');
  const to = n % 2;                                   // 0 = desert, 1 = night sea
  const type = view.p('type');
  const age = n ? t - view.lastPress('go') : 99;
  const dur = { cut: 0.001, cross: 2.5, dip: 2.4, travel: 5 }[type];
  const k = Math.min(1, age / dur);
  let wB, dark = 1, yawOld = 0, yawNew = 0;
  if (type === 'dip') { dark = k < 0.5 ? 1 - k * 2 : (k - 0.5) * 2; wB = k < 0.5 ? (to ? 0 : 1) : to; }
  else {
    const e = k * k * (3 - 2 * k);
    wB = to ? e : 1 - e;
    if (type === 'travel') { yawOld = 70 * e; yawNew = -70 * (1 - e); }
  }
  // which world is new
  const yawA = to ? yawOld : yawNew, yawB = to ? yawNew : yawOld;
  return { wB, dark, yawA, yawB, to };
}

export default {
  title: 'A cut moves the audience',
  act: ACT6,
  notes: `<p>On a screen a cut changes the <b>view</b>. In a dome it changes the <b>place</b>: everyone is moved, at once, without their consent. A desert at dusk and a sea at night, joined four ways — press <b>Go</b> and ask how each one felt.</p>
<ul><li><b>Cut</b>: a jolt. Good for a shock, tiring if repeated. Fast cutting in a dome is exhausting.</li>
<li><b>Crossfade</b>: two places at once for a moment — dreamlike.</li>
<li><b>Dip to black</b>: a breath; the dome disappears, and people accept a new place. Watch the black level (see the "Black isn't black" slide).</li>
<li><b>Travel</b>: the old world turns away and the new one turns in. The move itself becomes the transition — the way most fulldome shows change scenes. Keep it slow (vection!).</li></ul>
<p>Sound crossfades with the picture; a sound change alone can carry a cut that the picture softens.</p>`,
  params: {
    type: { type: 'select', label: 'Transition', options: [{ value: 'cut', label: 'Cut' }, { value: 'cross', label: 'Crossfade' }, { value: 'dip', label: 'Dip to black' }, { value: 'travel', label: 'Travel' }], value: 'cut' },
    go: { type: 'button', label: 'Go' },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'A cut moves the audience', 'on a screen a cut changes the view — in a dome it changes the place', 'try each transition: how did it feel?');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uWB, uDark, uYawA, uYawB;
      vec3 yaw(vec3 d, float a){ a *= DEG; return vec3(d.x * cos(a) - d.y * sin(a), d.x * sin(a) + d.y * cos(a), d.z); }
      float hills(float az, float amp, float f){ float a = az * DEG; return amp * (0.55 + 0.25 * sin(a * f) + 0.15 * sin(a * f * 2.3 + 1.7) + 0.08 * sin(a * f * 5.1 + 0.3)); }
      vec3 desert(vec3 d){
        float el = elOf(d), az = azOf(d);
        vec3 sky = mix(vec3(0.55, 0.22, 0.08), vec3(0.05, 0.04, 0.10), smoothstep(-2.0, 50.0, el));
        float sun = angleBetween(d, dirRoom(-25.0, 6.0));
        sky += vec3(1.0, 0.6, 0.25) * (1.0 - smoothstep(2.4, 2.8, sun)) + vec3(0.5, 0.2, 0.05) * exp(-sun / 9.0);
        float h1 = hills(az, 7.0, 3.0), h2 = hills(az + 40.0, 4.0, 7.0) - 2.0;
        vec3 c = sky;
        if (el < h1) c = vec3(0.16, 0.07, 0.03) * (0.7 + 0.3 * smoothstep(-20.0, h1, el));
        if (el < h2) c = vec3(0.09, 0.035, 0.015);
        return c;
      }
      vec3 sea(vec3 d){
        float el = elOf(d);
        vec3 c = mix(vec3(0.02, 0.04, 0.09), vec3(0.003, 0.006, 0.02), smoothstep(0.0, 60.0, el)) + stars(d) * smoothstep(2.0, 12.0, el);
        float moon = angleBetween(d, dirRoom(30.0, 24.0));
        c += vec3(0.85, 0.9, 1.0) * (1.0 - smoothstep(1.6, 1.8, moon)) + vec3(0.1, 0.13, 0.2) * exp(-moon / 10.0);
        if (el < 0.0) {
          float w = 0.5 + 0.5 * sin(azOf(d) * 2.0 / max(0.02, -el * 0.1) + uTime * 1.2);
          c = vec3(0.01, 0.025, 0.05) + vec3(0.25, 0.28, 0.35) * w * exp(-abs(azOf(d) - 30.0) / 6.0) * 0.6;
        }
        return c;
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = mix(desert(yaw(room, uYawA)), sea(yaw(room, uYawB)), uWB) * uDark;
        vec4 e = sampleEq(uEq, room); c = mix(c * (1.0 - e.a * 0.6), e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uWB: { value: 0 }, uDark: { value: 1 }, uYawA: { value: 0 }, uYawB: { value: 0 } });
    return {
      render(t) {
        const s = mixState(view, t), u = mat.uniforms;
        u.uWB.value = s.wB; u.uDark.value = s.dark; u.uYawA.value = s.yawA; u.uYawB.value = s.yawB;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view }) {
    // desert: wind (band-passed noise, slow gusts) at the front; sea: low swell all round
    const wind = group.noise(), bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 700; bp.Q.value = 0.8;
    const gA = ctx.createGain(); gA.gain.value = 0;
    const pA = group.panner(); pA.set(-25, 10, 0.5);
    wind.connect(bp).connect(gA).connect(pA.input);
    const surf = group.noise(), lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const gB = ctx.createGain(); gB.gain.value = 0;
    const pB = group.panner(); pB.set(0, 0, 0.8);
    surf.connect(lp).connect(gB).connect(pB.input);
    wind.start(); surf.start(0, 1.3);
    return {
      update(t) {
        const s = mixState(view, t);
        const gust = 0.7 + 0.3 * Math.sin(t * 0.7) * Math.sin(t * 0.23);
        const swell = 0.55 + 0.45 * Math.sin(t * 0.5);
        gA.gain.setTargetAtTime(0.5 * (1 - s.wB) * s.dark * gust, ctx.currentTime, 0.05);
        gB.gain.setTargetAtTime(0.7 * s.wB * s.dark * swell, ctx.currentTime, 0.05);
        bp.frequency.setTargetAtTime(500 + 500 * gust, ctx.currentTime, 0.2);
        pA.set(-25 + s.yawA, 10, 0.5, 0.05); pB.set(s.yawB, 0, 0.8, 0.05);
      },
      dispose() { const e = ctx.currentTime + 0.5; wind.stop(e); surf.stop(e); },
    };
  },
};
