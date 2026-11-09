// Dome geometry — one place for every venue constant.
//
// Two halves, because the file and the room do not have to agree:
//   FILE   how WE render the master: what field of view its circle spans, which tilt we assume.
//   VENUE  how the venue PROJECTS it: it spreads the master's whole circle over `venueFov`
//          degrees of the real dome (Wisdome: a 180° file goes onto 160°, i.e. squeezed),
//          the real tilt, and the opening of the physical screen.
// When the two halves match (the default), what we draw at az/el is where people see it.
// They can be pulled apart live from the presenter (Projection panel) to show the students
// what goes wrong: a 180° Blender master squeezed onto 160°, a planetarium master with its
// centre overhead played in a tilted dome…
//
// URL overrides (initial values; the presenter's Projection panel wins once it is used):
//   ?fov=160&tilt=26        the file      ?vfov=160&vtilt=26&opening=160   the venue
//   ?front=bottom&res=2048&q=normal
//
// Coordinate frames used everywhere in the slides:
//   ROOM  x = right, y = forward (towards the front of the room), z = up.
//         az = degrees from the front, positive to the RIGHT. el = degrees above eye level.
//   LOCAL the dome's own frame: z = dome axis (image centre), tilted forward by `tilt`.
//   MASTER the square fisheye file, u right, v up, both -1..1 (equidistant / "angular fisheye").
//
// The venue's own angle scale ("their 40°"): 0 at the rim (Marc's word: where the screen ends), 90 at its
// centre, counted in the FILE. On the front meridian:  el = (90 − venueTilt) − (1 − α/90)·venueFov/2.
// Wisdome: their 0 = front rim (−16°), their 90 = image centre (64°), their 40 ≈ 19.6° up.
const q = new URLSearchParams(typeof location !== 'undefined' ? location.search : '');
const num = (k, d) => (q.has(k) ? Number(q.get(k)) : d);

export const VENUE_DEFAULTS = { fov: 160, tilt: 26, vfov: 160, vtilt: 26, opening: 160 };

export const DOME = {
  // the file (how we render)
  fisheyeFov: num('fov', VENUE_DEFAULTS.fov),   // degrees across the full width of the master file
  tilt: num('tilt', VENUE_DEFAULTS.tilt),       // tilt the file is made for (0 = planetarium, centre overhead)
  // the venue (how it is projected)
  venueFov: num('vfov', VENUE_DEFAULTS.vfov),   // degrees the venue spreads the file's circle over (Wisdome: 160)
  venueTilt: num('vtilt', VENUE_DEFAULTS.vtilt),// real tilt, raised at the back (Wisdome: 26)
  opening: num('opening', VENUE_DEFAULTS.opening), // degrees of physical screen around the dome axis (Wisdome: 160)
  front: q.get('front') || 'bottom', // which edge of the master faces the front of the room
  // where to put things (derived, see updateDerived)
  sweetVenue: 40,                // venue's sweet spot, on THEIR scale (0 = front rim, 90 = image centre)
  sweetSpot: 0,                  // …the same in room elevation (degrees above eye level), derived
  bandAbove: 25,                 // comfortable zone IN FRONT: from the rim at the front up to sweet + 25° (≈45°, the top of a
                                 // relaxed viewer's field of view; Yu, Neafus & Wyatt, Planetarian 2016, Gates Planetarium, tilted 25°)…
  band: [0, 0],                  // …in room elevation, derived
  bandAz: 60,                    // …and ± this many degrees to either side of the front
  sweetSize: 12,                 // radius of the sweet spot (degrees)
  res: num('res', 2048),         // master size in px (venue: 2K start, 6K max)
  quality: q.get('q') || 'normal',
};

export const QUALITY = {
  low: { cube: 512, eq: 2048 },
  normal: { cube: 1024, eq: 4096 },
  high: { cube: 1536, eq: 4096 },
}[DOME.quality] || { cube: 1024, eq: 4096 };

export const FRONT_ROT = { bottom: 0, right: 90, top: 180, left: -90 }[DOME.front] ?? 0;

const D = Math.PI / 180;
export const deg = D;

/** venue angle (their scale, 0 = rim, 90 = image centre) -> room elevation, straight ahead */
export function venueToEl(alpha, d = DOME) { return (90 - d.venueTilt) - (1 - alpha / 90) * d.venueFov / 2; }
/** room elevation straight ahead -> venue angle */
export function elToVenue(el, d = DOME) { return 90 * (1 - ((90 - d.venueTilt) - el) / (d.venueFov / 2)); }

/** elevation of the real dome axis (image centre) — a live binding, follows setProjection() */
export let DOME_ZENITH_EL = 90 - DOME.venueTilt;

function updateDerived() {
  DOME.sweetSpot = venueToEl(DOME.sweetVenue);
  DOME.band = [venueToEl(0), DOME.sweetSpot + DOME.bandAbove]; // [rim at the front, ≈45°]
  DOME_ZENITH_EL = 90 - DOME.venueTilt;
}
updateDerived();

