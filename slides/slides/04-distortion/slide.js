import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

// Position 0..1 runs from 4° above the front horizon, over the top, to 38° above the back horizon
const E0 = 4, E1 = 180 - 38;

export default {
  title: 'Distortion: the file is not the picture',
  act: ACT1,
  notes: `<p>Two ways to draw the same square. Press <b>P</b> first so the dome master is on screen too.</p>
<ul><li><b>Drawn in the file</b>: a grid of straight lines and a square of fixed pixels, drawn on the master. In the dome the lines bend into arcs, and the square changes shape as it travels.</li>
<li><b>Drawn in the room</b>: a grid of angles and a square of fixed angular size. In the dome it stays square from the centre seat. In the file it is the one that bends.</li></ul>
<p>Move the square with <b>Position</b> (front → over the top → behind), or switch on the sweep.</p>
<p>The rule we take into the week: <b>compose by angle, not by pixel</b>.</p>`,
  params: {
    mode: { type: 'select', label: 'Draw the grid and square…', options: [{ value: 'file', label: 'in the file (pixels)' }, { value: 'room', label: 'in the room (angles)' }], value: 'file' },
    pos: { type: 'range', label: 'Position: front → over the top → behind', min: 0, max: 1, step: 0.005, value: Math.round((DOME.sweetSpot - E0) / (E1 - E0) * 200) / 200 }, // starts on the sweet spot
    sweep: { type: 'toggle', label: 'Sweep back and forth', value: false },
    size: { type: 'range', label: 'Square size', min: 6, max: 40, step: 1, value: 16, unit: '°' },
    grid: { type: 'toggle', label: 'Grid', value: true },
  },

  video({ THREE, comp, view }) {
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uMode, uE, uSize, uGrid;
      // probe pattern in its own uv (0..1): frame, circle, cross, a corner mark to show rotation
      vec3 probe(vec2 uv, vec3 bg){
        vec2 p = uv * 2.0 - 1.0;
        float frame = max(abs(p.x), abs(p.y));
        vec3 c = mix(bg, vec3(0.06, 0.07, 0.1), 0.85);
        c = mix(c, vec3(1.0, 0.71, 0.28), smoothstep(0.90, 0.92, frame));
        float r = length(p);
        c = mix(c, vec3(0.42, 0.78, 1.0), 1.0 - smoothstep(0.03, 0.05, abs(r - 0.6)));
        c = mix(c, vec3(0.9), (1.0 - smoothstep(0.015, 0.03, abs(p.x))) * step(r, 0.6) + (1.0 - smoothstep(0.015, 0.03, abs(p.y))) * step(r, 0.6));
        c = mix(c, vec3(1.0, 0.36, 0.36), step(0.6, p.x) * step(0.6, p.y) * step(frame, 0.9));
        return c;
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.5);
        // probe centre: along the front-back meridian, uE degrees from the front horizon over the top
        vec3 pc = normalize(vec3(0.0, cos(uE * DEG), sin(uE * DEG)));
        if (uMode < 0.5) {
          if (uGrid > 0.5) {
            vec2 g = abs(fract(m * 5.0 + 0.5) - 0.5) / 5.0;
            float gl = 1.0 - smoothstep(0.0, 1.5 * length(fwidth(m)), min(g.x, g.y));
            c = mix(c, vec3(0.42, 0.6, 1.0), gl * 0.7);
          }
          vec2 mc = localToMaster(roomToLocal(pc));
          float half_ = uSize / (uFov / DEG);    // square of fixed PIXEL size: uSize° as measured at the zenith
          vec2 q = (m - mc) / half_;
          if (abs(q.x) < 1.0 && abs(q.y) < 1.0) c = probe(vec2(q.x, q.y) * 0.5 + 0.5, c);
        } else {
          if (uGrid > 0.5) {
            float el = elOf(room), az = azOf(room);
            float ge = abs(fract(el / 10.0 + 0.5) - 0.5) * 10.0;
            float ga = abs(fract(az / 10.0 + 0.5) - 0.5) * 10.0 * cos(el * DEG);
            float gl = max(aaLine(ge, 0.18), aaLine(ga, 0.18) * step(el, 85.0));
            c = mix(c, vec3(0.42, 0.6, 1.0), gl * 0.7);
          }
          // a flat square card of fixed ANGULAR size, facing the centre; "up" follows the meridian
          vec2 uv = cardUV(room, pc, uSize, 1.0, uE > 90.0 ? 180.0 : 0.0);
          if (uv.x >= 0.0) c = probe(uv, c);
        }
        return vec4(c, 1.0);
      }`, { uMode: { value: 0 }, uE: { value: 20 }, uSize: { value: 16 }, uGrid: { value: 1 } });
    return {
      render() {
        const u = mat.uniforms;
        u.uMode.value = view.p('mode') === 'room' ? 1 : 0;
        let pos = view.p('pos');
        if (view.p('sweep')) pos = 0.5 - 0.5 * Math.cos(view.t() * 0.35);
        u.uE.value = E0 + pos * (E1 - E0);
        u.uSize.value = view.p('size');
        u.uGrid.value = view.p('grid') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); },
    };
  },
};
