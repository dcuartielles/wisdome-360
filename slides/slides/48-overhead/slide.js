import { NOISE_GLSL } from '../_common.js';
import { ACT6, header } from '../_lab.js';

const DUR = 9;

export default {
  title: 'Overhead is for events',
  act: ACT6,
  notes: `<p>Nobody holds their head back for long, so straight up is <b>not</b> a place for content. But it is the dome's special effect: once or twice in a piece, something that happens overhead is unforgettable.</p>
<ul><li>Let the calm scene settle, then press <b>Reveal</b> without warning. Watch the audience: heads go up together.</li>
<li>Notice how the event <b>starts in front</b> (where people already look), rises, and blooms overhead: you lead the eye there; you do not wait for it.</li>
<li>The sound rises with it — but 5.1 has no height, so it spreads over all speakers and opens up instead of going "up" (see "Sound has no height").</li>
<li>After it, bring the eye back down to the front.</li></ul>
<p>Lesson: overhead is an exclamation mark. Use it rarely, lead the eye to it, and return.</p>`,
  params: { reveal: { type: 'button', label: 'Reveal' } },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Overhead is for events', 'nobody looks up for long — so make looking up an event', 'press Reveal, without warning');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uK;          // 0..1 through the event, 0 = none
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float el = elOf(room), az = azOf(room);
        vec3 c = houseSky(room, 0.9) + stars(room) * 0.5;
        if (el < 4.0) c = vec3(0.03, 0.02, 0.02);
        if (uK > 0.0) {
          // 1) a spark rises from the front, 2) blooms overhead, 3) fades
          float rise = smoothstep(0.0, 0.35, uK);
          vec3 spark = dirRoom(0.0, mix(20.0, 90.0, rise));
          float a = angleBetween(room, spark);
          c += vec3(1.0, 0.85, 0.6) * exp(-a * a / 0.6) * (1.0 - smoothstep(0.35, 0.45, uK));
          float bloom = smoothstep(0.33, 0.75, uK), fade = 1.0 - smoothstep(0.7, 1.0, uK);
          float d = 90.0 - el;                                   // degrees from straight up
          float r = bloom * 70.0;
          float petals = 0.5 + 0.5 * cos(az * DEG * 12.0 + d * 0.15);
          float ring = exp(-pow(d - r, 2.0) / (20.0 + 60.0 * bloom));
          c += mix(vec3(1.0, 0.5, 0.2), vec3(0.4, 0.6, 1.0), d / 90.0) * ring * (0.5 + 0.8 * petals) * fade * 1.4;
          c += vec3(0.25, 0.2, 0.3) * exp(-d / 25.0) * bloom * fade;
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uK: { value: 0 } });
    return {
      render(t) {
        const age = t - view.lastPress('reveal');
        mat.uniforms.uK.value = age >= 0 && age < DUR ? age / DUR : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    const done = new Set();
    return {
      update() {
        for (const at of view.presses('reveal')) {
          if (done.has(at)) continue;
          done.add(at);
          const w = ctxTime(at);
          if (w + DUR < ctx.currentTime) continue;
          const p = group.panner();
          // a rising whistle from the front, then a wide shimmering chord that opens over all speakers
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.type = 'sine'; o.frequency.setValueAtTime(300, w); o.frequency.exponentialRampToValueAtTime(1600, w + DUR * 0.35);
          g.gain.setValueAtTime(0, w); g.gain.linearRampToValueAtTime(0.25, w + 0.5); g.gain.linearRampToValueAtTime(0, w + DUR * 0.4);
          o.connect(g).connect(p.input); o.start(w); o.stop(w + DUR * 0.45);
          const steps = 30;
          for (let i = 0; i <= steps; i++) { const k = i / steps; p.set(0, 20 + 70 * Math.min(1, k / 0.35), 0, 0.05, w + k * DUR); }
          [220, 277.2, 329.6, 440, 554.4].forEach((f, i) => {
            const q = ctx.createOscillator(), e = ctx.createGain(), pp = group.panner();
            q.type = 'triangle'; q.frequency.value = f; pp.set(-110 + i * 55, 70, 0.6);
            const s = w + DUR * 0.33;
            e.gain.setValueAtTime(0, s); e.gain.linearRampToValueAtTime(0.09, s + 1.2); e.gain.linearRampToValueAtTime(0, w + DUR);
            q.connect(e).connect(pp.input); q.start(s); q.stop(w + DUR + 0.1);
          });
        }
      },
    };
  },
};
