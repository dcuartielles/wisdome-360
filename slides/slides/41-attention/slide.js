import { NOISE_GLSL } from '../_common.js';
import { ACT6, header } from '../_lab.js';
import { hash, rimElevation } from '../../lib/dome.js';

const N = 18;
// the objects in the scene: same on the video and the audio page
const OBJ = Array.from({ length: N }, (_, i) => {
  const az = -170 + (340 * (i + hash(i * 3.1) * 0.8)) / N;
  const el = Math.max(rimElevation(az) + 6, 8 + hash(i + 0.37) * 40);
  return { az, el };
});
const target = (k) => Math.floor(hash(k * 7.77 + 1.3) * N);

export default {
  title: 'No frame: steer the look',
  act: ACT6,
  notes: `<p>On a screen, the frame and the close-up tell people where to look. In a dome there is no frame: 58 people may be looking at 58 different places. You steer the look with <b>sound, light, motion and contrast</b>.</p>
<ul><li>Choose a <b>Cue</b>, press <b>Next target</b>, and ask everyone to <b>point</b> at what they think matters. Count how many got it.</li>
<li><b>Sound</b> works even behind people. <b>Motion</b> wins in the corner of the eye. <b>Light</b> and <b>contrast</b> work in front but are missed behind.</li>
<li><b>None</b>: the same target with no cue. Nobody finds it — that is what an unguided dome feels like.</li>
<li>Combine cues (e.g. sound first, then light) — that is how fulldome shows lead the eye round the room.</li></ul>
<p>Reading: Rothe et al. (2019), a taxonomy of every known guidance method; Sitzmann et al. (2018) on where people actually look.</p>`,
  params: {
    cue: { type: 'select', label: 'Cue', options: [{ value: 'sound', label: 'Sound' }, { value: 'light', label: 'Light' }, { value: 'motion', label: 'Motion' }, { value: 'contrast', label: 'Colour contrast' }, { value: 'none', label: 'None' }], value: 'sound' },
    next: { type: 'button', label: 'Next target' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'No frame: steer the look', 'no frame, no close-up — so how do 58 people know where to look?', 'press Next target, ask everyone to point');
    ac.commit();
    const D = Math.PI / 180;
    const dirs = OBJ.map((o) => new THREE.Vector3(Math.cos(o.el * D) * Math.sin(o.az * D), Math.cos(o.el * D) * Math.cos(o.az * D), Math.sin(o.el * D)));
    const mat = comp.material(`${NOISE_GLSL}
      uniform vec3 uO[${N}];
      uniform float uT, uCue, uAge;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.7) + stars(room) * 0.25;
        for (int i = 0; i < ${N}; i++) {
          vec3 d = uO[i];
          bool isT = float(i) == uT;
          float on = isT ? smoothstep(0.0, 0.5, uAge) : 0.0;
          if (isT && uCue > 1.5 && uCue < 2.5) d = normalize(d + vec3(sin(uTime * 5.0), 0.0, cos(uTime * 3.3)) * 0.03 * on);
          float a = angleBetween(room, d);
          vec3 col = vec3(0.32, 0.36, 0.42);
          float k = 0.55;
          if (isT && uCue > 0.5 && uCue < 1.5) k = mix(0.55, 2.6, on);                          // light
          if (isT && uCue > 2.5 && uCue < 3.5) col = mix(col, vec3(1.0, 0.45, 0.12), on);      // contrast
          if (uCue > 2.5 && uCue < 3.5 && !isT) col *= 1.0 - 0.3 * smoothstep(0.0, 0.5, uAge);
          c += col * k * (1.0 - smoothstep(1.8, 2.4, a));
          c += col * k * 0.25 * exp(-a * a / 12.0);
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uO: { value: dirs }, uT: { value: -1 }, uCue: { value: 0 }, uAge: { value: 0 } });
    const CUES = ['sound', 'light', 'motion', 'contrast', 'none'];
    return {
      render(t) {
        const k = view.count('next');
        const u = mat.uniforms;
        u.uT.value = k ? target(k) : -1;
        u.uCue.value = CUES.indexOf(view.p('cue'));
        u.uAge.value = k ? t - view.lastPress('next') : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, ctx, view, ctxTime }) {
    const p = group.panner();
    const done = new Set();
    return {
      update() {
        const ps = view.presses('next');
        ps.forEach((at, i) => {
          if (done.has(at)) return;
          done.add(at);
          if (view.p('cue') !== 'sound') return;
          const o = OBJ[target(i + 1)];
          const when = ctxTime(at) + 0.3;
          if (when < ctx.currentTime) return;
          p.set(o.az, o.el, 0, 0.005, when - 0.05);
          for (let j = 0; j < 3; j++) {
            const osc = ctx.createOscillator(), e = ctx.createGain(), w = when + j * 0.35;
            osc.type = 'sine'; osc.frequency.value = 880 * (j === 2 ? 1.5 : 1);
            e.gain.setValueAtTime(0, w); e.gain.linearRampToValueAtTime(0.45, w + 0.01); e.gain.exponentialRampToValueAtTime(0.001, w + 0.3);
            osc.connect(e).connect(p.input); osc.start(w); osc.stop(w + 0.32);
          }
        });
      },
    };
  },
};
