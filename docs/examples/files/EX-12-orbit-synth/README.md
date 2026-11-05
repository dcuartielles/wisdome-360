# EX-12 Orbit synth · the instrument with its own synthesiser

**A live piece · picture and 5.1 sound · runs in any recent browser · no install**

This is the same instrument as [EX-11 Orbit](../../ex11-orbit.md): three spheres of mesh (keyboard, drums, guitar) orbiting in a void, readers that hum, lines that play. Fly out, double-click in, click to write, shift + drag to turn. What changes is how the sound is made. Every sound comes from **one synthesiser running in an AudioWorklet**, and the page only sends it note messages. So it can play hundreds of notes at once, and it has a **stress test** to find your laptop's limit.

The full page, with pictures, is [EX-12 Orbit synth](../../ex12-orbit-synth.md) on the course site.

## Files

| File | What it is |
|---|---|
| `orbit-synth.html` | The whole piece, with the synthesiser inside it. One file, no libraries, no server |
| `synth-worklet.js` | The synthesiser on its own, to read. The same code as inside the HTML; the page doesn't need it |
| `preview/still-31s-names.jpg` | The dome master at 31 s, note names on (compare it with EX-11's still) |
| `preview/stress-hud.jpg` | The stress test: 120 lines per sphere, 2 readers per height, HUD on |
| `preview/flyout-stress.jpg` | The same, flown out |

## What it teaches

- One synth instead of many audio nodes: a note is a few numbers, so the limit is arithmetic you can measure.
- Scheduling ahead on one clock: every hit is solved for and started at its exact sample.
- 5.1 by hand: six gains per note, and one limiter linked across all six channels.
- Finding your machine's limit before you are in the dome.

## Run it

Double-click `orbit-synth.html` (or serve the folder) and press **Start sound**. The score plays by itself: one reader humming, a line straight ahead at 20 s, two more at 30 s.

| Do | What happens |
|---|---|
| Click an empty cell | A line, and a reader if that height has none |
| Click a line | Another reader at that height |
| Shift-click a line | Removes it |
| Shift + drag | Turns the sphere |
| Fly out (O) · double-click a sphere · Into … (1 2 3) | Leave, or go into a sphere |
| Clear my notes (C) · Next line(s) now (N) · R | Remove your notes · next step of the score · restart |
| Dome output | Fullscreen, square, no panel |
| G · F · I · H | Zone and sweet spot guide · rim and front · HUD on the dome · hide the panel |

Address settings for testing: `?t=31` (jump the score), `?q=2048` (picture size), `?extra=120&extraR=2` (stress), `?names=1`, `?guides=1`, `?fly=out`, `?out=stereo`.

## How it works

- **`score(view, t)`** works out the whole world at time `t` from the settings and everything that happened (clicks, flights, rotations, each with its time). Readers move in closed form, so `hitsBetween()` solves for every hit.
- **The picture** is one fragment shader: each pixel of the master becomes a room direction (fisheye 160°, tilt 26°, front at the bottom), and the three spheres are ray-traced from the camera.
- **The feeder**, every 20 ms, finds the hits in the next 250 ms (only lines in a reader's band) and posts them: `{ when, bank, kind, f, len, vol, g: [L, R, C, LFE, Ls, Rs] }`. Hums go as a list of "what should hum now" (the 48 loudest readers); missing ones fade out.
- **The synth** starts each note at its sample, renders all voices a block (128 samples) at a time into six channels, low-passes the LFE and limits the sum. It is fast because slow things (envelopes, FM depth, vibrato) are worked out once per block, and it uses a sine table and a rational tanh. Up to 2048 voices; one note per guitar string.
- **One clock**: once the sound starts, picture and feeder both read the audio clock.
- **Why the synth is inside the HTML:** Chrome refuses `audioWorklet.addModule()` for a `file://` address. The page loads the embedded code from a Blob URL, or from a `data:` URL when it was opened from disk. If you change the synth, change it in the HTML.
- **5.1 or stereo:** with a 6-channel output device (Dante Virtual Soundcard set to 5.1, or the course's Dante box) the page sends six discrete channels, L R C LFE Ls Rs. Otherwise the synth folds the mix down to stereo itself. The panel says which.

| | EX-11 | EX-12 |
|---|---|---|
| A note is… | a small graph of Web Audio nodes (oscillators, gains, filters) built for it | a few numbers in an array inside one AudioWorklet |
| Panning (5.1) | a `Panner51` (7 nodes) per line | six multiplications per sample |
| Limiter | one `DynamicsCompressor` per speaker pair | inside the synth, linked across all six channels |
| Polyphony | capped (16 / 24 / 6), oldest let go | no caps (up to 2048 voices), only one note per guitar string |
| Cost | grows with the number of nodes the browser has to manage | grows with arithmetic: measurable, predictable |

## The stress test

**Generated lines per sphere** (0–240) and **readers per height** (1–4) fill all three spheres. The HUD at the front shows voices · hums · notes/s · limiter reduction · **real-time %**. 100 % means the synth keeps up; below about 98 % you hear crackles. Raise the sliders until it drops: that is your computer's number. Keep the picture running at its dome size while you test.

Measured on 3 November 2026 on the cloud test machine (one core of a 2.1 GHz Xeon, Node / V8, the synth alone):

| voices sounding at once | keyboard | drums | guitar | mixed |
|---|---|---|---|---|
| 100 | 15 % of a core | 11 % | 19 % | 25 % |
| 400 | 46 % | 28 % | 79 % | 71 % |
| 1000 | 98 % | 58 % | 185 % | 173 % |

That is about 550 mixed voices per core. A rerun of the mixed column on 5 November 2026 (same kind of machine, Node 22) gave 22 %, 68 % and 173 %. In headless Chromium there, about 210 voices stayed at 100 % real-time and about 920 voices dropped to about 76 %. Measure it on your own laptop.

## Getting it onto the dome

- **Picture over HDMI.** The dome's display is 3840 × 2160: press **Dome output** on that display (the master sits in the middle, 2160²), or use OBS's Fullscreen Projector.
- **Sound over Dante**, 5.1, from Dante Virtual Soundcard or the course's Dante box. Choose the device before pressing **Start sound**.
- **Fallback:** stereo over HDMI. The page folds 5.1 down by itself.
- **Rehearse** in the [Dome Simulator](../../../tools/dome-simulator.html). See [Connecting a live piece](../../../reference/connecting.md) and [Making a live piece](../../../make/live.md).

Geometry: fisheye 160°, tilt 26°. Sweet spot about 20° up, straight ahead. Comfortable zone from the rim at the front (about −16°) to about 45°, ±60°.

## Try changing first

- `blockNote()` in the synth: a new sound bank is a new branch there and a new sphere in `SPHERES`.
- `MAX_VOICES` (2048): lower it and push the stress test.
- `HUM_MAX` (48): how many readers hum at once.
- Move the scheduling into the worklet: send it lines and readers, no messages per note.

## What usually breaks

| Symptom | Cause |
|---|---|
| "The synth did not load" | An old browser, or one that blocks `data:` URLs from disk. Serve the folder with `python -m http.server` |
| No sound at all | Press **Start sound**: audio only starts after a click |
| Stereo instead of 5.1 | The device had fewer than six channels when the sound started. Set it to 5.1, make it the output, reload |
| Notes go missing when the picture stutters | Picture and feeder share the main thread. Lower **Picture size** |
| Crackles, real-time below 98 % | Too many voices for this machine |
| Stretched on the dome | The output isn't square. Use **Dome output** |

## Licence

Code: GPL-3.0-or-later. Text and images: CC BY-SA 4.0.
