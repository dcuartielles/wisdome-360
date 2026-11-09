import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { domeArtCanvas } from '../_domeart.js';
import { drawSlideFrame, screenPlace, W, H } from '../_slideframe.js';
import { DOME, DOME_ZENITH_EL } from '../../lib/dome.js';

// Picks up where "Presenting with 16:9 slides" ends (the slide on the screen at the front, circle in
// the middle), then: 1. the slide rises to the centre of the dome, 2. it grows until it is 2160 px
// high = the whole dome. Afterwards the landscape follows slow horizontal mouse movements.
const DELAY = 0.8, RISE = 1.8, SWAP = 0.4, GROW = 3.2;
const SMALL = 0.28;                  // half-height of the slide in the master when it starts to grow
const YAW_RANGE = 70;                // degrees the landscape can turn either way
const ease = (x) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const lerp = (a, b, t) => a + (b - a) * t;

export default {
  title: '…and what the dome shows',
  act: ACT1,
  pointer: true, // the presenter preview sends mouse movements to this slide
  notes: `<p>The venue's route, step by step. The slide from before rises to the centre of the dome, then is scaled until it is <b>2160 px high = the full dome</b>. The sides fall off the edge; the middle circle fills the whole dome.</p>
<ul><li>Look round: the city stands all around the rim, the Turning Torso at the <b>front</b>, the Öresund Bridge on the right, stars and the Plough overhead and behind. That is why the drawing was a fisheye circle.</li>
<li><b>Move the mouse slowly left and right over the preview</b> (or in the rehearsal tab): the city turns with it, gently. Fast movements are smoothed out.</li>
<li>Text in the slide's corners never arrives. Text in the circle arrives curved and huge: keep it short, low and near the bottom of the circle (the front).</li>
<li>Press <b>R</b> to play it again, or <b>P</b> (show the file) to see the master.</li></ul>`,
  params: {
    grow: { type: 'toggle', label: 'Animate (rise, then grow into the dome)', value: true },
    turn: { type: 'toggle', label: 'Turn with the mouse', value: true },
    label: { type: 'toggle', label: 'Caption', value: true },
  },
  video({ THREE, comp, AngleCanvas, view, onStream }) {
    const art = domeArtCanvas(2048);
    const mk = (annotate) => {
      const cv = document.createElement('canvas'); cv.width = W * 2; cv.height = H * 2;
      const g = cv.getContext('2d'); g.scale(2, 2);
      drawSlideFrame(g, art, 1, { annotate, text: true });
      const t = new THREE.CanvasTexture(cv); t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8;
      return t;
    };
    const texAnn = mk(true), texClean = mk(false);
    const { el: START_EL, w: START_W } = screenPlace();   // same screen as the previous slide
    const ac = new AngleCanvas(2048);
    // caption once the circle fills the dome: just above the sweet spot, under the Turning Torso's top
    ac.text('your 2160 px circle = the whole dome', 0, DOME.sweetSpot + 4, { size: 1.6, weight: 650, color: C.ink }).commit();
    const A = (W / H).toFixed(4);
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uAnn, uClean; uniform float uAnnA, uEl, uW, uMix, uHalfH, uYaw, uLabel;
      vec3 frame(vec2 uv){ return mix(texture(uClean, uv).rgb, texture(uAnn, uv).rgb, uAnnA); }
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        // a: the slide as a flat screen seen from the seats
        vec3 a = houseSky(room, 0.5) + stars(room) * 0.2;
        vec2 uv1 = cardUV(room, dirRoom(0.0, uEl), uW, ${A}, 0.0);
        if (uv1.x >= 0.0) a = frame(uv1);
        // b: the slide pasted into the centre of the master (the venue's route), turned by the mouse
        vec3 b = vec3(0.0);
        vec2 mr = rot2(uYaw) * m;
        vec2 uv2 = mr / vec2(uHalfH * ${A}, uHalfH) * 0.5 + 0.5;
        if (all(greaterThanEqual(uv2, vec2(0.0))) && all(lessThanEqual(uv2, vec2(1.0)))) b = frame(uv2);
        vec3 c = mix(a, b, uMix);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a * uLabel);
        return vec4(c, 1.0);
      }`, { uAnn: { value: texAnn }, uClean: { value: texClean }, uAnnA: { value: 1 }, uEl: { value: START_EL }, uW: { value: START_W }, uMix: { value: 0 },
            uHalfH: { value: SMALL }, uYaw: { value: 0 }, uEq: { value: ac.texture }, uLabel: { value: 0 } });

    // mouse: x 0..1 across the preview -> a target angle; the landscape eases towards it slowly
    let targetYaw = 0, yaw = 0;
    onStream((msg) => { if (msg.name === 'pointer' && msg.data && typeof msg.data.x === 'number') targetYaw = (msg.data.x - 0.5) * 2 * YAW_RANGE; });

    return {
      render(t, dt) {
        const u = mat.uniforms, ts = view.t();
        let rise = 1, swap = 1, grow = 1;
        if (view.p('grow')) {
          rise = ease((ts - DELAY) / RISE);
          swap = ease((ts - DELAY - RISE) / SWAP);
          grow = ease((ts - DELAY - RISE - SWAP * 0.5) / GROW);
        }
        u.uEl.value = lerp(START_EL, DOME_ZENITH_EL, rise);
        u.uW.value = START_W - 3 * rise;
        u.uAnnA.value = 1 - rise;
        u.uMix.value = swap;
        u.uHalfH.value = lerp(SMALL, 1, grow);
        const live = view.p('turn') && grow > 0.98;
        yaw += ((live ? targetYaw : 0) - yaw) * Math.min(1, dt * 0.9); // slow follow
        u.uYaw.value = yaw * Math.PI / 180;
        u.uLabel.value = view.p('label') ? ease((ts - DELAY - RISE - GROW - 0.5) / 1.2) * (1 - Math.min(1, Math.abs(yaw) / 15)) : 0;
        return mat;
      },
      dispose() { mat.dispose(); texAnn.dispose(); texClean.dispose(); ac.dispose(); },
    };
  },
};
