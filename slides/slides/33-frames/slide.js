import { NOISE_GLSL } from '../_common.js';
import { ACT5, header, labEls, readout, FPS_PARAM, frameTime } from '../_lab.js';

const WHEEL = { az: 0, r: 15 };   // on the sweet spot (el set in video/audio from labEls)

export default {
  title: 'Frames: wagon wheels and judder',
  act: ACT5,
  notes: `<p>The dome gets <b>30 frames a second</b>. Anything that repeats or moves fast gets sampled — and sampling lies.</p>
<p><b>Wagon wheel</b>: speed the wheel up slowly. As it nears one spoke-gap per frame it seems to slow down and run <b>backwards</b>; at exactly one spoke-gap per frame it <b>stops</b>; a bit faster and it creeps forward again. The sound is the true speed (one tick per spoke), so the ear and the eye disagree. Ask the room which way it turns.</p>
<p><b>Judder</b>: a fence of poles pans round the room. At 30 fps a 30°/s pan jumps one degree — about ${(30 * 2048 / DOME.fisheyeFov / 30).toFixed(0)} master pixels — per frame. The bigger the field, the bigger the jump: what is smooth on a laptop stutters on 11 metres of dome, and worst in the corners of the eye.</p>
<ul><li><b>Motion blur</b> spreads each frame over the time it represents: the wheel stops lying (it blurs instead) and the pan gets smoother. That is why film has a shutter.</li>
<li>Try <b>Frame rate</b> 24 and 15 to exaggerate; "display" shows the laptop's own rate.</li></ul>
<p>Reading: Watson, Ahumada &amp; Farrell (1986), <i>Window of visibility</i>.</p>`,
  params: {
    mode: { type: 'select', label: 'Demo', options: [{ value: 'wheel', label: 'Wagon wheel' }, { value: 'fence', label: 'Panning fence (judder)' }], value: 'wheel' },
    speed: { type: 'range', label: 'Wheel speed', min: -4, max: 4, step: 0.02, value: 0.3, unit: 'rev/s' },
    spokes: { type: 'range', label: 'Spokes', min: 3, max: 24, step: 1, value: 12 },
    pan: { type: 'range', label: 'Fence pan', min: -120, max: 120, step: 1, value: 30, unit: '°/s' },
    blur: { type: 'toggle', label: 'Motion blur', value: false },
    fps: FPS_PARAM,
    sound: { type: 'toggle', label: 'Tick per spoke (true speed)', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Frames: wagon wheels and judder', '30 pictures a second: fast repetition turns into a different motion', 'try: speed the wheel up: it runs backwards, stops, then creeps forward');
    ac.commit();
    const L = labEls(); WHEEL.el = L.centre;
    const ro = readout(AngleCanvas, -58, L.centre + 4, { color: '#ffb547' });
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uRo;
      uniform float uMode, uA0, uA1, uN, uP0, uP1;
      float wheel(vec3 room, float ang){
        vec2 uv = cardUV(room, dirRoom(${WHEEL.az.toFixed(1)}, ${WHEEL.el.toFixed(1)}), ${(2 * WHEEL.r * 1.15).toFixed(1)}, 1.0, 0.0);
        if (uv.x < 0.0) return -1.0;
        vec2 p = uv * 2.0 - 1.0; p *= 1.15;
        float r = length(p);
        float a = atan(p.x, p.y) + ang;
        float s = abs(fract(a * uN / (2.0 * PI)) - 0.5);           // 0 on a spoke
        float spoke = (1.0 - smoothstep(0.05, 0.08, s)) * step(0.12, r) * step(r, 0.92);
        float rim = 1.0 - smoothstep(0.02, 0.035, abs(r - 0.95));
        float hub = 1.0 - smoothstep(0.1, 0.12, r);
        float mark = (1.0 - smoothstep(0.05, 0.07, length(p - 0.78 * vec2(sin(-ang), cos(-ang))))); // one red mark
        return max(max(spoke, rim), hub) + 2.0 * mark;
      }
      float fence(vec3 room, float off){
        float az = azOf(room) + off, el = elOf(room);
        float s = abs(fract(az / 9.0) - 0.5) * 9.0;               // degrees from the nearest pole
        return (1.0 - smoothstep(0.7, 0.85, s * cos(el * DEG))) * step(-5.0, el) * step(el, 40.0);
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.5);
        if (uMode < 0.5) {
          float v = 0.0, red = 0.0;
          for (int i = 0; i < 8; i++) {
            float k = float(i) / 8.0;
            float w = wheel(room, mix(uA0, uA1, k));
            if (w < -0.5) { v = -1.0; break; }
            red += step(1.5, w) / 8.0; v += min(w, 1.0) / 8.0;
          }
          if (v > -0.5) c = mix(c, vec3(0.95), v); c = mix(c, vec3(1.0, 0.25, 0.2), red);
        } else {
          float v = 0.0;
          for (int i = 0; i < 8; i++) v += fence(room, mix(uP0, uP1, float(i) / 8.0)) / 8.0;
          c = mix(c, vec3(0.95, 0.9, 0.8), v);
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        vec4 q = sampleEq(uRo, room); c = mix(c, q.rgb, q.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRo: { value: ro.texture }, uMode: { value: 0 }, uA0: { value: 0 }, uA1: { value: 0 }, uN: { value: 12 }, uP0: { value: 0 }, uP1: { value: 0 } });
    const TAU = Math.PI * 2;
    return {
      render(t) {
        const u = mat.uniforms;
        const fps = Number(view.p('fps')), dt = fps > 0 ? 1 / fps : 1 / 60;
        const tq = frameTime(t, fps);
        const blur = view.p('blur');
        const wheel = view.p('mode') === 'wheel';
        u.uMode.value = wheel ? 0 : 1;
        u.uN.value = view.p('spokes');
        const a = (at) => view.integrate('speed', TAU, at) % (TAU * 1000);
        const f = (at) => view.integrate('pan', 1, at) % 360;
        u.uA0.value = a(tq); u.uA1.value = blur ? a(tq + dt) : a(tq);
        u.uP0.value = f(tq); u.uP1.value = blur ? f(tq + dt) : f(tq);
        const sp = view.p('speed'), n = view.p('spokes'), pan = view.p('pan');
        const per = fps > 0 ? fps : 60;
        if (wheel) {
          const gaps = (sp * n) / per;                          // spoke gaps per frame
          const seen = gaps - Math.round(gaps);
          ro.set([`${fps > 0 ? fps : 'display'} frames per second`, `true: ${(sp * n).toFixed(1)} spokes pass per second`, `= ${gaps.toFixed(2)} spoke gaps per frame`, Math.abs(seen) < 0.03 ? 'the eye sees: it stands still' : `the eye sees: ${seen > 0 === sp > 0 ? 'forwards' : 'BACKWARDS'}, ${Math.abs(seen).toFixed(2)} gap/frame`]);
        } else {
          const deg = Math.abs(pan) / per;
          ro.set([`${fps > 0 ? fps : 'display'} frames per second`, `pan ${Math.abs(pan)}°/s = ${deg.toFixed(2)}° per frame`, `≈ ${(deg * comp.res / DOME.fisheyeFov).toFixed(0)} master pixels per frame`, deg > 0.5 ? 'expect visible judder' : 'smooth enough']);
        }
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); ro.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    // one tick for every spoke that passes the top: the TRUE speed, whatever the eye sees
    const out = group.panner(); out.set(0, labEls().centre, 0.1);
    const g = ctx.createGain(); g.gain.value = 0.5; g.connect(out.input);
    let next = null, last = 0;
    return {
      update(t) {
        if (!view.p('sound') || view.p('mode') !== 'wheel') { next = null; return; }
        const rate = Math.abs(view.p('speed')) * view.p('spokes');   // ticks per second
        if (rate < 0.2) { next = null; return; }
        const period = 1 / Math.min(rate, 60);
        if (next === null || next < t - 0.1) next = t + 0.02;
        while (next < t + 0.15) {
          const when = ctxTime(next);
          if (when > ctx.currentTime && when > last) {
            const o = ctx.createOscillator(), e = ctx.createGain();
            o.type = 'square'; o.frequency.value = 1800;
            e.gain.setValueAtTime(0, when); e.gain.linearRampToValueAtTime(0.25, when + 0.001); e.gain.exponentialRampToValueAtTime(0.001, when + 0.012);
            o.connect(e).connect(g); o.start(when); o.stop(when + 0.02); last = when;
          }
          next += period;
        }
      },
    };
  },
};
