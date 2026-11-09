import { ACT3, C, box, textSlideMaterial } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'From an idea to the dome',
  act: ACT3,
  notes: `<p>Every tool this week ends in the same place: <b>a square fisheye picture</b> (the dome master) plus <b>six channels of sound</b>.</p>
<ul><li><b>Track A</b>: render a file. 2048 × 2048 dome master at 30 fps, plus 6 WAVs. It goes into one reel.</li>
<li><b>Track B</b>: run it live from your laptop. Picture over HDMI (3840 × 2160, the square master in the middle), sound over Dante, exactly the way these slides reach the dome. If Dante fails, HDMI carries stereo.</li></ul>
<p>Three ways to get a fisheye: a <b>fisheye camera</b> in the 3D tool, render a <b>cube map</b> and convert, or shoot/render <b>equirectangular 360</b> and convert. These slides use the cube map route.</p>`,
  params: {},
  video({ comp, AngleCanvas }) {
    const ac = new AngleCanvas();
    const S = DOME.sweetSpot;   // the row of boxes on the sweet spot, the title above, the five decisions under it
    ac.text('From an idea to the dome', 0, S + 18, { size: 3.2, weight: 750, color: C.ink })
      .text('compose by angle, not by pixel', 0, S + 13, { size: 1.6, weight: 500, color: C.warm });
    const y = S, h = 15;
    box(ac, -66, y, 30, h, 'MAKE', ['Blender · TouchDesigner', 'Unity · Unreal · p5.js', 'GLSL · Python · OpenSpace'], C.cool);
    box(ac, -22, y, 30, h, 'CAPTURE', ['fisheye camera, 180°', 'or cube map → fisheye', 'or 360 equirect → fisheye'], C.cool2);
    box(ac, 22, y, 30, h, 'DELIVER', ['Track A: 2048² master + 6 WAV', 'Track B: HDMI picture', '+ Dante 5.1 sound'], C.warm);
    box(ac, 66, y, 30, h, 'THE DOME', ['DarkMatter media server', '5 projectors · 160°', '5.1 speakers'], C.warm2);
    for (const a of [-49, -5, 39]) ac.arrow(a + 0.5, y, a + 4.5, y, { color: C.mute, width: 0.3, head: 1.4 });
    ac.text('the five decisions in every example', 0, S - 11.5, { size: 1.3, weight: 650, color: C.mute, letter: 0.1 })
      .text('near-black field  ·  content in front, around the sweet spot  ·  warm front, cool back  ·  texture, not content, at the zenith  ·  slow motion, zero roll', 0, S - 15, { size: 1.15, weight: 450, color: '#d5d8de' })
      .commit();
    const mat = textSlideMaterial(comp, ac);
    return { render: () => mat, dispose() { mat.dispose(); ac.dispose(); } };
  },
};
