import { makeRef } from '../_ref.js';
import { C } from '../_common.js';

export default makeRef({
  title: 'Sphere · Las Vegas',
  year: '2023',
  name: 'Sphere, Las Vegas',
  who: 'Opened September 2023 · 17,600 seats',
  facts: [
    'An LED screen instead of projectors: about 16K × 16K inside',
    'About 15,000 m² of screen, wrapping up and over the audience',
    'Sound from behind the screen: about 1,600 Holoplot speaker cabinets,',
    '     167,000 drivers, beams of sound steered to parts of the audience',
    'Films are shot with custom large-format cameras made for the dome',
  ],
  images: [
    { file: 'sphere-inside.jpg', caption: 'Inside the bowl', credit: 'U2 at Sphere, 2023 · Paul White, Wikimedia Commons' },
    { file: 'sphere-outside.jpg', caption: 'The outside is a screen too', credit: 'Wikimedia Commons' },
  ],
  accent: C.warm2,
  notes: `<p>The commercial extreme of the same idea, and still the same rules: a <b>front</b>, a comfortable band, slow camera moves, and sound that comes from where the picture is.</p>
<p>Our dome is 11.6 m and 58 seats. The maths of the fisheye is the same; only the pixel count changes.</p>`,
});
