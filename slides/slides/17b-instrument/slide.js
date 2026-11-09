import { ACT3, C, NOISE_GLSL } from '../_common.js';
import { DOME, dirRoom, localToRoom, roomToLocal, azElOf } from '../../lib/dome.js';
import { Panner51 } from '../../lib/audio51.js';

// EX-11 · "Orbit": the dome as a musical instrument — three of them, in a void.
//
// Three spheres of metal mesh orbit one another: a KEYBOARD, DRUMS and a distorted GUITAR. We
// start at the centre of the keyboard. Vertical bars ("readers") orbit inside each sphere and
// hum; white lines are notes. When a reader sweeps over a line at its own height, the line
// plays. HEIGHT is the note: each sphere is cut into 10° bands from its rim up to its pole.
//
// The score (seconds since the slide started), in the keyboard:
//   0 s        one reader in the 20–30° band, humming
//   intro      (20 s) a white line straight ahead; the reader speeds up to one orbit per 2 s
//   intro+more (30 s) two more lines at ±120°
//
// Then:
//   Fly out (button)        we leave the sphere backwards and see all three floating ahead of us
//   double-click a sphere   (from outside) fly into it; Into … buttons do the same
//   click a cell            adds a line (from inside, or on the near side from outside); if that
//                           height has no reader, one starts on the line, so the click sounds
//   click a line            another reader at that height, starting from the line
//   shift-click a line      removes it; a height's last line takes its readers with it
//   shift + drag            turns the sphere you are in (or the one under the mouse, from outside)
//   Clear my notes          removes everything added by clicking
// Sound: each sphere is its own instrument, quieter the further we are from it, and heard from
// where it is.
//
// How it stays in step: the picture is ray-traced every frame from a camera position; inside a
// sphere the camera sits at its centre, which is exactly a fisheye of the sphere around us. The
// camera's path (fly events), every edit and every rotation are in the shared state; picture and
// sound pages rebuild the whole world from them. Clicks are resolved to a sphere + cell on the
// page where you click (onClick below), and logged as such.

const D = Math.PI / 180;
const RAMP = 3;          // seconds the first reader takes to change speed when the first line appears
const PHI0 = 180;        // where the first reader starts: behind the audience
const BAND_DEG = 10;     // one note per 10° of height
const MER_DEG = 15;      // the mesh's meridians; lines snap to them
const NS = 3;            // spheres
const MAX_L = 64;        // lines per sphere (picture)
const MAX_R = 24;        // readers per sphere (picture)
const TEX_W = 64;        // the data texture the picture reads lines and readers from
const HUM_MAX = 6;       // hums sounding at once (the loudest); more would only cost CPU
const POLY = [16, 24, 6];   // notes sounding at once per sphere (keyboard, drums, guitar); the oldest is let go
const FADE_IN = 1.5, FADE_CLICK = 0.25, FADE_OUT = 0.4;
const FLY = 5;           // seconds a flight takes
const RORB = 2.3;        // sphere radius = 1; distance of each sphere from the common centre
const INCL = 35;         // the orbit plane leans this much towards us
const BETA = 15;         // from outside we look down on the spheres a little, to see their bands
const PAN_EL = 0.5;      // 5.1 has no height: pan with half the elevation so things keep circling
const LATE = 0.35;       // a hit this late (a click reaching the sound page) still plays, at once

const SPHERES = [
  { name: 'Keyboard', col: '#9fdcff' },
  { name: 'Drums', col: '#ffb547' },
  { name: 'Guitar', col: '#ff6b8a' },
];
const NOTE_COL = ['#ff7a3d', '#ffb547', '#5be38b', '#6cc6ff', '#b58cff'];
const SCALES = {
  major: { root: 261.63, steps: [0, 2, 4, 7, 9], names: ['C', 'D', 'E', 'G', 'A'], oct: 4, fromC: 0 },
  minor: { root: 220.0, steps: [0, 3, 5, 7, 10], names: ['A', 'C', 'D', 'E', 'G'], oct: 3, fromC: 9 },
  guitar: { root: 82.41, steps: [0, 3, 5, 7, 10], names: ['E', 'G', 'A', 'B', 'D'], oct: 2, fromC: 4 },   // E minor pentatonic from E2
};
const DRUMS = ['Kick', 'Tom low', 'Tom mid', 'Tom high', 'Snare', 'Clap', 'Hat', 'Open hat', 'Ride'];
// the southern hemisphere of the drums (band -1 just below the rim, down to -10 at the south pole)
const DRUMS_LOW = ['Rim', 'Cowbell', 'Shaker', 'Conga high', 'Conga low', 'Clave', 'Tambourine', 'Woodblock', 'Bongo', 'Crash'];
const drumOf = (band) => (band >= 0 ? DRUMS[band] : DRUMS_LOW[-band - 1]) || 'Hat';
const DRUM_COL = ['#ff7a3d', '#ffb547', '#ffd27a', '#fff0b0', '#f2efe9', '#ffd0e0', '#9fdcff', '#6cc6ff', '#b58cff'];
const DRUM_COL_LOW = ['#ffe08a', '#e8c070', '#c0e0ff', '#ff9a6a', '#d06a40', '#fff6d0', '#c8f0ff', '#e0b080', '#ffb090', '#ffffff'];
const lineColor = (k, band) => (k === 1 ? (band >= 0 ? DRUM_COL[band] : DRUM_COL_LOW[-band - 1]) || '#ffffff' : NOTE_COL[((band % 5) + 5) % 5]);

function noteOf(band, scale) {
  const sc = SCALES[scale] || SCALES.major;
  const o = Math.floor(band / 5), d = ((band % 5) + 5) % 5, semi = 12 * o + sc.steps[d];   // bands below the rim go down the scale
  return { freq: sc.root * Math.pow(2, semi / 12), name: sc.names[d] + (sc.oct + Math.floor((sc.fromC + semi) / 12)), degree: d };
}
const scaleOf = (k, view) => (k === 2 ? 'guitar' : view.p('scale'));
const labelOf = (k, band, view) => (k === 1 ? drumOf(band) : noteOf(band, scaleOf(k, view)).name);

