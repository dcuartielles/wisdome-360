import { ACT4, C, box, textSlideMaterial } from '../_common.js';
import { DOME } from '../../lib/dome.js';

export default {
  title: 'The room in the loop',
  act: ACT4,
  notes: `<p>Where this is going (to build later, if there's time):</p>
<ul><li><b>Phones</b>: join a local Wi-Fi, open a web page, tilt or tap. The same server that runs these slides relays it.</li>
<li><b>Microphone</b>: the room's noise drives the picture (you saw it already).</li>
<li><b>Camera</b>: count people, follow movement, put the audience in the dome.</li>
<li><b>Bluetooth / sensors</b>: Arduino boards sending OSC or serial.</li></ul>
<p>Hard rule for interactive pieces: <b>a recorded fallback</b>, and measure the latency at the dry run.</p>`,
  params: {},
  video({ comp, AngleCanvas }) {
    const ac = new AngleCanvas();
    const S = DOME.sweetSpot, y = S + 1;   // the boxes on the sweet spot, the title above, the line under them
    ac.text('The room in the loop', 0, S + 17, { size: 3.2, weight: 750, color: C.ink })
      .text('the audience as an input', 0, S + 12, { size: 1.6, weight: 500, color: C.warm });
    box(ac, -60, y, 26, 13, 'PHONES', ['local Wi-Fi + a web page', 'tilt, tap, vote'], C.cool);
    box(ac, -20, y, 26, 13, 'MICROPHONE', ['the room\'s sound', 'drives the picture'], C.green);
    box(ac, 20, y, 26, 13, 'CAMERA', ['presence, movement', 'faces in the dome'], C.warm);
    box(ac, 60, y, 26, 13, 'SENSORS', ['Arduino, Bluetooth', 'OSC / serial'], C.warm2);
    ac.text('one server  ·  one shared state  ·  picture and sound follow it', 0, y - 14, { size: 1.3, color: C.mute, weight: 500 })
      .commit();
    const mat = textSlideMaterial(comp, ac);
    return { render: () => mat, dispose() { mat.dispose(); ac.dispose(); } };
  },
};
