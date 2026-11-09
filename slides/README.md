# Live dome slides

> **This is the public copy** of the live slides used for the introductory lecture in Wisdome Malmö
> (9 November 2026). Pictures and films made by other people are **not included**: the slides that use
> them show a card naming the file they wait for. See [THIRD-PARTY-MEDIA.md](THIRD-PARTY-MEDIA.md) for
> what is missing and where to get it. Code: GPL-3.0. Texts, slide designs and our own pictures: CC BY-SA 4.0.
> Want to make your own? Start from the small kit in `docs/examples/files/EX-13-simple-hdmi-dante/` instead.

Interactive HTML5 slides for the Wisdome lecture. Picture as a 2048² fisheye dome master,
sound as 5.1 (L R C LFE Ls Rs). Spec and decisions: `SPEC.md`.

## Versions

- *after v002* (not yet tagged) · EX-12 (slide 17c): the instrument with one custom AudioWorklet synth
  (notes, hums, 5.1 panning, limiter) + stress test and HUD (voices, notes/s, real-time %). EX-11 fix:
  the slide's start time was recomputed with a tiny jitter on every update, so every page thought the
  slide had restarted: notes were scheduled again and again (stacked 10–30×, the real cause of the
  clipping) and shift-drag rotations were ignored.
- **v002** (3 Nov 2026) · EX-11 *Orbit*, the dome as an instrument (slide 17b): three mesh spheres
  (keyboard, drums, distorted guitar) orbiting in a void, fly out / double-click to fly in, click to
  write notes on any part of a sphere, shift + drag to turn it, distance-based 5.1 sound with limiters.
  Engine: clicks, double clicks and shift-drags on the dome (`lib/pointer.js`, presenter preview and
  rehearsal tab, master or seat view). Audit for content lost under the rim: 05, 07, 08 now placed
  relative to the screen edge.
- **v001** · the slideshow at the Wisdome 160° / 26° geometry (commit `c4d59ec`).

## One icon on the desktop

