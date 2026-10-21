---
title: Examples
---

# Examples

Ten worked examples: one per tool, plus three utilities. Seven of them render or run as they stand; the other three are recipes with working code for software you install first. Each one makes the same five decisions on purpose (see [Where to put things](../reference/comfortable-zone.md#the-five-decisions-every-example-makes)), so once you have read one, the others are quick.

| # | Name | Tool | Film or live | What it shows |
|---|---|---|---|---|
| [EX-01](ex01-drift.md) | Drift | Blender / Cycles | Film | A 3-D scene through a tilted fisheye camera |
| [EX-02](ex02-tide.ipynb) | Tide | Python + numpy | Film | Generating every frame of a dome master in code |
| [EX-03](ex03-pulse.md) | Pulse | WebGL / GLSL | Live | A live, microphone-reactive shader in one HTML file |
| [EX-04](ex04-chorus.md) | Chorus | p5.js | Either | The gentlest entry point, runs offline |
| [EX-05](ex05-touchdesigner.md) | — | TouchDesigner | Live | Recipe + two GLSL TOPs: zone guide, 360 footage → dome master |
| [EX-06](ex06-unity.md) | — | Unity + DomeTools | Live | Placing objects by angle, audience input from a microphone |
| [EX-07](ex07-openspace.md) | — | OpenSpace | Live | A custom asset and a timed tour |
| [EX-08](ex08-flat-to-dome.ipynb) | Flat to Dome | HTML / Python / ffmpeg | Either | Slides, photos and 16:9 video → dome master |
| [EX-09](ex09-type-size.ipynb) | Type size | Python + Pillow | Either | Test card: how small can text be |
| [EX-10](ex10-flight.ipynb) | Flight | Python + OpenCV | Either | Green-screen footage keyed and flown around the room |

Not sure where to start? [Making a film](../make/film.md) and [Making a live piece](../make/live.md) each have a table that picks one for you.

## The one thing they all teach

**Compose by angle, not by pixel.** Every example converts `(azimuth, elevation)` into whatever the tool needs, then does all its thinking in degrees. Azimuth 0 is the front of the room; elevation 0 is eye level. Once that is a habit, the comfortable zone stops being a rule to remember and becomes two pairs of numbers you can clamp: 15°–60° up, ±60° from the front.

**Measure from the audience, not from the image centre.** Wisdome Malmö is tilted 26°, raised at the back, so the centre of a dome master is 64° up in front of the audience, not overhead. Every example handles the tilt in one place, and its guide overlay undoes the tilt before drawing the zone.

## The Python examples are notebooks

EX-02, EX-08, EX-09 and EX-10 are Jupyter notebooks. Open one here to read it, press **Open in Colab** at the top to run it in your browser with nothing installed, or download it (the button at the top of the page) and run it in Jupyter. Each one also comes as a plain `.py` script that does the whole job from the command line.

## Getting the files

Each page links its own files. To get everything at once, download the [repository as a zip](https://github.com/dcuartielles/wisdome-360/archive/refs/heads/main.zip): the examples are in `docs/examples/files/`, one folder per example.

The rendered films of EX-01 and EX-02 are on the [Releases page](https://github.com/dcuartielles/wisdome-360/releases/tag/examples-media), because videos don't go in the repository. They are encoded at a lower bitrate than the [delivery spec](../reference/delivery-spec.md) so they download quickly.

Check anything these produce in the [Dome Simulator](../tools/dome-simulator.html): it is an ordinary dome master.

## Licences

The example code is GPL-3.0; the text, pictures and films are CC BY-SA 4.0. Two things bundled with the examples keep their own licences: p5.js (LGPL-2.1, in EX-04) and the fonts in EX-09 (SIL Open Font License, with their licence files). The dove footage used by EX-10 isn't here: its licence doesn't allow it, so the page tells you where to get it. Everything is listed in [Credits](../credits.md).
