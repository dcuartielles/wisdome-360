---
title: Connecting a live piece
---

# Connecting a live piece

A live piece runs on your laptop, which is plugged into the dome's system. There are **two ways** to connect, and you use one or the other for both picture and sound. Picture over one route and sound over the other is not an option.

| | **NDI + Dante** | **HDMI** |
|---|---|---|
| Picture | NDI over Ethernet | HDMI |
| Sound | Dante over a **second** Ethernet link | Inside the same HDMI cable |
| Sound channels | **6, in 5.1** (L, R, C, LFE, Ls, Rs) | **Stereo only** (L, R): no centre, sub or surrounds |
| Picture format | 2048 × 2048 dome master | 16:9 frame, dome master centred as a square |
| Cables from your laptop | Two Ethernet links (USB adapters are fine) | One HDMI cable |
| Software you need | An NDI sender, and a Dante sender (Dante Virtual Soundcard is paid software, or a hardware Dante interface) | None beyond your piece |
| Choose it when | Sound matters and you want it to move around the room | You want the simplest, most robust connection, and stereo is enough |

## NDI + Dante

**Picture.** Send a 2048 × 2048 dome master as NDI on the video network.

- TouchDesigner: an **NDI Out TOP** after your final TOP.
- Unity: NDI output on the dome camera rig (see EX-06).
- Browser pieces (WebGL, p5.js): the screen-capture tool in the free NDI Tools sends a window or screen as NDI.

**Sound.** Send six channels by Dante on the audio network, in the order L, R, C, LFE, Ls, Rs. A laptop needs **Dante Virtual Soundcard** (Audinate, paid licence) or a hardware Dante interface. Check the licence before relying on it.

**Rehearse it.** The [NDI bridge](../setup/index.md#the-three-ways-in) receives your NDI and shows it in the Dome Simulator, which is exactly the signal the venue takes. Dante can only be tested with a real Dante device or in the venue.

## HDMI

**Picture and sound** both travel in one HDMI cable. The dome takes the sound as **stereo**: if your piece is mixed in 5.1, make a stereo mix for this route.

**Rehearse it.** Plug the HDMI output into a USB capture card and pick the card in the Dome Simulator under **Camera / capture card**. Your laptop then sees the card as a second display, just as it will see the dome.

**Picture format.** The HDMI input takes a **16:9** signal. Put the dome master in the middle as a square, with black at the sides: in 1920 × 1080 the master is 1080 × 1080, in 3840 × 2160 it is 2160 × 2160. A 4K signal keeps more of the detail of a 2048² master.

## Whichever route you use

- **Keep a fallback recording.** Record your piece running, convert it to the [delivery spec](delivery-spec.md), and bring it. If the laptop fails, the recording plays.
- **Write a runbook:** how a stranger starts your system in under two minutes, in which order to plug things in and launch them.
- **Test the route before the day,** with the same laptop, cables and adapters.
