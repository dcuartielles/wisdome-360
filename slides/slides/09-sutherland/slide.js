import { makeRef } from '../_ref.js';
import { C } from '../_common.js';

export default makeRef({
  title: '1968 · The Sword of Damocles',
  year: '1968',
  name: 'The Sword of Damocles',
  who: 'Ivan Sutherland, with Bob Sproull and others',
  facts: [
    'The first head-mounted display driven by a computer',
    'A see-through stereo headset; the picture follows your head',
    'Tracked by a mechanical arm hanging from the ceiling, hence the name',
    'It showed simple wireframes: a cube floating in the room',
    'Paper: "A head-mounted three dimensional display", 1968',
  ],
  images: [
    { file: 'hmd.webm', caption: 'The 1968 demonstration: the headset on its ceiling arm', credit: 'Ivan E. Sutherland, 1968 · doi.org/10.1145/1476589.1476686' },
    { file: 'hmd_1.jpg', caption: 'The head-mounted display, Harvard University, 1968', credit: 'Photo © Mark Richards · Computer History Museum' },
    { file: 'hmd_2.jpg', caption: 'Side view: the mount for the arm that tracked the head', credit: 'Photo © Mark Richards · Computer History Museum' },
    { file: 'wireframe.jpg', caption: 'What the wearer saw' },
  ],
  accent: C.cool,
  notes: `<p>Start of the lineage: <b>immersion by putting the screen on the head</b>. Sutherland's 1965 essay "The Ultimate Display" imagined a room where the computer controls everything you see.</p>
<p>The first picture is the <b>1968 demonstration film</b> (21 s, loops). Its sound is off; press <b>🔊 Sound</b> to hear it.</p>
<p>The floating wireframe cube out to your left is a nod to his first demo.</p>
<p>Contrast with today: a headset isolates one person; <b>a dome is shared</b>. Sixty people, one picture, and you can see each other react.</p>`,
  extra(THREE, scene) {
    const g = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(3, 3, 3)), new THREE.LineBasicMaterial({ color: 0x9fe8ff }));
    g.position.set(-15, 3, -4); // to the left of the audience
    scene.add(g);
    return { update(t) { g.rotation.set(t * 0.21, t * 0.33, 0); }, dispose() { g.geometry.dispose(); g.material.dispose(); } };
  },
});
