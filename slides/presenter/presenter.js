import { connect, slideView } from '../lib/bus.js';
import { domePointer } from '../lib/pointer.js';
import { loadSlides, stepsLeft } from '../slides/index.js';
import { CH } from '../lib/audio51.js';
import { DOME, VENUE_DEFAULTS, getProjection, setProjection, projectionSummary, masterXYToRoom } from '../lib/dome.js';

const bus = connect('presenter');
const slides = await loadSlides();
const $ = (id) => document.getElementById(id);
let shown = -1, shownStart = null;

// slide list, grouped by act
const list = $('list');
let lastAct = null;
slides.forEach((s, i) => {
  if (s.act && s.act !== lastAct) { const a = document.createElement('li'); a.className = 'act'; a.textContent = s.act; list.append(a); lastAct = s.act; }
  const li = document.createElement('li'); li.textContent = s.title; li.dataset.i = i;
  li.onclick = () => go(i);
  list.append(li);
});

// Next first plays a slide's build steps (slide.steps), then moves on
function next() {
  if (stepsLeft(slides[cur()], bus.state, bus.now())) bus.cmd({ type: 'press', key: 'step', lead: 0 }); else go(cur() + 1);
}
function go(i) { i = Math.max(0, Math.min(slides.length - 1, i)); bus.cmd({ type: 'goto', slide: i, slideId: slides[i].id }); }
const cur = () => bus.state?.slide ?? 0;
$('prev').onclick = () => go(cur() - 1);
$('next').onclick = () => next();
$('restart').onclick = () => bus.cmd({ type: 'restart' });

// preview
let pvView = localStorage.getItem('dome.pv') || 'master';
function setPreview(v) {
  pvView = v; localStorage.setItem('dome.pv', v);
  $('pv').src = `../video/?preview=1&res=1024${v === 'inside' ? '&view=inside' : ''}`;
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === v));
  updateClick();
}
// clicking the preview steps through pictures on slides that have them (master view; inside view keeps dragging)
const hasPics = () => !!slides[cur()]?.params?.next;
const wantsPointer = () => !!slides[cur()]?.pointer;
function updateClick() { $('pvclick').classList.toggle('on', pvView === 'master' && (hasPics() || wantsPointer())); }
let lastPtr = 0;
$('pvclick').addEventListener('pointermove', (e) => {
  if (!wantsPointer() || performance.now() - lastPtr < 50) return;
  lastPtr = performance.now();
  const r = $('pvclick').getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
  bus.stream('pointer', { x, y, ...(masterXYToRoom(x, y) || {}) });
});
// slides that take clicks / shift-drags on the dome (EX-11): lib/pointer.js
domePointer($('pvclick'), {
  bus, getSlide: () => slides[cur()], makeView: (sl) => slideView(bus, sl), hover: false,
  toRoom: (e) => { const r = $('pvclick').getBoundingClientRect(); return masterXYToRoom((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); },
});
$('pvclick').onclick = (e) => {
  const sl = slides[cur()];
  if (sl?.clicks || sl?.onClick) return;   // handled by domePointer
  if (hasPics()) bus.cmd({ type: 'press', key: e.shiftKey ? 'prev' : 'next', lead: 0 });
};
document.querySelectorAll('[data-view]').forEach((b) => (b.onclick = () => setPreview(b.dataset.view)));
setPreview(pvView);

// globals
const toggleGlobal = (k) => bus.cmd({ type: 'global', key: k, value: !bus.state?.global?.[k] });
document.querySelectorAll('[data-global]').forEach((b) => (b.onclick = () => toggleGlobal(b.dataset.global)));

addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  if (['ArrowRight', 'PageDown'].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); go(cur() - 1); }
  else if (e.key === 'b' || e.key === '.') toggleGlobal('blackout');
  else if (e.key === 'g') toggleGlobal('guides');
  else if (e.key === 'p') toggleGlobal('pip');
  else if (e.key === 'v') toggleGlobal('vscale');
  else if (e.key === 'm') toggleGlobal('mute');
  else if (e.key === 'r') bus.cmd({ type: 'restart' });
  else if (e.key === 'ArrowDown' && hasPics()) { e.preventDefault(); bus.cmd({ type: 'press', key: 'next', lead: 0 }); }
  else if (e.key === 'ArrowUp' && hasPics()) { e.preventDefault(); bus.cmd({ type: 'press', key: 'prev', lead: 0 }); }
});