/** current projection as a plain object (what the presenter sends round) */
export function getProjection() {
  return { fov: DOME.fisheyeFov, tilt: DOME.tilt, vfov: DOME.venueFov, vtilt: DOME.venueTilt, opening: DOME.opening };
}
/** change the projection live. Returns true if anything changed. */
export function setProjection(p = {}) {
  const before = JSON.stringify(getProjection());
  const n = (v, d) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : d);
  DOME.fisheyeFov = n(p.fov, DOME.fisheyeFov);
  DOME.tilt = n(p.tilt, DOME.tilt);
  DOME.venueFov = n(p.vfov, DOME.venueFov);
  DOME.venueTilt = n(p.vtilt, DOME.venueTilt);
  DOME.opening = n(p.opening, DOME.opening);
  updateDerived();
  return JSON.stringify(getProjection()) !== before;
}
/** a few numbers worth showing next to the sliders */
export function projectionSummary(d = DOME) {
  const squeeze = d.venueFov / d.fisheyeFov;
  return {
    squeeze,                                   // < 1: the file is squeezed onto the dome
    eyeLevelVenue: elToVenue(0, d),            // eye level on their scale
    sweetEl: d.sweetSpot,                      // their sweet spot, above eye level
    axisEl: 90 - d.venueTilt,                  // image centre above eye level (front)
    frontRim: (90 - d.venueTilt) - Math.min(d.opening, d.venueFov) / 2,
    // where something the FILE puts at the room horizon (straight ahead) really lands
    horizonLands: (90 - d.venueTilt) - ((90 - d.tilt) * d.venueFov / d.fisheyeFov),
    tiltMismatch: d.venueTilt - d.tilt,
  };
}

export function dirRoom(az, el) {
  const ca = Math.cos(el * D);
  return [ca * Math.sin(az * D), ca * Math.cos(az * D), Math.sin(el * D)];
}
export function azElOf([x, y, z]) {
  return [Math.atan2(x, y) / D, Math.asin(Math.max(-1, Math.min(1, z))) / D];
}
// default tilt = the FILE's tilt (where content believes things are)
export function roomToLocal([x, y, z], tilt = DOME.tilt) {
  const c = Math.cos(tilt * D), s = Math.sin(tilt * D);
  return [x, y * c - z * s, y * s + z * c];
}
export function localToRoom([a, b, cz], tilt = DOME.tilt) {
  const c = Math.cos(tilt * D), s = Math.sin(tilt * D);
  return [a, b * c + cz * s, -b * s + cz * c];
}
/** a point on the dome master (x, y in 0..1, y DOWN, as a pointer gives it) -> room { az, el }, or null outside the circle */
export function masterXYToRoom(x, y) {
  let u = x * 2 - 1, v = 1 - y * 2;
  const a = FRONT_ROT * D; [u, v] = [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
  const r = Math.hypot(u, v); if (r > 1) return null;
  const th = r * (DOME.fisheyeFov / 2) * D, n = r || 1;
  const [az, el] = azElOf(localToRoom([Math.sin(th) * u / n, -Math.sin(th) * v / n, Math.cos(th)]));
  return { az, el };
}
/** angle (deg) of a room direction from the REAL dome axis */
export function angleFromDomeZenith(az, el) {
  return Math.acos(Math.max(-1, Math.min(1, roomToLocal(dirRoom(az, el), DOME.venueTilt)[2]))) / D;
}
/** elevation (deg) of the rim (where the projected image ends) at a given azimuth (the real room) */
export function rimElevation(az, opening = Math.min(DOME.opening, DOME.venueFov)) {
  let lo = -90, hi = 90; // angle from zenith decreases as el rises along this azimuth (until over the top)
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (angleFromDomeZenith(az, mid) > opening / 2) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
/** room az/el -> master pixel (0..res) — for placing things in the file directly (the file's own mapping) */
export function roomToMaster(az, el, res = DOME.res) {
  const l = roomToLocal(dirRoom(az, el));
  const th = Math.acos(Math.max(-1, Math.min(1, l[2])));
  const r = th / ((DOME.fisheyeFov / 2) * D);
  const n = Math.hypot(l[0], l[1]) || 1;
  let u = (l[0] / n) * r, v = (-l[1] / n) * r;
  const a = -FRONT_ROT * D; // undo image rotation
  [u, v] = [u * Math.cos(a) - v * Math.sin(a), u * Math.sin(a) + v * Math.cos(a)];
  return [(u * 0.5 + 0.5) * res, (0.5 - v * 0.5) * res];
}

/** uniforms shared by every dome shader */
export function domeUniforms() {
  const u = {
    uFov: { value: 0 }, uTilt: { value: 0 },          // the file
    uVFov: { value: 0 }, uVTilt: { value: 0 }, uOpening: { value: 0 }, // the venue
    uFrontRot: { value: FRONT_ROT * D },
    uSweet: { value: 0 }, uBand: { value: [0, 0, 0] },
  };
  syncDomeUniforms(u);
  return u;
}
/** copy the current DOME into a set of uniforms (call after setProjection) */
export function syncDomeUniforms(u) {
  u.uFov.value = DOME.fisheyeFov * D;
  u.uTilt.value = DOME.tilt * D;
  u.uVFov.value = DOME.venueFov * D;
  u.uVTilt.value = DOME.venueTilt * D;
  u.uOpening.value = DOME.opening * D;
  u.uSweet.value = DOME.sweetSpot;
  const b = u.uBand.value;
  if (b && b.set) b.set(DOME.band[0], DOME.band[1], DOME.bandAz); else u.uBand.value = [DOME.band[0], DOME.band[1], DOME.bandAz];
}

// small deterministic random, so video and audio pages agree on "random" events
export function hash(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}
