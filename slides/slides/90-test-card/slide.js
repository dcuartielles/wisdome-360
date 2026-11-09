import { ACTX, C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers } from '../_common.js';
import { DOME, rimElevation, venueToEl } from '../../lib/dome.js';
import { identSchedule, playIdent } from '../../lib/audio51.js';

export default {
  title: 'Test card + speaker ident',
  act: ACTX,
  get notes() { return `<p>For the venue test. Check with the technician:</p>
<ul><li>Is <b>FRONT</b> (red, at the bottom edge of the master) really at the front of the room? If not, restart the video page with <code>?front=top|left|right</code> and fix <code>lib/dome.js</code>.</li>
<li>Is the red circle (the rim at ${DOME.opening}) right where the screen ends? It should be: the venue spreads the whole file over ${DOME.venueFov}°, and we render at ${DOME.fisheyeFov}°.</li>
<li><b>Pink rings</b> = the venue's own angles (0 at the rim, 90 at the centre, every 10; their 40 is thick). Hold them against Paul Bourke's test pattern on the venue's player: they should match ring for ring. The <b>gold circle</b> is their 40° sweet spot (about ${Math.round(DOME.sweetSpot)}° up), the <b>orange line</b> eye level.</li>
<li>To show the mistake: Projection panel → <i>180° file (Blender default)</i>. The blue rings, labels and bars slide towards the centre; the pink rings stay.</li>
<li>Are the rings round and evenly spaced? (Mapping check.)</li>
<li>Press <b>Speaker ident</b> and walk the room: L, C, R, Rs, Ls, LFE.</li></ul>`; },
  params: { ident: { type: 'button', label: 'Speaker ident (pink noise)' } },
  video({ THREE, comp, AngleCanvas, view }) {
    const spk = speakerUniforms(THREE);
    const ac = new AngleCanvas();
    for (let a = -180; a < 180; a += 45) {
      const name = { 0: 'FRONT 0°', 45: 'R 45°', 90: 'RIGHT 90°', 135: 'R 135°', [-45]: 'L 45°', [-90]: 'LEFT 90°', [-135]: 'L 135°', [-180]: 'BACK 180°' }[a];
      ac.text(name, a, Math.max(rimElevation(a) + 4, 6), { size: 1.6, weight: 700, color: a === 0 ? C.red : C.ink });
    }
    ac.text(`master ${DOME.res}² · file ${DOME.fisheyeFov}° for tilt ${DOME.tilt}° · venue spreads it over ${DOME.venueFov}° · tilt ${DOME.venueTilt}° · front = ${DOME.front} edge`, 0, DOME.sweetSpot + 27, { size: 1.3, color: C.mute, weight: 500 });
    // the venue's scale, labelled up the front meridian (pink rings come from the guides)
    for (let a = 0; a <= 90; a += 10) {
      const el = venueToEl(a); if (el < rimElevation(0) + 0.5) continue;
      ac.text(`${a}`, -3, el + 1.1, { size: a === DOME.sweetVenue ? 1.5 : 1.1, weight: 700, color: '#ff73d9', align: 'right' });
    }
    ac.text("venue's angles", -3, venueToEl(85) + 1.1, { size: 0.9, weight: 600, color: '#ff73d9', align: 'right' });
    labelSpeakers(ac, spk.places);
    ac.commit();
    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform float uBarsEl;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = vec3(0.02);
        // colour + grey bars at the sweet spot
        vec2 uv = cardUV(room, dirRoom(0.0, uBarsEl), 40.0, 4.0, 0.0);
        if (uv.x >= 0.0) {
          float i = floor(uv.x * 8.0);
          vec3 bars[8] = vec3[8](vec3(1.0), vec3(1.0,1.0,0.0), vec3(0.0,1.0,1.0), vec3(0.0,1.0,0.0), vec3(1.0,0.0,1.0), vec3(1.0,0.0,0.0), vec3(0.0,0.0,1.0), vec3(0.0));
          c = uv.y > 0.35 ? bars[int(i)] * 0.75 : vec3(floor(uv.x * 11.0) / 10.0);
        }
        // master-space checks: centre cross + square border of the file
        c = mix(c, vec3(0.8), aaLine(m.x, 0.003) * step(abs(m.y), 0.06) + aaLine(m.y, 0.003) * step(abs(m.x), 0.06));
        c = drawSpeakers(c, room);
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { ...spk.uniforms, uEq: { value: ac.texture }, uBarsEl: { value: DOME.sweetSpot + 15 } });
    return {
      guides: { rings: 1, rim: 1, band: 0, sweet: 1, venue: 1 },
      render(t) {
        const g = new Float32Array(6);
        for (const s of identSchedule(view.lastPress('ident'))) if (t >= s.t0 && t < s.t1) g[s.ch] = 1;
        spk.setFromGains(mat.uniforms, g);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
  audio({ group, view, ctxTime }) {
    const played = new Set();
    return { update() { for (const at of view.presses('ident')) if (!played.has(at)) { played.add(at); playIdent(group, ctxTime(at)); } } };
  },
};
