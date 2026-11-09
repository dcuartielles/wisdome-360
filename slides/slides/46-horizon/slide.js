import { NOISE_GLSL, C } from '../_common.js';
import { ACT6, header, labEls, readout } from '../_lab.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'Where is the horizon?',
  act: ACT6,
  notes: `<p>The horizon tells the body where it is. Move it and the whole audience changes position without moving.</p>
<ul><li><b>At eye level</b> (0°): standing on the ground. Calm, real. But on a ${DOME.tilt}° tilted dome the eye-level horizon sits very low at the front and is hidden below the rim at the back.</li>
<li><b>Lower</b> (−10° and below): you are high up, flying, on a cliff. The sky takes over. Many fulldome shows sit here.</li>
<li><b>Higher</b> (+15° and above): you are sinking, in a valley, in a pit, under water. The world closes over you. Claustrophobic, or cosy.</li>
<li><b>Tilt it</b> (the tilt slider) and people lean to compensate — keep it level unless that is the point.</li></ul>
<p>Decide where your horizon is before anything else; it is the floor your audience stands on.</p>`,
  params: {
    h: { type: 'range', label: 'Horizon height', min: -30, max: 40, step: 0.5, value: 0, unit: '°' },
    tilt: { type: 'range', label: 'Tilt the horizon', min: -15, max: 15, step: 0.5, value: 0, unit: '°' },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'Where is the horizon?', 'the horizon is the floor your audience stands on', 'try: lower it to fly, raise it to sink');
    ac.commit();
    const ro = readout(AngleCanvas, -60, labEls().centre + 8, { color: C.warm });
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uRo;
      uniform float uH, uHTilt;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float az = azOf(room), el = elOf(room);
        float hz = uH + uHTilt * sin(az * DEG);           // horizon elevation at this azimuth
        float e = el - hz;
        vec3 c;
        if (e > 0.0) {
          c = mix(vec3(0.22, 0.12, 0.10), vec3(0.02, 0.03, 0.08), smoothstep(0.0, 45.0, e)) + stars(room) * smoothstep(20.0, 50.0, e) * 0.6;
          float a = az * DEG;
          float mtn = 4.0 * (0.5 + 0.3 * sin(a * 3.0) + 0.2 * sin(a * 7.0 + 1.0) + 0.1 * sin(a * 17.0));
          if (e < mtn) c = vec3(0.06, 0.05, 0.07);
          float moon = angleBetween(room, dirRoom(-35.0, hz + 18.0));
          c += vec3(0.9, 0.85, 0.75) * (1.0 - smoothstep(1.5, 1.7, moon)) + vec3(0.15, 0.1, 0.08) * exp(-moon / 12.0);
        } else {
          float dist = 1.7 / max(tan(-e * DEG), 0.002);
          vec2 p = vec2(sin(az * DEG), cos(az * DEG)) * dist;
          vec2 g = abs(fract(p / 4.0 + 0.5) - 0.5);
          vec2 w = fwidth(p / 4.0);
          float l = max(1.0 - smoothstep(w.x, w.x * 2.0, g.x), 1.0 - smoothstep(w.y, w.y * 2.0, g.y));
          c = vec3(0.045, 0.035, 0.025) + vec3(0.22, 0.17, 0.1) * l * exp(-dist * 0.01);
          c = mix(c, vec3(0.12, 0.07, 0.06), 1.0 - exp(-dist * 0.01));
        }
        c = mix(c, vec3(1.0, 0.7, 0.4), aaLine(e, 0.25) * 0.8);
        vec4 q = sampleEq(uRo, room); c = mix(c, q.rgb, q.a);
        vec4 t = sampleEq(uEq, room); c = mix(c * (1.0 - t.a * 0.6), t.rgb, t.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uRo: { value: ro.texture }, uH: { value: 0 }, uHTilt: { value: 0 } });
    return {
      render() {
        const h = view.p('h');
        mat.uniforms.uH.value = h; mat.uniforms.uHTilt.value = view.p('tilt');
        const word = h < -18 ? 'flying high' : h < -6 ? 'on a hill, a cliff' : h < 6 ? 'standing on the ground' : h < 20 ? 'in a valley, sinking' : 'in a pit, under water';
        ro.set([`horizon at ${h > 0 ? '+' : ''}${h}°`, `→ ${word}`]);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); ro.dispose(); },
    };
  },
};
