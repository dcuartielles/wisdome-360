import { ACT1, C, NOISE_GLSL } from '../_common.js';
import { DOME, DOME_ZENITH_EL, rimElevation, elToVenue } from '../../lib/dome.js';
import { drawSection, sectionImageURL } from '../_section.js';

export default {
  title: 'The dome in the room (side view)',
  act: ACT1,
  get notes() {
    let img = '';
    try { img = `<img src="${sectionImageURL(680)}" alt="side section of the tilted dome" style="width:100%;border-radius:8px;margin-bottom:10px">`; } catch {}
    return `${img}<p>A slice through the room, the front on the left.</p>
<ul><li>The dome is a hemisphere whose rim is <b>tilted ${DOME.venueTilt}°, raised at the back</b>, so its own top leans forward: the <b>dome zenith</b> is ${DOME_ZENITH_EL}° up, ahead of us, not overhead.</li>
<li>The venue projects <b>${DOME.opening}°</b> around that zenith: from ${Math.abs(Math.round(rimElevation(0)))}° <i>below</i> eye level at the front to ${Math.round(rimElevation(180))}° up behind us.</li>
<li>The seats rise towards the back, so everyone faces the same front. That is why our content has a <b>front</b>, unlike a flat planetarium.</li>
<li>Pink ticks: the <b>venue's own angles</b>, counted in the image: 0 at the front edge, 90 at the image centre. They are squeezed (90 of theirs on 80 real degrees) because the venue spreads the file over 160°.</li>
<li><b>Sweet spot</b>: their 40°, about <b>${Math.round(DOME.sweetSpot)}° above eye level</b> (eye level is their ${Math.round(elToVenue(0))}°). The <b>comfortable zone</b> around it (about ${Math.round(DOME.band[0])}–${Math.round(DOME.band[1])}° up, in front, ±${DOME.bandAz}° to the sides): where people can look for a long time without lifting or twisting their necks.</li></ul>
<p><b>Why the sweet spot is not in the middle of the comfortable zone</b> (no source says it directly; this is our reading):</p>
<ul><li><i>Yu, Neafus & Wyatt, "Filmmaking for Fulldome" (Planetarian, Dec 2016)</i> use the Gates Planetarium, Denver: tilted 25°, raked seats facing forward, almost our room. Their reference viewer sits with the head against the seat back and looks straight ahead.</li>
<li>That resting gaze lands about 25° above the front rim at 180, i.e. at about <b>eye level</b> (here: their ~18).</li>
<li>Vision reaches much further down than up: the field is about 180° × 110°, its lower edge about 40° below the front rim at 180, so its top is about <b>45° above eye level</b>. Content more than ~45° from the zenith is at the top edge of vision; beyond that people crane or twist.</li>
<li>The screen stops at the <b>rim at 160 (−16°)</b>. What is on screen <i>and</i> in view without moving the head runs from about −16° to +45°: its middle is about 15°, close to the venue's sweet spot (their 40 ≈ ${Math.round(DOME.sweetSpot)}° up). The sweet spot is the centre of the <i>visible screen</i>, not of the gaze.</li>
<li>Same paper: a projected horizon still looks right if it is lower than the viewer's own, or up to almost 30° above it.</li>
<li>Others: IMERSA "safe action" area ±50° to the sides, 10–60° up, nominal camera tilt 15°. UNC "When in Dome": flat dome sweet spot ~45° above the rim; tilted domes need content shifted 15–20° or it feels like "looking down a hill". Paul Bourke: planetarium viewing direction 30–40° above the far rim.</li>
<li>So our comfortable zone runs from the rim at the front (${Math.round(DOME.band[0])}°) to about ${Math.round(DOME.band[1])}° up. To confirm from the seats.</li></ul>
<p>PDFs: <code>ips-planetarium.org/page/fulldomeresources</code> (Planetarian Dec 2016 = Part I, Mar 2017 = Part II).</p>
<p>Drag <b>Tilt</b> from 0 to ${DOME.venueTilt}°, or switch on <b>Animate</b>, to show the dome swinging forward from a flat planetarium into this room.</p>`;
  },
  params: {
    tilt: { type: 'range', label: 'Tilt', min: 0, max: 45, step: 1, value: DOME.venueTilt, unit: '°' },
    animate: { type: 'toggle', label: 'Animate the tilt', value: false },
    image: { type: 'toggle', label: `Projected image (${DOME.opening}°)`, value: true },
    sweet: { type: 'toggle', label: 'Sweet spot (venue 40°)', value: true },
    venue: { type: 'toggle', label: "Venue's angle scale", value: true },
    band: { type: 'toggle', label: 'Comfortable band', value: true },
  },
  video({ THREE, comp, AngleCanvas, view }) {
    const cv = document.createElement('canvas'); cv.width = 1700; cv.height = 1300;
    const tex = new THREE.CanvasTexture(cv); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.anisotropy = 8;
    const ac = new AngleCanvas(2048);
    ac.text('The dome in the room', 0, 67, { size: 2.4, weight: 750, color: C.ink }).text('side view · front on the left', 0, 63.2, { size: 1.2, weight: 500, color: C.mute }).commit();
    let key = '';
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uImg;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.6) + stars(room) * 0.2;
        vec2 uv = cardUV(room, dirRoom(0.0, 30.0), 82.0, ${(1700 / 1300).toFixed(4)}, 0.0);
        if (uv.x >= 0.0) c = texture(uImg, uv).rgb;
        vec4 e = sampleEq(uEq, room); c = mix(c, e.rgb, e.a);
        return vec4(c, 1.0);
      }`, { uImg: { value: tex }, uEq: { value: ac.texture } });
    return {
      render(t) {
        let tilt = view.p('tilt');
        if (view.p('animate')) tilt = DOME.venueTilt * (0.5 - 0.5 * Math.cos(view.t() * 0.6));
        const k = `${tilt.toFixed(1)}|${view.p('image')}|${view.p('sweet')}|${view.p('band')}|${view.p('venue')}`;
        if (k !== key) { key = k; drawSection(cv, { tilt, image: view.p('image'), sweet: view.p('sweet'), band: view.p('band'), venue: view.p('venue') }); tex.needsUpdate = true; }
        return mat;
      },
      dispose() { mat.dispose(); tex.dispose(); ac.dispose(); },
    };
  },
};
