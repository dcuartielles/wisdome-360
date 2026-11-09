// Launch console: a systems check with some theatre, then IGNITE → the opening in the dome → presenter.
import { connect } from '../lib/bus.js';
import { loadSlides } from '../slides/index.js';
import { SPEAKERS } from '../lib/audio51.js';

const $ = (id) => document.getElementById(id);
// the desktop icon opens this as a Chrome app window: make it fill the screen
try { if (outerWidth < screen.availWidth - 40 || outerHeight < screen.availHeight - 40) { moveTo(screen.availLeft || 0, screen.availTop || 0); resizeTo(screen.availWidth, screen.availHeight); } } catch {}
const bus = connect('launcher');
const slides = await loadSlides();
const ignIndex = slides.findIndex((s) => s.id === '00-ignition');

// ---------- console sound (subtle; the big sound happens in the dome) ----------
let ac = null, muted = localStorage.getItem('dome.launch.mute') === '1';
function audio() { if (!ac) ac = new AudioContext(); if (ac.state === 'suspended') ac.resume(); return ac; }
function blip(f = 1200, d = 0.06, v = 0.05, type = 'sine') {
  if (muted) return;
  const c = audio(), o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
  o.type = type; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * 1.5, t + d);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + 0.02);
}
function hum(on) {
  if (muted) return;
  const c = audio();
  if (on && !hum.n) {
    const o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.frequency.value = 55; o2.frequency.value = 55.3; o.type = o2.type = 'sawtooth'; lp.frequency.value = 160; g.gain.value = 0;
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(c.destination); o.start(); o2.start();
    g.gain.linearRampToValueAtTime(0.025, c.currentTime + 2);
    hum.n = { o, o2, g };
  }
}

// ---------- the checks ----------
const rows = [];
function row(label) {
  const li = document.createElement('li');
  const n = String(rows.length + 1).padStart(2, '0');
  li.innerHTML = `<span class="n">${n}</span><span class="k">${label}</span><span class="v wait"></span>`;
  $('checks').append(li);
  const r = { li, v: li.querySelector('.v'), set(text, cls) { this.v.textContent = text; this.v.className = 'v ' + cls; } };
  rows.push(r);
  return r;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fresh = (s) => s && Date.now() + bus.offset - s.at < 4000;

async function sequence() {
  await sleep(500);
  hum(true);
  const steps = [
    ['SERVER', () => bus.connected ? [`ONLINE · ${bus.state?.hostname || 'localhost'}`, 'ok'] : null],
    ['CLOCK SYNC', () => bus.connected ? [`±${Math.abs(bus.offset).toFixed(1)} MS`, 'ok'] : null],
    ['SLIDES', () => [`${slides.length} LOADED`, 'ok']],
    ['DOME GEOMETRY', () => ['160° · TILT 26° · 2048²', 'ok']],
    ['DOME PICTURE · OBS → NDI', () => { const v = bus.stats.video; return fresh(v) ? [`${v.fps} FPS · ${v.res}²`, v.fps >= 27 ? 'ok' : 'warn'] : null; }, true],
    ['SOUND · 5.1', () => { const a = bus.stats.audio; return fresh(a) ? (a.discrete ? ['6 CH DISCRETE', 'ok'] : [`STEREO DOWNMIX`, 'warn']) : null; }, true],
  ];
  for (const [label, check, live] of steps) {
    const r = row(label);
    await sleep(60); r.li.classList.add('in'); blip(900 + rows.length * 120);
    await sleep(380);
    const res = check();
    if (res) { r.set(...res); blip(1800, 0.05, 0.04); }
    if (live) r.check = check;
  }
  await sleep(400);
  $('ignite').classList.add('ready');
  blip(660, 0.25, 0.06, 'triangle');
  // keep the live rows live
  setInterval(() => rows.forEach((r) => { if (!r.check) return; const res = r.check(); if (res) r.set(...res); else r.set('WAITING', 'wait'); }), 500);
}
sequence();

// ---------- ignite ----------
let fired = null;
async function ignite() {
  if (fired) return;
  fired = performance.now();
  $('ignite').classList.add('fired');
  blip(220, 0.4, 0.08, 'sawtooth');
  if (ignIndex >= 0) {
    if (bus.state?.slide !== ignIndex) { await bus.cmd({ type: 'goto', slide: ignIndex, slideId: '00-ignition' }); await sleep(700); }
    await bus.cmd({ type: 'press', key: 'go' });
  }
  const T = performance.now() + 150;
  const cd = $('count');
  const tick = () => {
    const tau = (performance.now() - T) / 1000;
    cd.textContent = tau < 0 ? '' : tau < 2 ? `T−${(2 - tau).toFixed(1)}` : 'GO';
    if (tau < 9) requestAnimationFrame(tick);
  };
  tick();
  setTimeout(() => { $('white').style.opacity = 0.85; setTimeout(() => ($('white').style.opacity = 0), 140); }, 2150);
  setTimeout(() => $('stage').classList.add('warp'), 6200);
  setTimeout(() => (location.href = '../presenter/'), 7700);
}
$('ignite').onclick = ignite;
addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if ($('ignite').classList.contains('ready')) ignite(); }
  if (e.key === 's' || e.key === 'S') location.href = '../presenter/';
  if (e.key === 'm' || e.key === 'M') { muted = !muted; localStorage.setItem('dome.launch.mute', muted ? '1' : '0'); if (muted && hum.n) hum.n.g.gain.value = 0; }
});

