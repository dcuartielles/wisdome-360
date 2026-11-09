// The side section of the tilted dome (front on the left), drawn from the venue numbers in lib/dome.js.
// Used by the "dome in the room" slide and as a picture in the presenter notes.
import { DOME } from '../lib/dome.js';
import { FONT } from '../lib/anglecanvas.js';

export function drawSection(cv, o = {}) {
  const tilt = o.tilt ?? DOME.venueTilt, vfov = DOME.venueFov, open = Math.min(o.opening ?? DOME.opening, vfov);
  // the venue's scale is counted in the file: 0 at the rim at 160, 90 at the image centre
  const venueEl = (a) => (90 - tilt) - (1 - a / 90) * vfov / 2;
  const sweet = venueEl(DOME.sweetVenue), band = [venueEl(0), sweet + DOME.bandAbove];
  const fmt1 = (x) => (Math.abs(x - Math.round(x)) < 0.05 ? Math.round(x) : x.toFixed(1));
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, k = W / 680;
  const ink = o.ink || '#e9e6df', mute = o.mute || '#8d929b', warm = '#ffb547', red = '#ff6a4d', cool = '#6cc6ff', green = '#5be38b';
  g.save();
  g.fillStyle = o.bg || '#0d0f14'; g.fillRect(0, 0, W, H);
  g.scale(k, k);
  const cx = 340, cy = 300, R = 220, D = Math.PI / 180;
  const P = (phi, r = R) => [cx - r * Math.cos(phi * D), cy - r * Math.sin(phi * D)];
  const arc = (p0, p1, r = R) => { g.beginPath(); for (let i = 0; i <= 90; i++) { const [x, y] = P(p0 + (p1 - p0) * i / 90, r); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke(); };
  const dot = (x, y, r, c) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); };
  const text = (s, x, y, c = mute, align = 'left', size = 12, w = 400) => { g.fillStyle = c; g.font = `${w} ${size}px ${FONT}`; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y); };
  const z = 90 - tilt, f0 = z - 90, f1 = z + 90, e0 = z - open / 2, e1 = z + open / 2;

  // room horizon
  g.setLineDash([2, 5]); g.strokeStyle = mute; g.lineWidth = 0.8;
  g.beginPath(); g.moveTo(90, cy); g.lineTo(590, cy); g.stroke(); g.setLineDash([]);
  text('FRONT', 40, cy, ink, 'left', 12, 600); text('BACK', 640, cy, ink, 'right', 12, 600);
  // comfortable band
  if (o.band !== false) { g.strokeStyle = green; g.globalAlpha = 0.55; g.lineWidth = 6; arc(band[0], band[1], R - 12); g.globalAlpha = 1; }
  // the dome: full hemisphere, projected part in amber
  g.strokeStyle = mute; g.lineWidth = 1.2; arc(f0, f1);
  if (o.image !== false) { g.strokeStyle = warm; g.lineWidth = 5; arc(e0, e1); }
  // the venue's scale along the front half of the image: a tick every 10, labelled every 20
  if (o.venue !== false && o.image !== false) {
    g.strokeStyle = '#ff73d9'; g.fillStyle = '#ff73d9';
    for (let a = 0; a <= 90; a += 10) {
      const phi = venueEl(a), [x0, y0] = P(phi, R + 3), [x1, y1] = P(phi, R + (a % 20 ? 10 : 14));
      g.lineWidth = a === DOME.sweetVenue ? 2.4 : 1.2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
      if (o.labels !== false && (a % 20 === 0 || a === 90)) { const [lx, ly] = P(phi, R + 26); text(String(a), lx, ly, '#ff73d9', 'center', 11, 600); }
    }
  }
  // two rims, parallel (both square to the dome axis). the venue's word: the rim is where the screen ends.
  //   rim at 180: the full hemisphere's springline, out of the screen (dashed)
  //   rim at 160: across the two ends of the projection screen (solid)
  const [rx0, ry0] = P(f0), [rx1, ry1] = P(f1);
  g.setLineDash([7, 6]); g.strokeStyle = mute; g.lineWidth = 1; g.beginPath(); g.moveTo(rx0, ry0); g.lineTo(rx1, ry1); g.stroke(); g.setLineDash([]);
  if (o.image !== false) {
    const [sx0, sy0] = P(e0), [sx1, sy1] = P(e1);
    g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(sx0, sy0); g.lineTo(sx1, sy1); g.stroke();
  }
  // raked seating under the rim
  g.strokeStyle = mute; g.lineWidth = 1; g.beginPath();
  const sx0 = 175, sx1 = 525, steps = 9, slope = Math.tan(tilt * D);
  for (let i = 0; i <= steps; i++) {
    const x = sx0 + (sx1 - sx0) * i / steps, y = cy + 62 - (x - cx) * slope;
    if (i === 0) g.moveTo(x, y); else { g.lineTo(x, g.__y); g.lineTo(x, y); }
    g.__y = y;
  }
  g.stroke();
  // the viewer
  g.strokeStyle = ink; g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, 6, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(cx, cy + 7); g.lineTo(cx, cy + 56); g.stroke();
  // rays
  const ray = (phi, c, dash, w = 1.2) => { const [x, y] = P(phi, R - 8); g.strokeStyle = c; g.lineWidth = w; g.setLineDash(dash); g.beginPath(); g.moveTo(cx, cy); g.lineTo(x, y); g.stroke(); g.setLineDash([]); };
  ray(90, mute, [2, 4], 0.8);
  ray(z, red, [5, 4]);
  if (o.sweet !== false) ray(sweet, warm, [], 1.6);
  // points + labels
  const [zx, zy] = P(z); dot(zx, zy, 4.5, red);
  const [tx, ty] = P(90); dot(tx, ty, 3, mute);
  if (o.labels !== false) {
    text(`dome zenith (venue 90°), ${z.toFixed(0)}° up`, zx + 14, zy + 12, red, 'left');
    text('room zenith', tx + 10, ty - 10, mute);
    if (o.sweet !== false) { const [sx, sy] = P(sweet, R - 22); dot(...P(sweet), 4.5, warm); text(`sweet spot: venue ${DOME.sweetVenue}° = ${fmt1(sweet)}° up`, sx + 6, sy - 12, warm, 'left'); }
    if (o.image !== false) {
      const [ax, ay] = P(e0), [bx, by] = P(e1); dot(ax, ay, 3.5, warm); dot(bx, by, 3.5, warm);
      text(`rim at ${open}: ${e0 >= 0 ? '+' : '−'}${Math.abs(e0).toFixed(0)}°`, ax - 4, ay + 26, ink, 'right', 12, 600);
      text(`rim at ${open}: ${(180 - e1).toFixed(0)}° behind`, bx + 10, by - 6, ink, 'left', 12, 600);
    }
    text(`rim at 180: ${f0 >= 0 ? '+' : '−'}${Math.abs(f0).toFixed(0)}°`, rx0 - 8, ry0 + 10, mute, 'right');
    text(`rim at 180: +${(180 - f1).toFixed(0)}°`, rx1 + 10, ry1 + 4, mute);
    if (o.band !== false) { const [bx, by] = P(band[1] - 4, R - 30); text(`comfortable ${Math.round(band[0])}–${Math.round(band[1])}° up (in front)`, bx + 4, by + 6, green); }
    text('you', cx + 12, cy + 16, ink);
    // legend
    const ly = 488;
    g.strokeStyle = warm; g.lineWidth = 5; g.beginPath(); g.moveTo(60, ly); g.lineTo(90, ly); g.stroke();
    text(`projected image, ${open}°`, 98, ly);
    if (o.venue !== false) { g.strokeStyle = '#ff73d9'; g.lineWidth = 1.5; for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(62 + i * 8, ly + 14); g.lineTo(62 + i * 8, ly + 22); g.stroke(); } text("venue's angles (0 = rim at 160, 90 = centre)", 98, ly + 18, '#ff73d9'); }
    g.strokeStyle = ink; g.lineWidth = 1.4; g.beginPath(); g.moveTo(370, ly); g.lineTo(400, ly); g.stroke();
    text(`rim at ${open}: where the screen ends`, 408, ly);
    g.setLineDash([7, 6]); g.strokeStyle = mute; g.lineWidth = 1; g.beginPath(); g.moveTo(370, ly + 18); g.lineTo(400, ly + 18); g.stroke(); g.setLineDash([]);
    text(`rim at 180 (out of screen), tilted ${tilt.toFixed(0)}°`, 408, ly + 18);
  }
  g.restore();
  return cv;
}

/** a data URL of the section, for the presenter notes */
export function sectionImageURL(w = 680, opts) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = Math.round(w * 520 / 680);
  return drawSection(cv, opts).toDataURL('image/png');
}
