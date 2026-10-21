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

## 2. Choose how you connect

Decide this early, because it decides your sound. [Connecting a live piece](../reference/connecting.md) has the details.

| | Picture | Sound | Cables |
|---|---|---|---|
| **NDI + Dante** | NDI | Dante, **5.1** | Two Ethernet links |
| **HDMI** | HDMI | Same cable, **stereo only** | One HDMI cable |

## 3. Rehearse on your laptop

Get your live output into the [Dome Simulator](../tools/dome-simulator.html). The [setup wizard](../setup/wizard.html) picks the steps for your laptop.

| Route | How | When |
|---|---|---|
| **Share a window** | Simulator → *Share a screen, window or tab* | Always works; start here |
| **Virtual Dome monitor** | A second, invisible 2048² screen your tool goes fullscreen on | Cleaner picture, closest to a real output |
| **NDI bridge** | Your tool sends NDI; the bridge passes it to the simulator | Rehearses the NDI + Dante route |
| **Capture card** | Your HDMI output goes into a USB capture card | Rehearses the HDMI route |

## 4. Before the day

- Test your connection route with the same laptop, cables and adapters you will bring.
- NDI + Dante: sending Dante from a laptop needs Dante Virtual Soundcard (paid) or a hardware Dante interface. Sort that out early.
- HDMI: make a stereo mix if your sound was planned in 5.1.
- Write `runbook.md`: how a stranger starts your system in under two minutes.
- Record a **fallback**: your piece running, converted to the [delivery spec](../reference/delivery-spec.md).

MaU students: the fallback and runbook deadlines are on [Hand-in](../course/hand-in.md).