// ---- geometry ----------------------------------------------------------------------------
// WORLD = the dome's own frame (with the dome) or the room (upright). Sphere radius 1.
function rimEl(frame) { return frame === 'room' ? 0 : 90 - Math.min(DOME.opening, DOME.venueFov) / 2; }   // band 0 starts here
function nBands(frame) { return Math.floor((90 - rimEl(frame)) / BAND_DEG); }        // bands above the rim: 0 … nBands-1
function bMin(frame) { return -Math.floor((90 + rimEl(frame)) / BAND_DEG); }          // …and below it, down to the south pole
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
const lerp = (a, b, u) => add(a, mul(sub(b, a), u));
const ease = (u) => u * u * (3 - 2 * u);
const wrap = (a) => ((a + 180) % 360 + 360) % 360 - 180;
const mod = (a, n) => ((a % n) + n) % n;
const same = (a, b) => Math.abs(wrap(a - b)) < 1;
const roomToWorld = (frame, v) => (frame === 'room' ? v : roomToLocal(v));
const worldToRoomAzEl = (frame, v) => { const [az, el] = azElOf(norm(frame === 'room' ? v : localToRoom(v))); return { az, el }; };
// sphere -> world rotation: pitch about x, after yaw about the sphere's pole (z). Rows.
function rotM(yaw, pitch) {
  const cy = Math.cos(yaw * D), sy = Math.sin(yaw * D), cp = Math.cos(pitch * D), sp = Math.sin(pitch * D);
  return [[cy, -sy, 0], [cp * sy, cp * cy, -sp], [sp * sy, sp * cy, cp]];
}
const rx = (a, v) => { const c = Math.cos(a * D), s = Math.sin(a * D); return [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c]; };   // pitch
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
const mtv = (M, v) => [M[0][0] * v[0] + M[1][0] * v[1] + M[2][0] * v[2], M[0][1] * v[0] + M[1][1] * v[1] + M[2][1] * v[2], M[0][2] * v[0] + M[1][2] * v[1] + M[2][2] * v[2]];

/** Everything about the world at server time t, from the shared state only. */
function score(view, t) {
  // the slide's start, in server seconds. now() - t() reads the clock twice, so round it back to the
  // whole millisecond the server stored: otherwise it differs a hair on every call, and every page
  // would think the slide had just restarted (notes played again and again, rotations ignored)
  const start = Math.round((view.now() - view.t()) * 1000) / 1000;
  const s = t - start;
  const auto = view.p('auto'), more = view.p('more');
  let s1 = auto ? view.p('intro') : Infinity, s2 = null;
  for (const abs of view.presses('step')) {
    const p = abs - start;
    if (p < s1) s1 = Math.max(0, p);
    else if (s2 === null && p < (auto ? s1 + more : Infinity)) s2 = p;
  }
  if (s2 === null) s2 = auto ? s1 + more : Infinity;

  // the first reader: v0 until the first line, then a smooth ramp to v1 (deg/s)
  const v0 = 360 / view.p('introOrbit'), v1 = 360 / view.p('orbit');
  const P1 = v0 * s1, P2 = P1 + (v0 + v1) / 2 * RAMP;
  const Phi0 = (x) => {
    if (x <= s1) return v0 * Math.max(0, x);
    if (x <= s1 + RAMP) { const u = x - s1; return P1 + v0 * u + (v1 - v0) * u * u / (2 * RAMP); }
    return P2 + v1 * (x - s1 - RAMP);
  };
  const Phi0Inv = (P) => {
    if (P <= P1) return P / v0;
    if (P <= P2) {
      const a = (v1 - v0) / (2 * RAMP), c = P1 - P;
      return s1 + (Math.abs(a) < 1e-9 ? (P - P1) / v0 : (-v0 + Math.sqrt(v0 * v0 - 4 * a * c)) / (2 * a));
    }
    return s1 + RAMP + (P - P2) / v1;
  };
  const speed0 = (x) => (x <= s1 ? v0 : x <= s1 + RAMP ? v0 + (v1 - v0) * (x - s1) / RAMP : v1);
  const linear = (st) => ({ Phi: (x) => v1 * Math.max(0, x - st), PhiInv: (P) => st + P / v1, speed: () => v1 });

  const frame = view.p('frame');
  const band0 = Math.max(0, Math.min(nBands(frame) - 1, Math.round(view.p('band'))));
  const dir = view.p('dir') === 'ccw' ? -1 : 1;

  // ---- where things are. Inside a sphere we look out in the dome's frame (the sphere's pole is the
  // dome's axis). Out in the void the camera also PITCHES, so that what is ahead of the audience (the
  // sweet spot) looks at the spheres from the side and a little above, and their bands face us.
  const Fv = norm(roomToWorld(frame, dirRoom(0, DOME.sweetSpot)));         // straight ahead, in the view
  const ALPHA = -(Math.asin(Fv[2]) / D + BETA);                            // the camera's pitch, out in the void
  const Fw = [0, Math.cos(BETA * D), -Math.sin(BETA * D)];                 // …where it then looks, in the world
  const E1 = [1, 0, 0];
  const U = [0, Math.sin(BETA * D), Math.cos(BETA * D)];                   // "up", across Fw
  const E2 = norm(add(mul(U, Math.cos(INCL * D)), mul(Fw, Math.sin(INCL * D))));
  const orbT = view.p('orbT');
  const centre = (k, x) => { const th = 2 * Math.PI * (x / orbT + k / NS) + Math.PI / 2; return add(mul(E1, RORB * Math.cos(th)), mul(E2, RORB * Math.sin(th))); };
  const OUT = mul(Fw, -view.p('outDist'));
  // rotations (shift + drag): a live value in the shared state, reset with the slide
  const g = view.global('ex11rot');
  const rots = g && Math.abs(g.start - start * 1000) < 1 && Array.isArray(g.r) ? g.r : [];
  const M = Array.from({ length: NS }, (_, k) => rotM(rots[k]?.[0] || 0, rots[k]?.[1] || 0));

  // ---- the camera's flights: 'out', or k = the centre of sphere k
  const flights = [
    ...view.presses('flyout').map((a) => ({ x: a - start, to: 'out' })),
    ...[0, 1, 2].flatMap((k) => view.presses(`in${k}`).map((a) => ({ x: a - start, to: k }))),
    ...view.events('fly').map((e) => ({ x: e.at - start, to: e.value?.to })),
  ].filter((f) => f.to === 'out' || [0, 1, 2].includes(f.to)).sort((a, b) => a.x - b.x);
  const targetAt = (to, x) => (to === 'out' ? { p: OUT, a: ALPHA } : { p: centre(to, x), a: 0 });
  /** the camera at time x: position p (world) and pitch a (deg) */
  const camState = (x) => {
    let i = -1; while (i + 1 < flights.length && flights[i + 1].x <= x) i++;
    const rec = (j) => {
      if (j < 0) return { p: centre(0, x), a: 0 };
      const tg = targetAt(flights[j].to, x), u = (x - flights[j].x) / FLY;
      if (u >= 1) return tg;
      const pr = rec(j - 1), e = ease(u);
      return { p: lerp(pr.p, tg.p, e), a: pr.a + (tg.a - pr.a) * e };
    };
    return rec(i);
  };
  const camAt = (x) => camState(x).p;
  const viewToWorld = (x, v) => rx(camState(x).a, v);
  const worldToView = (x, v) => rx(-camState(x).a, v);
  const insideAt = (x) => { const c = camAt(x); for (let k = 0; k < NS; k++) if (len(sub(c, centre(k, x))) < 0.98) return k; return -1; };
  const restingIn = (x) => { const k = insideAt(x); return k >= 0 && len(sub(camAt(x), centre(k, x))) < 0.02 ? k : -1; };

  // ---- the instruments: lines + readers per sphere, from the score and the edits
  const spheres = Array.from({ length: NS }, () => ({ lines: [], readers: [] }));
  spheres[0].lines.push(
    { id: 'p0', az: 0, band: band0, appear: s1, gone: Infinity, fade: FADE_IN },
    { id: 'p1', az: 120, band: band0, appear: s2, gone: Infinity, fade: FADE_IN },
    { id: 'p2', az: -120, band: band0, appear: s2, gone: Infinity, fade: FADE_IN },
  );
  spheres[0].readers.push({ id: 'r0', band: band0, start: 0, end: Infinity, startAz: wrap(dir * PHI0), Phi: Phi0, PhiInv: Phi0Inv, speed: speed0 });
  const evs = [
    ...view.events('edit').map((e) => ({ x: e.at - start, e: e.value })),
    ...view.presses('clear').map((a) => ({ x: a - start, clear: true })),
  ].sort((a, b) => a.x - b.x);
  let n = 0;
  for (const ev of evs) {
    const x = ev.x;
    const aliveL = (l) => l.appear <= x && l.gone > x, aliveR = (r) => r.start <= x && r.end > x;
    if (ev.clear) { for (const sp of spheres) { sp.lines.forEach((l) => { if (l.user && aliveL(l)) l.gone = x; }); sp.readers.forEach((r) => { if (r.user && aliveR(r)) r.end = x; }); } continue; }
    const e = ev.e; if (!e || !spheres[e.k] || !Number.isFinite(e.band) || e.band < bMin(frame) || e.band >= nBands(frame)) continue;
    const sp = spheres[e.k];
    const hit = sp.lines.find((l) => aliveL(l) && l.band === e.band && same(l.az, e.az));
    if (e.shift) {
      if (!hit) continue;
      hit.gone = x;
      if (!sp.lines.some((l) => aliveL(l) && l.band === e.band)) sp.readers.forEach((r) => { if (aliveR(r) && r.band === e.band) r.end = x; });
    } else if (hit) {
      sp.readers.push({ id: `u${n++}`, user: true, band: e.band, start: x, end: Infinity, startAz: hit.az, ...linear(x) });
    } else {
      sp.lines.push({ id: `l${n++}`, user: true, az: e.az, band: e.band, appear: x, gone: Infinity, fade: FADE_CLICK });
      if (!sp.readers.some((r) => aliveR(r) && r.band === e.band))
        sp.readers.push({ id: `u${n++}`, user: true, band: e.band, start: x, end: Infinity, startAz: e.az, ...linear(x) });
    }
  }
  for (const sp of spheres) for (const r of sp.readers) r.az = (x) => wrap(r.startAz + dir * r.Phi(x));

  const rim = rimEl(frame);
  /** a point on sphere k (its own az, height above its rim) -> world position at time x */
  const worldPoint = (k, az, h, x) => add(centre(k, x), mv(M[k], dirRoom(az, rim + h)));
  /** what a room direction from the camera hits at time x: { k, cell } (cell may be null) */
  const pick = (az, el, x) => {
    const d = norm(viewToWorld(x, roomToWorld(frame, dirRoom(az, el)))), c = camAt(x), inside = insideAt(x);
    let best = null;
    for (let k = 0; k < NS; k++) {
      const oc = sub(c, centre(k, x)), b = dot(oc, d), cc = dot(oc, oc) - 1, disc = b * b - cc;
      if (disc < 0) continue;
      const sq = Math.sqrt(disc), t0 = -b - sq, t1 = -b + sq;
      const tt = k === inside ? t1 : t0 > 0 ? t0 : null;
      if (tt === null || tt <= 0) continue;
      if (inside >= 0 && k !== inside) continue;            // inside a sphere, you play that sphere
      if (!best || tt < best.t) best = { k, t: tt };
    }
    if (!best) return null;
    const u = mtv(M[best.k], norm(sub(add(c, mul(d, best.t)), centre(best.k, x))));
    const [saz, sel] = azElOf(u);
    const band = Math.floor((sel - rim) / BAND_DEG);
    const cell = band >= bMin(frame) && band < nBands(frame) ? { az: wrap(Math.round(saz / MER_DEG) * MER_DEG), band } : null;
    return { k: best.k, cell, inside: inside === best.k };
  };
  return { s, start, frame, dir, rim, band0, spheres, M, centre, camAt, camState, worldToView, insideAt, restingIn, worldPoint, pick, rots };
}

