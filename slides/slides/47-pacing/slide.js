import { NOISE_GLSL, C } from '../_common.js';
import { ACT6, header, labEls, readout } from '../_lab.js';
import { hash, rimElevation } from '../../lib/dome.js';

const MAXSHOW = 40;
function event(k) {
  const az = -170 + hash(k * 1.37 + 0.2) * 340;
  const el = Math.max(rimElevation(az) + 5, 8 + hash(k * 2.11 + 0.7) * 50);
  return { az, el, hue: hash(k * 0.91 + 0.33) };
}
const phase = (view, at) => view.integrate('rate', 1 / 60, at);   // events so far

export default {
  title: 'Slower pacing',
  act: ACT6,
  notes: `<p>In a dome people need time to find things. On a screen the eye is already on the event; here it may be 120° away.</p>
<ul><li>Press <b>Start counting</b> and ask everyone to <b>count the events</b> silently for 30 seconds. Then turn on <b>Reveal</b>: the true count and where they all were.</li>
<li>At 6 per minute most people get them all. At 30 per minute most people get half — and they miss the ones behind them.</li>
<li>Turn on <b>Sound</b>: a soft tone from where each event happens. Counts go up — sound buys reaction time.</li></ul>
<p>Lesson: fewer events, longer shots, and announce what matters (sound, light) a moment <i>before</i> it happens.</p>`,
  params: {
    rate: { type: 'range', label: 'Events per minute', min: 2, max: 60, step: 1, value: 12 },
    reset: { type: 'button', label: 'Start counting' },
    reveal: { type: 'toggle', label: 'Reveal', value: false },
    sound: { type: 'toggle', label: 'Sound', value: false },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Slower pacing', 'people need time to find things — count the events', 'press Start counting · after 30 s, Reveal');
    ac.commit();
    const ro = readout(AngleCanvas, 0, labEls().lesson - 7.6, { color: C.warm, size: 1.6, gap: 2.4 });   // under the lesson
    const D = Math.PI / 180;
    const dir = (e) => new THREE.Vector3(Math.cos(e.el * D) * Math.sin(e.az * D), Math.cos(e.el * D) * Math.cos(e.az * D), Math.sin(e.el * D));
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uRo;
      uniform vec3 uE; uniform float uAge, uHue, uRev;
      uniform vec3 uPast[${MAXSHOW}]; uniform float uNPast;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.3;
        float a = angleBetween(room, uE);
        float life = smoothstep(0.0, 0.15, uAge) * (1.0 - smoothstep(1.0, 1.6, uAge));
        vec3 col = mix(vec3(1.0, 0.6, 0.25), vec3(0.4, 0.75, 1.0), step(0.5, uHue));
        c += col * life * ((1.0 - smoothstep(1.6, 2.0, a)) + 0.6 * aaLine(a - 2.0 - uAge * 4.0, 0.4));
        if (uRev > 0.5) for (int i = 0; i < ${MAXSHOW}; i++) {
          if (float(i) >= uNPast) break;
          float b = angleBetween(room, uPast[i]);
          c = mix(c, vec3(1.0, 0.85, 0.3), aaLine(b - 1.6, 0.3));
        }
        vec4 q = sampleEq(uRo, room); c = mix(c, q.rgb, q.a * uRev);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRo: { value: ro.texture }, uE: { value: new THREE.Vector3() }, uAge: { value: 9 }, uHue: { value: 0 }, uRev: { value: 0 }, uPast: { value: Array.from({ length: MAXSHOW }, () => new THREE.Vector3()) }, uNPast: { value: 0 } });
    return {
      render(t) {
        const u = mat.uniforms;
        const ph = phase(view, t), k = Math.floor(ph);
        const rate = view.p('rate');
        const e = event(k);
        u.uE.value.copy(dir(e)); u.uHue.value = e.hue;
        u.uAge.value = (ph - k) * 60 / rate;                 // seconds since this event began
        const r0 = view.count('reset') ? Math.floor(phase(view, view.lastPress('reset'))) + 1 : null;
        const n = r0 === null ? 0 : Math.max(0, k - r0 + 1);
        u.uRev.value = view.p('reveal') ? 1 : 0;
        u.uNPast.value = Math.min(n, MAXSHOW);
        for (let i = 0; i < Math.min(n, MAXSHOW); i++) u.uPast.value[i].copy(dir(event(k - i)));
        const secs = r0 === null ? 0 : t - view.lastPress('reset');
        ro.set(r0 === null ? ['press Start counting'] : [`${n} events in ${secs.toFixed(0)} s`]);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); ro.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    const p = group.panner();
    let lastK = null;
    return {
      update(t) {
        const ph = phase(view, t + 0.1), k = Math.floor(ph);
        if (lastK === null) { lastK = k; return; }
        if (k === lastK) return;
        lastK = k;
        if (!view.p('sound')) return;
        const e = event(k);
        const start = t - ((ph - k) * 60) / view.p('rate') + 0.1;    // server time this event began
        const when = Math.max(ctx.currentTime + 0.01, ctxTime(start));
        p.set(e.az, e.el, 0, 0.005, when - 0.02);
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = 'sine'; o.frequency.value = e.hue > 0.5 ? 660 : 440;
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.35, when + 0.05); g.gain.exponentialRampToValueAtTime(0.001, when + 1.2);
        o.connect(g).connect(p.input); o.start(when); o.stop(when + 1.3);
      },
    };
  },
};
