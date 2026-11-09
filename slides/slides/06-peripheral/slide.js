import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME, hash, rimElevation } from '../../lib/dome.js';

const FIX = { az: 0, el: Math.round(DOME.sweetSpot) }; // the gold dot: on the venue's sweet spot
// one blinker per time slot; video and audio both compute it from the slot number
function blinker(slot, mode) {
  const az = -150 + hash(slot) * 300;
  const rim = rimElevation(az) + 4;
  const el = rim + hash(slot + 0.37) * Math.max(4, 62 - rim);
  const hue = Math.floor(hash(slot + 0.71) * 4);
  return { az, el, hue, mode };
}

export default {
  title: 'Peripheral vision',
  act: ACT1,
  notes: `<p>Ask everyone to <b>stare at the gold dot</b> and not move their eyes. Raise a hand when something blinks.</p>
<ul><li><b>White blinks</b>: almost everyone catches them, even far out to the sides. The periphery is built for change and motion.</li>
<li><b>Colour</b>: now say the colour out loud. Away from the centre people guess. Colour vision fades quickly off-centre.</li>
<li><b>Still shapes</b>: they appear without blinking. Far out, many go unnoticed until they move.</li></ul>
<p><b>Field map</b> shows rough zones around the gaze: sharp (a few degrees), symbols and reading (about ±30°), colour (about ±60°), and motion only out to about ±100° horizontally. The dome fills all of it, so the edges are for atmosphere and cues, not for text.</p>
<p><b>Sound cue</b> plays a click from where each blink appears: sound can pull the eyes where the picture can't.</p>`,
  params: {
    mode: { type: 'select', label: 'Stimulus', options: [{ value: 'white', label: 'White blinks' }, { value: 'colour', label: 'Colour' }, { value: 'still', label: 'Still shapes' }], value: 'white' },
    rate: { type: 'range', label: 'Blinks per second', min: 0.2, max: 3, step: 0.1, value: 0.8 },
    size: { type: 'range', label: 'Size', min: 1, max: 8, step: 0.5, value: 3, unit: '°' },
    field: { type: 'toggle', label: 'Field map', value: false },
    cue: { type: 'toggle', label: 'Sound cue at each blink', value: false },
  },

  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    const lab = (s, az, el, col) => ac.text(s, az, el, { size: 1.3, color: col, weight: 650 });
    lab('sharp', FIX.az, FIX.el + 6.5, '#ffffff');
    lab('symbols, reading', FIX.az, FIX.el + 27, '#ffd76a');
    lab('colour', -62, FIX.el + 6, '#ff9a6a');
    lab('motion only', -103, FIX.el + 4, '#6cc6ff'); lab('motion only', 103, FIX.el + 4, '#6cc6ff');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform vec3 uB; uniform float uBOn, uBSize, uField, uHue;
      uniform vec3 uFix;
      float ell(vec3 room, float H, float Vu, float Vd){
        float dh = azOf(room) - ${FIX.az.toFixed(1)}; float dv = elOf(room) - ${FIX.el.toFixed(1)};
        dh *= cos(elOf(room) * DEG * 0.5);
        float V = dv > 0.0 ? Vu : Vd;
        return length(vec2(dh / H, dv / V));
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.4);
        if (uField > 0.5) {
          float z1 = ell(room, 5.0, 5.0, 5.0), z2 = ell(room, 30.0, 25.0, 30.0), z3 = ell(room, 60.0, 45.0, 55.0), z4 = ell(room, 100.0, 50.0, 70.0);
          vec3 f = z1 < 1.0 ? vec3(0.30, 0.30, 0.30) : z2 < 1.0 ? vec3(0.22, 0.18, 0.05) : z3 < 1.0 ? vec3(0.22, 0.09, 0.04) : z4 < 1.0 ? vec3(0.03, 0.10, 0.18) : vec3(0.0);
          c += f;
          c = mix(c, vec3(1.0), max(max(aaLine(z1 - 1.0, 0.02), aaLine(z2 - 1.0, 0.01)), max(aaLine(z3 - 1.0, 0.008), aaLine(z4 - 1.0, 0.006))) * 0.5);
          vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        }
        // fixation dot
        float a = angleBetween(room, uFix);
        c = mix(c, vec3(1.0, 0.85, 0.3), 1.0 - smoothstep(0.55, 0.75, a));
        c = mix(c, vec3(1.0, 0.85, 0.3), aaLine(a - 1.4, 0.2));
        // blinker
        if (uBOn > 0.0) {
          float b = angleBetween(room, uB);
          vec3 col = uHue < 0.5 ? vec3(1.0, 0.2, 0.15) : uHue < 1.5 ? vec3(0.1, 0.9, 0.25) : uHue < 2.5 ? vec3(0.2, 0.45, 1.0) : vec3(1.0, 0.9, 0.1);
          if (uHue < -0.5) col = vec3(1.0);
          c = mix(c, col, (1.0 - smoothstep(uBSize * 0.5 - 0.15, uBSize * 0.5 + 0.15, b)) * uBOn);
        }
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uB: { value: new THREE.Vector3() }, uBOn: { value: 0 }, uBSize: { value: 3 }, uField: { value: 0 }, uHue: { value: -1 }, uFix: { value: new THREE.Vector3(0, Math.cos(FIX.el * Math.PI / 180), Math.sin(FIX.el * Math.PI / 180)) } });
    const D = Math.PI / 180;
    return {
      render() {
        const u = mat.uniforms;
        const mode = view.p('mode');
        const phase = view.integrate('rate');      // blinks so far
        const slot = Math.floor(phase), f = phase - slot;
        const b = blinker(slot, mode);
        u.uB.value.set(Math.cos(b.el * D) * Math.sin(b.az * D), Math.cos(b.el * D) * Math.cos(b.az * D), Math.sin(b.el * D));
        const on = mode === 'still' ? (f < 0.85 ? Math.min(1, f * 6) : 0) : (f < 0.18 ? 1 : 0);
        u.uBOn.value = view.t() < 1.5 ? 0 : on;
        u.uHue.value = mode === 'colour' ? b.hue : -1;
        u.uBSize.value = view.p('size');
        u.uField.value = view.p('field') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  audio({ group, ctx, view, ctxTime }) {
    const p = group.panner();
    let lastSlot = Math.floor(view.integrate('rate'));
    const click = (when) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 2200; o.type = 'triangle';
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.5, when + 0.002); g.gain.exponentialRampToValueAtTime(0.001, when + 0.09);
      o.connect(g).connect(p.input); o.start(when); o.stop(when + 0.1);
    };
    return {
      update(t) {
        const slot = Math.floor(view.integrate('rate'));
        if (slot !== lastSlot) {
          lastSlot = slot;
          if (view.p('cue') && view.t() > 1.5 && view.p('mode') !== 'still') {
            const b = blinker(slot, view.p('mode'));
            p.set(b.az, b.el, 0, 0.001);
            click(ctx.currentTime + 0.01);
          }
        }
      },
    };
  },
};
