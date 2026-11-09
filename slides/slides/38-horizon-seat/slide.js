import { C, NOISE_GLSL } from '../_common.js';
import { ACT5, header, labEls, SEATS, SEAT_OPTIONS, SEAT_GLSL } from '../_lab.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'The tilt bends the horizon',
  act: ACT5,
  notes: `<p>A sea, a pier running straight out from the audience, and the horizon. From the centre of the dome the horizon is level and the pier is a straight line.</p>
<ul><li>Because the dome is tilted ${DOME.tilt}°, the horizon is not a circle round the centre of the image: it runs low across the front and disappears below the rim at the sides. Someone on the left aisle is closer to the left side of the screen: for them the horizon <b>tilts and bends</b>, and the pier leans.</li>
<li>Ask the two aisles: is the horizon level? Which way does it lean? They will disagree with each other.</li>
<li>Switch <b>Drawn for</b> to an aisle to fix it for them, at the cost of everybody else.</li>
<li><b>Raise the horizon</b> to see that a higher horizon (an elevated sea, a skyline) bends less in front: big, high, slow curves forgive off-centre seats.</li></ul>`,
  params: {
    seat: { type: 'select', label: 'Drawn for', options: SEAT_OPTIONS, value: 'centre' },
    eye: { type: 'range', label: 'Eye height above the sea', min: 0.5, max: 40, step: 0.5, value: 2, unit: 'm' },
    lift: { type: 'range', label: 'Raise the horizon (tilt the world)', min: 0, max: 20, step: 0.5, value: 0, unit: '°' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'The tilt bends the horizon', 'a level horizon is level for one seat only', 'try: ask both aisles if the horizon is level — then draw it for one of them');
    ac.commit();
    const lab = new AngleCanvas(2048);
    const mat = comp.material(`${NOISE_GLSL}${SEAT_GLSL}
      uniform float uEye, uLift;
      uniform sampler2D uLab;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 v = seatRay(room);
        float cl = cos(uLift * DEG), sl = sin(uLift * DEG);
        v = vec3(v.x, v.y * cl - v.z * sl, v.y * sl + v.z * cl);    // tilt the world forward by uLift
        vec3 o = uSeat;
        vec3 c;
        float hz = v.z;                                              // 0 at the horizon
        if (v.z < 0.0) {
          float t = (o.z + uEye) / -v.z;
          vec3 p = o + v * t;
          float w = 0.5 + 0.5 * sin(p.y * 1.3 + uTime * 0.8 + sin(p.x * 0.4) * 2.0);
          c = mix(vec3(0.01, 0.03, 0.06), vec3(0.03, 0.08, 0.13), w * exp(-t * 0.01));
          // the pier: a straight walkway from under the audience to 300 m out
          float pier = (1.0 - smoothstep(0.9, 1.0, abs(p.x))) * step(p.y, 300.0) * step(-30.0, p.y);
          c = mix(c, vec3(0.45, 0.33, 0.2) * (0.6 + 0.4 * step(0.5, fract(p.y * 0.5))), pier);
          // sun glitter
          c += vec3(1.0, 0.6, 0.3) * pow(max(0.0, 1.0 - abs(p.x) / (t * 0.12 + 1.0)), 6.0) * w * 0.25 * step(300.0, p.y);
        } else {
          c = mix(vec3(0.16, 0.07, 0.04), vec3(0.01, 0.015, 0.04), smoothstep(0.0, 0.5, v.z)) + stars(v) * smoothstep(0.15, 0.4, v.z);
          float sun = length(v - normalize(vec3(0.0, 1.0, 0.02)));
          c += vec3(1.0, 0.65, 0.35) * (1.0 - smoothstep(0.035, 0.04, sun)) + vec3(0.4, 0.15, 0.05) * exp(-sun * 8.0);
        }
        c = mix(c, vec3(1.0, 0.75, 0.45), (1.0 - smoothstep(0.0, 0.0025, abs(hz))) * 0.9);
        vec4 q = sampleEq(uLab, room); c = mix(c, q.rgb, q.a);
        vec4 e = sampleEq(uEq, room); c = mix(c * (1.0 - e.a * 0.7), e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uLab: { value: lab.texture }, uSeat: { value: new THREE.Vector3() }, uEye: { value: 2 }, uLift: { value: 0 } });
    let last = null;
    const labEl = labEls().lesson - 8.6;   // in the sky, under the lesson
    return {
      render() {
        const s = view.p('seat');
        mat.uniforms.uSeat.value.set(...SEATS[s]);
        mat.uniforms.uEye.value = view.p('eye'); mat.uniforms.uLift.value = -view.p('lift');
        if (s !== last) {
          last = s; lab.clear();
          lab.text(`drawn for: ${SEAT_OPTIONS.find((o) => o.value === s).label}`, 0, labEl, { size: 1.4, weight: 700, color: C.warm });
          lab.commit();
        }
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); lab.dispose(); },
    };
  },
};
