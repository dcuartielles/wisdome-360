---
title: Hand-in
---

# Hand-in

You upload twice to the same place: the **Wisdome group assignment** on Canvas, **one upload per Wisdome team** (up to 3 people; join a team under *People › Groups* on Canvas). Canvas keeps every upload.

| | When | What |
|---|---|---|
| **For the dry run** | **Friday 13 November, 08:00** | Your dome files: Track A, the film and its audio; Track B, the fallback recording, audio and `runbook.md`. We use these in the dry run, so a late or broken file misses it |
| **Final upload** | **Friday 13 November, end of the day** (deadline on Canvas) | The final piece and your presentation, zipped into one file |

Times and rooms for the whole week are on Canvas.

| | |
|---|---|
| Format | The [delivery spec](../reference/delivery-spec.md): 2048 × 2048, 160° fisheye, 30 fps, H.264 at 60 Mbit/s, audio as separate WAVs |
| Length | Track A: **90–180 s**. Track B fallback: as performed |
| Running-order number `##` | Announced on Wednesday. It goes into your file names |

## Large files

At the full spec, a 3-minute film is about 1.3 GB, which is too big to upload reliably. **If your video file is over 500 MB:**

1. **Upload a reduced version** by 08:00: same size and frame rate, lower bitrate. This line gives about 270 MB for 3 minutes:

    ```bash
    ffmpeg -i A07_team_TITLE_2048x2048_30fps.mp4 -c:v libx264 -profile:v high -pix_fmt yuv420p \
           -b:v 12M -maxrate 12M -bufsize 24M -an A07_team_TITLE_2048x2048_30fps_reduced.mp4
    ```

    Upload the WAVs as they are; they are small.
2. **Bring the full-quality version on your own laptop** and play it from there in the dome, over HDMI with the sound over Dante, like a live piece. See [Connecting a live piece](../reference/connecting.md) and [playing a film from your laptop](../make/film.md#5-playing-it-from-your-own-laptop).

## File names

Exactly like this, with your running-order number and team name:

```text
Track A   A07_teamname_TITLE_2048x2048_30fps.mp4        (…_reduced.mp4 if you upload a reduced version)
          A07_teamname_TITLE_48k16_L.wav
          A07_teamname_TITLE_48k16_R.wav                (… _C _LFE _Ls _Rs for 5.1)

Track B   B03_teamname_TITLE/
            fallback/B03_teamname_TITLE_2048x2048_30fps.mp4
            audio/…_L.wav  …_R.wav
            runbook.md      how to start your system, step by step
```

Fixed names, one resolution and separate audio make it quick to line up a dozen pieces on Friday morning. A wrongly named file is the one that gets left out.

## Checklist

Run it on the files you are about to upload, not on an earlier version.

- [ ] Everything in the [delivery spec checklist](../reference/delivery-spec.md#checklist) passes.
- [ ] File names follow the pattern exactly, including your running-order number.
- [ ] Video over 500 MB: you uploaded the reduced version, and the full version is on the laptop you bring.
- [ ] Track B: the fallback recording exists, meets the spec, and is in the folder.
- [ ] Track B: `runbook.md` tells a stranger how to start your system in under two minutes.
- [ ] Laptop in the dome (Track B, or a Track A film played from your laptop): you have tested the picture over **HDMI** at 3840 × 2160 with the master centred, the sound over **Dante** (Dante Virtual Soundcard or the course's Dante box), and you have a stereo mix ready in case Dante fails.

## Friday

- **08:00** Dome files uploaded. Late files miss the dry run.
- **Morning:** dry-run slots on the dome. Note what looks wrong; you can fix small things before the presentations.
- **Afternoon:** presentations. Three minutes per team to explain your decisions, in the dark, in the dome.
- **End of the day:** final upload.

If you play from your laptop, bring it with its charger, an HDMI cable and any adapter it needs, an Ethernet port or USB-Ethernet adapter for Dante, and the upload on a USB stick as well.