// ---------- the scope: a little dome master that never stops moving ----------
const cv = $('scope'), g = cv.getContext('2d');
const W = cv.width, R = W * 0.46, CX = W / 2, CY = W / 2;
const D = Math.PI / 180;
const pings = [];
const P = (azDeg, thDeg) => { const r = (thDeg / 90) * R; return [CX + Math.sin(azDeg * D) * r, CY + Math.cos(azDeg * D) * r]; }; // bottom = front
let t0 = performance.now();
function draw(now) {
  requestAnimationFrame(draw);
  const t = (now - t0) / 1000;
  g.fillStyle = 'rgba(5,6,8,0.28)'; g.fillRect(0, 0, W, W);
  const tau = fired ? (now - fired - 150) / 1000 : -1;
  // rings
  g.lineWidth = 2;
  for (let e = 0; e <= 90; e += 15) {
    g.strokeStyle = e === 80 ? 'rgba(255,93,93,.55)' : 'rgba(108,198,255,.16)';
    g.beginPath(); g.arc(CX, CY, (e / 90) * R, 0, Math.PI * 2); g.stroke();
  }
  g.strokeStyle = 'rgba(255,93,93,.55)'; g.beginPath(); g.arc(CX, CY, (80 / 90) * R, 0, Math.PI * 2); g.stroke();
  for (let a = 0; a < 360; a += 30) { const [x, y] = P(a, 90); g.strokeStyle = 'rgba(108,198,255,.10)'; g.beginPath(); g.moveTo(CX, CY); g.lineTo(x, y); g.stroke(); }
  for (let a = 0; a < 360; a += 5) { const [x1, y1] = P(a, 88), [x2, y2] = P(a, a % 30 ? 89.5 : 92); g.strokeStyle = 'rgba(233,236,239,.35)'; g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
  // sweep
  const sw = (t * 60) % 360;
  for (let i = 0; i < 40; i++) {
    const a = sw - i * 1.2; const [x, y] = P(a, 90);
    g.strokeStyle = `rgba(255,181,71,${0.22 * (1 - i / 40)})`; g.lineWidth = 6;
    g.beginPath(); g.moveTo(CX, CY); g.lineTo(x, y); g.stroke();
  }
  if (Math.random() < 0.05) pings.push({ az: Math.random() * 360, th: 10 + Math.random() * 70, t });
  // speakers + their levels
  const lv = fresh(bus.stats.audio) ? bus.stats.audio.levels : [0, 0, 0, 0, 0, 0];
  for (const s of SPEAKERS) {
    const [x, y] = P(s.az, 84); const l = Math.min(1, Math.sqrt(lv[s.ch] || 0) * 2.5);
    g.fillStyle = `rgba(255,181,71,${0.25 + 0.75 * l})`; g.beginPath(); g.arc(x, y, 10 + l * 16, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(233,236,239,.7)'; g.font = '600 24px Consolas, monospace'; g.textAlign = 'center'; g.fillText(s.name, ...P(s.az, 95.5));
  }
  // pings
  for (let i = pings.length - 1; i >= 0; i--) {
    const p = pings[i], age = t - p.t; if (age > 2) { pings.splice(i, 1); continue; }
    const [x, y] = P(p.az, p.th);
    g.strokeStyle = `rgba(108,198,255,${0.8 * (1 - age / 2)})`; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, 4 + age * 30, 0, Math.PI * 2); g.stroke();
  }
  // ignition: rings rushing in, the hit, a shockwave
  if (tau >= 0) {
    for (let k = 0; k < 6; k++) {
      const t0k = k * 0.22, p = Math.min(1, Math.max(0, (tau - t0k) / (2 - t0k)));
      if (tau < t0k || tau > 2.05) continue;
      g.strokeStyle = `rgba(255,${180 + 70 * p},${80 + 150 * p},${0.5 + 0.5 * p})`; g.lineWidth = 4 + 18 * p;
      g.beginPath(); g.arc(CX, CY, Math.max(1, (80 * (1 - p * p) / 90) * R), 0, Math.PI * 2); g.stroke();
    }
    if (tau > 2) {
      const a = tau - 2;
      g.strokeStyle = `rgba(150,220,255,${Math.max(0, 1 - a / 2.5)})`; g.lineWidth = 10;
      g.beginPath(); g.arc(CX, CY, Math.min(R * 1.2, a * R * 0.9), 0, Math.PI * 2); g.stroke();
      for (let i = 0; i < 24; i++) {
        const ang = i * 15 + a * 10, r1 = (a * 0.6 % 1) * R, r2 = r1 + 60 + a * 40;
        g.strokeStyle = `rgba(255,220,170,${Math.max(0, 0.6 - a / 8)})`; g.lineWidth = 3;
        g.beginPath(); g.moveTo(CX + Math.sin(ang * D) * r1, CY + Math.cos(ang * D) * r1); g.lineTo(CX + Math.sin(ang * D) * r2, CY + Math.cos(ang * D) * r2); g.stroke();
      }
    }
  }
  // centre and front marker
  g.fillStyle = 'rgba(255,181,71,.9)'; g.beginPath(); g.arc(CX, CY, 6, 0, Math.PI * 2); g.fill();
  g.fillStyle = 'rgba(255,93,93,.9)'; g.font = '700 26px Consolas, monospace'; g.textAlign = 'center'; g.fillText('FRONT', ...P(0, 72));
}
requestAnimationFrame(draw);

// ticker
const words = ['NDI', 'DANTE', 'L R C LFE Ls Rs', 'EQUIDISTANT FISHEYE', 'CUBE → DOME', 'AZ/EL', '2048 × 2048', '30 FPS', 'TILT 26°', 'OPENING 160°', 'SWEET SPOT 40°', 'BAND 15–60°', 'COMPOSE BY ANGLE'];
let tk = ''; for (let i = 0; i < 80; i++) tk += `${words[i % words.length]}  ·  ${Math.random().toString(16).slice(2, 10).toUpperCase()}  ·  `;
$('tk').textContent = tk + tk;
