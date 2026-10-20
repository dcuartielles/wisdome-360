---
title: Track A — a film
---

# Track A: from idea to a film in the dome

You make a video. On Friday it is joined with every other Track A film into one reel and played from one machine. Nothing to plug in, nothing to crash.

## 1. Choose a tool

| If you want to… | Start from |
|---|---|
| Build a 3-D scene and fly through it | **EX-01 Drift** (Blender) |
| Generate abstract patterns with code | **EX-02 Tide** (Python + numpy) |
| Draw with code in a browser, then save frames | **EX-04 Chorus** (p5.js) |
| Use your own video, filmed on green screen | **EX-10 Flight** (Python + OpenCV) |
| Show slides, photos or 16:9 video | **EX-08 Flat to Dome** |

Whatever the tool, the camera must be a **180° equidistant fisheye**, tilted like the venue. In Blender: panoramic camera, *Fisheye Equidistant*, 180°, rotated `180° − 26°` about X.

## 2. Work small, check often

1. Render **single frames at 1024²** while designing. A 2048² frame takes four times as long.
2. Drop each test frame into the [Dome Simulator](../tools/dome-simulator.html) (**Open file**). Check from the reference seat, then the back row (`4`) and the far side (`5`).
3. Keep the guides on: the subject belongs in the green zone, aimed at the gold sweet spot.

## 3. Sound

Plan 5.1 or stereo early. Export one mono WAV per channel, 48 kHz / 16-bit, starting at frame 1. Put a 1 kHz blip on frame 1 and a white flash on frame 1 of the picture.

## 4. Final render

1. Render the final master at **2048 × 2048, 30 fps** as a PNG sequence. Start it on Thursday at the latest.
2. Encode with the line from the [delivery spec](../delivery.md#video) (60 Mbit/s CBR).
3. Watch the encoded `.mp4` once, whole, in the simulator.
4. Run the [delivery checklist](../delivery.md#checklist) and upload by **Friday 08:00**.