// projection: the file (how we render) vs the dome (how the venue projects it)
const W = VENUE_DEFAULTS;
const PRESETS = [
  { id: 'venue', label: 'Wisdome, made right', p: { ...W, link: true },
    hint: 'File rendered at 160° for a 26° tilt: what we draw at an angle is where people see it.' },
  { id: 'b180', label: '180° file (Blender default)', p: { ...W, fov: 180, link: false },
    hint: 'A standard 180° dome master: the venue spreads it over 160°, so everything is pulled towards the image centre.' },
  { id: 'plan', label: 'Planetarium file in this dome', p: { ...W, fov: 180, tilt: 0, link: false },
    hint: 'A 180° master made for a flat dome (centre overhead) played in the tilted Wisdome: the horizon climbs at the front and falls at the back.' },
  { id: 'flat', label: 'Centre overhead (no tilt)', p: { fov: 160, tilt: 0, vfov: 160, vtilt: 0, opening: 160, link: true },
    hint: 'The same dome, not tilted: the image centre (their 90°) straight overhead. Compare with “Wisdome, made right”.' },
  { id: 'plan180', label: 'Classic planetarium', p: { fov: 180, tilt: 0, vfov: 180, vtilt: 0, opening: 180, link: true },
    hint: 'A full 180° hemisphere over flat seats: the reference most fulldome tools assume.' },
];
let proj = { ...getProjection(), link: true };
const pctls = [...document.querySelectorAll('.pctl')];
PRESETS.forEach((pr) => {
  const b = document.createElement('button'); b.textContent = pr.label; b.title = pr.hint; b.dataset.preset = pr.id;
  b.onclick = () => sendProj({ ...pr.p });
  $('presets').append(b);
});
let projTimer = null, projPending = null;
function sendProj(p, now = true) {
  if (p.link) { p.fov = p.vfov; p.tilt = p.vtilt; }
  proj = p; drawProj();
  projPending = p;
  if (now) { clearTimeout(projTimer); projTimer = null; bus.cmd({ type: 'global', key: 'projection', value: p }); return; }
  if (!projTimer) projTimer = setTimeout(() => { projTimer = null; bus.cmd({ type: 'global', key: 'projection', value: projPending }); }, 60);
}
pctls.forEach((c) => {
  const inp = c.querySelector('input');
  inp.oninput = () => sendProj({ ...proj, [c.dataset.k]: Number(inp.value) }, false);
});
$('plink').onchange = (e) => sendProj({ ...proj, link: e.target.checked });
const f1 = (x) => (Math.round(x * 10) / 10).toFixed(Math.abs(x - Math.round(x)) < 0.05 ? 0 : 1);
function drawProj() {
  pctls.forEach((c) => {
    const inp = c.querySelector('input'), v = proj[c.dataset.k];
    if (document.activeElement !== inp) inp.value = v;
    c.querySelector('output').textContent = v + '°';
  });
  $('plink').checked = !!proj.link;
  document.querySelector('.pgrid fieldset').classList.toggle('off', !!proj.link);
  document.querySelectorAll('.pgrid fieldset:first-child input').forEach((i) => (i.disabled = !!proj.link));
  const key = JSON.stringify({ ...proj, link: undefined });
  document.querySelectorAll('[data-preset]').forEach((b) => {
    const pr = PRESETS.find((x) => x.id === b.dataset.preset);
    b.classList.toggle('on', JSON.stringify({ ...pr.p, link: undefined }) === key);
  });
  // the numbers, computed for these settings
  const d = { ...DOME, fisheyeFov: proj.fov, tilt: proj.tilt, venueFov: proj.vfov, venueTilt: proj.vtilt, opening: proj.opening };
  d.sweetSpot = (90 - d.venueTilt) - (1 - d.sweetVenue / 90) * d.venueFov / 2;
  const s = projectionSummary(d);
  const lines = [];
  if (Math.abs(s.squeeze - 1) < 1e-3) lines.push(`File and dome agree: <b>${proj.fov}°</b> of file on ${proj.vfov}° of dome.`);
  else lines.push(`<span class="bad">${s.squeeze < 1 ? 'Squeezed' : 'Stretched'}</span>: the file's ${proj.fov}° is spread over ${proj.vfov}° of dome (×${s.squeeze.toFixed(2)}). Everything moves ${s.squeeze < 1 ? 'towards' : 'away from'} the image centre.`);
  if (s.tiltMismatch) lines.push(`<span class="bad">Tilt off by ${s.tiltMismatch}°</span>: the file is made for ${proj.tilt}°, the dome is tilted ${proj.vtilt}°.`);
  const hl = s.horizonLands;
  lines.push(`The file's eye-level horizon, straight ahead, lands at <b>${f1(hl)}°</b>${Math.abs(hl) > 0.5 ? ' <span class="bad">(should be 0°)</span>' : ' (right)'}.`);
  lines.push(`Image centre (their 90°): <b>${f1(s.axisEl)}°</b> up, ahead · rim at the front: <b>${f1(s.frontRim)}°</b>.`);
  lines.push(`Venue sweet spot (their ${DOME.sweetVenue}°): <b>${f1(d.sweetSpot)}°</b> above eye level · eye level is their <b>${f1(s.eyeLevelVenue)}°</b>.`);
  $('psum').innerHTML = lines.join('<br>');
}
function onProjState(s) {
  const p = s.global?.projection;
  if (!p || projTimer) return;
  const key = JSON.stringify(p);
  if (key === onProjState.k) return;
  onProjState.k = key;
  proj = { ...proj, ...p };
  if (setProjection(p)) { const sl = slides[s.slide]; if (sl) $('notes').innerHTML = sl.notes || '<p class="hint">—</p>'; }
  drawProj();
}
drawProj();

