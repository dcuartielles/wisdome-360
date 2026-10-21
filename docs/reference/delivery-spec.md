---
title: Delivery spec
---

# Delivery spec

The format the dome plays: a dome-master video with its sound as separate files. A rendered film is delivered like this, and so is the fallback recording of a live piece. For a live connection see [Connecting a live piece](connecting.md).

## Video

| | |
|---|---|
| Projection | Equidistant azimuthal fisheye ("dome master") |
| Resolution | **2048 × 2048**. The venue goes up to 6144 × 6144; agree with the venue before you deliver anything larger |
| Aspect | 1:1 square, content inside the circle, corners pure black |
| Field of view | 180° master. The dome shows the central **160°**: keep nothing in the outer ~11 % of the radius |
| Frame rate | **30 fps**, constant |
| Codec | H.264 High profile (H.265 also accepted) |
| Container | `.mp4` |
| Bitrate | **60 Mbit/s CBR** or higher |
| Colour | 8-bit, Rec.709 |

From a PNG sequence, this ffmpeg line gives a conforming file:

```bash
ffmpeg -framerate 30 -i frame_%04d.png -c:v libx264 -profile:v high \
       -pix_fmt yuv420p -b:v 60M -maxrate 60M -bufsize 120M -r 30 out.mp4
```

## Audio

Delivered **separately**, never inside the video file.

| | |
|---|---|
| Format | WAV, 48 kHz, 16-bit |
| Layout | 5.1: six mono files `_L _R _C _LFE _Ls _Rs`. A stereo piece delivers `_L` and `_R` only |
| Sync | Audio starts at frame 1 |
| Sync blip | A 1 kHz tone on frame 1 of the audio **and** a white flash on frame 1 of the picture |

## Checklist

Run it on the files you are about to deliver, not on an earlier version.

- [ ] The image is square, the content sits inside the circle, the corners are pure black.
- [ ] 2048 × 2048, 30 fps constant.
- [ ] `.mp4`, H.264 or H.265, 60 Mbit/s or more.
- [ ] Audio as separate WAVs, 48 kHz / 16-bit, one mono file per channel.
- [ ] A sync blip on frame 1 of both picture and sound.
- [ ] You have watched it once, whole, in the [Dome Simulator](../tools/dome-simulator.html), not only on a flat screen.
- [ ] The subject is in the comfortable zone in front (15°–60° up, ±60°), near the 40° sweet spot, and nothing important is outside the central 160°.
- [ ] No roll, no fast global motion.

MaU students: file names, deadline and where to upload are on [Hand-in](../course/hand-in.md).
