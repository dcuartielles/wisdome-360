import { ACT1, C, NOISE_GLSL, SPEAKER_GLSL, speakerUniforms, labelSpeakers } from '../_common.js';
import { DOME, DOME_ZENITH_EL, rimElevation, elToVenue } from '../../lib/dome.js';

const r0 = (x) => Math.round(x);
import { identSchedule, playIdent, IDENT_ORDER } from '../../lib/audio51.js';

export default {
  title: 'Meet the dome',
  act: ACT1,
  get notes() { return `<p>Switch the layers on one at a time.</p>
<ul><li><b>Rings and spokes</b>: every 15° of elevation, every 30° around. Orange line = the room's horizon.</li>
<li><b>Tilt</b>: the dome is tilted <b>${DOME.venueTilt}°</b>, raised at the back. Its zenith (the centre of the image, the venue's 90°) is ahead of us at ${DOME_ZENITH_EL}°, not overhead. Below the horizon at the front, about ${Math.round(-rimElevation(0))}° of picture; behind us it stops at ${Math.round(rimElevation(180))}°.</li>
<li><b>Rim</b> (red line): the venue's word for where the screen ends, the <b>rim at ${DOME.opening}</b>. (The full hemisphere's rim, at 180, is out of the screen.) The venue spreads the whole file over these ${DOME.opening}°: a 180° file is squeezed into 160°, so we render at 160°.</li>
<li><b>Venue scale</b> (pink rings): the venue's own angles, 0 at the rim, 90 at the image centre, every 10. Their 40 is the thick one.</li>
<li><b>Sweet spot</b> (gold): the venue's <b>40°</b> on their scale, which is straight ahead, about <b>${r0(DOME.sweetSpot)}° above eye level</b>. Eye level is their ${r0(elToVenue(0))}°.</li>
<li><b>Comfortable zone</b> (green): <b>in front</b>, about ${r0(DOME.band[0])}–${r0(DOME.band[1])}° up and ${DOME.bandAz}° to either side, from the rim at the front up to about 45°, around the sweet spot. Faces stay forward, necks don't have to lift or twist for long. Main content goes here; the sides, the back and the top are for atmosphere and moments when you ask people to turn. (From the Planetarian guide's tilted dome: what is on screen and in view without lifting the head. Check it from the seats.)</li></ul>
<p>Then press <b>Speaker ident</b>: pink noise walks L → C → R → Rs → Ls → LFE, and the speaker lights up where it plays.</p>`; },
  params: {
    rings: { type: 'toggle', label: 'Rings and spokes', value: true },
    rim: { type: 'toggle', label: 'Rim at 160 + front', value: true },
    band: { type: 'toggle', label: 'Comfortable zone (in front)', value: false },
    sweet: { type: 'toggle', label: 'Sweet spot (venue 40°)', value: false },
    vscale: { type: 'toggle', label: "Venue scale (their angles)", value: false },
    labels: { type: 'toggle', label: 'Labels', value: true },
    speakers: { type: 'toggle', label: 'Speakers', value: true },
    ident: { type: 'button', label: 'Speaker ident (pink noise)', hint: 'L, C, R, Rs, Ls, then LFE, one second each' },
  },

  video({ THREE, comp, AngleCanvas, view }) {
    const spk = speakerUniforms(THREE);
    const ac = new AngleCanvas();
    const L = { size: 1.7, color: C.ink, weight: 650 };
    ac.text('FRONT', 0, rimElevation(0) + 5, { ...L, size: 2.4, color: C.red })
      .text('LEFT', -90, 18, L).text('RIGHT', 90, 18, L)
      .text('BEHIND YOU', 180, rimElevation(180) + 8, { ...L, color: C.cool })
      .text('dome zenith', 0, DOME_ZENITH_EL + 3.2, { ...L, size: 1.3, color: C.warm })
      .text(`tilted ${DOME.venueTilt}°, raised at the back`, 0, DOME_ZENITH_EL + 6.3, { size: 1.1, color: C.mute, weight: 500 })
      .text('room zenith', 180, 86, { ...L, size: 1.3, color: C.cool })
      .text(`rim at ${DOME.opening}`, 40, rimElevation(40) + 2.5, { size: 1.2, color: C.red, weight: 600 });
    for (let e = 0; e <= 75; e += 15) ac.text(`${e}°`, 7, e + 1.3, { size: 1.15, color: '#9fb4ff', weight: 600, align: 'left' });
    const [b0, b1] = DOME.band, sw = DOME.sweetSpot;
    ac.text('comfortable zone', -40, b1 - 3, { size: 1.4, color: C.green, weight: 650 }).text(`${r0(b0)}°–${r0(b1)}° up · ±${DOME.bandAz}° to the sides`, -40, b1 - 5.8, { size: 1.0, color: C.green, weight: 500 })
      .text('sweet spot', 0, sw - 4.5, { size: 1.3, color: '#ffd76a', weight: 650 }).text(`venue 40° · ${r0(sw)}° up`, 0, sw - 7.4, { size: 0.95, color: '#ffd76a', weight: 500 })
      .text('Astro-Tec 11.6 m tilted dome  ·  58 seats  ·  5 projectors  ·  5.1 sound', 0, 8, { size: 1.15, color: C.mute, weight: 500 });
    labelSpeakers(ac, spk.places);
    ac.commit();

    const mat = comp.material(`${NOISE_GLSL}${SPEAKER_GLSL}
      uniform float uLabels, uSpk, uTiltMark;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.7) + stars(room) * 0.25;
        // dome zenith and room zenith marks
        float dz = angleBetween(room, localToRoom(vec3(0.0, 0.0, 1.0)));
        c = mix(c, vec3(1.0, 0.7, 0.3), aaLine(dz - 1.4, 0.3) + (1.0 - smoothstep(0.3, 0.5, dz)));
        float rz = angleBetween(room, vec3(0.0, 0.0, 1.0));
        c = mix(c, vec3(0.42, 0.78, 1.0), aaLine(rz - 1.4, 0.3) + (1.0 - smoothstep(0.3, 0.5, rz)));
        if (uSpk > 0.5) c = drawSpeakers(c, room);
        vec4 e = sampleEq(uEq, room);
        c = mix(c, e.rgb, e.a * uLabels);
        return vec4(c, 1.0);
      }`, { ...spk.uniforms, uEq: { value: ac.texture }, uLabels: { value: 1 }, uSpk: { value: 1 }, uTiltMark: { value: 1 } });

    const inst = {
      guides: {},
      render(t) {
        const u = mat.uniforms;
        inst.guides = { rings: view.p('rings'), rim: view.p('rim'), band: view.p('band'), sweet: view.p('sweet'), venue: view.p('vscale') };
        u.uLabels.value = view.p('labels') ? 1 : 0;
        u.uSpk.value = view.p('speakers') ? 1 : 0;
        // ident: light the speaker that is playing
        const g = new Float32Array(6);
        const start = view.lastPress('ident');
        for (const s of identSchedule(start)) if (t >= s.t0 && t < s.t1) g[s.ch] = 1;
        spk.setFromGains(u, g);
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
    return inst;
  },

  audio({ group, view, ctxTime }) {
    let played = new Set();
    return {
      update() {
        for (const at of view.presses('ident')) {
          if (played.has(at)) continue;
          played.add(at);
          playIdent(group, ctxTime(at));
        }
      },
    };
  },
};
export { IDENT_ORDER };
