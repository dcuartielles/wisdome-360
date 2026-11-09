import { NOISE_GLSL } from '../_common.js';
import { ACT6, header } from '../_lab.js';
import { rimElevation } from '../../lib/dome.js';

export default {
  title: 'People look where others look',
  act: ACT6,
  notes: `<p>A dome audience watches together. People glance at each other, follow pointing arms, react to gasps. That is a lever flat cinema hardly has.</p>
<ul><li>Turn the <b>Brightness</b> down until the wandering light is very faint. Ask: "Point at it when you find it — and keep pointing."</li>
<li>Watch how it spreads: the first few find it on their own; the rest follow the arms, not the picture. Time it.</li>
<li>Try it with <b>Brightness</b> higher: everybody at once, no social chain.</li>
<li><b>Show me</b> makes it bright for a moment, for the people who never found it.</li></ul>
<p>Lesson: you design for a crowd. A reveal that a few people see first and the rest discover through them can be stronger than one everybody sees at once. Laughter, gasps and pointing are part of the piece.</p>`,
  params: {
    bright: { type: 'range', label: 'Brightness', min: 0.02, max: 1, step: 0.01, value: 0.08 },
    wander: { type: 'range', label: 'Wander speed', min: 0, max: 6, step: 0.1, value: 1.5, unit: '°/s' },
    show: { type: 'button', label: 'Show me' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'People look where others look', 'point at the light when you find it — and keep pointing', 'start very faint, then watch how the pointing spreads');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform vec3 uL; uniform float uB;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.35;
        float a = angleBetween(room, uL);
        c += vec3(1.0, 0.92, 0.75) * uB * (exp(-a * a / 0.25) + 0.3 * exp(-a * a / 6.0));
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a * 0.8);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uL: { value: new THREE.Vector3(0, 1, 0) }, uB: { value: 0.1 } });
    const D = Math.PI / 180;
    return {
      render(t) {
        // a slow wander that starts away from the front, so it has to be found
        const s = view.integrate('wander') / 40;
        const az = 70 + 80 * Math.sin(s) + 25 * Math.sin(s * 2.3 + 1);
        const el = Math.max(rimElevation(az) + 4, 32 + 18 * Math.sin(s * 1.7 + 0.5));   // wanders away from the front; never under the rim
        mat.uniforms.uL.value.set(Math.cos(el * D) * Math.sin(az * D), Math.cos(el * D) * Math.cos(az * D), Math.sin(el * D));
        const flash = t - view.lastPress('show');
        mat.uniforms.uB.value = Math.max(view.p('bright'), flash >= 0 && flash < 2.5 ? 1.5 * (1 - flash / 2.5) : 0);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
