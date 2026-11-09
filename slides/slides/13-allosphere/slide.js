import { makeRef } from '../_ref.js';
import { C } from '../_common.js';

export default makeRef({
  title: 'The AlloSphere · UC Santa Barbara',
  year: '2007 →',
  name: 'The AlloSphere',
  who: 'JoAnn Kuchera-Morin · California NanoSystems Institute, UC Santa Barbara',
  facts: [
    'A sphere 10 m across, made of perforated aluminium',
    'Inside a three-storey cube: one of the largest near-anechoic chambers',
    'A bridge through the middle: up to 30 people stand inside the picture',
    'Stereoscopic projection all round, and 54.1 channels of sound',
    'Built for science and art together: data you can walk into and hear',
  ],
  images: [
    { file: 'allosphere-bridge.jpg', caption: 'The bridge through the sphere', credit: 'AlloSphere, UC Santa Barbara' },
    { file: 'allosphere-data.jpg', caption: 'Inside: the sphere as a stage', credit: 'AlloSphere, UC Santa Barbara' },
  ],
  accent: C.cool,
  notes: `<p>The "full" version of what we have: <b>picture and sound in every direction, including below</b>. The bridge puts the audience in the centre of the sphere.</p>
<p>Note: the AlloSphere is at <b>UC Santa Barbara</b> (Media Arts and Technology). Miller Puckette, author of Max and Pure Data, is at <b>UC San Diego</b>; he comes up on the tools slide.</p>
<p>Its sound system is a reminder of how far beyond 5.1 a room can go. Our dome: 6 channels. The AlloSphere: 54.1.</p>`,
});
