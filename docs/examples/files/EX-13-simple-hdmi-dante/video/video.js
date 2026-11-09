// The dome picture. Load in an OBS Browser Source at 2048 x 2048 (→ DistroAV → NDI).
// URL options:
//   ?audio=1        also play the sound in this page (rehearsal on one machine, stereo downmix)
//   ?view=inside    show the dome from a seat instead of the master (drag to look around)
//   ?preview=1      silent follower for the presenter page (no stats, no keys)
//   ?res=2048 ?q=low|normal|high ?fov=160 ?tilt=26 ?vfov=160 ?vtilt=26 ?front=bottom   (see lib/dome.js)
// The Projection panel on the presenter page changes the file/venue geometry live (state.global.projection).
import { Compositor, THREE } from '../lib/compositor.js';
import { DOME, QUALITY, setProjection, masterXYToRoom, azElOf } from '../lib/dome.js';
import { connect, slideView } from '../lib/bus.js';
import { domePointer, slideTakesShiftDrag } from '../lib/pointer.js';
import { AngleCanvas } from '../lib/anglecanvas.js';
import { loadSlides, stepsLeft } from '../slides/index.js';

const q = new URLSearchParams(location.search);
const preview = q.has('preview');
const withAudio = q.get('audio') === '1';
const view = q.get('view') === 'inside' ? 'inside' : 'master';
const res = Number(q.get('res')) || (preview ? 1024 : DOME.res);
document.body.classList.add(view);

const canvas = document.getElementById('c');
const comp = new Compositor(canvas, { res, view, viewSize: [innerWidth * devicePixelRatio, innerHeight * devicePixelRatio] });
if (view === 'inside') {
  addEventListener('resize', () => comp.resizeView(innerWidth * devicePixelRatio, innerHeight * devicePixelRatio));
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (e.shiftKey && slideTakesShiftDrag(window.__domeSlide?.())) return; // shift + drag belongs to the slide (EX-11 turns a sphere)
    drag = { x: e.clientX, y: e.clientY, az: comp.look.az, el: comp.look.el }; canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    comp.look.az = drag.az - (e.clientX - drag.x) * 0.15;
    comp.look.el = Math.max(-30, Math.min(89, drag.el + (e.clientY - drag.y) * 0.15));
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    comp.insideCam.fov = Math.max(40, Math.min(130, comp.insideCam.fov + e.deltaY * 0.05));
    comp.insideCam.updateProjectionMatrix();
  }, { passive: true });
}

const bus = connect(preview ? 'preview' : withAudio ? 'video+audio' : 'video');
const slides = await loadSlides();
const frames = document.getElementById('frames');
const hud = document.getElementById('hud');

let cur = null;       // { index, startedAt, slide, inst, unsub[] }
let fade = 0, target = null;
let projKey = '', rebuildAt = 0; // live projection changes: shaders follow at once, the slide is rebuilt when the sliders rest

function makeInstance(index) {
  const slide = slides[index];
  if (!slide) return null;
  const unsub = [];
  const ctx = {
    THREE, comp, AngleCanvas, DOME, QUALITY, preview, frames, bus,
    view: slideView(bus, slide),
    base: new URL(`../slides/${slide.id}/`, import.meta.url).href,
    onStream(fn) { unsub.push(bus.on('stream', fn)); },
  };
  let inst = null;
  try { inst = slide.video(ctx); } catch (e) { console.error('slide failed', slide.id, e); }
  return { index, slide, inst, unsub, startedAt: bus.state?.startedAt };
}
function dispose(c) {
  if (!c) return;
  c.unsub.forEach((f) => f());
  try { c.inst?.dispose?.(); } catch (e) { console.error(e); }
  frames.replaceChildren();
}

const blank = comp.material(`vec4 slideColor(vec3 room, vec3 local, vec2 m){ return vec4(0.0,0.0,0.0,1.0); }`);

bus.on('state', (s) => {
  if (!cur || s.slide !== cur.index) target = s.slide;
  else if (s.startedAt !== cur.startedAt) target = s.slide; // restart
});

// keyboard (clickers send PageUp/PageDown)
if (!preview) {
  addEventListener('keydown', (e) => {
    const s = bus.state; if (!s) return;
    const go = (i) => { i = Math.max(0, Math.min(slides.length - 1, i)); bus.cmd({ type: 'goto', slide: i, slideId: slides[i].id }); };
    if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { if (stepsLeft(slides[s.slide], s, bus.now())) bus.cmd({ type: 'press', key: 'step', lead: 0 }); else go(s.slide + 1); }
    else if (['ArrowLeft', 'PageUp'].includes(e.key)) go(s.slide - 1);
    else if (e.key === 'b' || e.key === '.') bus.cmd({ type: 'global', key: 'blackout', value: !s.global.blackout });
    else if (e.key === 'g') bus.cmd({ type: 'global', key: 'guides', value: !s.global.guides });
    else if (e.key === 'p') bus.cmd({ type: 'global', key: 'pip', value: !s.global.pip });
    else if (e.key === 'v') bus.cmd({ type: 'global', key: 'vscale', value: !s.global.vscale });
    else if (e.key === 'h') hud.hidden = !hud.hidden;
    else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && slides[s.slide]?.params?.next) bus.cmd({ type: 'press', key: e.key === 'ArrowDown' ? 'next' : 'prev', lead: 0 });
  });
}

