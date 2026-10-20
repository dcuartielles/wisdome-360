---
title: Delivery
---

# Delivery spec

This is the contract. Every Track A film is joined into one reel and played from one machine, so a file that doesn't meet the spec can't be played. The deadline is **Friday 13 November, 08:00**, the morning of the dry run, so there is no time to fix a file after that.

!!! info "Where to hand in"
    Upload to the assignment on Canvas. The running-order number `##` is issued on Wednesday.

## Video

| | |
|---|---|
| Projection | Equidistant azimuthal fisheye ("dome master") |
| Resolution | **2048 × 2048**. The venue goes up to 6144², but the reel is built at one size: ask first |
| Aspect | 1:1 square, content inside the circle, corners pure black |
| Field of view | 180° master. The dome shows the central **160°**: keep nothing in the outer ~11 % of the radius |
| Frame rate | **30 fps**, constant |
| Codec | H.264 High profile (H.265 also accepted) |
| Container | `.mp4` |
| Bitrate | **60 Mbit/s CBR** or higher |
| Colour | 8-bit, Rec.709 |
| Duration | Track A: 90–180 s. Track B fallback: as performed |

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

## File names

Exactly like this, with your running-order number:

```text
Track A   A07_teamname_TITLE_2048x2048_30fps.mp4
          A07_teamname_TITLE_48k16_L.wav
          A07_teamname_TITLE_48k16_R.wav          (… _C _LFE _Ls _Rs for 5.1)

Track B   B03_teamname_TITLE/
            fallback/B03_teamname_TITLE_2048x2048_30fps.mp4
            audio/…_L.wav  …_R.wav
            runbook.md      how to start your system, step by step
```

## Track B: live input

| | |
|---|---|
| Video | NDI over Ethernet, or HDMI. Send a 2048 × 2048 fisheye |
| Audio | Dante over Ethernet, 6 channels (5.1). Stereo goes to L/R |
| Network | **Two** dedicated Ethernet links, one for NDI and one for Dante. USB adapters are fine |

## Checklist

Run it on the files you are about to upload, not on an earlier version.

- [ ] The image is square, the content sits inside the circle, the corners are pure black.
- [ ] 2048 × 2048, 30 fps constant.
- [ ] `.mp4`, H.264 or H.265, 60 Mbit/s or more.
- [ ] Audio as separate WAVs, 48 kHz / 16-bit, one mono file per channel.
- [ ] A sync blip on frame 1 of both picture and sound.
- [ ] File names follow the pattern exactly, including your running-order number.
- [ ] You have watched it once, whole, in the [Dome Simulator](tools/dome-simulator.html), not only on a flat screen.
- [ ] The subject is in the comfortable zone in front (15°–60° up, ±60°), near the 40° sweet spot, and nothing important is outside the central 160°.
- [ ] No roll, no fast global motion.
- [ ] Track B: the fallback recording exists, conforms, and is in the folder.
- [ ] Track B: `runbook.md` tells a stranger how to start your system in under two minutes.
- [ ] Track B: your laptop sends NDI (or HDMI) video and Dante audio over two Ethernet links, and you have tested both.