// reader r is over line l when Phi_r = c + 360 n, c = (dir·(l.az − r.startAz)) mod 360
const crossC = (sc, r, l) => mod(sc.dir * (l.az - r.startAz), 360);
const hitWindow = (r, l) => [Math.max(r.start, l.appear), Math.min(r.end, l.gone)];
function sinceHit(sc, sp, l, s) {
  let best = Infinity;
  for (const r of sp.readers) {
    if (r.band !== l.band) continue;
    const [a, b] = hitWindow(r, l);
    if (a > s) continue;
    const c = crossC(sc, r, l);
    for (let n = Math.floor((r.Phi(Math.min(s, b)) - c) / 360); n >= 0; n--) {
      const th = r.PhiInv(c + 360 * n);
      if (th > s || th >= b) continue;
      if (th >= a) best = Math.min(best, s - th);
      break;
    }
  }
  return best;
}
function hitsBetween(sc, r, l, from, to) {
  const out = [];
  if (r.band !== l.band) return out;
  const [a, b] = hitWindow(r, l);
  const lo = Math.max(from, a), hi = Math.min(to, b);
  if (lo >= hi) return out;
  const c = crossC(sc, r, l);
  let n = Math.max(0, Math.ceil((r.Phi(lo) - c) / 360 - 1e-9));
  for (let i = 0; i < 64; i++, n++) {
    const th = r.PhiInv(c + 360 * n);
    if (th >= hi) break;
    if (th >= lo) out.push({ at: th, n });
  }
  return out;
}
const fadeOf = (x, a, b, fin) => Math.max(0, Math.min(1, (x - a) / fin, 1 - (x - b) / FADE_OUT));
const readerFade = (r, s) => fadeOf(s, r.start, r.end, r.id === 'r0' ? 2 : 0.4);
/** how loud sphere k is from where the camera is: 1 inside, falling off outside */
const gainOf = (sc, k, s) => { const d = len(sub(sc.camAt(s), sc.centre(k, s))); return d <= 1 ? 1 : Math.pow(1 / d, 1.2); };

