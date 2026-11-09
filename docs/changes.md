---
title: What changed
---

# What changed

Every change to this site is listed here, newest first, grouped by release. If something you relied on moved, it is in this list. Each release is also on the [Releases page](https://github.com/dcuartielles/wisdome-360/releases) of the repository.

## v0.0.3 — not released yet

Changes since v0.0.2, *venue*. They are already on this site.

### 2026-11-09 (evening)

- **The venue's HDMI test frame**, from the Wisdome technicians: 3840 × 2160 with the dome circle in the middle. Check your output against it before you come. See [Connecting a live piece](reference/connecting.md#the-venues-test-frame).

- **New example: EX-13 Simple HDMI + Dante example.** A small version of the live slides used in the lecture, with five commented demo slides (test image, title, a comet with 5.1 sound, a carousel of pictures and video, a dome film) and step-by-step instructions for testing in the browser, the picture over HDMI and the sound over Dante. See [EX-13](examples/ex13-simple-hdmi-dante.md).
- **The lecture's live slides are in the repository** (`slides/` folder), without the pictures and films that belong to other people; `slides/THIRD-PARTY-MEDIA.md` lists them and where to get them.

### 2026-11-09

- **EX-05 TouchDesigner: a ready-made network.** A script that builds the whole dome network in TouchDesigner for you, and the saved `.toe`, with a screenshot. See [EX-05](examples/ex05-touchdesigner.md).
- **Correction, TouchDesigner:** the fisheye is set on the **Render TOP** (*Render Mode* `Fish-Eye (180)`), not on the Camera COMP, and it is fixed at 180°. To get Wisdome's 160°, add a Transform TOP with Scale 1.125. Keep the camera at the centre (Translate `0 0 0`). See [EX-05](examples/ex05-touchdesigner.md) and [Problems](problems.md).

## v0.0.2 "venue" — 2026-11-06

The corrections from the venue: 160° geometry, live pieces over HDMI and Dante, the Friday hand-in in teams, and two new examples.

### 2026-11-05

- **Hand-in on Friday:** dome files by 08:00 for the dry run, final upload at the end of the day, both to the group assignment on Canvas. A video over 500 MB is uploaded as a reduced version and played in full from your own laptop. See [Hand-in](course/hand-in.md) and [playing a film from your laptop](make/film.md#5-playing-it-from-your-own-laptop).
- **Times and rooms** for the week are now only on Canvas.
- **New examples: EX-11 Orbit and EX-12 Orbit synth.** The dome as a musical instrument, in one browser page each: three spheres you write notes on, with 5.1 sound. EX-12 makes all its sound in its own synthesiser and has a stress test. See [Examples](examples/index.md).
- **Wisdome teams:** you make and hand in your piece in a team of up to 3 people (Team 1–20 on Canvas). Seminars stay with your workshop group.
- **Live pieces: picture over HDMI, sound over Dante.** The picture goes over HDMI at 3840 × 2160 with the dome master centred as a 2160² square; the 5.1 sound goes over Dante. If Dante fails, HDMI carries stereo sound. NDI is no longer used for student pieces. See [Connecting a live piece](reference/connecting.md). The setup wizard follows this.
- **Corrected geometry, from the venue.** Wisdome spreads the whole circle of a dome master over its 160° screen, so **render the fisheye at 160°**, not 180°. The **sweet spot is about 20° above eye level**, not 40°, and the comfortable zone runs from the bottom of the screen at the front up to about 45°. Text sizes change with it: 1° = 12.8 px at 2K. See [Where to put things](reference/comfortable-zone.md).
- **Examples updated to the new geometry:** files, pictures, pages and notebooks. The Dome Simulator uses the venue's 160° mapping.

## v0.0.1 "protoclass" — 2026-11-05

The first release: the site as it was before the venue's 2 November corrections. It still says to render at 180°, puts the sweet spot at 40°, and connects live pieces by NDI + Dante or HDMI alone.

### 2026-10-21

- **Examples:** every example now has its own page, with its files to download, how to run it, what to change first and what usually breaks. Start at [Examples](examples/index.md).
- The Python examples (EX-02 Tide, EX-08 Flat to Dome, EX-09 Type size, EX-10 Flight) are notebooks you can run in Colab with nothing installed.
- EX-10 Flight runs on a test clip of its own; the dove clip is downloaded from UltraKey (see [Credits](credits.md)).
- EX-05 TouchDesigner: the 360° footage shader needs `uTilt = -26` for Wisdome; its notes said 0.

### 2026-10-20 (afternoon)

- The site is now split into general pages and a **[MaU course 2026](course/index.md)** section with the week, the tracks and the hand-in.
- **Corrected:** a live piece connects either by **NDI + Dante** (5.1 sound) or by **HDMI** (picture and stereo sound in one cable). New page: [Connecting a live piece](reference/connecting.md).
- New logo: the "o" in wisdome is a dome master, with the sweet spot below centre. Files and rules in `docs/assets/logo/`.
- Live pieces over HDMI: send a **16:9** signal with the dome master centred as a square, black at the sides.
- Moved: *The week* → [MaU course 2026 › The week](course/week.md); *Delivery* → [Delivery spec](reference/delivery-spec.md) (format) and [Hand-in](course/hand-in.md) (deadline, file names); *Workflows* → [Make](make/index.md).

### 2026-10-20

- First version of the site: Start here, the week, setup wizard, Dome Simulator, workflows for both tracks, examples overview, problems, reference, delivery spec, credits.
