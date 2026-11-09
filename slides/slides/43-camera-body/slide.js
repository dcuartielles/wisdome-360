import { NOISE_GLSL } from '../_common.js';
import { ACT6, header } from '../_lab.js';

export default {
  title: 'The camera is their body',
  act: ACT6,
  notes: `<p>In a dome the camera is not a point of view: it is everyone's body. Whatever the camera does, 58 people feel it.</p>
<ul><li><b>Hold</b>: a still camera is not boring in a dome — it is when people start looking around.</li>
<li><b>Forward</b>: gliding forward is the kindest move. The world streams past at the sides; the front stays calm.</li>
<li><b>Turn</b>: the whole room spins round the audience — vection. Keep it slow and short.</li>
<li><b>Roll</b>: tilting the horizon. The fastest way to make someone sick. Almost never.</li>
<li><b>Handheld</b>: the shaky-cam of documentary film. On a screen it reads as "real"; in a dome it reads as an earthquake.</li></ul>
<p>Rule of thumb from fulldome practice: translate, don't rotate; ease in and out; one movement at a time.</p>`,
  params: {
    move: { type: 'select', label: 'Camera', options: [{ value: 'hold', label: 'Hold' }, { value: 'fwd', label: 'Forward' }, { value: 'yaw', label: 'Turn' }, { value: 'roll', label: 'Roll ⚠' }, { value: 'shake', label: 'Handheld' }], value: 'fwd' },
    speed: { type: 'range', label: 'Speed', min: 0, max: 10, step: 0.1, value: 2, hint: 'm/s forward, ×5 °/s for turn and roll, shake strength' },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    header(ac, 'The camera is their body', 'whatever the camera does, 58 bodies feel it', 'try: forward, then turn, then roll — which one was hard?');
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}
      uniform vec3 uPos; uniform mat3 uRot;
      float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 d = uRot * room;
        vec3 o = uPos;
        vec3 c = mix(vec3(0.07, 0.05, 0.08), vec3(0.005, 0.008, 0.02), smoothstep(-5.0, 40.0, elOf(d))) + stars(d) * 0.6 * smoothstep(5.0, 20.0, elOf(d));
        float tHit = 1e9; vec3 col = c;
        // ground: z = 0
        if (d.z < -1e-4) {
          float t = -o.z / d.z; vec3 p = o + d * t;
          vec2 g = abs(fract(p.xy / 2.0 + 0.5) - 0.5) * 2.0;
          vec2 w = fwidth(p.xy / 2.0) * 1.5;
          float l = max(1.0 - smoothstep(w.x, w.x * 2.0, g.x), 1.0 - smoothstep(w.y, w.y * 2.0, g.y));
          col = vec3(0.02, 0.018, 0.02) + vec3(0.25, 0.2, 0.15) * l * exp(-t * 0.02);
          col = mix(col, c, 1.0 - exp(-t * 0.015));
          tHit = t;
        }
        // pillars on an 8 m grid, walked cell by cell along the ray (2-D DDA)
        vec2 rd = d.xy; float rl = length(rd);
        if (rl > 1e-4) {
          vec2 dir = rd / rl;
          vec2 cell = floor(o.xy / 8.0);
          vec2 stepv = sign(dir);
          vec2 tDelta = abs(8.0 / dir);
          vec2 nextB = (cell + max(stepv, 0.0)) * 8.0;
          vec2 tMax = (nextB - o.xy) / dir;
          for (int i = 0; i < 22; i++) {
            float h = h21(cell);
            vec2 cpos = (cell + 0.5 + (vec2(h21(cell + 3.1), h21(cell + 7.7)) - 0.5) * 0.5) * 8.0;
            float r = 0.45;
            // ray-circle in 2-D (distance along the horizontal direction)
            vec2 oc = o.xy - cpos;
            float b = dot(oc, dir), cc = dot(oc, oc) - r * r, disc = b * b - cc;
            if (disc > 0.0 && h > 0.25) {
              float s = -b - sqrt(disc);
              if (s > 0.0) {
                float t = s / rl;
                float z = o.z + d.z * t, top = 2.0 + h * 9.0;
                if (z > 0.0 && z < top && t < tHit) {
                  vec2 n = normalize(o.xy + dir * s - cpos);
                  float lam = 0.35 + 0.65 * max(0.0, dot(n, normalize(vec2(-0.6, 0.8))));
                  vec3 pc = mix(vec3(0.35, 0.42, 0.55), vec3(0.85, 0.55, 0.3), step(0.85, h)) * lam;
                  pc += vec3(1.0, 0.8, 0.5) * (1.0 - smoothstep(0.0, 0.25, top - z)) * 0.6;
                  col = mix(pc, c, 1.0 - exp(-t * 0.015)); tHit = t;
                }
              }
            }
            if (tMax.x < tMax.y) { tMax.x += tDelta.x; cell.x += stepv.x; } else { tMax.y += tDelta.y; cell.y += stepv.y; }
            if (min(tMax.x, tMax.y) * 1.0 > 180.0) break;
          }
        }
        vec4 e = sampleEq(uEq, room); col = mix(col * (1.0 - e.a * 0.6), e.rgb, e.a);
        return vec4(col, 1.0);
      }`, { uEq: { value: ac.texture }, uPos: { value: new THREE.Vector3(4, 0, 1.6) }, uRot: { value: new THREE.Matrix3() } });
    const D = Math.PI / 180;
    const rot = (yaw, pitch, roll) => {
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), cr = Math.cos(roll), sr = Math.sin(roll);
      const Y = new THREE.Matrix3().set(cy, -sy, 0, sy, cy, 0, 0, 0, 1);
      const P = new THREE.Matrix3().set(1, 0, 0, 0, cp, -sp, 0, sp, cp);
      const R = new THREE.Matrix3().set(cr, 0, sr, 0, 1, 0, -sr, 0, cr);
      return Y.multiply(P).multiply(R);
    };
    return {
      render(t) {
        const mv = view.p('move'), u = mat.uniforms, sp = view.p('speed');
        const dist = mv === 'fwd' ? view.integrate('speed') : 0;
        u.uPos.value.set(4, dist % 8000, 1.6);
        let yaw = 0, pitch = 0, roll = 0;
        if (mv === 'yaw') yaw = -view.integrate('speed', 5) * D;
        if (mv === 'roll') roll = Math.sin(view.integrate('speed', 0.6)) * 0.35 * Math.min(1, sp / 3);
        if (mv === 'shake') {
          const k = sp * 0.006;
          yaw = k * (Math.sin(t * 7.3) + 0.6 * Math.sin(t * 13.1 + 1)); pitch = k * (Math.sin(t * 9.1 + 2) + 0.5 * Math.sin(t * 17.3)); roll = k * 0.5 * Math.sin(t * 5.7 + 3);
          u.uPos.value.z = 1.6 + k * 4 * Math.sin(t * 11.7);
        }
        u.uRot.value.copy(rot(yaw, pitch, roll));
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
