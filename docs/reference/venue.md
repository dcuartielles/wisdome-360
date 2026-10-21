---
title: The venue
---

# Wisdome Malmö

The dome at Malmö Museum, opened in April 2023 and one of five Wisdome domes in Sweden. Malmö University is a partner of Wisdome Malmö.

## Confirmed by the venue

| | |
|---|---|
| Dome | Astro-Tec, about 11.6 m, **tilted 26°**, raised at the back |
| Seats | 58 |
| Projection | 5 projectors; the picture covers a **160°** opening |
| Sweet spot | 40° from the ground |
| Live input, route 1 | **NDI** video on one Ethernet network + **Dante** audio on a second: 6 channels, 5.1 (L, R, C, LFE, Ls, Rs) |
| Live input, route 2 | **HDMI**, picture and sound in one cable: a **16:9** signal with the dome master centred, **stereo** sound only |
| Resolution | 2048 × 2048 is a good start; 6144 × 6144 is the maximum |
| Slideshows | 16:9, about 2K high, content in the centre (or rendered through a fisheye, see EX-08) |

## What this means for you

- **Start at 2K.** 6K is the ceiling, not the target, and it multiplies your render time by nine.
- **A live piece uses one route for picture and sound:** NDI + Dante (two Ethernet links, 5.1), or HDMI (one cable, stereo). See [Connecting a live piece](connecting.md).
- **Compose for 160°.** The outer ring of a 180° master is not projected.

## Still being confirmed

These will be added here when the venue answers:

- Which edge of a dome master lands at the front of the room. The simulator and the examples assume the **bottom** edge.
- How long it takes to swap one live laptop for the next, and how much delay NDI adds.
- Whether a visiting laptop can join the Dante network directly.
