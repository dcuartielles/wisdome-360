// ═════════════════════════════════════════════════════════════════════════════════════════════
// START HERE: the slide to practise on.
// Words, a picture, a dot that circles the room and a sound that follows the dot.
// Change a value below, SAVE (Ctrl+S, on a Mac ⌘S), then RELOAD the browser page (F5, ⌘R).
//
// Places are given as two angles, in degrees:
//   az (azimuth)    0 = straight ahead · 90 = right · -90 = left · 180 = behind you
//   el (elevation)  0 = eye level · 90 = straight up. The best place is the sweet spot,
//                   about 20° up, straight ahead (dome.sweetSpot).
// Sizes are in degrees too. A letter should be at least 1.5° tall to be read from every seat.
//
// Colours: a name in quotes ('white', 'tomato', 'gold') or a code ('#ffb547').
// Lines starting with // are comments: the computer skips them.
// ═════════════════════════════════════════════════════════════════════════════════════════════
import { simpleSlide, C } from '../_simple.js';

// ── 1. The words ────────────────────────────────────────────────────────────────────────────
const TITLE = 'Hello, dome';
const SUBTITLE = 'Change these words in slides/start-here/slide.js';
const TITLE_COLOUR = '#ffb547';      // try 'tomato' or '#6cc6ff'
const TITLE_SIZE = 4;                // letter height in degrees

// ── 2. The picture (a file in this slide's media/ folder) ──────────────────────────────────
const PICTURE = 'media/picture.png';
const PICTURE_AZ = -40;              // 40° to the left
const PICTURE_EL = 25;               // 25° up
const PICTURE_WIDTH = 24;            // degrees wide (the height follows the picture's shape)

// ── 3. The dot that moves ───────────────────────────────────────────────────────────────────
const DOT_SPEED = 20;                // degrees per second; negative = the other way round
const DOT_HEIGHT = 35;               // degrees up
const DOT_SIZE = 3;                  // degrees across
const DOT_COLOUR = '#6cc6ff';

// ── 4. The sound that follows the dot ───────────────────────────────────────────────────────
const SOUND_FILE = 'media/sound.wav'; // a file in media/ (.wav, .mp3, .ogg). Set to null for a plain tone
const SOUND_VOLUME = 0.3;            // 0 = silent, 1 = loud. Start low: a dome is a loud room
const NOTE = 220;                    // the plain tone's pitch in Hz, used when there is no file

// Where the dot is at time t (seconds since the slide started). The picture and the sound both use it.
function dotAt(t) {
  return { az: t * DOT_SPEED, el: DOT_HEIGHT };
}

export default simpleSlide({
  title: 'Start here',               // the name in the presenter's list
  act: 'Practice',                   // the heading it sits under in the presenter's list

  // Drawn once. draw.text / draw.picture / draw.box / draw.circle all take (…, az, el, …).
  still(draw, dome) {
    draw.text(TITLE, 0, dome.sweetSpot + 3, { size: TITLE_SIZE, color: TITLE_COLOUR, weight: 700 });
    draw.text(SUBTITLE, 0, dome.sweetSpot - 3, { size: 1.6, color: C.ink, weight: 400 });
    draw.picture(PICTURE, PICTURE_AZ, PICTURE_EL, PICTURE_WIDTH);
  },

  // Drawn again for every frame, 30 times a second. t = seconds since the slide started.
  moving(draw, t, dome) {
    const dot = dotAt(t);
    draw.circle(dot.az, dot.el, DOT_SIZE, { color: DOT_COLOUR });
  },

  // One sound, placed over the five speakers where the dot is.
  sound: { file: SOUND_FILE, volume: SOUND_VOLUME, note: NOTE, at: dotAt },

  notes: `<p>The practice slide. Every value at the top of <code>slides/start-here/slide.js</code> can be changed.</p>`,
});
