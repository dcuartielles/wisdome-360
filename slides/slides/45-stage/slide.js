import { NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';
import { ACT6, header } from '../_lab.js';

export default {
  title: 'The front is a stage',
  act: ACT6,
  get notes() { return `<p>A tilted dome has a front, and the comfortable zone in front (about ${Math.round(DOME.band[0])}–${Math.round(DOME.band[1])}° up, ±${DOME.bandAz}° to the sides, around the venue's sweet spot) behaves like a <b>stage</b>. The rest of the dome is the <b>world</b> around it.</p>
<ul><li><b>Stage only</b>: a small performance in the zone and darkness elsewhere. Theatrical, focused — and a waste of the dome?</li>
<li><b>World only</b>: a forest all round, nothing happening. Immersive, but no story: where should I look?</li>
<li><b>Both</b>: the action on the stage, the world breathing around it. Most good dome pieces work like this: <i>subject in front, place all round</i>.</li>
<li>Turn on <b>Show the zone</b> to reveal the comfortable zone and the sweet spot.</li></ul>
<p>Old idea: the proscenium stage, the panorama, the Philips Pavilion all made the same split.</p>`; },
  params: {
    show: { type: 'select', label: 'Show', options: [{ value: 'both', label: 'Both' }, { value: 'stage', label: 'Stage only' }, { value: 'world', label: 'World only' }], value: 'both' },
    zone: { type: 'toggle', label: 'Show the zone', value: false },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'The front is a stage', 'subject in the zone in front, the world all round it', 'try: stage only, world only, both');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uStage, uWorld;
      float trunk(float az, float el, float seed){
        float a = az + seed * 37.0;
        float cell = floor(a / 9.0), f = fract(a / 9.0) - 0.5;
        float h = fract(sin(cell * 12.9898 + seed) * 43758.5453);
        float w = 0.06 + 0.1 * h;
        return (1.0 - smoothstep(w, w + 0.02, abs(f + (h - 0.5) * 0.3))) * step(el, 30.0 + 50.0 * h);
      }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float el = elOf(room), az = azOf(room);
        vec3 c = vec3(0.004, 0.006, 0.01);
        if (uWorld > 0.5) {
          c = mix(vec3(0.03, 0.06, 0.05), vec3(0.005, 0.012, 0.02), smoothstep(0.0, 70.0, el)) + stars(room) * 0.35 * smoothstep(40.0, 70.0, el);
          float sway = sin(uTime * 0.4 + az * 0.05) * 0.6;
          float t1 = trunk(az + sway * (el / 60.0), el, 1.0), t2 = trunk(az * 1.3 + 20.0, el, 2.0);
          c = mix(c, vec3(0.012, 0.02, 0.016), max(t1, t2) * step(-30.0, el));
          c += vec3(0.25, 0.5, 0.3) * 0.05 * (0.5 + 0.5 * sin(az * 0.3 + uTime * 0.7)) * exp(-max(el, 0.0) / 10.0);
          // fireflies
          for (int i = 0; i < 12; i++) {
            float fi = float(i);
            vec3 d = dirRoom(fi * 30.0 + sin(uTime * 0.2 + fi) * 10.0, 15.0 + 20.0 * fract(sin(fi * 7.1) * 99.0) + sin(uTime * 0.5 + fi) * 3.0);
            float a = angleBetween(room, d);
            c += vec3(0.9, 1.0, 0.5) * exp(-a * a / 0.3) * (0.5 + 0.5 * sin(uTime * 2.0 + fi * 1.7));
          }
        }
        if (uStage > 0.5) {
          // a pool of light and a small dancer at the sweet spot
          float a0 = angleBetween(room, dirRoom(0.0, uSweet - 1.0));
          c += vec3(0.35, 0.25, 0.15) * exp(-a0 * a0 / 120.0);
          float tt = uTime * 0.9;
          for (int i = 0; i < 2; i++) {
            float fi = float(i);
            vec3 d = dirRoom(sin(tt + fi * 3.14) * 9.0, uSweet + 4.0 + cos(tt * 1.3 + fi * 3.14) * 6.0);
            float a = angleBetween(room, d);
            c += (i == 0 ? vec3(1.0, 0.6, 0.25) : vec3(0.4, 0.75, 1.0)) * (exp(-a * a / 0.8) + 0.25 * exp(-a * a / 12.0));
          }
          vec2 uv = cardUV(room, dirRoom(0.0, uSweet + 2.0), 12.0, 0.5, sin(tt) * 8.0);
          if (uv.x >= 0.0) {
            vec2 p = (uv - vec2(0.5, 0.0)) * vec2(0.5, 1.0);
            float body = length((p - vec2(0.0, 0.62)) * vec2(1.0, 0.5)) - 0.1;
            float head = length(p - vec2(0.0, 0.88)) - 0.055;
            float d = min(body, head);
            c = mix(c, vec3(0.95, 0.85, 0.75), 1.0 - smoothstep(0.0, 0.01, d));
          }
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uStage: { value: 1 }, uWorld: { value: 1 } });
    const inst = {
      guides: { band: 0, sweet: 0 },
      render() {
        const s = view.p('show');
        mat.uniforms.uStage.value = s !== 'world' ? 1 : 0; mat.uniforms.uWorld.value = s !== 'stage' ? 1 : 0;
        const z = view.p('zone') ? 1 : 0; inst.guides.band = z; inst.guides.sweet = z;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
    return inst;
  },
};
