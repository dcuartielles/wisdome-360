// Shared GLSL. Every dome shader gets DOME_GLSL prepended.
export const DOME_GLSL = /* glsl */ `
#define PI 3.14159265359
#define DEG 0.01745329252
uniform float uFov, uTilt, uFrontRot;          // the FILE: how the master is rendered
uniform float uVFov, uVTilt, uOpening;         // the VENUE: how it is projected (see lib/dome.js)
uniform float uSweet; uniform vec3 uBand;      // sweet spot (el) · comfortable band (el lo, el hi, ±az)
uniform float uTime;

mat2 rot2(float a){ float c=cos(a), s=sin(a); return mat2(c,-s,s,c); }

// master (-1..1, v up) -> dome-local direction (z = dome zenith, -y of the image = front)
vec3 masterToLocal(vec2 m){
  m = rot2(uFrontRot) * m;
  float r = length(m);
  float th = r * uFov * 0.5;
  vec2 d = r > 1e-6 ? m / r : vec2(0.0);
  return vec3(sin(th) * d.x, -sin(th) * d.y, cos(th));
}
vec2 localToMaster(vec3 l){
  float th = acos(clamp(l.z, -1.0, 1.0));
  float r = th / (uFov * 0.5);
  vec2 d = vec2(l.x, -l.y);
  float n = length(d);
  d = n > 1e-6 ? d / n : vec2(0.0);
  return rot2(-uFrontRot) * (d * r);
}
vec3 localToRoom(vec3 l){ float c=cos(uTilt), s=sin(uTilt); return vec3(l.x, l.y*c + l.z*s, -l.y*s + l.z*c); }
vec3 roomToLocal(vec3 d){ float c=cos(uTilt), s=sin(uTilt); return vec3(d.x, d.y*c - d.z*s, d.y*s + d.z*c); }
// the same, as the VENUE projects the file (…V): where a pixel of the master really lands
vec3 masterToLocalV(vec2 m){
  m = rot2(uFrontRot) * m;
  float r = length(m);
  float th = r * uVFov * 0.5;
  vec2 d = r > 1e-6 ? m / r : vec2(0.0);
  return vec3(sin(th) * d.x, -sin(th) * d.y, cos(th));
}
vec2 localToMasterV(vec3 l){
  float th = acos(clamp(l.z, -1.0, 1.0));
  float r = th / (uVFov * 0.5);
  vec2 d = vec2(l.x, -l.y);
  float n = length(d);
  d = n > 1e-6 ? d / n : vec2(0.0);
  return rot2(-uFrontRot) * (d * r);
}
vec3 localToRoomV(vec3 l){ float c=cos(uVTilt), s=sin(uVTilt); return vec3(l.x, l.y*c + l.z*s, -l.y*s + l.z*c); }
vec3 roomToLocalV(vec3 d){ float c=cos(uVTilt), s=sin(uVTilt); return vec3(d.x, d.y*c - d.z*s, d.y*s + d.z*c); }
vec3 dirRoom(float azDeg, float elDeg){ float a=azDeg*DEG, e=elDeg*DEG; return vec3(cos(e)*sin(a), cos(e)*cos(a), sin(e)); }
float azOf(vec3 d){ return atan(d.x, d.y) / DEG; }          // -180..180, + = right
float elOf(vec3 d){ return asin(clamp(d.z, -1.0, 1.0)) / DEG; }
float angleBetween(vec3 a, vec3 b){ return acos(clamp(dot(a, b), -1.0, 1.0)) / DEG; }
// room -> three.js world (y up, -z forward)
vec3 toThree(vec3 d){ return vec3(d.x, d.z, -d.y); }

// equirect canvas covering az -180..180, el -30..90 (front in the middle)
vec4 sampleEq(sampler2D tex, vec3 d){
  float u1 = atan(d.x, d.y) / (2.0 * PI) + 0.5;
  float u2 = fract(u1 + 0.5) - 0.5;          // Tarini's seam trick: pick the param without the jump
  float u = fwidth(u1) <= fwidth(u2) + 1e-5 ? u1 : u2;
  float el = asin(clamp(d.z, -1.0, 1.0));
  float v = 1.0 - (PI * 0.5 - el) / (PI * 2.0 / 3.0);
  if (v < 0.0) return vec4(0.0);
  return texture(tex, vec2(u, v));
}

// a flat rectangle (virtual screen) seen from the centre of the room.
// returns uv (0..1) inside the card, or -1 outside. widthDeg = horizontal angular size.
vec2 cardUV(vec3 d, vec3 center, float widthDeg, float aspect, float rollDeg){
  vec3 f = normalize(center);
  vec3 up0 = abs(f.z) > 0.999 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 r = normalize(cross(f, up0));
  vec3 u = cross(r, f);
  float cr = cos(rollDeg*DEG), sr = sin(rollDeg*DEG);
  vec3 r2 = r*cr + u*sr; vec3 u2 = -r*sr + u*cr;
  float k = dot(d, f);
  if (k <= 0.0) return vec2(-1.0);
  vec3 p = d / k;
  float hw = tan(widthDeg * 0.5 * DEG);
  vec2 uv = vec2(dot(p, r2) / hw, dot(p, u2) / (hw / aspect)) * 0.5 + 0.5;
  if (any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(-1.0);
  return uv;
}

float aaLine(float dist, float width){ float w = fwidth(dist); return 1.0 - smoothstep(width*0.5 - w, width*0.5 + w, abs(dist)); }

// guides, drawn where things REALLY are (venue mapping): elevation rings, azimuth spokes,
// comfortable band, sweet spot, rim/front, and the venue's own angle scale.
uniform vec4 uGuides;  // x rings+spokes, y band, z sweet spot, w rim/front
uniform float uGuideVenue; // the venue's scale: rings every 10 of THEIR degrees (0 = rim, 90 = centre)
vec3 applyGuides(vec3 col, vec3 room, vec3 local, float r){
  float el = elOf(room), az = azOf(room);
  if (uGuides.y > 0.5) { // comfortable zone: in FRONT of the audience, uBand.x–uBand.y up, ±uBand.z to the sides
    float aaz = abs(az);
    float inZone = step(uBand.x, el) * step(el, uBand.y) * step(aaz, uBand.z);
    col = mix(col, col + vec3(0.05, 0.10, 0.06), inZone * 0.9);
    float edge = max(max(aaLine(el - uBand.x, 0.25), aaLine(el - uBand.y, 0.25)) * step(aaz, uBand.z),
                     aaLine((aaz - uBand.z) * cos(el * DEG), 0.25) * step(uBand.x, el) * step(el, uBand.y));
    col = mix(col, vec3(0.35, 0.95, 0.55), edge * 0.85);
  }
  if (uGuides.x > 0.5) {
    float ring = 0.0;
    for (int i = -1; i <= 6; i++) ring = max(ring, aaLine(el - float(i) * 15.0, 0.18));
    float spoke = 0.0;
    float a = mod(az + 360.0, 30.0); a = min(a, 30.0 - a);
    spoke = aaLine(a * cos(el*DEG), 0.18) * step(el, 84.0);
    col = mix(col, vec3(0.45, 0.6, 1.0), max(ring, spoke) * 0.55);
    col = mix(col, vec3(1.0, 0.55, 0.2), aaLine(el, 0.35) * 0.9);   // the room horizon (eye level)
  }
  if (uGuideVenue > 0.5 && r <= 1.0) { // their scale, in the file: alpha = 90 (1 - r)
    float alpha = (1.0 - r) * 90.0;
    float d = abs(fract(alpha / 10.0 + 0.5) - 0.5) * 10.0;              // distance (their degrees) to the nearest ring
    float px = d * (uVFov / DEG) / 180.0;                                // …in real degrees
    float w = abs(alpha - 40.0) < 5.0 ? 0.45 : 0.22;                     // their 40 (sweet spot) thicker
    col = mix(col, vec3(1.0, 0.45, 0.85), aaLine(px, w) * 0.9);
  }
  if (uGuides.z > 0.5) { // sweet spot: straight ahead at uSweet
    float a = angleBetween(room, dirRoom(0.0, uSweet));
    col = mix(col, col + vec3(0.10, 0.08, 0.02), (1.0 - smoothstep(11.0, 12.0, a)) * 0.9);
    col = mix(col, vec3(1.0, 0.85, 0.3), aaLine(a - 12.0, 0.35));
    col = mix(col, vec3(1.0, 0.85, 0.3), 1.0 - smoothstep(1.2, 1.6, a));
  }
  if (uGuides.w > 0.5) {
    float th = r * uVFov * 0.5;
    col = mix(col, vec3(1.0, 0.25, 0.25), aaLine((th - uOpening * 0.5) / DEG, 0.4));
    float fa = abs(az);
    float frontMark = (1.0 - smoothstep(0.4, 0.6, fa)) * step(el, 10.0);
    col = mix(col, vec3(1.0, 0.25, 0.25), frontMark);
  }
  return col;
}
`;
