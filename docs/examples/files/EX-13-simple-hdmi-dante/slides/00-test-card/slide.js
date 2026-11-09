// ═════════════════════════════════════════════════════════════════════════════════════════════
// DEMO SLIDE: TEST IMAGE
// Shows where the front is, the compass directions, colour and grey bars at the sweet spot,
// the five speakers, and a "Speaker ident" button that plays pink noise from each speaker in turn.
// Use it first thing in the venue (or at home with the browser rehearsal view) to check that
// picture and sound point the same way.
//
// Every slide is a JavaScript module that exports ONE object with:
//   title, act, notes        what the presenter page shows
//   params                   controls on the presenter page (sliders, toggles, buttons, menus)
//   video(ctx)               builds the picture; returns { render(t), dispose() }
//   audio(ctx)               (optional) builds the sound; returns { update(t), dispose() }
// Picture and sound run on DIFFERENT pages (often different computers), so they never talk to
// each other directly: both read the same shared state through `view` (see below).
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { ACT_CHECK, C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers } from '../_common.js';
import { DOME, rimElevation, venueToEl } from '../../lib/dome.js';
import { identSchedule, playIdent } from '../../lib/audio51.js';

export default {
  title: 'Test card + speaker ident',
  act: ACT_CHECK,

  // Notes appear on the presenter page next to the preview. HTML is allowed.
  // (A getter, "get notes()", lets the text use numbers computed from the venue settings.)
  get notes() { return `<p>Check with the technician:</p>
<ul><li>Is <b>FRONT</b> (red) really at the front of the room? If not, open the picture page with <code>?front=top</code>, <code>left</code> or <code>right</code>.</li>
<li>Does the red rim circle sit where the screen ends? The venue spreads the whole file over ${DOME.venueFov}°.</li>
<li>The gold circle is the sweet spot, about ${Math.round(DOME.sweetSpot)}° above eye level, straight ahead. Put your main things near it.</li>
<li>Press <b>Speaker ident</b> and walk the room: L, C, R, Rs, Ls, LFE.</li></ul>`; },

  // Controls on the presenter page. Types: 'range' (slider), 'toggle', 'select', 'button'.
  // A button doesn't hold a value: the slide asks "when was it last pressed?" (see render below).
  params: { ident: { type: 'button', label: 'Speaker ident (pink noise)' } },

  // ─── PICTURE ────────────────────────────────────────────────────────────────────────────────
  // ctx gives you: THREE (three.js), comp (the dome renderer), AngleCanvas (text and shapes
  // placed by angle), view (the shared state), base (this slide's folder URL, for media files).
  video({ THREE, comp, AngleCanvas, view }) {
    const spk = speakerUniforms(THREE);     // where the 5 speakers are, as shader inputs

    // AngleCanvas = a transparent "wallpaper" around the whole room. You write on it by
    // AZIMUTH (0 = straight ahead, + to the right, ±180 behind) and ELEVATION (0 = eye level,
    // 90 = straight up), with sizes in degrees. Then commit() uploads it to the graphics card.
    const ac = new AngleCanvas();
    const NAMES = { 0: 'FRONT 0°', 45: 'R 45°', 90: 'RIGHT 90°', 135: 'R 135°', [-45]: 'L 45°', [-90]: 'LEFT 90°', [-135]: 'L 135°', [-180]: 'BACK 180°' };
    for (let a = -180; a < 180; a += 45) {
      // rimElevation(az) = where the picture ends at that azimuth (the dome is tilted, so the
      // edge is low in front and high behind). Keep text a few degrees above it.
      ac.text(NAMES[a], a, Math.max(rimElevation(a) + 4, 6), { size: 1.6, weight: 700, color: a === 0 ? C.red : C.ink });
    }
    ac.text(`master ${DOME.res}² · ${DOME.fisheyeFov}° fisheye · dome tilted ${DOME.tilt}°`, 0, DOME.sweetSpot + 27, { size: 1.3, color: C.mute, weight: 500 });
    // the venue's own scale (0 at the screen edge, 90 at the centre of the file), up the front
    for (let a = 0; a <= 90; a += 10) {
      const el = venueToEl(a); if (el < rimElevation(0) + 0.5) continue;
      ac.text(`${a}`, -3, el + 1.1, { size: 1.1, weight: 700, color: '#ff73d9', align: 'right' });
    }
    labelSpeakers(ac, spk.places);
    ac.commit();

    // The picture itself is ONE small GLSL function, slideColor(), run for every pixel of the
    // dome. It receives the direction that pixel looks at:
    //   room   unit vector in the room (x right, y front, z up)  ← use this to place things
    //   local  the same direction in the dome's own (tilted) frame
    //   m      the pixel's position in the square master file, -1..1 (y up)
    // Helpers available in every shader: azOf(room), elOf(room) (degrees), dirRoom(az, el),
    // angleBetween(a, b) (degrees), cardUV(room, centre, widthDeg, aspect, rollDeg) (a flat card
    // in the room: returns 0..1 inside it, -1 outside), sampleEq(uEq, room) (your AngleCanvas).
    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform float uBarsEl;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.02);                                       // near-black background
        vec2 uv = cardUV(room, dirRoom(0.0, uBarsEl), 40.0, 4.0, 0.0);   // a 40°-wide card, 4:1
        if (uv.x >= 0.0) {                                         // inside the card: colour + grey bars
          float i = floor(uv.x * 8.0);
          vec3 bars[8] = vec3[8](vec3(1.0), vec3(1.0,1.0,0.0), vec3(0.0,1.0,1.0), vec3(0.0,1.0,0.0), vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), vec3(0.0,0.0,1.0), vec3(0.0));
          c = uv.y > 0.35 ? bars[int(i)] * 0.75 : vec3(floor(uv.x * 11.0) / 10.0);
        }
        c = drawSpeakers(c, room);                                 // the 5 speaker rings
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);      // the text on top
        return vec4(c, 1.0);
      }`, { ...spk.uniforms, uEq: { value: ac.texture }, uBarsEl: { value: DOME.sweetSpot + 15 } });

    return {
      // the engine's own overlays for this slide: rings every 10°, the rim, the sweet spot, the venue's scale
      guides: { rings: 1, rim: 1, band: 0, sweet: 1, venue: 1 },
      // render(t) runs every frame (t = shared clock, in seconds) and returns the material to draw.
      render(t) {
        // light up the speaker ring that is playing the ident right now
        const g = new Float32Array(6);
        for (const s of identSchedule(view.lastPress('ident'))) if (t >= s.t0 && t < s.t1) g[s.ch] = 1;
        spk.setFromGains(mat.uniforms, g);
        return mat;
      },
      // free GPU memory when the slide changes
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },

  // ─── SOUND ──────────────────────────────────────────────────────────────────────────────────
  // ctx gives you: group (this slide's 6-channel output: group.panner(), group.noise(), ...),
  // ctx (the Web Audio context), view (the same shared state), ctxTime(t) (shared clock → audio clock).
  audio({ group, view, ctxTime }) {
    const played = new Set();
    return {
      // update(t) runs about 30 times a second on the sound page.
      // view.presses('ident') lists every time the button was pressed: play each press once,
      // at the exact moment it happened (ctxTime converts it), so picture and sound stay in step.
      update() { for (const at of view.presses('ident')) if (!played.has(at)) { played.add(at); playIdent(group, ctxTime(at)); } },
    };
  },
};