// ---- mouse: runs on the page where you click, writes to the shared state ---------------------
let drag = null;
function onClick(e, { bus, view }) {
  const sc = score(view, view.now());
  const hit = sc.pick(e.az, e.el, sc.s);
  if (!hit) return;
  if (e.dbl && !hit.inside) { bus.cmd({ type: 'set', key: 'fly', value: { to: hit.k } }); return; }
  if (!hit.cell) return;
  const edit = { k: hit.k, az: hit.cell.az, band: hit.cell.band, shift: !!e.shift };
  bus.cmd({ type: 'set', key: 'edit', value: edit });
  if (e.dbl) bus.cmd({ type: 'set', key: 'edit', value: edit });   // inside, a double click is two clicks
}
function onDrag(e, { bus, view }) {
  const sc = score(view, view.now());
  if (e.phase === 'start') {
    const k = sc.insideAt(sc.s) >= 0 ? sc.insideAt(sc.s) : sc.pick(e.az, e.el, sc.s)?.k;
    drag = k === undefined || k === null ? null : { k, base: [...(sc.rots[k] || [0, 0])] };
    return;
  }
  if (!drag) return;
  const r = Array.from({ length: NS }, (_, k) => [...(sc.rots[k] || [0, 0])]);
  r[drag.k] = [drag.base[0] - e.dx * 0.35, Math.max(-80, Math.min(80, drag.base[1] + e.dy * 0.35))];
  bus.cmd({ type: 'global', key: 'ex11rot', value: { start: sc.start * 1000, r } });
  if (e.phase === 'end') drag = null;
}

