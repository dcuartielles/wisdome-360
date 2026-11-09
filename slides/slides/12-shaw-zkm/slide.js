import { makeRef } from '../_ref.js';
import { C } from '../_common.js';

export default makeRef({
  title: 'Jeffrey Shaw · ZKM Karlsruhe',
  year: '1993–97',
  name: 'Jeffrey Shaw at ZKM',
  who: 'Founding director, ZKM Institute for Visual Media, Karlsruhe (1991–2002)',
  facts: [
    'EVE, Extended Virtual Environment (1993): a dome where the projection follows your head',
    'PLACE – a user\'s manual (1995): a 360° round screen, a rotating platform,',
    '     a camera you steer through panoramic photographs of real places',
    'conFiguring the CAVE (1997) · Panoramic Navigator (1997)',
    'Later: iCinema, UNSW Sydney: AVIE, a 360° stereoscopic screen; PLACE-Hampi',
  ],
  images: [
    { file: 'place-users-manual.jpg', caption: 'PLACE – a user\'s manual, 1995', credit: 'Jeffrey Shaw · via scanlines.net' },
    { file: 'eve.jpg', caption: 'EVE, 1993', credit: 'Jeffrey Shaw' },
    { file: 'avie.jpg', caption: 'AVIE, iCinema · T_Visionarium II', credit: 'iCinema, UNSW' },
  ],
  accent: C.warm,
  notes: `<p>Shaw treats the panorama as an <b>interface</b>: the visitor chooses where to look and where to go, and the image answers. That is our Track B: interactive work in the dome.</p>
<p>Also at ZKM: the <b>Klangdom</b>, a dome of loudspeakers with the Zirkonium software for spatial sound. Worth a look for the audio-led teams.</p>
<p>Since 2009 Shaw has been at City University of Hong Kong (School of Creative Media).</p>`,
});
