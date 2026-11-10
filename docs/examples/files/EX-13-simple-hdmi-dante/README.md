# EX-13 · Simple HDMI + Dante example

A small version of the live dome slides used in the Wisdome lecture: the same engine, with **a practice
slide and five demo slides**, one of each kind, with comments in the code so you can copy them and make your own.

**Never used Node.js or a code editor?** Follow [Live slides from zero](https://dcuartielles.github.io/wisdome-360/make/live-slides-from-zero/)
first: it takes you from installing the tools to changing the practice slide, step by step.
It sends the **picture over HDMI** and the **sound (5.1) over Dante**, the way a live piece reaches
the Wisdome dome.

| Slide | Folder | What it shows you |
|---|---|---|
| **Start here** | `slides/start-here/` | **the one to practise on**: words, a picture, a dot that circles the room and a sound that follows it, all in plain JavaScript (no shader code). Every value is at the top of the file |
| Test image | `slides/00-test-card/` | where the front is, the screen edge, the sweet spot, the five speakers; a **Speaker ident** button |
| Title screen | `slides/01-title/` | text placed by angle, a turning starry sky, an optional drone that circles the room |
| Sound that moves | `slides/02-comet/` | a comet circling the room, its sound following it over the 5.1 speakers |
| Carousel | `slides/03-carousel/` | pictures and a video on cards around the room, brought to the front one at a time |
| Dome film | `slides/04-dome-film/` | a finished dome master film, full dome, with its sound |

Everything here was made for the course: code **GPL-3.0**, texts and sample media **CC BY-SA 4.0**,
three.js (in `vendor/`) **MIT**.

## 1 · What you need

- A laptop with **Node.js 20 or newer** ([nodejs.org](https://nodejs.org)) and **Google Chrome**. Windows, macOS or Linux.
- Only for the two sample films (carousel video, dome film): Python 3 with `numpy` and `pillow`, and `ffmpeg`, or download them (step 2). Everything else, including the practice slide, works without them.
- In the dome: an **HDMI** cable to the venue's input, an **Ethernet** cable to the Dante network, and
  **Dante Virtual Soundcard** (Audinate; a licence or its trial) on the laptop.

## 2 · Start it

```
cd EX-13-simple-hdmi-dante
node server/server.mjs

# optional, once: the two sample films (or unzip EX-13-sample-media.zip from the Releases page)
python3 tools/make_sample_media.py
```

On Windows you can double-click `setup/Dome Slides.cmd` instead (macOS: `setup/Dome Slides.command`).
The server prints the addresses. Keep its window open: closing it stops the slides.

| Address | What it is |
|---|---|
| `http://localhost:8360/presenter/` | **your control page**: the list of slides, Next/Back, each slide's controls and notes, a small preview |
| `http://localhost:8360/video/` | **the picture**: the square dome master. This goes on the HDMI screen |
| `http://localhost:8360/audio/` | **the sound**: 6 channels, L R C LFE Ls Rs. This goes to Dante |
| `http://localhost:8360/video/?audio=1&view=inside` | **rehearsal**: the dome seen from a seat, with sound, in one tab |

All pages follow the same shared state: press Next on the presenter and every page changes together.

## 3 · Test it at home, in the browser

1. Open the **rehearsal** address. Click once to start the sound. **Drag** to look around as if you sat in
   the dome; the wheel zooms. You hear a stereo mix of the 5.1 sound.
2. Open the **presenter** in a second window and step through the slides with **→**.
   - On **Start here**, open `slides/start-here/slide.js`, change the words, save, and reload the rehearsal tab.
   - On the test image, press **Speaker ident**: the noise moves L, C, R, Rs, Ls, LFE and the rings light up.
   - On the comet, change the speed and height and follow the sound with your eyes closed.
   - On the carousel, press **↓** to bring the next picture to the front; turn on the 🔊 switch of the video.
   - On the film, press **R** to restart it.
3. Press **G** for the guides: the comfortable zone (where people can look without effort) and the sweet
   spot, about 20° above eye level, straight ahead. Put your important things there.
4. To see it on a dome: open the **Dome Simulator** on the course site, share the `video/` window with it,
   and walk around the 3D dome. Or put on a Quest 3 with the dome viewer.

Keys (presenter or picture page): **→ / PageDown** next · **← / PageUp** back · **B** blackout · **M** mute ·
**R** restart the slide · **G** guides · **P** show the square file · **↓ / ↑** next/previous picture ·
**H** (picture page) hide the small info text.

## 4 · The picture over HDMI

1. Connect the HDMI cable. Windows: **Win + P → Extend**. In *Settings → Display*, pick the venue's
   screen and set it to **3840 × 2160** and scale **100 %** (macOS: *System Settings → Displays*,
   arrange as an extended display).
2. Open a **new Chrome window** with `http://localhost:8360/video/`, drag it onto the venue's screen and
   press **F11** (macOS: ⌃⌘F) for full screen. The square master sits in the middle of the 16:9 picture,
   2160 × 2160, black at the sides. Press **H** to hide the info text.
   (OBS works too: a Browser Source at 2048 × 2048 and *Fullscreen Projector* on the venue's screen.)
3. Go to the **test image**. Check with the technician that **FRONT** is at the front of the room and
   the red circle is where the screen ends. If the front is on another side, open the picture page as
   `http://localhost:8360/video/?front=top` (or `left`, `right`).
4. Control the show from the **presenter** on the laptop's own screen.

## 5 · The sound over Dante

Dante sends audio over an ordinary Ethernet network. **Dante Virtual Soundcard** (DVS) makes your laptop a
Dante device: whatever you play into it comes out on the venue's speakers, once the technician connects
("subscribes") its channels.

1. Plug the Ethernet cable into the venue's Dante network.
2. Open **Dante Virtual Soundcard**: choose that Ethernet adapter, **at least 6 transmit channels**, the
   **sample rate the venue uses** (ask; usually 48 kHz), and press **Start**.
3. Make the system send 6 channels to it:
   - **Windows:** *Sound settings → More sound settings → Playback*, select **Dante Virtual Soundcard**,
     *Configure → 5.1 Surround*, and in *Properties → Advanced* pick 24 bit, 48000 Hz (the venue's rate).
     If you skip this, Chrome only sends stereo.
   - **macOS:** *Audio MIDI Setup → Dante Virtual Soundcard → Configure Speakers → 5.1 Surround*.
4. Open the **sound page** (`/audio/`) in its own Chrome window. Press **Start sound**, choose
   **Dante Virtual Soundcard** as the device and **Out: this computer only**. Press **Channel ident**:
   the six meters light up in turn.
5. Ask the technician to route DVS channels **1–6** to **L, R, C, LFE, Ls, Rs** in Dante Controller.
6. On the **test image**, press **Speaker ident** and walk the room: L, C, R, Rs, Ls, LFE. Then play the comet.

**If Dante doesn't work**, the HDMI cable can carry stereo: on the sound page choose the HDMI screen's
audio device instead. The page mixes the 6 channels down to 2 (it says so); ask the technician to play
the HDMI input's sound. Sound no longer moves round the room, but nothing else changes.

**Picture and sound in step:** picture through the venue's projectors can be a little late. If claps or
flashes don't line up, use the presenter's **Audio delay** to delay the sound.

## 6 · Preparing your own sound

**Sound made by a slide** (like the comet or the title drone) is written in the slide's `audio()` part:
- `const p = group.panner(); source.connect(p.input); p.set(azimuth, elevation)` puts a sound where you
  see it, over the 5 speakers. Elevation does little: 5.1 has no speakers above you.
- `group.channel(i)` sends straight to one speaker: 0 L, 1 R, 2 C, 3 LFE (subwoofer), 4 Ls, 5 Rs.
- Use any Web Audio node: oscillators, filters, `AudioBuffer` samples you `fetch()` from your `media/` folder.

**Sound inside a film** (slide 04): the film can carry
- **stereo**: the slide plays its left and right on L and R and a little on C. Choose *Film sound is… stereo*.
- **5.1**: six channels in the order **L R C LFE Ls Rs**. Choose *Film sound is… 5.1*. To put six mono
  files (one per speaker) into your film with ffmpeg:
  ```
  ffmpeg -i film.mp4 -i L.wav -i R.wav -i C.wav -i LFE.wav -i Ls.wav -i Rs.wav \
    -filter_complex "[1:a][2:a][3:a][4:a][5:a][6:a]join=inputs=6:channel_layout=5.1[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 384k film_51.mp4
  ```
- Export at **48 kHz**. Leave headroom: keep peaks a few dB under 0 dBFS, and try the level in the room
  quietly first: a dome is a loud, live space.
- The LFE channel is only for the deep rumble under about 120 Hz; never put dialogue or music only there.

## 7 · Make your own slide

1. Copy the demo folder closest to what you want (e.g. `slides/start-here/` → `slides/05-my-scene/`).
   `start-here` is the easiest: plain JavaScript, no shader. The others draw their picture in GLSL.
2. Add `'05-my-scene'` to the list in `slides/index.js`, where it should appear.
3. Edit `slide.js`. Reload the picture, sound and presenter pages (they read the slides once, when they open).
4. If something goes wrong, the slide shows "failed to load": press **F12** in Chrome and read the Console.

### Cheat sheet

For slides made from `start-here` (the template in `slides/_simple.js`):

| In the slide | What it is |
|---|---|
| `still(draw, dome)` | drawn once: words, boxes, pictures that don't move |
| `moving(draw, t, dome)` | drawn every frame; `t` = seconds since the slide started |
| `draw.text(words, az, el, { size, color, weight })` | words centred on (az, el); `size` = letter height in degrees |
| `draw.circle(az, el, size, { color, glow })` | a round spot, `size` = diameter in degrees |
| `draw.box(az, el, width, height, { color, fill })` | a rectangle, sizes in degrees |
| `draw.picture(file, az, el, width)` | a picture from the slide's `media/` folder |
| `sound: { file, volume, note, at }` | one looping sound (or a tone of `note` Hz); `at(t)` returns `{ az, el }`, where it comes from |
| `dome.sweetSpot` | the best elevation, straight ahead (about 20°) |

For the other demo slides:

| In the slide | What it is |
|---|---|
| `params` | controls on the presenter: `range` (slider), `toggle`, `select`, `button` |
| `view.p('name')` | a control's current value |
| `view.t()` | seconds since the slide started (the same on every page) |
| `view.integrate('speed')` | a slider summed over time (°/s → degrees): smooth movement |
| `view.lastPress('name')`, `view.presses('name')` | when a button was pressed |
| `base + 'media/file.png'` | the address of a file in your slide's `media/` folder |
| `new AngleCanvas()` → `.text(str, az, el, { size, color, weight })` → `.commit()` | text and shapes placed by **angle**: azimuth 0 = front, + right; elevation 0 = eye level; sizes in degrees |
| `comp.material(glsl, uniforms)` | the picture: a GLSL function `slideColor(room, local, m)` run for every pixel |
| `room`, `azOf(room)`, `elOf(room)` | the direction a pixel shows (x right, y front, z up), and its angles |
| `dirRoom(az, el)`, `angleBetween(a, b)` | a direction from angles; the angle between two directions |
| `cardUV(room, centre, widthDeg, aspect, rollDeg)` | a flat picture hung in the room: 0..1 inside, −1 outside |
| `sampleEq(uEq, room)` | your AngleCanvas, at that direction |
| `group.panner()`, `group.channel(i)`, `group.noise()` | sound: a 5.1 panner, one speaker, a noise source |

Place things **by angle, not by pixel**: the sweet spot is `DOME.sweetSpot` degrees up, straight ahead;
the screen ends at `rimElevation(az)` (low in front, high behind, because the dome is tilted 26°).

## 8 · If something doesn't work

| Symptom | Try |
|---|---|
| The picture page is black | is the server window still open? Reload the page |
| No sound in the rehearsal tab | click the page once (browsers only play sound after a click) |
| The sound page plays only stereo to Dante | set the DVS playback device to 5.1 (step 5.3), then reload the sound page |
| DVS channels don't appear in Dante Controller | DVS started on the right Ethernet adapter? Same sample rate as the venue? |
| The circle is cut or doesn't reach the screen edge | the screen is not at 3840 × 2160 / 100 %, or Chrome is not full screen |
| A picture shows "picture goes here" | the file name in `slide.js` and in `media/` differ (capitals count) |
| A video doesn't play | use H.264 `.mp4` or `.webm`; Chrome can't play `.mov` (ProRes) or `.mkv` |