// audio delay
$('delay').oninput = (e) => { $('delayv').textContent = e.target.value + ' ms'; bus.cmd({ type: 'delay', ms: Number(e.target.value) }); };

// meters
CH.forEach((n) => { const d = document.createElement('div'); d.innerHTML = `<i></i><b>${n}</b>`; $('meters').append(d); });

// controls for the current slide
function buildControls(slide) {
  const box = $('controls'); box.replaceChildren();
  const params = slide.params || {};
  if (!Object.keys(params).length) { box.innerHTML = '<div class="ctl"><span class="hint">No live controls on this slide.</span></div>'; return; }
  for (const [key, p] of Object.entries(params)) {
    const el = document.createElement('div'); el.className = 'ctl'; el.dataset.key = key;
    const val = () => bus.state?.params?.[key] ?? p.value;
    if (p.type === 'range') {
      el.innerHTML = `<label><span>${p.label || key}</span><output></output></label><input type="range" min="${p.min}" max="${p.max}" step="${p.step ?? 0.01}">`;
      const inp = el.querySelector('input'), out = el.querySelector('output');
      let pending = null, timer = null;
      inp.oninput = () => {
        out.textContent = fmt(Number(inp.value), p);
        pending = Number(inp.value);
        if (!timer) timer = setTimeout(() => { bus.cmd({ type: 'set', key, value: pending }); timer = null; }, 50);
      };
      el.sync = () => { if (document.activeElement !== inp) inp.value = val(); out.textContent = fmt(Number(val()), p); };
    } else if (p.type === 'toggle') {
      el.innerHTML = `<div class="opts"><button>${p.label || key}</button></div>`;
      const b = el.querySelector('button');
      b.onclick = () => bus.cmd({ type: 'set', key, value: !val() });
      el.sync = () => b.classList.toggle('on', !!val());
    } else if (p.type === 'select') {
      el.innerHTML = `<label><span>${p.label || key}</span></label><div class="opts">${p.options.map((o) => `<button data-v="${o.value ?? o}">${o.label ?? o}</button>`).join('')}</div>`;
      el.querySelectorAll('button').forEach((b) => (b.onclick = () => bus.cmd({ type: 'set', key, value: b.dataset.v })));
      el.sync = () => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', String(val()) === b.dataset.v));
    } else if (p.type === 'button') {
      el.classList.add('btn');
      el.innerHTML = `<button class="primary">${p.label || key}</button>`;
      el.querySelector('button').onclick = () => bus.cmd({ type: 'press', key, lead: key === 'next' || key === 'prev' ? 0 : undefined });
      el.sync = () => {};
    }
    if (p.hint) el.insertAdjacentHTML('beforeend', `<div class="hint">${p.hint}</div>`);
    box.append(el);
  }
}
function fmt(v, p) { const d = (p.step ?? 0.01) >= 1 ? 0 : (p.step ?? 0.01) >= 0.1 ? 1 : 2; return v.toFixed(d) + (p.unit ? ' ' + p.unit : ''); }

