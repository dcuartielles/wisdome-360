// ─────────────────────────────────────────────────────────────────────────────────────────────
// Bits several slides share: colours, a starry background, and helpers for the 5 speakers.
// Import what you need at the top of a slide, e.g.
//   import { C, NOISE_GLSL } from '../_common.js';
// ─────────────────────────────────────────────────────────────────────────────────────────────
import { SPEAKERS, gains51 } from '../lib/audio51.js';
import { dirRoom, rimElevation } from '../lib/dome.js';

// "Acts" group the slides in the presenter's list. Name them after the parts of your show.
export const ACT_CHECK = 'Before the show';
export const ACT_SHOW = 'The show';
// (names the bigger slideshow uses, kept so its slides can be copied in without changes)
export const ACT1 = ACT_SHOW, ACT2 = ACT_SHOW, ACT3 = ACT_SHOW, ACT4 = ACT_SHOW, ACTX = ACT_CHECK;

// The house palette (CSS colours, used for text on the dome): warm front, cool back
export const C = {
  warm: '#ffb547', warm2: '#ff7a3d', cool: '#6cc6ff', cool2: '#7d8cff', ink: '#f2efe9', mute: '#a9adb6', green: '#5be38b', red: '#ff5d5d',
};

// GLSL helpers you can paste into a slide's shader with ${NOISE_GLSL}:
//   stars(dir)            a field of stars in that direction (vec3)
//   houseSky(room, k)     a dark sky with a warm glow low at the front (k = brightness)
export const NOISE_GLSL = /* glsl */ `
float hash13(vec3 p){ p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
vec3 starLayer(vec3 d, float scale, float density){
  vec3 p = d * scale; vec3 c = floor(p); vec3 f = fract(p);
  float h = hash13(c);
  vec3 sp = vec3(hash13(c + 1.7), hash13(c + 5.3), hash13(c + 9.1)) * 0.8 + 0.1;
  float dist = length(f - sp);
  float rad = max(0.06, 1.2 * length(fwidth(p)));
  float b = step(1.0 - density, h) * (1.0 - smoothstep(rad * 0.4, rad, dist)) * (0.35 + 0.65 * hash13(c + 7.7));
  return b * mix(vec3(1.0, 0.86, 0.72), vec3(0.72, 0.86, 1.0), hash13(c + 3.3));
}
vec3 stars(vec3 d){ return starLayer(d, 60.0, 0.035) + 0.55 * starLayer(d, 150.0, 0.02); }
// the house background: near-black, warm glow low at the front, cool at the back
vec3 houseSky(vec3 room, float k){
  float el = elOf(room), az = azOf(room);
  float front = 0.5 + 0.5 * cos(az * DEG);
  vec3 warm = vec3(0.10, 0.045, 0.015), cool = vec3(0.012, 0.03, 0.07);
  vec3 c = mix(cool, warm, front) * exp(-max(el, 0.0) / 28.0) * k;
  return c + vec3(0.004, 0.005, 0.008);
}
`;

// speaker markers drawn on the dome just above the rim
export const SPEAKER_GLSL = /* glsl */ `
uniform vec3 uSpkDir[5];
uniform float uSpkLvl[5];
vec3 drawSpeakers(vec3 col, vec3 room){
  for (int i = 0; i < 5; i++) {
    float a = angleBetween(room, uSpkDir[i]);
    float lvl = uSpkLvl[i];
    float ring = aaLine(a - 2.2, 0.35);
    float fill = (1.0 - smoothstep(1.6, 1.9, a)) * lvl;
    float glow = exp(-a * a / (2.0 * 9.0)) * lvl * 0.5;
    col += vec3(1.0, 0.72, 0.3) * glow;
    col = mix(col, vec3(1.0, 0.8, 0.4), max(ring * 0.7, fill));
  }
  return col;
}
`;

/** an elevation at least `margin` degrees above the rim (where the picture ends) at azimuth az */
export function aboveRim(az, el, margin = 3) { return Math.max(el, rimElevation(az) + margin); }

/** speaker positions (room az/el) just above the visible rim */
export function speakerPlaces(lift = 4) {
  return SPEAKERS.map((s) => ({ ...s, el: Math.max(2, rimElevation(s.az) + lift) }));
}
export function speakerUniforms(THREE, lift) {
  const places = speakerPlaces(lift);
  return {
    places,
    uniforms: {
      uSpkDir: { value: places.map((p) => new THREE.Vector3(...dirRoom(p.az, p.el))) },
      uSpkLvl: { value: [0, 0, 0, 0, 0] },
    },
    /** set levels from 6-ch gains (L R C LFE Ls Rs) */
    setFromGains(u, g) { places.forEach((p, i) => { u.uSpkLvl.value[i] = g[p.ch]; }); },
  };
}
export { gains51 };

/** label every speaker on an AngleCanvas */
export function labelSpeakers(ac, places, color = C.warm) {
  for (const p of places) ac.text(p.name, p.az, p.el + 4.2, { size: 1.8, color, weight: 700 });
}

/** a labelled box on an AngleCanvas (diagrams) */
export function box(ac, az, el, w, h, title, sub, color = C.warm) {
  ac.rect(az, el, w, h, { fill: 'rgba(20,23,30,0.92)', stroke: color, lineWidth: 0.22, radius: 0.8 });
  ac.text(title, az, el + (sub ? h * 0.18 : 0), { size: 1.45, weight: 700, color });
  if (sub) {
    const lines = Array.isArray(sub) ? sub : [sub];
    lines.forEach((s, i) => ac.text(s, az, el - h * 0.12 - i * 1.9, { size: 1.05, weight: 450, color: '#d5d8de' }));
  }
}

/** a plain "angle canvas + house sky" slide material */
export function textSlideMaterial(comp, ac, extraGlsl = '', starK = 0.3) {
  return comp.material(`${NOISE_GLSL}
    ${extraGlsl}
    vec4 slideColor(vec3 room, vec3 local, vec2 m){
      vec3 c = houseSky(room, 0.8) + stars(room) * ${starK.toFixed(2)};
      vec4 e = sampleEq(uEq, room);
      return vec4(mix(c, e.rgb, e.a), 1.0);
    }`, { uEq: { value: ac.texture }, uEqOn: { value: 1 } });
}
