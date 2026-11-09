// ═════════════════════════════════════════════════════════════════════════════════════════════
// DEMO SLIDE: TITLE SCREEN
// A title, a subtitle and a line of credits straight ahead at the sweet spot, over a slowly
// turning starry sky, with an optional drone that circles the room.
// Copy this one to make any slide that is mostly text.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { ACT_SHOW, C, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

// ── edit the words here ──
const TITLE = 'Our dome piece';
const SUB = 'a subtitle in one line';
const LINE = 'Team names  ·  Course  ·  Year';

export default {
  title: 'Title',
  act: ACT_SHOW,
  notes: `<p>Lights down before this slide. Let the stars settle for a few seconds.</p>
<p>The title sits straight ahead, on the sweet spot. Press <b>G</b> on the presenter to see the guides.</p>`,

  // A 'range' becomes a slider; its value is read with view.p('drift').
  params: {
    drift: { type: 'range', label: 'Sky drift', min: -3, max: 3, step: 0.1, value: 0.6, unit: '°/s' },
    ambience: { type: 'toggle', label: 'Ambience (circling drone)', value: false },
  },

  video({ comp, AngleCanvas, view }) {
    const S = DOME.sweetSpot;        // degrees above eye level, straight ahead (about 20° in Wisdome)
    // Text by angle: text(string, azimuth, elevation, { size in degrees, weight, color, letter spacing })
    // Rule of thumb in a dome: a capital letter should be at least 1.5° tall to be read from every seat.
    const ac = new AngleCanvas();
    ac.text(TITLE, 0, S + 5.5, { size: 4.2, weight: 700, color: C.ink })
      .text(SUB, 0, S - 1, { size: 2.2, weight: 400, color: C.warm })
      .text(LINE, 0, S - 6, { size: 1.4, weight: 500, color: C.mute, letter: 0.15 })
      .commit();

    // The shader: a dark sky (houseSky) with stars that turn round the vertical axis by uSpin
    // degrees, and the text on top. Uniforms (uSpin) are values you set from JavaScript each frame.
    const mat = comp.material(`${NOISE_GLSL}
      uniform float uSpin;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        float a = uSpin * DEG;                                   // DEG = degrees → radians
        vec3 d = vec3(room.x * cos(a) - room.y * sin(a), room.x * sin(a) + room.y * cos(a), room.z);
        vec3 c = houseSky(room, 1.0) + stars(d) * smoothstep(-5.0, 15.0, elOf(room));
        vec4 e = sampleEq(uEq, room);
        return vec4(mix(c, e.rgb, e.a), 1.0);
      }`, { uEq: { value: ac.texture }, uSpin: { value: 0 } });

    return {
      // view.integrate('drift') = the sum of the slider over time (°/s × s = degrees), so moving
      // the slider changes the speed smoothly instead of making the sky jump.
      render(t) { mat.uniforms.uSpin.value = view.integrate('drift'); return mat; },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  // A soft drone: three detuned saw waves through a slow filter, circling the room once a minute.
  audio({ group, ctx, view }) {
    // group.panner() = a 5.1 panner: p.set(azimuth, elevation) places the sound like the picture.
    const p = group.panner();
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
    const amp = ctx.createGain(); amp.gain.value = 0;
    const oscs = [55, 55.4, 82.5].map((f) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); o.start(); return o; });
    lp.connect(amp).connect(p.input);
    p.lfe(0.3);                       // also send 30 % to the subwoofer (LFE)
    return {
      update(t) {
        const on = view.p('ambience');
        amp.gain.setTargetAtTime(on ? 0.12 : 0, ctx.currentTime, 0.6);     // fade in/out
        const ts = view.t();          // seconds since the slide started (shared by all pages)
        lp.frequency.setTargetAtTime(350 + 250 * Math.sin(ts * 0.21), ctx.currentTime, 0.2);
        p.set((ts * 6) % 360, 20);    // 6°/s round the room, 20° up
      },
      dispose() { oscs.forEach((o) => o.stop(ctx.currentTime + 0.5)); },
    };
  },
};