// mouse over the picture (rehearsal tab): sent to slides that listen to the pointer
if (!preview) {
  let lastPtr = 0, down = null;
  // where the mouse points, as a room direction: through the fisheye (master) or the seat camera (inside)
  const roomAt = (e) => {
    if (view === 'inside') {
      const v = new THREE.Vector3((e.clientX / innerWidth) * 2 - 1, 1 - (e.clientY / innerHeight) * 2, 0.5).unproject(comp.insideCam).sub(comp.insideCam.position).normalize();
      const [az, el] = azElOf([v.x, -v.z, v.y]);
      return { az, el };
    }
    const r = canvas.getBoundingClientRect();
    return masterXYToRoom((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  };
  const curSlide = () => slides[bus.state?.slide];
  window.__domeSlide = curSlide;
  addEventListener('pointermove', (e) => {
    const s = bus.state; if (!s || !slides[s.slide]?.pointer || performance.now() - lastPtr < 50) return;
    if (view === 'inside' && e.buttons) return; // dragging the view, not steering
    lastPtr = performance.now();
    bus.stream('pointer', { x: e.clientX / innerWidth, y: e.clientY / innerHeight, ...(roomAt(e) || {}) });
  });
  // clicks, double clicks and shift + drags on the dome, for slides that take them (EX-11): lib/pointer.js.
  // In the seat view a plain drag still turns the view.
  domePointer(window, { bus, getSlide: curSlide, makeView: (sl) => slideView(bus, sl), toRoom: roomAt, hover: false });
}

// sound in the same page (rehearsal)
if (withAudio) {
  const { AudioHost } = await import('../lib/audiohost.js');
  const host = new AudioHost(bus, slides, { reportStats: true });
  const tap = document.getElementById('tap');
  tap.style.display = 'flex';
  const start = async () => { await host.start(); tap.style.display = 'none'; };
  tap.addEventListener('click', start, { once: true });
  addEventListener('keydown', start, { once: true });
}

// main loop
let last = performance.now(), frameCount = 0, statT = last, worst = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  worst = Math.max(worst, now - last);
  last = now;
  const s = bus.state;
  if (!s) return;
  if (!cur && target === null) target = s.slide;

  // transitions: fade to black, swap, fade up
  if (target !== null) {
    fade = Math.max(0, fade - dt / 0.3);
    if (fade === 0 || !cur) { dispose(cur); cur = makeInstance(target); target = null; }
  } else {
    fade = Math.min(1, fade + dt / 0.4);
  }
  const t = bus.now();
  comp.shared.uTime.value = cur ? t - (s.startedAt / 1000) : 0;
  const g = s.global || {};
  const pk = JSON.stringify(g.projection || null);
  if (pk !== projKey) {
    projKey = pk;
    if (g.projection && setProjection(g.projection)) { comp.syncDome(); rebuildAt = now + 350; }
  }
  if (rebuildAt && now > rebuildAt && cur && target === null) { // labels placed from JS (rim, sweet spot…) follow
    rebuildAt = 0; const i = cur.index; dispose(cur); cur = makeInstance(i);
  }
  const own = cur?.inst?.guides || {};
  comp.setGuides({ ...(g.guides ? { rings: 1, band: 1, sweet: 1, rim: 1 } : own), venue: g.vscale || own.venue });

  let mat = blank;
  if (cur?.inst?.render) {
    try { mat = cur.inst.render(t, dt) || blank; } catch (e) { console.error(e); cur.inst.render = null; }
  }
  frames.style.opacity = g.blackout ? 0 : fade;
  comp.render(mat, { fade: g.blackout ? 0 : fade * fade, pip: !!g.pip });

  frameCount++;
  if (now - statT > 2000) {
    const fps = (frameCount * 1000) / (now - statT);
    const info = `${slides[s.slide]?.id ?? ''}  file ${DOME.fisheyeFov}°/${DOME.tilt}° → dome ${DOME.venueFov}°/${DOME.venueTilt}°  ${fps.toFixed(1)} fps  worst ${worst.toFixed(0)} ms  ${res}²  q=${DOME.quality}  ${bus.connected ? '' : 'OFFLINE'}`;
    hud.textContent = info;
    if (!preview) bus.cmd({ type: 'stats', role: 'video', fps: +fps.toFixed(1), worst: Math.round(worst), res, quality: DOME.quality, view });
    frameCount = 0; statT = now; worst = 0;
  }
}
requestAnimationFrame(frame);
if (preview) hud.hidden = true;
