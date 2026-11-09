// Draw in ANGLES: a 2D canvas laid out as az -180..180 (front in the middle) × el -30..90.
// Everything drawn here lands in the dome at the right azimuth/elevation; the compositor
// does the fisheye. Sizes are in degrees.
import * as THREE from '../vendor/three.module.min.js';
import { QUALITY } from './dome.js';

export const FONT = `"Inter", "Segoe UI", "Helvetica Neue", Helvetica, Arial, sans-serif`;
export const MONO = `"JetBrains Mono", "Cascadia Mono", Consolas, "SF Mono", Menlo, monospace`;

export class AngleCanvas {
  constructor(width = QUALITY.eq) {
    this.w = width;
    this.h = Math.round(width / 3);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.w; this.canvas.height = this.h;
    this.ctx = this.canvas.getContext('2d');
    this.ppd = this.w / 360; // pixels per degree (at the horizon)
    const t = new THREE.CanvasTexture(this.canvas);
    t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.ClampToEdgeWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.anisotropy = 8;
    this.texture = t;
  }
  x(az) { return (((az + 180) % 360 + 360) % 360 - 180) / 360 * this.w + this.w / 2; }
  /** run a drawing function at x and, near the back seam (az ±180), again one full turn away */
  wrapped(az, fn) {
    const x = this.x(az);
    fn(x);
    if (x < this.w * 0.2) fn(x + this.w);
    if (x > this.w * 0.8) fn(x - this.w);
  }
  y(el) { return ((90 - el) / 120) * this.h; }
  clear() { this.ctx.clearRect(0, 0, this.w, this.h); return this; }
  commit() { this.texture.needsUpdate = true; return this; }

  /** text centred on (az, el). size = cap height in degrees. Corrects the horizontal squeeze at height. */
  text(str, az, el, { size = 3, color = '#fff', weight = 600, align = 'center', font = FONT, alpha = 1, baseline = 'middle', letter = 0 } = {}) {
    const c = this.ctx;
    this.wrapped(az, (x) => {
    c.save();
    c.globalAlpha = alpha;
    c.translate(x, this.y(el));
    c.scale(1 / Math.max(0.2, Math.cos((el * Math.PI) / 180)), 1);
    c.font = `${weight} ${size * this.ppd * 1.38}px ${font}`;
    if (letter) c.letterSpacing = `${letter * this.ppd}px`;
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = baseline;
    c.fillText(str, 0, 0);
    c.restore();
    });
    return this;
  }
  /** several lines, top line at el, going down */
  lines(arr, az, el, opts = {}) {
    const size = opts.size ?? 2.5, gap = opts.gap ?? 1.7;
    arr.forEach((s, i) => this.text(s, az, el - i * size * gap, opts));
    return this;
  }
  /** filled/stroked rectangle in degrees (az/el = centre) */
  rect(az, el, wDeg, hDeg, { fill, stroke, lineWidth = 0.2, radius = 0 } = {}) {
    const c = this.ctx;
    const k = 1 / Math.max(0.2, Math.cos((el * Math.PI) / 180));
    const w = wDeg * this.ppd * k, h = hDeg * this.ppd;
    this.wrapped(az, (x) => {
      c.save();
      c.translate(x, this.y(el));
      c.beginPath();
      c.roundRect(-w / 2, -h / 2, w, h, radius * this.ppd);
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth * this.ppd; c.stroke(); }
      c.restore();
    });
    return this;
  }
  /** a line between two az/el points (straight in the canvas, i.e. along constant-ish angles) */
  line(az1, el1, az2, el2, { color = '#fff', width = 0.2, dash } = {}) {
    const c = this.ctx;
    c.save(); c.strokeStyle = color; c.lineWidth = width * this.ppd;
    if (dash) c.setLineDash(dash.map((d) => d * this.ppd));
    c.beginPath(); c.moveTo(this.x(az1), this.y(el1)); c.lineTo(this.x(az2), this.y(el2)); c.stroke(); c.restore();
    return this;
  }
  arrow(az1, el1, az2, el2, opts = {}) {
    this.line(az1, el1, az2, el2, opts);
    const c = this.ctx, a = Math.atan2(this.y(el2) - this.y(el1), this.x(az2) - this.x(az1)), s = (opts.head ?? 1.2) * this.ppd;
    c.save(); c.fillStyle = opts.color || '#fff'; c.translate(this.x(az2), this.y(el2)); c.rotate(a);
    c.beginPath(); c.moveTo(0, 0); c.lineTo(-s, s * 0.5); c.lineTo(-s, -s * 0.5); c.closePath(); c.fill(); c.restore();
    return this;
  }
  image(img, az, el, wDeg, hDeg, { alpha = 1 } = {}) {
    const k = 1 / Math.max(0.2, Math.cos((el * Math.PI) / 180));
    const w = wDeg * this.ppd * k, h = hDeg * this.ppd;
    this.ctx.save(); this.ctx.globalAlpha = alpha;
    this.ctx.drawImage(img, this.x(az) - w / 2, this.y(el) - h / 2, w, h);
    this.ctx.restore();
    return this;
  }
  dispose() { this.texture.dispose(); }
}
