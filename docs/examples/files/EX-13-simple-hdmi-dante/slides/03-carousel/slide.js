// ═════════════════════════════════════════════════════════════════════════════════════════════
// DEMO SLIDE: PICTURES AND VIDEO ON A CAROUSEL
// A title and a few lines of text in front, with pictures on cards around the room. On the
// presenter, "Next picture" (or the ↓ key) turns the ring and brings the next card to the front,
// big. Videos play muted and looping; each video gets a 🔊 switch on the presenter.
//
// This slide is only DATA: the work is done by the template in ../_ref.js (makeRef).
// To make your own: copy this folder, put your files in its media/ folder, list them below.
// Stills: .jpg .png .webp · animated .gif · video: .mp4 (H.264) or .webm. Up to 6 items.
// A file that is missing shows as a card saying "picture goes here" with its name.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { makeRef } from '../_ref.js';
import { ACT_SHOW, C } from '../_common.js';

export default makeRef({
  title: 'Carousel: pictures and a video',   // name in the presenter's list
  act: ACT_SHOW,
  year: 'DEMO',                              // the big word on top (a year, a number, a label)
  name: 'Pictures around the room',          // the headline
  who: 'Edit 03-carousel/slide.js to make it yours',
  facts: [                                   // up to about 5 short lines under the headline
    'Each card is a flat screen hung in the room, facing the audience',
    'The dome bends it back: from the seats it looks straight',
    'Press Next picture (↓) to bring the next card to the front',
  ],
  images: [
    // file: name in media/ · caption: under the card · credit: small line under the caption (who made it, licence)
    { file: 'sample-1.png', caption: 'A still picture', credit: 'Sample image · CC BY-SA 4.0' },
    { file: 'sample-2.png', caption: 'Another one', credit: 'Sample image · CC BY-SA 4.0' },
    { file: 'sample-clip.webm', caption: 'A video (muted until you switch its sound on)', credit: 'Sample clip · CC BY-SA 4.0' },
    { file: 'sample-3.png', caption: 'A third picture', credit: 'Sample image · CC BY-SA 4.0' },
  ],
  accent: C.cool,                            // colour of the big word and the captions
  layout: 'overview',                        // or 'carousel' to start with one big picture in front
  notes: `<p>Pictures on cards around the room. <b>↓</b> or a click on the preview: next picture. <b>↑</b> or shift-click: previous.</p>`,
});
