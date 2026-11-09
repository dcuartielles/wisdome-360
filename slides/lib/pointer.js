// Mouse on the dome, for slides that take it (EX-11). Used by the presenter preview (master view)
// and the rehearsal tab (master or seat view), so both behave the same.
//
// A slide opts in with flags and hooks; the hooks run ONLY on the page where the mouse is, and
// write to the shared state themselves (bus.cmd), so every picture and sound page agrees:
//   pointer: true          hover: streams { x, y, az, el } as 'pointer' (ephemeral, ~20/s)
//   clicks: true           a click is logged as a 'set' of the key 'click' { az, el, shift }
//   onClick(e, ctx)        …or handled by the slide: e = { az, el, shift, dbl }
//   dblclicks: true        hold single clicks back ~280 ms to tell them from double clicks (e.dbl)
//   onDrag(e, ctx)         shift + drag: e = { phase: 'start'|'move'|'end', az, el (where it started), dx, dy (px) }
// ctx = { bus, view } (view = slideView for that slide). Directions are ROOM az/el in degrees.
export function domePointer(el, { bus, getSlide, makeView, toRoom, hover = true }) {
  let down = null, dragging = false, lastHover = 0, lastDrag = 0, pending = null;
  const ctxOf = (slide) => ({ bus, view: makeView(slide) });

  el.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY, shift: e.shiftKey, room: toRoom(e) };
    dragging = false;
  });
  el.addEventListener('pointermove', (e) => {
    const slide = getSlide(); if (!slide) return;
    const now = performance.now();
    if (hover && slide.pointer && !e.buttons && now - lastHover > 50) {
      lastHover = now;
      const d = toRoom(e);
      if (d) bus.stream('pointer', { az: d.az, el: d.el });
    }
    if (!down || !e.buttons || !down.shift || !slide.onDrag || !down.room) return;
    const dx = e.clientX - down.x, dy = e.clientY - down.y;
    if (!dragging && Math.hypot(dx, dy) > 5) { dragging = true; slide.onDrag({ phase: 'start', ...down.room, dx: 0, dy: 0 }, ctxOf(slide)); }
    if (dragging && now - lastDrag > 50) { lastDrag = now; slide.onDrag({ phase: 'move', ...down.room, dx, dy }, ctxOf(slide)); }
  });
  el.addEventListener('pointerup', (e) => {
    const slide = getSlide(), d0 = down; down = null;
    if (!slide || !d0) return;
    if (dragging) { dragging = false; slide.onDrag?.({ phase: 'end', ...d0.room, dx: e.clientX - d0.x, dy: e.clientY - d0.y }, ctxOf(slide)); return; }
    if (Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 5) return;
    const d = toRoom(e); if (!d) return;
    const ev = { az: +d.az.toFixed(2), el: +d.el.toFixed(2), shift: e.shiftKey };
    if (slide.onClick) {
      if (!slide.dblclicks) { slide.onClick(ev, ctxOf(slide)); return; }
      if (pending && performance.now() - pending.t < 300) {
        clearTimeout(pending.timer); pending = null;
        slide.onClick({ ...ev, dbl: true }, ctxOf(slide));
      } else {
        pending = { t: performance.now(), timer: setTimeout(() => { pending = null; slide.onClick(ev, ctxOf(slide)); }, 280) };
      }
    } else if (slide.clicks) {
      bus.cmd({ type: 'set', key: 'click', value: ev });
    }
  });
}
/** true when a shift + drag here belongs to the slide (so the seat view must not turn) */
export const slideTakesShiftDrag = (slide) => !!slide?.onDrag;
