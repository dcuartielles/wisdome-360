// ─────────────────────────────────────────────────────────────────────────────────────────────
// The running order of the show. Each entry is a folder in slides/ that holds a slide.js
// (and, if the slide uses pictures or films, a media/ folder next to it).
//
// To add your own slide: copy one of the demo folders, rename it (e.g. '05-my-scene'),
// change its slide.js, and add the folder name to this list where you want it to appear.
// Pages load the slides once when they open: after a change, reload the picture and sound pages.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export const ORDER = [
  '00-test-card',   // test image: is the front at the front, are the speakers in the right place?
  '01-title',       // title screen: text placed by angle, a starry sky, an optional drone
  '02-comet',       // 5.1 sound: a comet circles the room and its sound follows it
  '03-carousel',    // pictures and a video on cards around the room, one at a time to the front
  '04-dome-film',   // a finished dome master film, played full dome
];

// ---- engine plumbing below: you don't need to change it ------------------------------------
export async function loadSlides() {
  const mods = await Promise.all(ORDER.map((id) => import(`./${id}/slide.js`).then((m) => ({ ...m.default, id })).catch((e) => {
    console.error('could not load slide', id, e);
    return { id, title: `${id} (failed to load: see the browser console)`, act: '—', params: {}, video: () => ({ render: () => null }) };
  })));
  return mods;
}

/** build steps still to play on this slide before Next changes slide */
export function stepsLeft(slide, state, nowSec) {
  if (!slide?.steps || !state) return 0;
  let done = (state.log || []).filter((e) => e.key === 'step' && e.value === 'press').length;
  const auto = state.params?.auto ?? slide.params?.auto?.value;
  if (slide.autoStep && auto && nowSec - state.startedAt / 1000 > slide.autoStep) done = Math.max(done, 1);
  return Math.max(0, slide.steps - done);
}
