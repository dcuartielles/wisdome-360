// =====================================================================
// EX-05b  equirect_to_domemaster.glsl  --  TouchDesigner GLSL TOP
// =====================================================================
// Converts an EQUIRECTANGULAR (360x180) source into a proper equidistant
// fisheye dome master. Use it when you have 360 footage, a 360 camera, or
// an equirect render and you need it on the dome.
//
// This is NOT the same as stretching a panorama into a circle. Equirect
// stores elevation linearly in the vertical axis; a dome master stores
// elevation linearly in RADIUS. Getting this wrong is the single most
// common reason 360 footage "looks nearly right but wrong" on a dome.
//
// The master's circle spans FOV = 160 degrees (radius 1 = 80 degrees from the
// centre), because that is what Wisdome spreads it over.
//
// TouchDesigner setup
//   1. GLSL TOP, Pixel Shader = this file.
//   2. Input 0 = your equirect source (2:1 aspect).
//   3. Common page: Resolution -> Custom, 4096 x 4096 (SQUARE).
//   4. Vectors page, custom uniforms:
//        uRotate   float  0.0    degrees, to spin the horizon to your front
//        uTilt     float  0.0    degrees, if the source horizon is not level
// =====================================================================
out vec4 fragColor;

uniform float uRotate;
uniform float uTilt;

#define PI 3.14159265359
const float FOV = 160.0;   // the venue spreads the whole master over its 160 deg screen; a 180 deg file would be squeezed

void main()
{
    vec2 p = vUV.st * 2.0 - 1.0;
    float r = length(p);
    if (r > 1.0) { fragColor = vec4(0.0, 0.0, 0.0, 1.0); return; }

    // dome master -> a direction in the room
    float elev = PI * 0.5 - r * radians(FOV * 0.5);   // radians, 90 deg at the centre, 10 deg at the rim
    float az   = atan(p.x, -p.y) + radians(uRotate);

    vec3 dir = vec3(cos(elev) * sin(az),
                    sin(elev),
                    -cos(elev) * cos(az));        // -Z is the front

    // optional tilt about the X axis, for footage shot off-level
    float ct = cos(radians(uTilt)), st = sin(radians(uTilt));
    dir = vec3(dir.x, dir.y * ct - dir.z * st, dir.y * st + dir.z * ct);
    dir = normalize(dir);

    // that direction -> equirectangular lookup
    float u = (atan(dir.x, -dir.z) / (2.0 * PI)) + 0.5;
    float v = 0.5 + asin(clamp(dir.y, -1.0, 1.0)) / PI;

    fragColor = TDOutputSwizzle(vec4(texture(sTD2DInputs[0], vec2(u, v)).rgb, 1.0));
}
