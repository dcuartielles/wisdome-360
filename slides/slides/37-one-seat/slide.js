import { C } from '../_common.js';
import { ACT5, header, labEls, SEATS, SEAT_OPTIONS, SEAT_GLSL } from '../_lab.js';

export default {
  title: 'Only one true seat',
  act: ACT5,
  notes: `<p>A dome master is drawn for <b>one point</b>: usually the centre of the dome. Only someone sitting there sees straight lines straight. Everyone else sees them bent, and the further from the centre, the more.</p>
<ul><li>Start with <b>Drawn for: centre</b>. The corridor and its rails are perfectly straight from the middle of the room. Ask the people at the sides and in the back row whether the rails look straight.</li>
<li>Switch to <b>left aisle</b>: now the picture is drawn for a person on the left. They see it straight; the centre now sees it bent. Repeat for the back row.</li>
<li>That is the trade-off of every dome: one sweet seat, everyone else close enough. Big shapes and slow curves forgive it; architecture, text and straight horizons do not.</li></ul>
<p>Seat positions are approximate (metres from the projection centre). Rehearse it in the inside view, dragging the camera, but the real test is walking the seats on Monday.</p>`,
  params: {
    seat: { type: 'select', label: 'Drawn for', options: SEAT_OPTIONS, value: 'centre' },
    rails: { type: 'toggle', label: 'Highlight the straight rails', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Only one true seat', 'the picture is right from one point — everyone else sees straight lines bent', 'try: ask the sides and the back row, then switch who it is drawn for');
    ac.commit();
    const lab = new AngleCanvas(2048);
    const mat = comp.material(`${SEAT_GLSL}
      uniform float uRails;
      uniform sampler2D uLab;
      // a long corridor round the viewer: walls at x = ±4.5 m, floor -1.3 m, ceiling +3.4 m, far wall at y = 40 m
      vec3 corridor(vec3 o, vec3 v){
        float t = 1e9; vec3 n = vec3(0.0);
        if (v.x > 1e-4) { float k = (4.5 - o.x) / v.x; if (k < t) { t = k; n = vec3(-1.0, 0.0, 0.0); } }
        if (v.x < -1e-4) { float k = (-4.5 - o.x) / v.x; if (k < t) { t = k; n = vec3(1.0, 0.0, 0.0); } }
        if (v.z < -1e-4) { float k = (-1.3 - o.z) / v.z; if (k < t) { t = k; n = vec3(0.0, 0.0, 1.0); } }
        if (v.z > 1e-4) { float k = (3.4 - o.z) / v.z; if (k < t) { t = k; n = vec3(0.0, 0.0, -1.0); } }
        if (v.y > 1e-4) { float k = (40.0 - o.y) / v.y; if (k < t) { t = k; n = vec3(0.0, -1.0, 0.0); } }
        vec3 p = o + v * t;
        vec3 base = abs(n.z) > 0.5 ? (n.z > 0.0 ? vec3(0.05, 0.045, 0.04) : vec3(0.025, 0.03, 0.04)) : abs(n.y) > 0.5 ? vec3(0.07, 0.05, 0.035) : vec3(0.035, 0.04, 0.05);
        base *= 1.0 / (1.0 + t * 0.03);
        float l = 0.0;
        if (abs(n.x) > 0.5) l = max(gridLine(p.y, 2.0, 0.035), gridLine(p.z, 1.0, 0.03));
        if (abs(n.z) > 0.5) l = max(gridLine(p.x, 1.5, 0.03), gridLine(p.y, 2.0, 0.035));
        if (abs(n.y) > 0.5) { l = max(gridLine(p.x, 1.5, 0.06), gridLine(p.z, 1.0, 0.06)); if (abs(p.x) < 0.7 && p.z < 1.0) base = vec3(0.6, 0.45, 0.25); }
        vec3 c = base + vec3(0.32, 0.36, 0.42) * l / (1.0 + t * 0.02);
        // the four long corner rails + a centre line on the floor: these should be STRAIGHT
        if (uRails > 0.5) {
          float r = 0.0;
          if (abs(n.x) > 0.5) r = max(1.0 - smoothstep(0.03, 0.06, abs(p.z + 1.25)), 1.0 - smoothstep(0.03, 0.06, abs(p.z - 3.35)));
          if (abs(n.z) > 0.5) r = max(r, max(1.0 - smoothstep(0.03, 0.06, abs(abs(p.x) - 4.45)), 1.0 - smoothstep(0.02, 0.05, abs(p.x))));
          r *= 1.0 / (1.0 + t * 0.01);
          c = mix(c, vec3(1.0, 0.72, 0.3), r);
        }
        return c;
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = corridor(uSeat, seatRay(room));
        vec4 q = sampleEq(uLab, room); c = mix(c, q.rgb, q.a);
        vec4 e = sampleEq(uEq, room); c = mix(c * (1.0 - e.a * 0.7), e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uLab: { value: lab.texture }, uSeat: { value: new THREE.Vector3() }, uRails: { value: 1 } });
    let last = null;
    const labEl = labEls().try + 9;   // just above the "try" line
    return {
      render() {
        const s = view.p('seat');
        mat.uniforms.uSeat.value.set(...SEATS[s]);
        mat.uniforms.uRails.value = view.p('rails') ? 1 : 0;
        if (s !== last) {
          last = s; lab.clear();
          lab.text(`drawn for: ${SEAT_OPTIONS.find((o) => o.value === s).label}`, 0, labEl, { size: 1.5, weight: 700, color: C.warm });
          lab.commit();
        }
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); lab.dispose(); },
    };
  },
};
