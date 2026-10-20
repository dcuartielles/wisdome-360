---
title: Track B — live
---

# Track B: a live piece in the dome

Your laptop draws the dome master in real time and sends it to the dome. It can react: to sound, to the audience, to sensors. It can also fail, which is why every Track B group hands in a fallback recording.

## 1. Choose a tool

| If you want to… | Start from |
|---|---|
| React to sound, sensors or the network, fast | **EX-05** (TouchDesigner) |
| A game engine, 3-D scenes, audience input | **EX-06** (Unity + DomeTools) |
| Shaders in a browser, no install | **EX-03 Pulse** (WebGL / GLSL) |
| Gentle creative coding in a browser | **EX-04 Chorus** (p5.js) |
| Fly through space, real astronomy data | **EX-07** (OpenSpace) |

## 2. Rehearse on your laptop

There are three ways to get your live output into the [Dome Simulator](../tools/dome-simulator.html). The [setup wizard](../setup/wizard.html) picks the right one for your laptop.

| Route | How | When |
|---|---|---|
| **Share a window** | Simulator → *Share a screen, window or tab* | Always works; start here |
| **Virtual Dome monitor** | A second, invisible 2048² screen your tool goes fullscreen on | Cleaner picture, closest to a real output |
| **NDI** | Your tool sends NDI; the NDI bridge passes it to the simulator | The way you will connect in the venue |

## 3. Get ready for the venue

- **Two Ethernet links:** one for NDI video, one for Dante audio. Get USB-Ethernet adapters now if you need them.
- **Sound by Dante.** Sending Dante from a laptop needs Dante Virtual Soundcard, which is paid software: ask before you buy a licence.
- Write `runbook.md`: how a stranger starts your system in under two minutes.

## 4. The fallback recording

Record your piece running (screen capture of the dome-master output), convert it to the [delivery spec](../delivery.md), and hand it in with the audio by **Friday 08:00**. If your machine fails on Friday, the recording plays and your presentation continues. **No fallback, no live slot.**
