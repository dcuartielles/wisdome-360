// ─────────────────────────────────────────────────────────────────────────────────────────────
// The running order of the show. Each entry is a folder in slides/ that holds a slide.js
// (and, if the slide uses pictures or films, a media/ folder next to it).
//
// To add your own slide: copy one of the demo folders (start-here is the easiest), rename it (e.g. '05-my-scene'),
// change its slide.js, and add the folder name to this list where you want it to appear.
// Pages load the slides once when they open: after a change, reload the picture and sound pages.
// ─────────────────────────────────────────────────────────────────────────────────────────────
export const ORDER = [
  'start-here',     // the practice slide: words, a picture, a moving dot and its sound, no shader code
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
    return { id, title: `${id} (failed to load: see the browser console)`, act: '—', params: {}, video: ({ comp, AngleCanvas }) => failedSlide(comp, AngleCanvas, id, e) };
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

/** what the dome shows instead of a slide that has a mistake in it */
function failedSlide(comp, AngleCanvas, id, e) {
  const ac = new AngleCanvas();
  ac.text(`The slide "${id}" has a mistake in it`, 0, 26, { size: 2.6, color: '#ff5d5d', weight: 700 })
    .text(String(e?.message || e).slice(0, 100), 0, 21, { size: 1.5, color: '#f2efe9', weight: 400 })
    .text(`Open slides/${id}/slide.js in VS Code and look for a red wavy underline.`, 0, 16.5, { size: 1.3, color: '#a9adb6', weight: 400 })
    .text('Fix it (or undo with Ctrl+Z), save, and reload this page.', 0, 13.5, { size: 1.3, color: '#a9adb6', weight: 400 })
    .commit();
  const mat = comp.material(`vec4 slideColor(vec3 room, vec3 local, vec2 m){
      vec4 e = sampleEq(uEq, room); return vec4(mix(vec3(0.03), e.rgb, e.a), 1.0); }`, { uEq: { value: ac.texture }, uEqOn: { value: 1 } });
  return { render: () => mat, dispose() { mat.dispose(); ac.dispose(); } };
}
