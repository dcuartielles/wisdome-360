import { ACT5, header, labEls } from '../_lab.js';
import { C } from '../_common.js';

export default {
  title: 'The dome lights itself',
  act: ACT5,
  notes: `<p>A dome is a concave white mirror: light from one side lands on the other. Every bright area greys out the blacks everywhere else — <b>cross-reflection</b>.</p>
<ul><li>Start with <b>Bright side</b> at 0: the black-and-grey squares in front are crisp.</li>
<li>Raise it: one side of the dome turns white. Watch the squares in front: the black ones go grey, the contrast collapses. Nothing changed in the file for those squares.</li>
<li>Switch <b>Which side</b>: behind lights the whole front; overhead is the worst.</li></ul>
<p><b>Simulate</b> (laptop only) adds the grey wash so you can rehearse the explanation; in the dome, turn it off — the dome does it for real.</p>
<p>Lesson: <b>dark field, bright elements</b>. A dome piece with a white background has no blacks anywhere.</p>`,
  params: {
    bright: { type: 'range', label: 'Bright side', min: 0, max: 1, step: 0.01, value: 0 },
    side: { type: 'select', label: 'Which side', options: [{ value: '90', label: 'right' }, { value: '-90', label: 'left' }, { value: '180', label: 'behind' }, { value: 'top', label: 'overhead' }], value: '90' },
    sim: { type: 'toggle', label: 'Simulate the wash (laptop only)', value: false },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'The dome lights itself', 'light from one side lands on the other: blacks turn grey', 'try: raise "Bright side" and watch the black squares in front');
    const CH = labEls().centre + 1;   // the checker (44° wide, about 27° tall) just above the sweet spot, its label under it
    ac.text('black · 5% · black · 5% …', 0, CH - 16.5, { size: 1.0, color: C.mute, weight: 500 });
    ac.commit();
    const mat = comp.material(`
      uniform float uB, uSide, uTop, uSim;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.0);
        // checker of black and 5% grey at the front
        vec2 uv = cardUV(room, dirRoom(0.0, ${CH.toFixed(2)}), 44.0, 1.6, 0.0);
        if (uv.x >= 0.0) {
          vec2 q = floor(uv * vec2(8.0, 5.0));
          c = vec3(mod(q.x + q.y, 2.0) < 0.5 ? 0.0 : 0.05);
          vec2 f = abs(fract(uv * vec2(8.0, 5.0)) - 0.5);
          // a white "hairline" ring in some squares, to judge sharpness
          if (mod(q.x * 3.0 + q.y, 4.0) < 0.5) c = max(c, vec3(0.9) * (1.0 - smoothstep(0.012, 0.03, abs(length(f) - 0.3))));
        }
        // the lit side
        float lit = 0.0;
        if (uTop > 0.5) lit = smoothstep(58.0, 64.0, elOf(room));
        else { float d = abs(mod(azOf(room) - uSide + 180.0, 360.0) - 180.0); lit = 1.0 - smoothstep(55.0, 62.0, d); }
        c = mix(c, vec3(1.0), lit * uB);
        // simulated scattered light: roughly proportional to how much of the dome is lit
        if (uSim > 0.5) c += vec3(0.16, 0.155, 0.15) * uB * (1.0 - lit);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uB: { value: 0 }, uSide: { value: 90 }, uTop: { value: 0 }, uSim: { value: 0 } });
    return {
      render() {
        const u = mat.uniforms, s = view.p('side');
        u.uB.value = view.p('bright'); u.uTop.value = s === 'top' ? 1 : 0; u.uSide.value = s === 'top' ? 0 : Number(s);
        u.uSim.value = view.p('sim') ? 1 : 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
