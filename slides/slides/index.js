// The running order. Each entry is a folder in slides/ with a slide.js.
export const ORDER = [
  // Before we start: the server opens here (Paul Bourke's test pattern)
  '00-test-pattern',
  // Act I — the room
  '00-ignition',
  '01-title',
  '03a-dome-section',
  '03-meet-the-dome',
  '02-flat',
  '02b-slide-route',
  '02c-slide-in-dome',
  '04-distortion',
  '05-space-3d',
  '06-peripheral',
  '07-comet-51',
  '08-mic-ring',
  // Act II — who did this before
  '09-sutherland',
  '10-vortex',
  '11-philips',
  '12-shaw-zkm',
  '13-allosphere',
  '14-sphere-vegas',
  // Act III — tools
  '15-pipeline',
  '15b-flat-to-dome',
  '16-examples-rendered',
  '16b-dove-live',
  '17-examples-live',
  '17b-instrument',
  '17c-synth',
  '18-touchdesigner',
  '19-toolbox',
  '19b-open-content',
  // Act IV — the room in the loop
  '20-room-in-loop',
  '21-your-turn',
  // Seminar V — limits you can show
  '30-sem-limits',
  '31-aliasing',
  '32-sampling',
  '33-frames',
  '34-black',
  '35-reflection',
  '36-vection',
  '37-one-seat',
  '38-horizon-seat',
  '39-sound-limits',
  '39b-rainbow',
  // Seminar VI — telling stories in a dome
  '40-sem-cinema',
  '41-attention',
  '42-cuts',
  '43-camera-body',
  '44-scale',
  '45-stage',
  '46-horizon',
  '47-pacing',
  '48-overhead',
  '49-collective',
  '49b-fulldome-showcase',
  // Tech checks (for the venue test, not the lecture)
  '90-test-card',
  '91-av-sync',
];

export async function loadSlides() {
  const mods = await Promise.all(ORDER.map((id) => import(`./${id}/slide.js`).then((m) => ({ ...m.default, id })).catch((e) => {
    console.error('could not load slide', id, e);
    return { id, title: `${id} (failed to load)`, act: '—', params: {}, video: () => ({ render: () => null }) };
  })));
  return mods;
}

/** build steps still to play on this slide before Next changes slide (a step that already played by itself counts) */
export function stepsLeft(slide, state, nowSec) {
  if (!slide?.steps || !state) return 0;
  let done = (state.log || []).filter((e) => e.key === 'step' && e.value === 'press').length;
  const auto = state.params?.auto ?? slide.params?.auto?.value;
  if (slide.autoStep && auto && nowSec - state.startedAt / 1000 > slide.autoStep) done = Math.max(done, 1);
  return Math.max(0, slide.steps - done);
}
