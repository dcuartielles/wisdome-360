import { NOISE_GLSL, C } from '../_common.js';
import { ACT6, header, labEls, readout } from '../_lab.js';

export default {
  title: 'Scale replaces the close-up',
  act: ACT6,
  notes: `<p>Everything in a dome has a <b>size in the room</b>. A face that fills the screen in cinema is intimate; a face that fills the dome is a giant leaning over you.</p>
<ul><li>Slide <b>Size</b> from 2° to 140°. Ask: how far away is this person? Is she small, life size, a giant?</li>
<li>About 17° is "life size": a person standing on the dome surface, 5.8 m away. Bigger than ~40° and she is in your space. Over 90° she towers over the audience.</li>
<li>So the close-up does not exist. Intimacy comes from other places: <b>sound</b> close to the ear, slowness, a small thing near the sweet spot, darkness around it.</li>
<li><b>Ground</b> toggles a floor line: with a horizon, size reads as distance; without one, size reads as scale.</li></ul>`,
  params: {
    size: { type: 'range', label: 'Size of the figure', min: 2, max: 140, step: 1, value: 17, unit: '°' },
    ground: { type: 'toggle', label: 'Ground', value: true },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Scale replaces the close-up', 'everything has a size in the room — a "close-up" is a giant', 'try: slide the size — when does she stop being a person and become a building?');
    ac.commit();
    const ro = readout(AngleCanvas, 58, labEls().centre + 4, { color: C.warm });   // the figure stands on the ground (6° up) in front
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uRo;
      uniform float uH, uGround;
      float sdCapsule(vec2 p, vec2 a, vec2 b, float r){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h) - r; }
      float person(vec2 p){                                  // p: x across, y up, height 1, feet at y = 0
        float d = length(p - vec2(0.0, 0.92)) - 0.075;
        d = min(d, sdCapsule(p, vec2(0.0, 0.8), vec2(0.0, 0.48), 0.085));
        d = min(d, sdCapsule(p, vec2(-0.03, 0.47), vec2(-0.07, 0.03), 0.045));
        d = min(d, sdCapsule(p, vec2(0.03, 0.47), vec2(0.08, 0.03), 0.045));
        d = min(d, sdCapsule(p, vec2(-0.07, 0.78), vec2(-0.16, 0.5), 0.035));
        d = min(d, sdCapsule(p, vec2(0.07, 0.78), vec2(0.14, 0.52), 0.035));
        return d;
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.7) + stars(room) * 0.3;
        float el = elOf(room), az = azOf(room);
        float feet = 6.0;
        if (uGround > 0.5) {
          c = mix(c, vec3(0.05, 0.04, 0.035) + vec3(0.06, 0.05, 0.04) * step(0.5, fract(az / 15.0)) * step(el, 0.0), step(el, feet - 0.5) * step(-30.0, el));
          c = mix(c, vec3(0.5, 0.4, 0.3), aaLine(el - feet + 0.5, 0.25));
        }
        vec2 p = vec2(az * cos(el * DEG * 0.5), el - feet) / uH;
        float d = person(p);
        float px = fwidth(d);
        c = mix(c, vec3(0.92, 0.6, 0.35), 1.0 - smoothstep(-px, px, d));
        c += vec3(0.6, 0.35, 0.15) * exp(-max(d, 0.0) * 30.0) * 0.15;
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        vec4 q = sampleEq(uRo, room); c = mix(c, q.rgb, q.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRo: { value: ro.texture }, uH: { value: 17 }, uGround: { value: 1 } });
    return {
      render() {
        const H = view.p('size');
        mat.uniforms.uH.value = H; mat.uniforms.uGround.value = view.p('ground') ? 1 : 0;
        const dist = 1.75 / (2 * Math.tan((H * Math.PI) / 360));
        const word = H < 6 ? 'far away' : H < 12 ? 'across a square' : H < 24 ? 'life size' : H < 45 ? 'in your space' : H < 90 ? 'leaning over you' : 'a giant';
        ro.set([`${H}° tall`, `a 1.75 m person ${dist >= 1 ? dist.toFixed(1) + ' m' : (dist * 100).toFixed(0) + ' cm'} away`, `→ ${word}`]);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); ro.dispose(); },
    };
  },
};
