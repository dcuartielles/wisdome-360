// The example 16:9 slide used by "slides in the dome": 3840 x 2160 drawn at 1920 x 1080.
// p = 0: an ordinary slide (text left, the dome drawing as a circle on the right)
// p = 1: the circle moved to the centre at full height: the part that becomes the dome
import { FONT } from '../lib/anglecanvas.js';
import { C } from './_common.js';
import { DOME } from '../lib/dome.js';

const lerp = (a, b, t) => a + (b - a) * t;
export const W = 1920, H = 1080;
/** the flat screen the example slide hangs on in the room (both "16:9 slides" slides): 92° wide, about 60° tall,
 *  centred a little above the sweet spot so its bottom edge stays just under eye level */
export function screenPlace(d = DOME) { return { el: d.sweetSpot + 4, w: 92 }; }

export function drawSlideFrame(g, art, p, { annotate = true, text = true } = {}) {
  g.save();
  g.fillStyle = '#0d1016'; g.fillRect(0, 0, W, H);
  // text (fades as the circle takes over)
  if (text) {
    g.globalAlpha = lerp(1, 0.08, p);
    g.fillStyle = C.ink; g.font = `700 92px ${FONT}`; g.fillText('Presenting with slides', 110, 190);
    g.fillStyle = C.warm; g.font = `500 46px ${FONT}`; g.fillText('16:9  ·  3840 × 2160 px', 112, 262);
    g.fillStyle = '#c9ccd2'; g.font = `400 44px ${FONT}`;
    ['• make the slide 2160 px high', '• put what matters in the middle', '• the middle circle', '   becomes the whole dome'].forEach((s, i) => g.fillText(s, 120, 420 + i * 78));
    g.globalAlpha = 1;
  }
  // the circle: from the right of the slide to the centre, growing to full height
  const cx = lerp(1450, W / 2, p), cy = lerp(620, H / 2, p), r = lerp(330, H / 2, p);
  g.drawImage(art, cx - r, cy - r, 2 * r, 2 * r);
  g.strokeStyle = 'rgba(255,181,71,0.9)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.stroke();
  if (annotate && p > 0.02) {
    const a = Math.min(1, p * 1.4);
    // the sides: never reach the dome
    g.fillStyle = `rgba(0,0,0,${0.55 * a})`; g.fillRect(0, 0, (W - H) / 2, H); g.fillRect((W + H) / 2, 0, (W - H) / 2, H);
    g.globalAlpha = a;
    g.setLineDash([16, 12]); g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 3;
    g.strokeRect((W - H) / 2 + 2, 2, H - 4, H - 4);
    g.setLineDash([10, 10]); g.strokeStyle = 'rgba(255,93,93,0.95)';
    g.beginPath(); g.arc(cx, cy, r * 160 / 180, 0, Math.PI * 2); g.stroke(); g.setLineDash([]);
    g.font = `600 34px ${FONT}`; g.textAlign = 'center'; g.fillStyle = '#ffffff';
    g.fillText('outside', (W - H) / 4, H / 2 - 22); g.fillText('the dome', (W - H) / 4, H / 2 + 22);
    g.fillText('outside', W - (W - H) / 4, H / 2 - 22); g.fillText('the dome', W - (W - H) / 4, H / 2 + 22);
    g.fillStyle = '#ffb547'; g.fillText('2160 × 2160', W - (W - H) / 4, H - 150); g.font = `400 28px ${FONT}`; g.fillText('= the dome master', W - (W - H) / 4, H - 108);
    g.fillStyle = '#ff6a4d'; g.font = `500 28px ${FONT}`; g.fillText('red ring: edge of', (W - H) / 4, H - 150); g.fillText('the projection (160°)', (W - H) / 4, H - 108);
    g.fillStyle = '#ffffff'; g.font = `500 28px ${FONT}`; g.fillText('front', W / 2, H - 22);
    g.textAlign = 'left'; g.globalAlpha = 1;
  }
  g.strokeStyle = C.warm; g.lineWidth = 8; g.strokeRect(4, 4, W - 8, H - 8);
  g.restore();
}
