---
title: Making a live piece
---

# Making a live piece for the dome

Your laptop draws the dome master in real time and is plugged into the dome. The piece can react to sound, to the audience, to sensors. It can also fail, which is why you always bring a fallback recording.

## 1. Choose a tool

| If you want to… | Start from |
|---|---|
| React to sound, sensors or the network, fast | **EX-05** (TouchDesigner) |
| A game engine, 3-D scenes, audience input | **EX-06** (Unity + DomeTools) |
| Shaders in a browser, no install | **EX-03 Pulse** (WebGL / GLSL) |
| Gentle creative coding in a browser | **EX-04 Chorus** (p5.js) |
| Fly through space, real astronomy data | **EX-07** (OpenSpace) |

## 2. How you connect

The picture goes over **HDMI**, the sound over **Dante** in 5.1. [Connecting a live piece](../reference/connecting.md) has the details.

| | How | What you need |
|---|---|---|
| **Picture** | HDMI at 3840 × 2160, the dome master centred as a 2160² square | An HDMI output, and OBS or your tool's fullscreen output |
| **Sound** | Dante, 6 channels in 5.1 | Dante Virtual Soundcard (paid) or a hardware Dante interface, and an Ethernet port |
| **Fallback** | Sound inside the HDMI cable | A stereo mix of your piece |

## 3. Rehearse on your laptop

Get your live output into the [Dome Simulator](../tools/dome-simulator.html). The [setup wizard](../setup/wizard.html) picks the steps for your laptop.

| Way in | How | When |
|---|---|---|
| **Share a window** | Simulator → *Share a screen, window or tab* | Always works; start here |
| **Virtual Dome monitor** | A second, invisible 2048² screen your tool goes fullscreen on | Cleaner picture, closest to a real output |
| **Capture card** | Your HDMI output goes into a USB capture card | Rehearses the real HDMI picture, at the real resolution |

## 4. Before the day

- Test with the same laptop, cables and adapters you will bring. Check the HDMI output really runs at 3840 × 2160.
- Sort out your Dante sender early: Dante Virtual Soundcard or a hardware Dante interface.
- Picture and sound travel separately: check in the room that they line up.
- Keep a stereo mix ready, in case you have to send the sound over HDMI.
- Write `runbook.md`: how a stranger starts your system in under two minutes.
- Record a **fallback**: your piece running, converted to the [delivery spec](../reference/delivery-spec.md).

MaU students: the fallback and runbook deadlines are on [Hand-in](../course/hand-in.md), and the course has a Dante box you can use.
