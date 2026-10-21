// =====================================================================
// EX-05a  domemaster_guide.glsl   --  TouchDesigner GLSL TOP
// =====================================================================
// Drop this on a GLSL TOP, wire your fisheye render into input 0, and you
// get the comfortable zone, the sweet spot, eye-level elevation rings and
// the front marker drawn over your own work. Leave it in your network while
// you work; bypass it for delivery.
//
// The guides are measured from the AUDIENCE'S point of view, not from the
// centre of the image. Wisdome Malmö is tilted 26 degrees, raised at the
// back, so the centre of a dome master is NOT overhead: it is 64 degrees
// up, in front of the audience. This shader undoes the tilt before it
// measures anything.
//
//   comfortable zone  IN FRONT: 15-60 degrees above eye level,
//                     +-60 degrees either side of the front
//   sweet spot        straight ahead, 40 degrees up (12-degree radius)
//   everything else   ambience: people will not turn round or crane for it
//
// TouchDesigner setup
//   1. Create a GLSL TOP.
//   2. Set its Pixel Shader to this file.
//   3. Common page: Resolution -> Custom, 2048 x 2048 (SQUARE).
//   4. Vectors page, add these custom uniforms:
//        uTilt     float   26.0     dome tilt, degrees (Wisdome Malmo: 26)
//        uZoneLo   float   15.0     comfortable zone, lower edge (deg up)
//        uZoneHi   float   60.0     comfortable zone, upper edge
//        uZoneAz   float   60.0     comfortable zone, +- degrees from front
//        uSweet    float   40.0     sweet spot elevation
//        uGuide    float   1.0      (0 = off, for delivery)
//        uFront    float   1.0
//        uRotate   float   0.0      degrees, if your venue's front differs
// =====================================================================
out vec4 fragColor;

uniform float uTilt;
uniform float uZoneLo;
uniform float uZoneHi;
uniform float uZoneAz;
uniform float uSweet;
uniform float uGuide;
uniform float uFront;
uniform float uRotate;

// dome master position (-1..1, y up, front at the bottom) -> direction in
// the ROOM: x = right, y = front, z = up
vec3 roomDir(vec2 p)
{
    float r  = length(p);
    float th = r * radians(90.0);                      // angle from the dome's own zenith
    vec2  d  = r > 1e-6 ? p / r : vec2(0.0);
    vec3  l  = vec3(sin(th) * d.x, -sin(th) * d.y, cos(th));   // dome frame
    float c = cos(radians(uTilt)), s = sin(radians(uTilt));
    return vec3(l.x, l.y * c + l.z * s, -l.y * s + l.z * c);    // tilt it into the room
}

float line(float distDeg, float widthDeg)
{
    return 1.0 - smoothstep(widthDeg * 0.5, widthDeg * 0.5 + 0.35, abs(distDeg));
}

void main()
{
    vec2 uv = vUV.st;
    vec2 p  = uv * 2.0 - 1.0;          // -1..1, y up
    float rot = radians(uRotate);
    p = mat2(cos(rot), -sin(rot), sin(rot), cos(rot)) * p;
    float r = length(p);

    if (r > 1.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    // The audience's view of this pixel, in two numbers:
    vec3  d    = roomDir(p);
    float elev = degrees(asin(clamp(d.z, -1.0, 1.0)));   // 0 = eye level, 90 = straight up
    float az   = degrees(atan(d.x, d.y));                // 0 = front, + = right

    vec3 col = texture(sTD2DInputs[0], uv).rgb;

    if (uGuide > 0.5) {
        // eye-level rings every 15 degrees (they are NOT circles round the image centre)
        float g = 0.0;
        for (int i = 0; i < 6; i++)
            g = max(g, line(elev - float(i) * 15.0, 0.25));
        col = mix(col, vec3(0.45, 0.60, 1.0), g * 0.40);

        // the comfortable zone: a patch IN FRONT, not a ring round the dome
        float aaz    = abs(az);
        float inZone = step(uZoneLo, elev) * step(elev, uZoneHi) * step(aaz, uZoneAz);
        col = mix(col, col + vec3(0.05, 0.10, 0.06), inZone);
        float edge = max(max(line(elev - uZoneLo, 0.5), line(elev - uZoneHi, 0.5)) * step(aaz, uZoneAz),
                         line((aaz - uZoneAz) * cos(radians(elev)), 0.5)
                             * step(uZoneLo, elev) * step(elev, uZoneHi));
        col = mix(col, vec3(0.35, 0.95, 0.55), edge * 0.85);

        // dim everything outside it a little, so the zone is obvious
        col = mix(col, col * vec3(0.60, 0.65, 0.80), (1.0 - inZone) * 0.35);

        // the sweet spot: one place, straight ahead
        vec3  s = vec3(0.0, cos(radians(uSweet)), sin(radians(uSweet)));
        float a = degrees(acos(clamp(dot(d, s), -1.0, 1.0)));
        col = mix(col, vec3(1.0, 0.85, 0.30), line(a - 12.0, 0.6));
        col = mix(col, vec3(1.0, 0.85, 0.30), 1.0 - smoothstep(1.0, 1.4, a));
    }

    if (uFront > 0.5) {
        float m = (1.0 - smoothstep(0.0, 1.4, abs(az)))
                * (1.0 - smoothstep(-20.0, 8.0, elev));
        col = mix(col, vec3(1.0, 0.49, 0.30), m);
    }

    fragColor = TDOutputSwizzle(vec4(col, 1.0));
}