export default {
  title: 'EX-11 live: the dome as an instrument',
  act: ACT3,
  steps: 2,
  autoStep: 20,
  pointer: true,     // hover: the cell under the mouse lights up
  dblclicks: true,   // tell double clicks (fly in) from clicks
  onClick, onDrag,
  notes: `<p><b>EX-11 · Orbit.</b> Three spheres of metal mesh orbit one another: a <b>keyboard</b>, <b>drums</b> and a distorted <b>guitar</b>. We start at the centre of the keyboard. Readers orbit and hum; white lines are notes; when a reader sweeps over a line at its height, the line plays.</p>
<ul><li><b>Height is the note.</b> 10° bands from each sphere's rim to its pole: pentatonic notes (keyboard, guitar), or kick → toms → snare → clap → hats (drums).</li>
<li><b>The score</b> (keyboard): 0 s one reader · 20 s a line straight ahead, one orbit per 2 s · 30 s two more lines.</li>
<li><b>Fly out</b>: we leave backwards and see the three spheres floating ahead, in a void full of spheres. The further away, the quieter. <b>Double-click a sphere</b> (or <i>Into …</i>) to fly into it.</li>
<li><b>Play</b> (presenter preview, master view, or the rehearsal tab): click a cell → a line (and a reader, if that height has none: you hear the click) · click a line → another reader from it · shift-click a line → remove · <b>shift + drag</b> → turn the sphere · <b>Clear my notes</b>. From outside, clicks land on the near side of a sphere.</li></ul>
<p><b>Sphere</b>: <i>with the dome</i> keeps every orbit on the screen; <i>upright</i> makes eye level the equator. <b>R</b> restarts everything.</p>`,
  params: {
    step: { type: 'button', label: 'Next line(s) now', hint: 'or press Next' },
    flyout: { type: 'button', label: 'Fly out', hint: 'see the three spheres from outside' },
    in0: { type: 'button', label: 'Into the keyboard' },
    in1: { type: 'button', label: 'Into the drums' },
    in2: { type: 'button', label: 'Into the guitar' },
    clear: { type: 'button', label: 'Clear my notes', hint: 'removes everything added by clicking' },
    auto: { type: 'toggle', label: 'Play the score by itself', value: true },
    intro: { type: 'range', label: 'First line after', min: 3, max: 60, step: 1, value: 20, unit: 's' },
    more: { type: 'range', label: 'Two more after', min: 2, max: 30, step: 1, value: 10, unit: 's' },
    introOrbit: { type: 'range', label: 'One orbit, at first', min: 1, max: 12, step: 0.5, value: 4, unit: 's' },
    orbit: { type: 'range', label: 'One orbit, with notes', min: 0.5, max: 8, step: 0.1, value: 2, unit: 's' },
    band: { type: 'range', label: 'Score band (×10° above the rim)', min: 0, max: 8, step: 1, value: 2 },
    scale: { type: 'select', label: 'Keyboard scale', options: [{ value: 'major', label: 'C major pentatonic' }, { value: 'minor', label: 'A minor pentatonic' }], value: 'major' },
    note: { type: 'range', label: 'Note length', min: 0.1, max: 1.5, step: 0.05, value: 0.5, unit: 's' },
    dir: { type: 'select', label: 'Direction', options: [{ value: 'cw', label: 'Clockwise (to the right)' }, { value: 'ccw', label: 'Anticlockwise' }], value: 'cw' },
    frame: { type: 'select', label: 'Sphere', options: [{ value: 'dome', label: 'With the dome (tilted)' }, { value: 'room', label: 'Upright (equator = eye level)' }], value: 'dome' },
    outDist: { type: 'range', label: 'Fly out to', min: 3.5, max: 14, step: 0.5, value: 5.5, unit: '× radius' },
    orbT: { type: 'range', label: 'Spheres: one orbit', min: 30, max: 600, step: 10, value: 120, unit: 's' },
    mesh: { type: 'range', label: 'Mesh', min: 0, max: 1, step: 0.01, value: 0.45 },
    hum: { type: 'range', label: 'Hum', min: 0, max: 1, step: 0.01, value: 0.5 },
    vol: { type: 'range', label: 'Notes', min: 0, max: 1, step: 0.01, value: 0.7 },
    names: { type: 'toggle', label: 'Note names on the bands (inside)', value: false },
  },

  video({ THREE, comp, AngleCanvas, view, onStream }) {
    const ac = new AngleCanvas(2048);
    let labelKey = '';
    const drawLabels = (sc, s) => {
      const k = sc.restingIn(s);
      const show = view.p('names') && k >= 0;
      const key = show ? [k, sc.frame, view.p('scale'), ...(sc.rots[k] || [0, 0]).map((v) => v.toFixed(1))].join('|') : 'off';
      if (key === labelKey) return;
      labelKey = key;
      ac.clear();
      if (show) {
        for (let b = bMin(sc.frame); b < nBands(sc.frame); b++) {
          const at = worldToRoomAzEl(sc.frame, sc.worldToView(s, mv(sc.M[k], dirRoom(-4, sc.rim + b * BAND_DEG + BAND_DEG / 2))));
          ac.text(labelOf(k, b, view), at.az, at.el, { size: 1.5, weight: 600, color: lineColor(k, b), alpha: 0.85 });
        }
      }
      ac.commit();
    };

    let hover = null, hoverAt = -1e9;
    onStream((m) => { if (m.name === 'pointer' && Number.isFinite(m.data?.az)) { hover = m.data; hoverAt = performance.now(); } });

    const B = BAND_DEG.toFixed(1);
    const data = new Float32Array(TEX_W * 12 * 4);
    const dataTex = new THREE.DataTexture(data, TEX_W, 12, THREE.RGBAFormat, THREE.FloatType);
    dataTex.minFilter = dataTex.magFilter = THREE.NearestFilter; dataTex.generateMipmaps = false; dataTex.needsUpdate = true;
    const put = (x, y, a, b, c, d) => { const i = (y * TEX_W + x) * 4; data[i] = a; data[i + 1] = b; data[i + 2] = c; data[i + 3] = d; };
    const col = new THREE.Color();
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uFrameDome, uMesh, uDir, uRimEl;
      uniform vec3 uCam;
      uniform mat3 uCamRot;                 // view -> world (the camera's pitch)
      uniform vec3 uSph[${NS}];
      uniform mat3 uRot[${NS}];             // world -> sphere frame
      uniform vec3 uSphCol[${NS}];
      // uData rows: 0-2 lines of sphere k sorted by band (az, band bottom, visibility, s since hit) ·
      // 3-5 their colours · 6-8 readers (az, band bottom, visibility, trail) · 9-11 per band: (first line, count)
      uniform sampler2D uData;
      uniform float uNRd[${NS}], uBMin;
      uniform vec4 uHover;                  // az, band bottom, alpha, sphere
      uniform float uOutside;               // 0 inside a sphere .. 1 out in the void

      float across(vec3 l, float azDeg){ float a = azDeg * DEG; return asin(clamp(dot(l, vec3(cos(a), -sin(a), 0.0)), -1.0, 1.0)) / DEG; }
      float facing(vec3 l, float azDeg){ float a = azDeg * DEG; return dot(l.xy, vec2(sin(a), cos(a))); }
      float bandMask(float h, float lo, float w){ return smoothstep(lo - 0.5 * w, lo + 0.25 * w, h) * (1.0 - smoothstep(lo + ${B} - 0.25 * w, lo + ${B} + 0.5 * w, h)); }

      // a far field of wire spheres: the void
      vec3 voidSpheres(vec3 d){
        vec3 p = d * 7.0; vec3 c = floor(p); vec3 f = fract(p);
        float h = hash13(c + 17.0);
        if (h < 0.72) return vec3(0.0);
        vec3 ctr = vec3(hash13(c + 2.1), hash13(c + 4.7), hash13(c + 8.3)) * 0.5 + 0.25;
        float rad = 0.06 + 0.16 * hash13(c + 6.6);
        vec3 q = f - ctr; float r = length(q);
        float w = max(0.012, 1.2 * length(fwidth(p)));
        float ring = 1.0 - smoothstep(w * 0.5, w, abs(r - rad));
        float eq = (1.0 - smoothstep(w * 0.5, w, abs(q.y))) * step(r, rad);
        float mer = (1.0 - smoothstep(w * 0.5, w, abs(q.x))) * step(r, rad);
        float k = 0.06 + 0.10 * hash13(c + 9.9);
        return mix(vec3(0.55, 0.6, 0.7), vec3(0.7, 0.55, 0.5), hash13(c + 1.3)) * max(ring, max(eq, mer) * 0.6) * k;
      }

      vec3 shade(int k, vec3 q, float t, float back){
        vec3 u = uRot[k] * normalize(q - uSph[k]);
        float el = elOf(u), h = el - uRimEl;
        float w = max(1.0, t);                                  // line widths grow with distance: about constant on screen
        vec3 c = vec3(0.0);
        float ring = aaLine(abs(fract(h / ${B} + 0.5) - 0.5) * ${B}, 0.22 * w);
        float mer = 0.0;
        for (int i = 0; i < 12; i++) mer = max(mer, aaLine(across(u, float(i) * ${MER_DEG.toFixed(1)}), 0.22 * w));
        mer *= 1.0 - smoothstep(74.0, 87.0, abs(el));
        float mesh = max(ring, mer);
        c += mix(vec3(0.52, 0.55, 0.60), uSphCol[k], 0.25 * uOutside) * mesh * uMesh;

        if (uHover.z > 0.0 && int(uHover.w + 0.5) == k) {
          float bm = bandMask(h, uHover.y, w), d = across(u, uHover.x);
          c += vec3(0.55, 0.6, 0.7) * (aaLine(d, 0.7 * w) * 0.55 + exp(-d * d / (10.0 * w * w)) * 0.08) * bm * step(0.0, facing(u, uHover.x)) * uHover.z;
        }
        float pb = floor(h / ${B});
        for (int db = -2; db <= 2; db++) {
         int x = int(pb - uBMin) + db;
         if (x < 0 || x >= ${TEX_W}) continue;
         vec4 rg = texelFetch(uData, ivec2(x, 9 + k), 0);
         if (rg.y < 0.5) continue;
         bool near = abs(db) <= 1;
         for (int jj = 0; jj < ${MAX_L}; jj++) {
          if (float(jj) >= rg.y) break;
          int j = int(rg.x) + jj;
          vec4 P = texelFetch(uData, ivec2(j, k), 0);
          vec3 lc = texelFetch(uData, ivec2(j, 3 + k), 0).rgb;
          if (P.z <= 0.0 || (!near && P.w > 2.0)) continue;
          float bm = bandMask(h, P.y, w);
          if (bm <= 0.0 && P.w > 2.0) continue;
          float d = across(u, P.x), f = step(0.0, facing(u, P.x)), hit = exp(-P.w * 4.0);
          c += mix(vec3(0.95), lc * 1.5, hit) * aaLine(d, 0.7 * w) * bm * f * P.z * (1.0 + 1.2 * hit);
          c += lc * exp(-d * d / (6.0 * w * w)) * bm * f * P.z * (0.04 + 0.5 * hit);
          c += lc * bm * 0.07 * exp(-P.w * 6.0) * P.z;
          if (P.w < 2.0) {
            float a = angleBetween(u, dirRoom(P.x, uRimEl + P.y + ${(BAND_DEG / 2).toFixed(1)}));
            c += lc * aaLine(a - (4.0 + 42.0 * P.w), (0.5 + 2.5 * P.w) * w) * exp(-P.w * 2.2) * 0.6 * P.z * (0.5 + 0.8 * mesh);
          }
         }
        }
        for (int j = 0; j < ${MAX_R}; j++) {
          if (float(j) >= uNRd[k]) break;
          vec4 R = texelFetch(uData, ivec2(j, 6 + k), 0);
          if (R.z <= 0.0 || abs(R.y + ${(BAND_DEG / 2).toFixed(1)} - h) > ${(BAND_DEG / 2).toFixed(1)} + w) continue;
          float bm = bandMask(h, R.y, w);
          if (bm <= 0.0) continue;
          float d = across(u, R.x), f = step(0.0, facing(u, R.x));
          float behind = max(-d * uDir, 0.0);
          float trail = (behind > 0.0 ? exp(-behind / max(R.w, 0.5)) : 0.0) * 0.30;
          c += uSphCol[k] * (aaLine(d, 0.9 * w) * 1.2 + exp(-d * d / (4.0 * w * w)) * 0.25 + trail) * bm * f * R.z;
        }
        return c * mix(1.0, 0.35, back) * exp(-max(t - 1.0, 0.0) * 0.04);
      }

      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 d = uCamRot * (uFrameDome > 0.5 ? local : room);   // a direction in the WORLD
        vec3 c = houseSky(room, 0.5) * (1.0 - 0.6 * uOutside) + stars(room) * 0.30 + voidSpheres(d) * (0.35 + 0.65 * uOutside);
        for (int k = 0; k < ${NS}; k++) {
          vec3 oc = uCam - uSph[k];
          float b = dot(oc, d), cc = dot(oc, oc) - 1.0, disc = b * b - cc;
          if (disc < 0.0) continue;
          float sq = sqrt(disc), t0 = -b - sq, t1 = -b + sq;
          if (t1 <= 0.0) continue;
          if (t0 > 0.0) {                                       // outside: near side, far side seen through the mesh
            vec3 n = normalize(uCam + d * t0 - uSph[k]);
            c += uSphCol[k] * pow(1.0 - abs(dot(n, d)), 3.0) * 0.18;   // a faint glow at the edge, in the sphere's colour
            c += shade(k, uCam + d * t0, t0, 0.0);
            c += shade(k, uCam + d * t1, t1, 1.0);
          } else {
            c += shade(k, uCam + d * t1, t1, 0.0);              // inside: the sphere around us
          }
        }
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, {
      uEq: { value: ac.texture },
      uFrameDome: { value: 1 }, uMesh: { value: 0.45 }, uDir: { value: 1 }, uRimEl: { value: 10 }, uOutside: { value: 0 },
      uCam: { value: new THREE.Vector3() }, uCamRot: { value: new THREE.Matrix3() },
      uSph: { value: Array.from({ length: NS }, () => new THREE.Vector3()) },
      uRot: { value: Array.from({ length: NS }, () => new THREE.Matrix3()) },
      uSphCol: { value: SPHERES.map((s) => new THREE.Color(s.col)) },
      uData: { value: dataTex }, uNRd: { value: [0, 0, 0] }, uBMin: { value: -10 },
      uHover: { value: new THREE.Vector4() },
    });

    return {
      render(t) {
        const sc = score(view, t), s = sc.s, u = mat.uniforms;
        drawLabels(sc, s);
        u.uFrameDome.value = sc.frame === 'room' ? 0 : 1;
        u.uRimEl.value = sc.rim;
        u.uMesh.value = view.p('mesh');
        u.uDir.value = sc.dir;
        const cs = sc.camState(s);
        u.uCam.value.set(...cs.p);
        const ca = Math.cos(cs.a * D), sa = Math.sin(cs.a * D);
        u.uCamRot.value.set(1, 0, 0, 0, ca, -sa, 0, sa, ca);
        const ins = sc.insideAt(s);
        const dist = ins >= 0 ? 0 : Math.min(...[0, 1, 2].map((k) => len(sub(sc.camAt(s), sc.centre(k, s)))));
        u.uOutside.value = ins >= 0 ? 0 : Math.min(1, (dist - 1) / 2);
        for (let k = 0; k < NS; k++) {
          u.uSph.value[k].set(...sc.centre(k, s));
          const M = sc.M[k];   // world -> sphere = transpose(M); Matrix3.set takes rows
          u.uRot.value[k].set(M[0][0], M[1][0], M[2][0], M[0][1], M[1][1], M[2][1], M[0][2], M[1][2], M[2][2]);
          const sp = sc.spheres[k];
          let n = 0;
          for (const r of sp.readers) {
            const vis = readerFade(r, s);
            if (vis <= 0 || n >= MAX_R) continue;
            put(n++, 6 + k, r.az(s), r.band * BAND_DEG, vis, r.speed(s) * 0.08);
          }
          for (let j = n; j < MAX_R; j++) put(j, 6 + k, 0, 0, 0, 0);
          u.uNRd.value[k] = n;
          // lines, sorted by band, with where each band's lines start
          const ls = sp.lines.map((l) => ({ l, vis: fadeOf(s, l.appear, l.gone, l.fade) })).filter((o) => o.vis > 0).slice(0, MAX_L).sort((a, b) => a.l.band - b.l.band);
          for (let x = 0; x < TEX_W; x++) put(x, 9 + k, 0, 0, 0, 0);
          ls.forEach(({ l, vis }, j) => {
            put(j, k, l.az, l.band * BAND_DEG, vis, Math.min(sinceHit(sc, sp, l, s), 99));
            col.set(lineColor(k, l.band)); put(j, 3 + k, col.r, col.g, col.b, 1);
            const x = l.band - bMin(sc.frame), i = ((9 + k) * TEX_W + x) * 4;
            if (data[i + 1] === 0) data[i] = j;
            data[i + 1] += 1;
          });
        }
        u.uBMin.value = bMin(sc.frame);
        dataTex.needsUpdate = true;
        const age = (performance.now() - hoverAt) / 1000;
        const hp = hover && age < 3 ? sc.pick(hover.az, hover.el, s) : null;
        if (hp && hp.cell) u.uHover.value.set(hp.cell.az, hp.cell.band * BAND_DEG, Math.min(1, 3 - age), hp.k); else u.uHover.value.z = 0;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); dataTex.dispose(); },
    };
  },

  audio({ group, ctx, view, ctxTime }) {
    // ---- the slide's own 5.1 bus, through limiters ---------------------------------------
    // Every voice is panned into these six inputs; each speaker pair (L R · C LFE · Ls Rs) then goes
    // through a limiter (a DynamicsCompressor takes at most two channels) before it reaches the
    // engine. However many notes land at once, it cannot clip.
    const busIn = Array.from({ length: 6 }, () => ctx.createGain());
    for (const [x, y] of [[0, 1], [2, 3], [4, 5]]) {
      const m2 = ctx.createChannelMerger(2);
      busIn[x].connect(m2, 0, 0); busIn[y].connect(m2, 0, 1);
      const lim = ctx.createDynamicsCompressor();
      lim.channelCount = 2; lim.channelCountMode = 'explicit'; lim.channelInterpretation = 'discrete';
      lim.threshold.value = -14; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = 0.003; lim.release.value = 0.25;
      const makeup = ctx.createGain(); makeup.gain.value = 1.15;
      const sp2 = ctx.createChannelSplitter(2);
      m2.connect(lim).connect(makeup).connect(sp2);
      sp2.connect(group.channel(x), 0); sp2.connect(group.channel(y), 1);
    }
    const panner = () => new Panner51(ctx, busIn);

    const curve = new Float32Array(2048);
    for (let i = 0; i < curve.length; i++) { const x = i / (curve.length - 1) * 2 - 1; curve[i] = Math.tanh(x * 7) / Math.tanh(7); }
    let noiseBuf = null;
    const noise = () => {
      if (!noiseBuf) { noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
      const n = ctx.createBufferSource(); n.buffer = noiseBuf; return n;
    };
    const envGain = (when, peak, a, dur, shape = 'exp') => {
      const g = ctx.createGain(); g.gain.setValueAtTime(0, when);
      g.gain.linearRampToValueAtTime(peak, when + a);
      if (shape === 'exp') g.gain.exponentialRampToValueAtTime(0.0001, when + a + dur);
      else { g.gain.setValueAtTime(peak, when + a + dur * 0.7); g.gain.linearRampToValueAtTime(0, when + a + dur); }
      return g;
    };

    // ---- one output per LINE, made once and reused by all its notes ----------------------
    // (a line never moves within its sphere, so its panner only follows the camera). The guitar's
    // amp (distortion + cabinet) lives here too: one per string, not one per note.
    const outs = new Map();
    const lineOut = (k, l) => {
      const id = `${k}:${l.id}`;
      let o = outs.get(id);
      if (o) return o;
      const pan = panner();
      if (k === 1) pan.lfe(0.5);
      const level = ctx.createGain(); level.gain.value = 0;
      level.connect(pan.input);
      let input = level;
      if (k === 2) {
        const pre = ctx.createGain(); pre.gain.value = 1.2;
        const ws = ctx.createWaveShaper(); ws.curve = curve; ws.oversample = '2x';
        const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
        const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 900; mid.gain.value = 5; mid.Q.value = 0.8;
        const cab = ctx.createBiquadFilter(); cab.type = 'lowpass'; cab.frequency.value = 3200; cab.Q.value = 0.9;
        const post = ctx.createGain(); post.gain.value = 0.16;
        pre.connect(ws).connect(hp).connect(mid).connect(cab).connect(post).connect(level);
        input = pre;
      }
      o = { pan, level, input, k, held: null,
        free() { level.gain.setTargetAtTime(0, ctx.currentTime, 0.05); setTimeout(() => { try { pan.disconnect(); level.disconnect(); } catch {} }, 600); } };
      outs.set(id, o);
      return o;
    };

    // ---- the three sound banks: play(when, band, into, len, vol) -> { stop(at), end } ----
    const stopper = (srcs, g, end) => ({ end, stop(at) { g.gain.cancelScheduledValues(at); g.gain.setValueAtTime(g.gain.value, at); g.gain.linearRampToValueAtTime(0, at + 0.03); srcs.forEach((x) => { try { x.stop(at + 0.05); } catch {} }); } });
    const BANKS = [
      // 0 · keyboard: a small FM electric piano
      (when, band, into, len, vol) => {
        const f = noteOf(band, view.p('scale')).freq;
        const car = ctx.createOscillator(); car.frequency.value = f;
        const mod = ctx.createOscillator(); mod.frequency.value = f;
        const mi = ctx.createGain(); mi.gain.setValueAtTime(f * 2.2, when); mi.gain.exponentialRampToValueAtTime(f * 0.25, when + 0.35);
        mod.connect(mi).connect(car.frequency);
        const env = envGain(when, 0.42 * vol, 0.004, len, 'hold');
        car.connect(env).connect(into);
        for (const o of [car, mod]) { o.start(when); o.stop(when + len + 0.1); }
        car.onended = () => env.disconnect();
        return stopper([car, mod], env, when + len);
      },
      // 1 · drums: one sound per band; the southern hemisphere has its own kit
      (when, band, into, len, vol) => {
        const kind = drumOf(band);
        const pitched = { 'Tom low': [95, 0.6, 0.45, 0.6], 'Tom mid': [140, 0.6, 0.45, 0.6], 'Tom high': [200, 0.6, 0.4, 0.6], Kick: [130, 0.32, 0.35, 0.95],
          'Conga low': [210, 0.85, 0.3, 0.5], 'Conga high': [320, 0.85, 0.25, 0.5], Bongo: [420, 0.8, 0.18, 0.45], Woodblock: [900, 0.95, 0.08, 0.5], Clave: [2500, 1, 0.06, 0.4] }[kind];
        if (pitched) {
          const [f0, drop, dur, pk] = pitched;
          const o = ctx.createOscillator(); o.frequency.setValueAtTime(f0, when); o.frequency.exponentialRampToValueAtTime(f0 * drop, when + dur * 0.5);
          const g = envGain(when, pk * vol, 0.002, dur);
          o.connect(g).connect(into); o.start(when); o.stop(when + dur + 0.1); o.onended = () => g.disconnect();
          return stopper([o], g, when + dur);
        }
        if (kind === 'Cowbell') {
          const g = envGain(when, 0.3 * vol, 0.002, 0.35);
          const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 800; bp.Q.value = 2;
          const os = [540, 800].map((fr) => { const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = fr; o.connect(bp); o.start(when); o.stop(when + 0.45); return o; });
          bp.connect(g).connect(into); os[0].onended = () => g.disconnect();
          return stopper(os, g, when + 0.35);
        }
        const n = noise();
        const f = ctx.createBiquadFilter();
        const set = {
          Snare: ['bandpass', 1800, 0.8, 0.55, 0.22], Clap: ['bandpass', 1200, 1.5, 0.6, 0.16],
          Hat: ['highpass', 7500, 0.7, 0.3, 0.05], 'Open hat': ['highpass', 6500, 0.7, 0.3, 0.38], Ride: ['bandpass', 5200, 3, 0.25, 0.9],
          Rim: ['bandpass', 1700, 4, 0.6, 0.04], Shaker: ['highpass', 5000, 0.7, 0.25, 0.09], Tambourine: ['bandpass', 8000, 2, 0.35, 0.22], Crash: ['highpass', 3500, 0.5, 0.35, 1.6],
        }[kind] || ['highpass', 7000, 0.7, 0.3, 0.06];
        f.type = set[0]; f.frequency.value = set[1]; f.Q.value = set[2];
        const g = envGain(when, set[3] * vol, kind === 'Shaker' ? 0.03 : 0.002, set[4]);
        n.connect(f).connect(g).connect(into); n.start(when, Math.random() * 0.5); n.stop(when + set[4] + 0.1);
        n.onended = () => g.disconnect();
        const extra = [];
        if (kind === 'Snare') { const o = ctx.createOscillator(); o.frequency.value = 185; o.connect(g); o.start(when); o.stop(when + 0.15); extra.push(o); }
        return stopper([n, ...extra], g, when + set[4]);
      },
      // 2 · guitar: a long power chord into its string's amp, with a slow vibrato
      (when, band, into, len, vol) => {
        const f = noteOf(band, 'guitar').freq, dur = Math.max(1.8, len * 4);
        const env = ctx.createGain(); env.gain.setValueAtTime(0, when);
        env.gain.linearRampToValueAtTime(0.9 * vol, when + 0.012);
        env.gain.linearRampToValueAtTime(0.55 * vol, when + 0.5);
        env.gain.linearRampToValueAtTime(0.4 * vol, when + dur - 0.4);
        env.gain.linearRampToValueAtTime(0, when + dur);
        const lfo = ctx.createOscillator(); lfo.frequency.value = 5.2;
        const lg = ctx.createGain(); lg.gain.setValueAtTime(0, when); lg.gain.linearRampToValueAtTime(14, when + 0.9);
        lfo.connect(lg);
        const oscs = [[1, 0], [1, 7], [1.5, -5], [2, 3]].map(([k, cents]) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f * k; o.detune.value = cents;
          const g = ctx.createGain(); g.gain.value = k === 2 ? 0.25 : 0.4; o.connect(g).connect(env); lg.connect(o.detune); return o;
        });
        env.connect(into);
        for (const o of [...oscs, lfo]) { o.start(when); o.stop(when + dur + 0.05); }
        oscs[0].onended = () => env.disconnect();
        return stopper([...oscs, lfo], env, when + dur);
      },
    ];

    // ---- hums: one voice per reader, but only the loudest HUM_MAX actually sound -----------
    const voices = new Map();
    const makeVoice = (k) => {
      const pan = panner();
      const hum = ctx.createGain(); hum.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = k === 2 ? 420 : 650; lp.Q.value = 0.7;
      const o1 = ctx.createOscillator(); o1.type = k === 2 ? 'sawtooth' : 'sine';
      const o2 = ctx.createOscillator(); o2.type = 'sine';
      const tone = ctx.createGain(); tone.gain.value = k === 1 ? 0 : k === 2 ? 0.35 : 1;   // the drums only swish
      o1.connect(tone); o2.connect(tone); tone.connect(lp);
      const air = noise(); air.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = k === 1 ? 2 : 6;
      const ga = ctx.createGain(); ga.gain.value = k === 1 ? 0.5 : 0.22;
      air.connect(bp).connect(ga).connect(hum);
      lp.connect(hum).connect(pan.input);
      o1.start(); o2.start(); air.start(0, Math.random());
      return {
        pan, hum, o1, o2, bp, k,
        stop(after = 0.6) {
          hum.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
          const st = ctx.currentTime + after;
          [o1, o2, air].forEach((o) => { try { o.stop(st); } catch {} });
          setTimeout(() => { try { pan.disconnect(); } catch {} }, (after + 0.3) * 1000);
        },
      };
    };

    const done = new Map();
    const sounding = [[], [], []];   // notes still ringing, per sphere: { end, stop, line }
    let lastStart = null;
    const reset = () => { done.clear(); for (const v of voices.values()) v.stop(0.3); voices.clear(); for (const o of outs.values()) o.free(); outs.clear(); sounding.forEach((a) => (a.length = 0)); };
    return {
      update(t) {
        const sc = score(view, t), s = sc.s;
        if (sc.start !== lastStart) { lastStart = sc.start; reset(); }
        const cam = sc.camAt(s);
        const fromCam = (k, az, band) => worldToRoomAzEl(sc.frame, sc.worldToView(s, sub(sc.worldPoint(k, az, band * BAND_DEG + BAND_DEG / 2, s), cam)));
        const now = ctx.currentTime;

        // hums: the loudest few
        const cands = [];
        for (let k = 0; k < NS; k++) {
          const g = gainOf(sc, k, s), live = sc.spheres[k].readers.filter((r) => readerFade(r, s) > 0);
          const share = 1 / Math.sqrt(Math.max(1, live.length));
          for (const r of live) cands.push({ k, r, loud: g * share * readerFade(r, s) });
        }
        cands.sort((a, b) => b.loud - a.loud);
        const seen = new Set();
        for (const { k, r, loud } of cands.slice(0, HUM_MAX)) {
          const id = `${k}:${r.id}`; seen.add(id);
          let v = voices.get(id);
          if (!v) { v = makeVoice(k); voices.set(id, v); }
          const f = (k === 1 ? 200 * Math.pow(2, r.band / 3) : noteOf(r.band, scaleOf(k, view)).freq) / 2;
          v.o1.frequency.setTargetAtTime(f, now, 0.08);
          v.o2.frequency.setTargetAtTime(f * 1.004, now, 0.08);
          v.bp.frequency.setTargetAtTime(k === 1 ? f * 20 : f * 6, now, 0.08);
          const at = fromCam(k, r.az(s), r.band);
          v.hum.gain.setTargetAtTime(view.p('hum') * 0.20 * loud * (0.8 + 0.2 * (0.5 + 0.5 * Math.cos(at.az * D))), now, 0.1);
          v.pan.set(at.az, at.el * PAN_EL, 0, 0.02);
        }
        for (const [id, v] of voices) if (!seen.has(id)) { v.stop(); voices.delete(id); }

        // line outputs: follow the camera (position, distance); let go of lines that are gone
        const liveLines = new Set();
        for (let k = 0; k < NS; k++) {
          const g = gainOf(sc, k, s);
          for (const l of sc.spheres[k].lines) {
            if (l.gone < s - 3 || l.appear > s + 0.3) continue;
            const id = `${k}:${l.id}`; liveLines.add(id);
            const o = outs.get(id); if (!o) continue;
            const at = fromCam(k, l.az, l.band);
            o.pan.set(at.az, at.el * PAN_EL, 0, 0.05);
            o.level.gain.setTargetAtTime(g, now, 0.05);
          }
        }
        for (const [id, o] of outs) if (!liveLines.has(id)) { o.free(); outs.delete(id); }

        // notes: the next 250 ms, and up to LATE back (a click that starts a reader on a line is a
        // hit AT the click, and reaches this page a little after it)
        const len = view.p('note'), vol = view.p('vol');
        const hits = [];
        for (let k = 0; k < NS; k++) {
          const sp = sc.spheres[k];
          for (const r of sp.readers) for (const l of sp.lines) for (const hit of hitsBetween(sc, r, l, s - LATE, s + 0.25)) {
            const key = `${k}:${r.id}:${l.id}:${hit.n}`;
            if (done.has(key)) continue;
            done.set(key, hit.at);
            const when = ctxTime(sc.start + hit.at);
            if (when < now - LATE) continue;
            hits.push({ k, l, when: Math.max(when, now) });
          }
        }
        // notes that land together share the loudness (1/√n), so a chord of 8 is not 8× as loud
        const together = new Map();
        for (const h of hits) { const key = `${h.k}:${Math.round(h.when * 20)}`; together.set(key, (together.get(key) || 0) + 1); }
        for (const h of hits) {
          const { k, l, when } = h;
          const o = lineOut(k, l);
          if (!o.level.gain.value) { const at = fromCam(k, l.az, l.band); o.pan.set(at.az, at.el * PAN_EL, 0, 0.002); o.level.gain.value = gainOf(sc, k, s); }
          const share = 1 / Math.sqrt(together.get(`${k}:${Math.round(when * 20)}`));
          const list = sounding[k];
          for (let i = list.length - 1; i >= 0; i--) if (list[i].end < now) list.splice(i, 1);
          if (k === 2) for (const v of list) if (v.line === o && v.end > when) v.stop(when);   // one note per string
          while (list.length >= POLY[k]) list.shift().stop(when);                               // let the oldest go
          const v = BANKS[k](when, l.band, o.input, len, vol * share);
          v.line = o; list.push(v);
        }
        for (const [key, at2] of done) if (at2 < s - 5) done.delete(key);
      },
      dispose() { for (const v of voices.values()) v.stop(0.3); voices.clear(); for (const o of outs.values()) o.free(); outs.clear(); },
    };
  },
};
