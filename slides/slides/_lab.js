// Shared bits for the seminar slides: "limits you can show" (31–39b) and
// "telling stories in a dome" (41–49).
import { C } from './_common.js';
import { DOME } from '../lib/dome.js';

export const ACT5 = 'V · Seminar: limits you can show';
export const ACT6 = 'VI · Seminar: telling stories in a dome';

/** where the lab layout goes (room elevations, in front), from the venue's sweet spot and comfortable zone:
 *  title + lesson at the top of the zone, the demo centred on the sweet spot, the "try this" line low at the front
 *  (above the seat backs). Read it inside video() so it follows a live projection change. */
export function labEls(d = DOME) {
  const S = d.sweetSpot;
  return { title: S + 23, lesson: S + 19, centre: S, try: d.band[0] + 10 };
}

/** title + one-line lesson at the top of the comfortable zone, a "try this" line low at the front */
export function header(ac, title, lesson, watch) {
  const L = labEls();
  ac.text(title, 0, L.title, { size: 2.5, weight: 800, color: C.ink });
  if (lesson) ac.text(lesson, 0, L.lesson, { size: 1.2, weight: 500, color: C.warm });
  if (watch) ac.text(watch, 0, L.try, { size: 1.0, weight: 500, color: C.mute });
  return ac;
}

/** frame-rate choice: the video page runs at the display rate, OBS sends 30 fps to the dome */
export const FPS_PARAM = {
  type: 'select', label: 'Frame rate', value: '30',
  options: [{ value: '0', label: 'display' }, { value: '30', label: '30' }, { value: '24', label: '24' }, { value: '15', label: '15' }],
  hint: 'The dome gets 30 fps from OBS. On a 60 Hz laptop, "30" shows what the dome will show.',
};
/** server time quantised to a frame rate (0 = no quantising) */
export function frameTime(t, fps) { fps = Number(fps); return fps > 0 ? Math.floor(t * fps) / fps : t; }

/** a small text panel that is redrawn only when its text changes */
export function readout(AngleCanvas, az, el, opts = {}) {
  const ac = new AngleCanvas(2048);
  let last = '';
  return {
    ac, texture: ac.texture,
    set(lines) {
      const s = lines.join('\n');
      if (s === last) return;
      last = s;
      ac.clear();
      lines.forEach((l, i) => ac.text(l, az, el - i * (opts.gap ?? 2.0), { size: opts.size ?? 1.15, weight: i === 0 ? 650 : 500, color: i === 0 ? (opts.color ?? C.cool) : C.mute }));
      ac.commit();
    },
    dispose() { ac.dispose(); },
  };
}

/** seat positions in metres, relative to the projection centre (x right, y front, z up). Approximate. */
export const SEATS = {
  centre: [0, 0, 0],
  left: [-3.0, 0.4, 0.1],
  right: [3.0, 0.4, 0.1],
  front: [0, 2.4, -0.6],
  back: [0, -3.2, 1.0],
};
export const SEAT_OPTIONS = [
  { value: 'centre', label: 'centre' }, { value: 'left', label: 'left aisle' }, { value: 'right', label: 'right aisle' },
  { value: 'front', label: 'front row' }, { value: 'back', label: 'back row' },
];

// GLSL: where a seat actually sees a dome pixel. The dome is a sphere of radius R round the
// projection centre; a seat at uSeat (metres) looks at that point of the screen.
export const SEAT_GLSL = /* glsl */ `
uniform vec3 uSeat;
const float DOME_R = 5.8;
vec3 seatRay(vec3 room){ return normalize(room * DOME_R - uSeat); }
// thin antialiased grid lines on a coordinate measured in metres
float gridLine(float x, float spacing, float w){
  float f = abs(fract(x / spacing + 0.5) - 0.5) * spacing;
  float fw = max(fwidth(x), 1e-4);
  return 1.0 - smoothstep(w * 0.5, w * 0.5 + fw * 1.2, f);
}
`;
