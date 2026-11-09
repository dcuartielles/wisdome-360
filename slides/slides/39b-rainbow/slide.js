import { ACT5, header, labEls } from '../_lab.js';
import { C } from '../_common.js';

export default {
  title: 'Colour fringes (DLP)',
  act: ACT5,
  notes: `<p>Many projectors with a single DLP chip show red, green and blue <b>one after another</b>, very fast. When your eyes jump, the colours land on different places on the retina: thin white things grow brief red-green-blue fringes. Some people see it strongly, some never.</p>
<ul><li>Ask everyone to follow the <b>gold dot</b> as it jumps left and right. Watch the white bars out of the corner of the eye. Rainbows? Then the projectors are sequential-colour.</li>
<li>Faster jumps, thinner bars and more contrast make it worse. The <b>Bars</b> brightness slider shows that softer contrast hides it.</li>
<li><b>Ask the technician on Monday</b> which projectors the dome uses. Three-chip DLP, LCD and LCoS projectors show all colours at once and do not do this.</li></ul>
<p>Lesson: thin, bright, high-contrast lines on black are the risky case — exactly the "neon line" look students love.</p>`,
  params: {
    jump: { type: 'range', label: 'Jumps per second', min: 0, max: 4, step: 0.1, value: 1.5 },
    span: { type: 'range', label: 'Jump width', min: 10, max: 120, step: 1, value: 60, unit: '°' },
    bars: { type: 'range', label: 'Bars brightness', min: 0.1, max: 1, step: 0.01, value: 1 },
    width: { type: 'range', label: 'Bar width', min: 0.1, max: 2, step: 0.05, value: 0.35, unit: '°' },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Colour fringes (DLP)', 'follow the gold dot — do the white bars grow rainbow edges?', 'if yes: the projectors show colours one after another');
    ac.commit();
    // bars from just above eye level up to under the lesson, the dot in the middle on the sweet spot;
    // the bars stop 2° inside the edge of the picture (they reach ±100° to the sides)
    const L = labEls(), B0 = L.centre - 17, B1 = L.centre + 14, DOT = L.centre - 1.5;
    const mat = comp.material(`
      uniform float uX, uB, uW;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.0);
        float az = azOf(room), el = elOf(room);
        float s = abs(fract(az / 8.0) - 0.5) * 8.0 * cos(el * DEG);
        c += vec3(uB) * (1.0 - smoothstep(uW * 0.5, uW * 0.5 + 0.08, s)) * step(${B0.toFixed(2)}, el) * step(el, ${B1.toFixed(2)}) * step(abs(az), 100.0)
          * step(acos(clamp(roomToLocalV(room).z, -1.0, 1.0)), 0.5 * min(uOpening, uVFov) - 2.0 * DEG);
        float a = angleBetween(room, dirRoom(uX, ${DOT.toFixed(2)}));
        c = mix(c, vec3(1.0, 0.82, 0.3), 1.0 - smoothstep(0.9, 1.2, a));
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uX: { value: 0 }, uB: { value: 1 }, uW: { value: 0.35 } });
    return {
      render() {
        const ph = view.integrate('jump');
        mat.uniforms.uX.value = (Math.floor(ph) % 2 ? 0.5 : -0.5) * view.p('span');
        mat.uniforms.uB.value = view.p('bars'); mat.uniforms.uW.value = view.p('width');
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
