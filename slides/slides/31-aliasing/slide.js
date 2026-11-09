import { NOISE_GLSL } from '../_common.js';
import { ACT5, header, labEls, readout } from '../_lab.js';
import { DOME } from '../../lib/dome.js';


export default {
  title: 'Spatial aliasing: the zone plate',
  act: ACT5,
  notes: `<p>A <b>zone plate</b>: rings that get finer and finer towards the edge. Wherever the rings get finer than the pixels can carry, <b>ghost rings</b> appear: patterns that are not in the picture at all.</p>
<ul><li>Raise <b>Finest rings</b> slowly. The red dashed circle marks where the rings reach the limit of this master (the Nyquist limit: two pixels per cycle). Outside it, everything is a lie.</li>
<li>The dome master is ${DOME.res} px across ${DOME.fisheyeFov}°: about ${(DOME.res / DOME.fisheyeFov).toFixed(1)} px per degree, so nothing finer than about ${(DOME.res / DOME.fisheyeFov / 2).toFixed(1)} cycles per degree survives. The eye resolves ~30. The projectors then resample again, so the dome adds a second layer of moiré of its own.</li>
<li>Turn on <b>Anti-aliasing</b>: detail beyond the limit fades to grey instead of turning into fake rings. This is what mipmaps, supersampling and blur do for you.</li>
<li>Ask: where have you seen this? Striped shirts on TV, brick walls, fences from a car, fine text in a render.</li></ul>
<p>Lesson for the students: <b>no hairlines, no fine stripes, no tiny text</b> — and if you must, filter them.</p>`,
  params: {
    freq: { type: 'range', label: 'Finest rings', min: 1, max: 24, step: 0.5, value: 4, unit: 'cyc/°' },
    size: { type: 'range', label: 'Plate radius', min: 8, max: 40, step: 1, value: 20, unit: '°' },
    aa: { type: 'toggle', label: 'Anti-aliasing', value: false },
    drift: { type: 'range', label: 'Drift (makes ghosts move)', min: 0, max: 2, step: 0.05, value: 0, unit: '°/s' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Spatial aliasing', 'finer than two pixels per cycle, a pattern turns into a different pattern', 'try: raise "Finest rings" — then turn on anti-aliasing');
    ac.commit();
    const L = labEls(), CENTRE = { az: 0, el: L.centre - 2 };   // the plate just under the sweet spot (clear of the lesson), the numbers to its right
    const ro = readout(AngleCanvas, 58, L.centre + 2);
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uRo;
      uniform float uK, uSize, uAA, uNyq, uShift;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.5);
        vec2 uv = cardUV(room, dirRoom(${CENTRE.az.toFixed(1)}, ${CENTRE.el.toFixed(1)}), 2.0 * uSize * 1.3, 1.0, 0.0);
        if (uv.x >= 0.0) {
          vec2 p = (uv * 2.0 - 1.0) * uSize * 1.3;          // degrees on the plate (near enough)
          p.x += uShift;
          float r = length(p);
          float ph = PI * uK * r * r;                       // local frequency = uK * r cycles per degree
          float v = 0.5 + 0.5 * cos(ph);
          float cpp = fwidth(ph) / (2.0 * PI);              // cycles per master pixel
          if (uAA > 0.5) v = mix(v, 0.5, smoothstep(0.25, 0.5, cpp));
          float inside = 1.0 - smoothstep(uSize - 0.3, uSize, r);
          c = mix(c, vec3(v), inside);
          // Nyquist circle (r where uK * r = uNyq)
          float rn = uNyq / max(uK, 1e-3);
          float dash = step(0.5, fract(atan(p.y, p.x) * 12.0 / PI));
          c = mix(c, vec3(1.0, 0.3, 0.25), aaLine(r - rn, 0.18) * dash * step(rn, uSize));
          c = mix(c, vec3(0.6), aaLine(r - uSize, 0.2));
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        vec4 q = sampleEq(uRo, room); c = mix(c, q.rgb, q.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRo: { value: ro.texture }, uK: { value: 0 }, uSize: { value: 20 }, uAA: { value: 0 }, uNyq: { value: 5 }, uShift: { value: 0 } });
    return {
      render() {
        const u = mat.uniforms;
        const size = view.p('size'), freq = view.p('freq');
        const nyq = comp.res / DOME.fisheyeFov / 2;              // cycles per degree this master can carry
        u.uK.value = freq / size; u.uSize.value = size; u.uAA.value = view.p('aa') ? 1 : 0; u.uNyq.value = nyq;
        u.uShift.value = view.integrate('drift') % 40;
        ro.set([`this master: ${comp.res} px over ${DOME.fisheyeFov}°`, `≈ ${(comp.res / DOME.fisheyeFov).toFixed(1)} px per degree`, `limit ≈ ${nyq.toFixed(1)} cycles per degree`, `plate edge: ${freq} cycles per degree`, freq > nyq ? `→ ${(freq / nyq).toFixed(1)}× past the limit` : '→ inside the limit']);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); ro.dispose(); },
    };
  },
};
