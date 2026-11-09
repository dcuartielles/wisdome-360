import { makeRef } from '../_ref.js';
import { ACT3, C } from '../_common.js';

export default makeRef({
  title: 'Open content for domes',
  act: ACT3,
  layout: 'carousel',
  year: 'Open content',
  name: 'Fulldome material you can use',
  who: 'licences differ: CC BY · CC0 · public domain · free to screen only',
  facts: [
    'ESO: fulldome clips, shows, panoramas, music, live fisheye webcams · CC BY 4.0',
    'ESA/Hubble: fulldome movies as dome-master frames',
    'Free to screen: From Earth to the Universe · Losing the Dark · ESA Webb',
    'NASA SVS: dome versions of visualisations · Poly Haven: CC0 360° photos',
    'Sound: Freesound (CC0 / CC BY) · RØDE ambisonic library',
  ],
  images: [
    { file: 'eso-planetarium.png', caption: 'ESO for planetariums · CC BY 4.0' },
    { file: 'esa-hubble-fulldome.png', caption: 'ESA/Hubble fulldome archive' },
    { file: 'free-shows.png', caption: 'Free shows to screen, not to remix' },
    { file: 'nasa-svs.png', caption: 'NASA Scientific Visualization Studio' },
    { file: 'poly-haven.png', caption: 'Poly Haven · CC0 360° photographs' },
    { file: 'sound.png', caption: 'Sound and pictures · Freesound, RØDE, Commons' },
  ],
  accent: C.green,
  notes: `<p>Where students can get material they are allowed to use — and what each licence lets them do.</p>
<ul><li><b>CC BY 4.0 (ESO)</b>: use and remix, with the credit <b>visible in the picture</b> or at the end of the film. A YouTube-style description is not enough.</li>
<li><b>CC BY-ND</b> (some ESO shows, e.g. <i>Waiting Far Away</i>): show it, don't change it.</li>
<li><b>CC0 (Poly Haven, many Freesound files)</b>: anything, no credit needed (but credit anyway).</li>
<li><b>Public domain (most NASA material)</b>: free, but keep NASA's credit and check the music.</li>
<li><b>Free to screen</b> (From Earth to the Universe, Losing the Dark, ESA Webb): show as is, no editing.</li></ul>
<p>Poly Haven's 360° photos become dome masters with the EX-05 equirect shader or one ffmpeg line (<code>v360=input=e:output=fisheye:h_fov=160:v_fov=160:pitch=64</code> turns the 360° photo so the centre of the master is 64° up in front, as in Wisdome, at the venue's 160°: the front horizon lands 16° inside the bottom edge, at eye level).</p>
<p>The full list with links and credit lines is in <code>live/media-sources.csv</code> and <code>media-to-collect.xlsx</code>. The next slide plays three of them.</p>`,
});
