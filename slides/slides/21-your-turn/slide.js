import { ACT4, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

const WEEK = [
  ['MON', 'here: the dome, the rules, the tools'],
  ['TUE', 'concept + storyboard by angle'],
  ['WED', 'seminar (TEI) · build'],
  ['THU', 'build · record the fallback'],
  ['FRI', 'files in by 08:00 · show it'],
];

export default {
  title: 'Your turn',
  act: ACT4,
  notes: `<p>Close on the week. Leave the sky turning while people ask questions.</p><p>The week: Wednesday's seminar is for TEI; EDT groups discuss the readings among themselves (optional EDT session Wednesday morning). Films and fallback recordings are in by <b>Friday 08:00</b>; dry run in the dome Friday morning, presentations Friday afternoon. (Edit WEEK at the top of this slide.)</p>`,
  params: { drift: { type: 'range', label: 'Sky drift', min: -3, max: 3, step: 0.1, value: 0.8, unit: '°/s' } },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    const S = DOME.sweetSpot;   // title just above the sweet spot, the week just under it
    ac.text('Your turn', 0, S + 10, { size: 4.6, weight: 800, color: C.ink })
      .text('make the room the medium', 0, S + 4, { size: 1.8, weight: 500, color: C.warm });
    WEEK.forEach(([d, s], i) => {
      const az = -48 + i * 24;
      ac.text(d, az, S - 7, { size: 1.8, weight: 800, color: i === 4 ? C.warm : C.cool })
        .text(s, az, S - 10.5, { size: 1.0, weight: 450, color: '#d5d8de' });
    });
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uSpin;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float a = uSpin * DEG;
        vec3 d = vec3(room.x * cos(a) - room.y * sin(a), room.x * sin(a) + room.y * cos(a), room.z);
        vec3 c = houseSky(room, 1.0) + stars(d);
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a), 1.0);
      }`, { uEq: { value: ac.texture }, uSpin: { value: 0 } });
    return { render() { mat.uniforms.uSpin.value = view.integrate('drift'); return mat; }, dispose() { mat.dispose(); ac.dispose(); } };
  },
};