**Windows (the laptop):** double-click `setup/Install desktop icon.cmd` once. It puts a **Dome Slides**
icon on the desktop and creates an OBS profile (2048 × 2048, 30 fps) and a scene with the dome page in
it (only if they don't exist yet). In OBS, once: *Tools → DistroAV NDI Settings → Main Output*, name it
`DOME-SLIDES`.

The icon runs `node server\server.mjs --launch` in a minimised window: that window *is* the server
(close it to stop). If the icon ever does nothing, double-click `setup\Dome Slides.cmd`, which does the
same with the window visible, so you can read any error.

Double-clicking the icon then: starts the server (or reuses it if it's already running) →
starts OBS minimised → opens the sound window (it starts by itself) → opens the **launch console**
full screen: a systems check (server, clock, slides, picture fps, 5.1 sound) and an **IGNITE**
button. IGNITE fires slide 00 in the dome: rings rush to the zenith with a riser circling the 5.1
ring, a sub boom on the LFE, a warp of light, "WISDOME LIVE". Then the console warps into the presenter.
Chrome runs in its own profile (`%LOCALAPPDATA%\DomeSlides`) so autoplay is allowed and your audio
device choice is remembered. Log: `%LOCALAPPDATA%\DomeSlides\server.log`.
**Shut down server** is at the bottom of the presenter's slide list (click twice).

**Mac (the spare):** `setup/Dome Slides.command` does the same. Make an alias on the desktop
(first time: right-click → Open). To give it the icon: open `setup/dome.png` in Preview, Copy, then
Get Info on the alias and paste onto the small icon.

## Run it

Needs Node 18+ and Chrome. No `npm install`: there are no dependencies; three.js is in `vendor/`.

```
node server/server.mjs          # or setup/start-win.ps1 / setup/start-mac.sh
```

| Page | What it's for |
|---|---|
| `http://localhost:8360/presenter/` | your screen: next/prev, live controls, notes, preview (master or inside view), meters, audio delay |
| `http://localhost:8360/video/` | the dome picture. In the venue: **OBS Browser Source, 2048 × 2048, 30 fps** → DistroAV → NDI |
| `http://localhost:8360/audio/` | the dome sound. A Chrome tab in its own window. **Out:** this computer (e.g. the Dante Virtual Soundcard, 5.1) or the **UNO Q bridge** (address of the bridge; see `bridge/rx/README.md`). URL options `?mode=bridge&bridge=192.168.0.2` |
| `http://localhost:8360/video/?audio=1&view=inside` | **rehearsal in one tab**: picture seen from a seat (drag to look around, wheel to zoom) + sound, downmixed to stereo |

Keys (presenter or video page): **→ / PageDown** next · **← / PageUp** back · **B** blackout · **G** guides ·
**P** show the file (the master itself on a screen in the dome) · **M** mute · **R** restart the slide.
Clickers work (they send PageUp/PageDown).

Video URL options: `?res=2048` `?q=low|normal|high` (cube map and canvas sizes) `?fov=180|160` `?front=bottom|top|left|right` `?tilt=26`.

## Running order (slides/index.js)

I · The room: 00 ignition · 01 title · the dome in the room (side view) · meet the dome (+ speaker ident) · presenting with 16:9 slides (build step) · what the dome shows · flat picture on a round screen · distortion ·
05 3D space · 06 peripheral vision · 07 comet + 5.1 · 08 live mic ring / waterfall
II · Who did this before: 09 Sutherland 1968 · 10 Vortex 1957 · 11 Philips Pavilion 1958 · 12 Jeffrey Shaw / ZKM · 13 AlloSphere · 14 Sphere Las Vegas
III · Tools: 15 pipeline · 16 EX-01/02/10 rendered · 17 EX-03/04 live · 17b EX-11 the dome as an instrument (5.1) · 18 TouchDesigner · 19 toolbox (all round the room)
IV: 20 the room in the loop · 21 your turn
Tech checks: 90 test card + ident · 91 AV sync (flash + click)

## Pictures, GIFs and videos (Act II and any text + picture slide)

Each history slide waits for media in `slides/<slide>/media/` with the file names shown on its
placeholder cards. **Stills** (.jpg .png .webp), **animated GIFs** (.gif) and **videos** (.mp4 .webm,
muted, looping) all work. **Video sound:** every video gets a **🔊 Sound** button on the presenter, plus a
**Video volume** slider. The sound is played by the audio page (so it goes out over Dante), kept in step
with the picture by the shared clock, and placed in 5.1 where the video is in the dome: it moves
round with the carousel and is loudest at the front. To use a GIF or a video, change the file name in the slide's `images` list
(e.g. `{ file: 'eve.mp4', caption: 'EVE, 1993' }`).

Two layouts: **Overview** (text in the middle, pictures either side) and **Carousel** (title on top,
one big picture at the front, the others waiting on a ring round the room). **Next picture**,
the **↓** key or a **click on the presenter preview** turns the ring (↑ / shift-click goes back);
doing that from the overview switches to the carousel by itself.

`docs/dome-side-section.png`: the side view of the tilted dome (also slide 03 and its notes).

## Pictures for Act II (sources)

Each history slide waits for pictures in `slides/<slide>/media/` with the file names shown on its
placeholder cards (e.g. `slides/09-sutherland/media/hmd.jpg`). Any jpg/png works; aspect is kept.
Wikimedia Commons, the Computer History Museum, ZKM and the artists' own sites are good sources;
note the credit in the slide's notes.

## Writing a slide

`slides/NN-name/slide.js` exports `{ title, act, notes, params, video(ctx), audio(ctx) }`.

* **Compose by angle.** A slide colours a direction: `slideColor(room, local, m)` gets the room
  direction (x right, y front, z up) for every pixel of the master. Helpers in `lib/glsl.js`:
  `dirRoom(az, el)`, `azOf`, `elOf`, `angleBetween`, `cardUV` (a flat virtual screen), `sampleEq`.
* **Three ways to draw:** an `AngleCanvas` (2D canvas laid out by azimuth/elevation; text sizes in
  degrees), a three.js scene through `comp.cube()` (cube map → fisheye), or your own GLSL.
* **Build steps:** `steps: 1` on a slide makes the first **Next** play a step (a `step` button press)
  instead of changing slide; `autoStep: 5` counts the step as done once it has played by itself.
* **Params** become controls on the presenter automatically (`range`, `toggle`, `select`, `button`).
  Read them with `view.p('name')`. Anything that moves at a speed should use
  `view.integrate('speed')` so the picture page and the sound page stay locked together.
* **Sound:** `audio({ group, view, ctx, ctxTime })` → `group.panner().set(az, el)` places a sound in 5.1.

## Status (Oct 2026)

Built and checked in headless Chromium (software GL): every slide renders, controls work, the
audio parts run without errors. **Not yet measured on the laptop GPU**: phase 1 of SPEC.md
(30 fps at 2048² with OBS + NDI + audio for 20 min) is still to do. H.264 playback (slide 16) could
not be checked here; it needs Chrome / OBS, which ship the codec.
