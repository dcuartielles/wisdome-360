// A fisheye drawing that makes sense in a dome: Malmö at dusk, looking straight up.
// The rim of the circle is the ground all around you, the centre is the top of the dome,
// the bottom of the circle is the FRONT (as in a dome master).
// Buildings, the Turning Torso (front) and the Öresund Bridge (right) stand round the rim;
// stars, the Plough and the moon are overhead.

function rnd(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }

export function drawDomeArt(g, cx, cy, r) {
  const D = Math.PI / 180;
  // az: degrees from the front, + to the right; e: degrees above the rim (0 = ground, 90 = top)
  // ground level is put on the edge of the projected 160°: the outer ring of the file is never seen
  const P = (az, e) => { const rho = r * (80 - e) / 90; return [cx + rho * Math.sin(az * D), cy + rho * Math.cos(az * D)]; };
  const R = rnd(7);
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();

  // sky: dark at the top, dusk glow at the horizon, warmest towards the west (left-front)
  const sky = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  sky.addColorStop(0, '#04061a'); sky.addColorStop(0.55, '#0b1440'); sky.addColorStop(0.8, '#2b2357');
  sky.addColorStop(0.92, '#7a3550'); sky.addColorStop(1, '#e07a45');
  g.fillStyle = sky; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);
  const west = g.createRadialGradient(...P(-60, 0), 0, ...P(-60, 0), r * 0.9);
  west.addColorStop(0, 'rgba(255,150,80,0.55)'); west.addColorStop(1, 'rgba(255,150,80,0)');
  g.fillStyle = west; g.fillRect(cx - r, cy - r, 2 * r, 2 * r);

  // stars (fewer near the glowing horizon)
  for (let i = 0; i < 900; i++) {
    const s18 = Math.sin(16 * D), az = R() * 360, e = Math.asin(s18 + R() * (Math.sin(79 * D) - s18)) / D, [x, y] = P(az, e), s = R() < 0.06 ? 2.6 : R() * 1.5 + 0.4;
    g.fillStyle = `rgba(${220 + R() * 35},${220 + R() * 35},255,${0.35 + R() * 0.65})`;
    g.beginPath(); g.arc(x, y, s * r / 1024, 0, Math.PI * 2); g.fill();
  }
  // the Plough (Big Dipper), high in the north (behind the audience)
  const dip = [[160, 52], [170, 50], [178, 51], [186, 49], [190, 43], [203, 44], [200, 51]].map(([a, e]) => P(a, e));
  g.strokeStyle = 'rgba(160,200,255,0.45)'; g.lineWidth = 2 * r / 1024; g.beginPath();
  dip.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.lineTo(...dip[3]); g.stroke();
  dip.forEach(([x, y]) => { g.fillStyle = '#eaf2ff'; g.beginPath(); g.arc(x, y, 4.2 * r / 1024, 0, Math.PI * 2); g.fill(); });
  // the moon, a crescent, over the front-left
  const [mx, my] = P(-28, 38), mr = 46 * r / 1024;
  const halo = g.createRadialGradient(mx, my, mr, mx, my, mr * 3); halo.addColorStop(0, 'rgba(255,240,200,0.25)'); halo.addColorStop(1, 'rgba(255,240,200,0)');
  g.fillStyle = halo; g.beginPath(); g.arc(mx, my, mr * 3, 0, Math.PI * 2); g.fill();
  const mc = document.createElement('canvas'); mc.width = mc.height = Math.ceil(mr * 2 + 4);
  const mg = mc.getContext('2d'), mo = mc.width / 2;
  mg.fillStyle = '#fff2cf'; mg.beginPath(); mg.arc(mo, mo, mr, 0, Math.PI * 2); mg.fill();
  mg.globalCompositeOperation = 'destination-out';
  mg.beginPath(); mg.arc(mo + mr * 0.45, mo - mr * 0.25, mr * 0.9, 0, Math.PI * 2); mg.fill();
  g.drawImage(mc, mx - mo, my - mo);

  // the ground outside the projected 160° (never seen in the dome)
  g.fillStyle = '#05060a'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.arc(cx, cy, r * 80 / 90, 0, Math.PI * 2, true); g.fill();
  // helper: a block standing on the ground between az a0..a1, height h (degrees)
  const block = (a0, a1, h, fill) => {
    g.fillStyle = fill; g.beginPath();
    const n = Math.max(2, Math.ceil(Math.abs(a1 - a0)));
    for (let i = 0; i <= n; i++) { const [x, y] = P(a0 + (a1 - a0) * i / n, -3); i ? g.lineTo(x, y) : g.moveTo(x, y); }
    for (let i = n; i >= 0; i--) { const [x, y] = P(a0 + (a1 - a0) * i / n, h); g.lineTo(x, y); }
    g.closePath(); g.fill();
  };
  const windows = (a0, a1, h, e0 = 0) => {
    for (let a = a0 + 0.6; a < a1 - 0.4; a += 1.1) for (let e = e0 + 1.2; e < e0 + h - 0.6; e += 1.3) {
      if (R() < 0.45) continue;
      const [x, y] = P(a, e); g.fillStyle = R() < 0.8 ? 'rgba(255,200,110,0.9)' : 'rgba(170,220,255,0.8)';
      g.fillRect(x - 1.6 * r / 1024, y - 1.6 * r / 1024, 3.2 * r / 1024, 3.2 * r / 1024);
    }
  };

  // the city all round the horizon
  const ink = '#07080d';
  for (let a = -180; a < 180;) {
    const w = 2 + R() * 6, h = R() < 0.15 ? 9 + R() * 6 : 2.5 + R() * 5;
    if (!(a > 55 && a < 125) && !(a > -8 && a < 8)) { block(a, a + w, h, ink); windows(a, a + w, h); }
    a += w + R() * 1.5;
  }
  // the Öresund Bridge on the right: low deck, two pylons, cables
  g.strokeStyle = ink; g.lineWidth = 7 * r / 1024; g.beginPath();
  for (let a = 55; a <= 125; a += 1) { const [x, y] = P(a, 2.2); a === 55 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  for (const pa of [80, 100]) {
    block(pa - 0.7, pa + 0.7, 12, ink);
    g.strokeStyle = 'rgba(10,12,18,0.7)'; g.lineWidth = 1.1 * r / 1024;
    for (let k = 1; k <= 5; k++) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(...P(pa, 11.5)); g.lineTo(...P(pa + s * k * 3.2, 2.4)); g.stroke(); }
    const [lx, ly] = P(pa, 12.3); g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(lx, ly, 3.4 * r / 1024, 0, Math.PI * 2); g.fill();
  }
  for (let a = 57; a < 124; a += 3) { const [x, y] = P(a, 2.9); g.fillStyle = 'rgba(255,210,140,0.9)'; g.fillRect(x - 1.5, y - 1.5, 3, 3); }
  // the Turning Torso at the front: nine twisting cubes
  for (let i = 0; i < 9; i++) {
    const tw = Math.sin(i * 0.45) * 0.9, a0 = -2.4 + tw, a1 = 2.4 + tw, e0 = i * 3.1, e1 = e0 + 2.8;
    g.fillStyle = i % 2 ? '#0b0d14' : '#10131c'; g.beginPath();
    for (let k = 0; k <= 6; k++) { const [x, y] = P(a0 + (a1 - a0) * k / 6, i ? e0 : -3); k ? g.lineTo(x, y) : g.moveTo(x, y); }
    for (let k = 6; k >= 0; k--) { const [x, y] = P(a0 + (a1 - a0) * k / 6, e1); g.lineTo(x, y); }
    g.closePath(); g.fill();
    windows(a0, a1, e1 - e0 + 0.6, e0);
  }
  const [tx, ty] = P(0.8, 28.6); g.fillStyle = '#ff4a3a'; g.beginPath(); g.arc(tx, ty, 3.6 * r / 1024, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** the drawing on its own square canvas (for textures) */
export function domeArtCanvas(size = 2048) {
  const cv = document.createElement('canvas'); cv.width = cv.height = size;
  const g = cv.getContext('2d'); // transparent outside the circle
  drawDomeArt(g, size / 2, size / 2, size / 2);
  return cv;
}
