import { ACT3, C, aboveRim, textSlideMaterial } from '../_common.js';
import { DOME } from '../../lib/dome.js';

// tools placed all the way round the room: the audience has to turn to read them
const GROUPS = [
  { az: 0, name: 'PICTURE · real time', col: C.warm, items: ['TouchDesigner', 'Unity + dome tools', 'Unreal Engine', 'three.js / WebGL', 'p5.js'] },
  { az: 72, name: 'PICTURE · rendered', col: C.warm2, items: ['Blender (Cycles fisheye)', 'Python + numpy', 'After Effects + plugins', 'ffmpeg (encode, check)'] },
  { az: 144, name: 'SOUND', col: C.cool, items: ['Pure Data (Miller Puckette)', 'Max', 'Reaper + spatial plugins', 'SuperCollider', 'IEM Plug-in Suite (ambisonics)'] },
  { az: -144, name: 'PIPES', col: C.cool2, items: ['OBS Studio (projector)', 'HDMI out, 3840 × 2160', 'Dante Virtual Soundcard', 'OSC (phones, sensors)'] },
  { az: -72, name: 'SKY + SCIENCE', col: C.green, items: ['OpenSpace', 'Stellarium', 'DigitalSky (the venue)', 'Our dome viewer for Quest 3'] },
];

export default {
  title: 'The toolbox, all around you',
  act: ACT3,
  notes: `<p>This slide uses <b>the whole room</b>: five groups of tools spaced 72° apart. People have to turn round to read it. Point that out.</p>
<ul><li><b>Sound</b>: Pure Data is Miller Puckette's open-source descendant of Max (he wrote both, Max at IRCAM, Pd at UC San Diego). Good for 5.1 panning and for listening to the room.</li>
<li><b>Pipes</b>: how a live piece reaches the dome (HDMI picture, Dante sound, OSC for phones).</li>
<li><b>Spin</b> rotates the ring so you can bring each group to the front while you talk about it.</li></ul>`,
  params: {
    spin: { type: 'select', label: 'Bring to the front', options: GROUPS.map((g, i) => ({ value: String(i), label: g.name.split(' ·')[0] })), value: '0' },
  },
  video({ comp, AngleCanvas, view }) {
    const ac = new AngleCanvas();
    let shown = null, rot = 0, target = 0;
    const S = DOME.sweetSpot;
    const draw = (offset) => {
      ac.clear();
      for (const g of GROUPS) {
        let az = ((g.az + offset + 540) % 360) - 180;
        // the group in front sits round the sweet spot; round the back each list is lifted so its last line clears the rim
        const listH = (g.items.length - 1) * 1.6 * 1.75;
        const top = aboveRim(az, S + 1, listH + 3);
        ac.text(g.name, az, top + 6, { size: 1.9, weight: 750, color: g.col, letter: 0.1 });
        ac.lines(g.items, az, top, { size: 1.6, gap: 1.75, weight: 500, color: '#e3e5e9' });
      }
      ac.text('Tools', 0, S + 15, { size: 2.6, weight: 750, color: C.ink, alpha: 0.9 });
      ac.commit();
    };
    const mat = textSlideMaterial(comp, ac);
    return {
      render(t, dt) {
        target = -GROUPS[Number(view.p('spin'))].az;
        let d = ((target - rot + 540) % 360) - 180;
        if (Math.abs(d) > 0.05) { rot += d * Math.min(1, dt * 2.2); draw(rot); shown = rot; }
        else if (shown === null) { rot = target; draw(rot); shown = rot; }
        return mat;
      },
      dispose() { mat.dispose(); ac.dispose(); },
    };
  },
};
