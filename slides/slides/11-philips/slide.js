import { makeRef } from '../_ref.js';
import { C } from '../_common.js';

export default makeRef({
  title: '1958 · Philips Pavilion, Poème électronique',
  year: '1958',
  name: 'Philips Pavilion · Poème électronique',
  who: 'Le Corbusier, Iannis Xenakis, Edgard Varèse · Expo 58, Brussels',
  facts: [
    'A tent of hyperbolic paraboloids, designed by Xenakis for Le Corbusier',
    'Varèse\'s 8-minute tape piece travelled along "sound routes"',
    'Hundreds of loudspeakers in the walls, with projected images and coloured light',
    'Around two million visitors; the building was demolished after the fair',
  ],
  images: [
    { file: 'pavilion.jpg', caption: 'The pavilion, 1958' },
    { file: 'interior.mp4', caption: 'Inside: projections and speakers' },
    { file: 'show-colour.jpg', caption: 'During the show: coloured light over the audience', credit: 'Philips Pavilion, Expo 58' },
    { file: 'show-projection.jpg', caption: 'During the show: projected images on the walls', credit: 'Philips Pavilion, Expo 58' },
    { file: 'poeme-electronique.mp4', caption: 'Poème électronique: the film shown inside', credit: 'Le Corbusier (images), Edgard Varèse (music), 1958' },
    { file: 'xenakis-sketch.jpg', caption: 'Xenakis: geometry of the shell', credit: 'Iannis Xenakis, sketches for the pavilion' },
  ],
  accent: C.warm,
  notes: `<p>The first <b>building designed around moving sound</b>. Sound placed and moved through space as part of the composition, the same idea as our 5.1 comet, at a far larger scale.</p>
<p>It ties architecture, image and sound together: the theme of this week.</p>`,
});
