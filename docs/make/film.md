---
title: Making a film
---

# Making a film for the dome

You make a video, and the dome plays it from its own system. Nothing to plug in, nothing to crash.

## 1. Choose a tool

| If you want to… | Start from |
|---|---|
| Build a 3-D scene and fly through it | **EX-01 Drift** (Blender) |
| Generate abstract patterns with code | **EX-02 Tide** (Python + numpy) |
| Draw with code in a browser, then save frames | **EX-04 Chorus** (p5.js) |
| Use your own video, filmed on green screen | **EX-10 Flight** (Python + OpenCV) |
| Show slides, photos or 16:9 video | **EX-08 Flat to Dome** |

Whatever the tool, the camera must be a **160° equidistant fisheye**, tilted like the venue. In Blender: panoramic camera, *Fisheye Equidistant*, field of view 160°, rotated `180° − 26°` about X. Not 180°: the venue spreads the whole circle over its 160° screen.

## 2. Work small, check often

1. Render **single frames at 1024²** while designing. A 2048² frame takes four times as long.
2. Drop each test frame into the [Dome Simulator](../tools/dome-simulator.html) (**Open file**). Check from the reference seat, then the back row (`4`) and the far side (`5`).
3. Keep the guides on: the subject belongs in the green zone, aimed at the gold sweet spot.

## 3. Sound

Plan 5.1 or stereo early. Export one mono WAV per channel, 48 kHz / 16-bit, starting at frame 1. Put a 1 kHz blip on frame 1 and a white flash on frame 1 of the picture.

## 4. Final render

1. Render the final master at **2048 × 2048, 30 fps** as a PNG sequence. At this size a few minutes of film takes hours, so start early.
2. Encode with the line from the [delivery spec](../reference/delivery-spec.md#video) (60 Mbit/s CBR).
3. Watch the encoded `.mp4` once, whole, in the simulator.
4. Run the [delivery checklist](../reference/delivery-spec.md#checklist).

MaU students: file names, deadline and upload are on [Hand-in](../course/hand-in.md).

## 5. Playing it from your own laptop

Some venues play your file from their own system. If you play the film from your own laptop instead, for example because the full-quality file is too big to hand in, connect it like a live piece: picture over HDMI, sound over Dante. See [Connecting a live piece](../reference/connecting.md).

1. Make a playback copy with the 5.1 sound inside the MP4, so picture and sound stay together:

    ```bash
    ffmpeg -i film_2048x2048_30fps.mp4 \
           -i film_L.wav -i film_R.wav -i film_C.wav -i film_LFE.wav -i film_Ls.wav -i film_Rs.wav \
           -filter_complex "[1:a][2:a][3:a][4:a][5:a][6:a]join=inputs=6:channel_layout=5.1[a]" \
           -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 384k film_play.mp4
    ```

    For a stereo piece, use only the L and R files and `channel_layout=stereo` with `inputs=2`.
2. Set the HDMI display to 3840 × 2160 and play the copy fullscreen on it, centred with black at the sides. [VLC](https://www.videolan.org/) or [mpv](https://mpv.io/) work; turn off any scaling that stretches the square.
3. Send the player's sound to your Dante device (or, as a fallback, to the HDMI output in stereo).
4. Play it once from start to finish before your slot, from the same laptop.
