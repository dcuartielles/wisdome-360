---
title: EX-07 OpenSpace
---

# EX-07 · OpenSpace

**A live piece · a custom asset plus a tour script · make work inside the software the dome already runs**

[OpenSpace](https://www.openspaceproject.com) is open source (MIT), developed with Linköping University, the American Museum of Natural History, NYU, the University of Utah and NASA. It is the main software of the Wisdome network, Malmö included. If you have a dataset and some scripting nerve, this is how you put *real data* in front of an audience rather than a picture of data.

Docs: <https://docs.openspaceproject.com>

## Files

| File | What it is |
|---|---|
| [`malmo_marker.asset`](files/EX-07-openspace/malmo_marker.asset) | The smallest complete custom asset: one labelled object standing on Earth at Malmö, plus a plane for your own image. It shows the shape every OpenSpace asset has |
| [`tour.lua`](files/EX-07-openspace/tour.lua) | A timed four-minute journey from Malmö out to the Milky Way, with a note on driving it from outside for a live performance |

## How OpenSpace content is made

Three layers. You can stop at any of them.

1. **A profile:** which assets load, where the camera starts, what is visible. Edited in the Launcher, no code. You can build a real piece at this level alone.
2. **An asset** (`.asset`, Lua): adds your own object, dataset or image to the scene graph. `malmo_marker.asset` is a complete example.
3. **A script** (Lua, or the WebSocket API from Python or JavaScript): drives the camera, time and properties. This is where a *show* comes from.

## Run it

**The asset.** Put `malmo_marker.asset` (and your image) in `<openspace>/data/assets/customization/`. In the Launcher, open your profile → *Assets* → add `customization/malmo_marker`. Launch: the marker is in the scene tree as "Malmo Marker".

**The tour.** In the console: `openspace.scriptScheduler.loadFile("tour.lua")`, or bind it to a key in your profile.

The script scheduler runs in *simulation* time. For a performance, drive the steps from outside instead: OpenSpace has a WebSocket API, so a short Python script can send each step at the right wall-clock second, or when you press a key. That matters on the day, when the audience is slower than your rehearsal. The end of `tour.lua` shows how.

## Before you commit to OpenSpace

Ask the venue, in this order. If the first answer is no, choose another tool straight away.

1. **Is OpenSpace installed on the dome machine, and can we load our own profile and assets into it?**
2. Which version? The Lua API changes between releases, and these examples may need adjusting.
3. Can we use a machine with that version while we develop, or do we work on our own laptop install?
4. Is the network open enough for the WebSocket API, if we want to drive it live?

## Three things that make an OpenSpace piece good rather than impressive

- **Hold the shot.** The instinct is to keep flying. In a dome, a held frame is when the audience finally looks around the rest of the hemisphere. Nothing in `tour.lua` moves in under twelve seconds, on purpose.
- **Bring your own data.** A flight through the default solar system is a demo everyone has seen. A flight through *your* dataset (cycle routes, migration, ocean temperature, anything with coordinates) is a piece.
- **Frame the subject in front.** The comfortable zone is 15°–60° above eye level, ±60° to the sides, with the sweet spot straight ahead at 40° up ([Where to put things](../reference/comfortable-zone.md)). The dome's own OpenSpace set-up already accounts for the 26° tilt. On your laptop, set the fisheye tilt in your window configuration to match before you judge a framing.

## Record the fallback

OpenSpace can render frames to disk. Set the output to square, 2048², 30 fps, run the tour once, and encode with the line in the [delivery spec](../reference/delivery-spec.md#video) (OpenSpace numbers its frames with six digits, so use `frame_%06d.png`).

## What usually breaks

| Symptom | Cause |
|---|---|
| A call in the asset or tour is rejected | The Lua API changed in your version. Check the docs for that version: the *shape* of an asset is stable even when function names aren't |
| The marker doesn't appear | The asset isn't in the profile, or the file isn't under `data/assets/customization/` |
| The tour runs too fast or too slow | It is in simulation time. Drive it from outside for a performance |
| The framing looks right on the laptop and wrong in the dome | The laptop's fisheye isn't tilted 26° like the dome |