function onState(s) {
  onProjState(s);
  const slide = slides[s.slide];
  if (!slide) return;
  if (s.slide !== shown || s.startedAt !== shownStart) {
    if (s.slide !== shown) { buildControls(slide); $('notes').innerHTML = slide.notes || '<p class="hint">—</p>'; }
    shown = s.slide; shownStart = s.startedAt;
    updateClick();
    $('title').textContent = slide.title;
    $('idx').textContent = `${String(s.slide + 1).padStart(2, '0')} / ${slides.length}`;
    const nx = slides[s.slide + 1];
    $('nextup').textContent = nx ? `Next: ${nx.title}` : 'Last slide';
    list.querySelectorAll('li[data-i]').forEach((li) => li.classList.toggle('cur', Number(li.dataset.i) === s.slide));
  }
  document.querySelectorAll('.ctl').forEach((c) => c.sync?.());
  document.querySelectorAll('[data-global]').forEach((b) => b.classList.toggle('on', !!s.global?.[b.dataset.global]));
  if (document.activeElement !== $('delay')) { $('delay').value = s.delayMs; $('delayv').textContent = s.delayMs + ' ms'; }
}
bus.on('state', onState);
if (bus.state) onState(bus.state);
if (bus.connected) $('conn').classList.add('ok');
bus.on('connected', (ok) => { $('conn').classList.toggle('ok', ok); $('conn').title = ok ? 'server connected' : 'server offline'; });

bus.on('stats', (st) => {
  const now = Date.now() + bus.offset;
  const v = st.video;
  const vEl = $('vstat');
  if (v && now - v.at < 5000) {
    vEl.textContent = `video ${v.fps} fps · worst ${v.worst} ms · ${v.res}² ${v.quality}`;
    vEl.className = 'stat' + (v.fps < 27 ? ' bad' : v.fps < 29 ? ' warn' : '');
  } else { vEl.textContent = 'video page not running'; vEl.className = 'stat warn'; }
  const a = st.audio;
  const aEl = $('astat');
  if (a && now - a.at < 3000) {
    aEl.textContent = `audio ${a.discrete ? '6 ch' : 'downmix ' + a.channels + ' ch'} · ${a.rate / 1000} kHz`;
    aEl.className = 'stat' + (a.discrete ? '' : ' warn');
    [...$('meters').children].forEach((m, i) => (m.querySelector('i').style.height = Math.min(100, Math.sqrt(a.levels[i] || 0) * 160) + '%'));
  } else { aEl.textContent = 'audio page not running'; aEl.className = 'stat warn'; }
  const b = st.bridge, bEl = $('bstat');
  if (b && now - b.at < 3000) {
    bEl.style.display = '';
    const ok = b.link === 'connected' && b.state === 'playing';
    bEl.textContent = ok ? `bridge ${b.fill_ms} ms · ${b.ppm > 0 ? '+' : ''}${b.ppm} ppm · ${b.underruns} underruns${b.muted ? ' · MUTED' : ''}`
      : `bridge ${b.link === 'connected' ? (b.state ?? '…') : b.link}`;
    bEl.className = 'stat' + (!ok || b.sink_error ? ' bad' : b.muted || b.underruns ? ' warn' : '');
  } else bEl.style.display = 'none';
});

// timer since the first slide change in this session
const t0 = Date.now();
setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); $('clock').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; }, 1000);

// shut down: click twice within 3 s
let quitArm = null;
$('quit').onclick = () => {
  if (quitArm) { bus.cmd({ type: 'shutdown' }); $('quit').textContent = 'Stopped. You can close the windows.'; return; }
  $('quit').textContent = 'Click again to stop'; $('quit').classList.add('on');
  quitArm = setTimeout(() => { quitArm = null; $('quit').textContent = 'Shut down server'; $('quit').classList.remove('on'); }, 3000);
};
