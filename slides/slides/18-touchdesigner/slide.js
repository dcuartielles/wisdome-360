import { ACT3, C, box, NOISE_GLSL } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'TouchDesigner',
  act: ACT3,
  notes: `<p>The fastest route to a live, interactive dome piece. The free non-commercial licence covers coursework.</p>
<ul><li>A <b>Camera COMP</b> leaning like the dome (Rotate X = 64) → <b>Render TOP</b> with Render Mode <b>Fish-Eye (180)</b>, 2048 × 2048 → a <b>Transform TOP</b> scaling 1.125 (180° → the venue's 160°). That's the whole trick.</li>
<li>EX-05's <code>03_build_dome_network.py</code> builds this network for you: run it in the Textport.</li>
<li>Our <b>EX-05</b> adds two GLSL TOPs: a guide overlay (band, rings, front) and an equirect → dome master converter for 360 footage.</li>
<li>Inputs: Audio Device In CHOP, Mouse In, OSC In (phones), Serial/Arduino (sensors).</li>
<li>Out: a <b>Null TOP</b> → a <b>Window COMP</b> fullscreen on the HDMI output (3840 × 2160, the square master in the middle). Sound: <b>Audio Device Out CHOP</b>, 6 channels to Dante.</li>
<li><b>Show the real network</b> (toggle) brings up a screenshot of the network the script builds, with its live dome master preview.</li>
<li>Fallback: <b>Movie File Out TOP</b>, H.264, 30 fps, square. Hand it in by Friday 08:00, with the films, so it can play if the live link fails.</li></ul>
<p>Place things by angle: a small Script DAT turns (azimuth, elevation, distance) into x, y, z (see EX-05 README).</p>`,
  params: { shot: { type: 'toggle', label: 'Show the real network', value: false } },
  video({ THREE, comp, AngleCanvas, view, base }) {
    const ac = new AngleCanvas();
    // two rows of boxes either side of the sweet spot, the title above, the file names low at the front
    const S = DOME.sweetSpot;
    ac.text('TouchDesigner', 0, S + 20, { size: 3.4, weight: 750, color: C.ink })
      .text('a live dome piece in one network', 0, S + 15, { size: 1.6, weight: 500, color: C.warm });
    const y1 = S + 6, y2 = S - 7, w = 22, h = 10;
    const top = [
      [-72, 'Geo COMPs', 'your scene, placed by angle'],
      [-44, 'Camera COMP', 'Rotate X 64, like the dome'],
      [-16, 'Render TOP', 'Fish-Eye (180) · 2048²'],
      [12, 'GLSL TOP', 'EX-05 guide overlay'],
      [40, 'Null TOP', 'the final picture'],
      [68, 'Window COMP', 'HDMI → the dome'],
    ];
    top.forEach(([az, t, s], i) => { box(ac, az, y1, w, h, t, s, i < 3 ? C.cool : C.warm); if (i) ac.arrow(az - 28 + w / 2 + 0.4, y1, az - w / 2 - 0.4, y1, { color: C.mute, width: 0.25 }); });
    const bot = [
      [-58, 'Audio Device In', 'room mic'],
      [-30, 'OSC In', 'phones'],
      [-2, 'Serial', 'Arduino, sensors'],
      [30, 'Audio Device Out', '6 ch → Dante'],
      [62, 'Movie File Out', 'fallback .mp4'],
    ];
    bot.forEach(([az, t, s], i) => box(ac, az, y2, w, h, t, s, i < 3 ? C.green : C.warm2));
    ac.text('inputs', -30, y2 - 7.5, { size: 1.1, color: C.green, weight: 600 })
      .text('outputs', 46, y2 - 7.5, { size: 1.1, color: C.warm2, weight: 600 })
      .text('outputs/06-examples/EX-05-touchdesigner  ·  03_build_dome_network.py  ·  01_domemaster_guide.glsl', 0, DOME.band[0] + 11, { size: 1.05, color: C.mute, weight: 450 })
      .commit();
    const shot = { tex: null, aspect: 1882 / 1113 };
    new THREE.TextureLoader().load(base + 'media/network.png', (t) => { t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 8; shot.tex = t; shot.aspect = t.image.width / t.image.height; mat.uniforms.uShot.value = t; mat.uniforms.uAspect.value = shot.aspect; mat.uniforms.uHas.value = 1; });
    const mat = comp.material(`${NOISE_GLSL}
      uniform sampler2D uShot; uniform float uK, uHas, uAspect;
      vec4 slideColor(vec3 room, vec3 local, vec2 m){
        vec3 c = houseSky(room, 0.8) + stars(room) * 0.3;
        vec4 e = sampleEq(uEq, room);
        c = mix(c, e.rgb, e.a);
        if (uHas > 0.5 && uK > 0.0) {
          c *= 1.0 - 0.75 * uK;                                   // dim the diagram behind
          vec2 uv = cardUV(room, dirRoom(0.0, ${(DOME.sweetSpot + 3).toFixed(2)}), 76.0, uAspect, 0.0);
          if (uv.x >= 0.0) c = mix(c, texture(uShot, uv).rgb, uK);
        }
        return vec4(c, 1.0);
      }`, { uEq: { value: ac.texture }, uShot: { value: null }, uK: { value: 0 }, uHas: { value: 0 }, uAspect: { value: shot.aspect } });
    let k = 0, last = null;
    return {
      render(t) {
        const dt = last === null ? 0 : Math.min(0.1, t - last); last = t;
        k += ((view.p('shot') ? 1 : 0) - k) * Math.min(1, dt * 4);
        mat.uniforms.uK.value = k;
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); shot.tex?.dispose(); },
    };
  },
};
