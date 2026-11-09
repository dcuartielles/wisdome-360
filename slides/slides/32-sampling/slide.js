import { C, NOISE_GLSL } from '../_common.js';
import { ACT5, header } from '../_lab.js';
import { DOME, rimElevation } from '../../lib/dome.js';

// the same patch of stripes, placed around the room
const PATCHES = [
  { az: 0, el: Math.max(2, rimElevation(0) + 9), name: 'front, low' },
  { az: 0, el: Math.round(DOME.sweetSpot), name: 'sweet spot' },
  { az: -78, el: 28, name: 'left' },
  { az: 82, el: 52, name: 'right, high' },
  { az: 0, el: 82, name: 'overhead' },
  { az: 180, el: 62, name: 'behind' },
];

export default {
  title: 'The fisheye samples unevenly',
  act: ACT5,
  notes: `<p>Six identical patches of stripes: same width in degrees, same direction on the dome. They do <b>not</b> look the same in the master, and on a dome some of them shimmer while others are clean.</p>
<ul><li>An equidistant fisheye has the same number of pixels per degree outwards from the centre, but not around it: near the rim it has more pixels per degree around than outwards: about 1.4× at the edge of our 160° file (1.6× for a 180° one). So stripes running one way alias, the same stripes turned 90° do not. Switch <b>Stripes</b> between <i>along the horizon</i> and <i>up–down</i>.</li>
<li>Turn on <b>Pixel density map</b>: blue = fewer pixels per degree, red = more. The centre of the master (64° up, in front) and the rim are sampled differently.</li>
<li>Then the projectors resample the master again onto their own grids: five different moiré patterns, one per projector.</li></ul>
<p>Lesson: test fine detail <b>where it will sit</b>, in the dome or the Quest viewer, not on a flat monitor.</p>`,
  params: {
    freq: { type: 'range', label: 'Stripe frequency', min: 1, max: 12, step: 0.25, value: 5, unit: 'cyc/°' },
    orient: { type: 'select', label: 'Stripes', options: [{ value: '0', label: 'along the horizon' }, { value: '1', label: 'up–down' }, { value: '2', label: 'diagonal' }], value: '0' },
    density: { type: 'toggle', label: 'Pixel density map', value: false },
    spin: { type: 'range', label: 'Turn the stripes', min: 0, max: 20, step: 0.5, value: 0, unit: '°/s' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'The fisheye samples unevenly', 'six identical patches — not identical in the file, not identical on the dome', 'try: switch the stripe direction, then show the pixel density map');
    for (const p of PATCHES) ac.text(p.name, p.az, p.el - 10.5, { size: 1.05, color: C.mute, weight: 600 });
    ac.commit();
    const D = Math.PI / 180;
    const dirs = PATCHES.map((p) => new THREE.Vector3(Math.cos(p.el * D) * Math.sin(p.az * D), Math.cos(p.el * D) * Math.cos(p.az * D), Math.sin(p.el * D)));
    const mat = comp.material(`${NOISE_GLSL}
      uniform vec3 uP[6];
      uniform float uF, uAng, uDen;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.4);
        if (uDen > 0.5) {
          // master pixels per degree here (geometric mean of the two directions)
          float px = 1.0 / max(degrees(length(dFdx(room))), 1e-5);   // master pixels per degree, across
          float py = 1.0 / max(degrees(length(dFdy(room))), 1e-5);   // and up the file
          float ppd = sqrt(px * py) / ${(comp.res / 180).toFixed(3)};
          float k = clamp((ppd - 0.97) / 0.45, 0.0, 1.0);
          c = mix(vec3(0.05, 0.12, 0.35), vec3(0.45, 0.08, 0.05), k) * 0.9;
        }
        for (int i = 0; i < 6; i++) {
          // local "up" and "right" on the dome at this patch
          vec3 f = uP[i];
          vec3 r = normalize(cross(f, vec3(0.0, 0.0, 1.0) + vec3(0.0, 0.0001, 0.0)));
          if (abs(f.z) > 0.98) r = vec3(1.0, 0.0, 0.0);
          vec3 u = cross(r, f);
          float a = angleBetween(room, f);
          if (a < 9.0) {
            vec3 d = room - f * dot(room, f);
            vec2 q = vec2(dot(d, r), dot(d, u)) / DEG;     // degrees from the patch centre
            vec2 dir = vec2(sin(uAng), cos(uAng));
            float v = 0.5 + 0.5 * cos(2.0 * PI * uF * dot(q, dir));
            c = mix(c, vec3(v), 1.0 - smoothstep(8.6, 9.0, a));
          }
          c = mix(c, vec3(0.55), aaLine(a - 9.3, 0.2));
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uP: { value: dirs }, uF: { value: 5 }, uAng: { value: 0 }, uDen: { value: 0 } });
    return {
      render() {
        const u = mat.uniforms;
        u.uF.value = view.p('freq');
        const base = [0, 90, 45][Number(view.p('orient'))] * D;   // 0: lines along the horizon = stripes vary up–down
        u.uAng.value = base + view.integrate('spin') * D;
        u.uDen.value = view.p('density') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
