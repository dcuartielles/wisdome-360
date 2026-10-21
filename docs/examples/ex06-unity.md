---
title: EX-06 Unity + DomeTools
---

# EX-06 · Unity + DomeTools

**A live piece · a recipe plus two C# components · the right choice if you already know Unity**

Don't learn Unity for a dome piece. If you already know it, this is the shortest path from a Unity scene to the dome, and it comes with a headset viewer for free.

## Files

| File | What it does |
|---|---|
| [`DomePlacement.cs`](files/EX-06-unity-dometools/DomePlacement.cs) | Place any object by **(azimuth, elevation, distance)** instead of XYZ. Can clamp it into the comfortable zone, and draws the zone, the sweet spot and the front marker as Scene-view gizmos |
| [`DomeAudienceInput.cs`](files/EX-06-unity-dometools/DomeAudienceInput.cs) | Reads the microphone and exposes `DomeAudienceInput.Level` and `.Bass`. The audience's own voice is the cheapest real interaction they can have with your piece |

## Set it up

1. Unity 2022 LTS or Unity 6, any render pipeline.
2. Install **[DomeTools](https://github.com/prefrontalcortex/DomeTools)**: *Package Manager → Add package from git URL*.
3. Add the **Dome Creator** rig to the scene. It replaces your normal camera and renders an equidistant fisheye dome master.
4. Output **2048 × 2048**, square. Work at 1024 if the laptop struggles.
5. Drop in the two scripts.
6. For live output over NDI, enable **NDI** on the Dome Creator rig. DomeTools also ships **Dome Viewer**, which receives the same NDI stream on a Quest 3, so you can rehearse inside a virtual dome.

## The conventions the scripts assume

```text
+Y   up, towards the zenith
-Z   the FRONT of the room          -> azimuth 0
+X   the audience's right            -> azimuth +90
elevation 0 = eye level, 90 = straight up
comfortable zone = IN FRONT: elevation 15 to 60, azimuth -60 to +60
sweet spot       = azimuth 0, elevation 40
```

These are the **audience's** angles. Wisdome Malmö is tilted 26°, raised at the back, so tilt the Dome Creator rig to match: its zenith leaning 26° towards the front (−Z), with the world kept level. Then the angles above are what people in the seats see. Check which edge of the master is the front by looking at the output in the [Dome Simulator](../tools/dome-simulator.html) with the front marker on (++f++).

## A five-minute first scene

1. Empty scene, black skybox, no ambient light. **Keep the dome dark**: a bright field cross-reflects and greys out the whole image.
2. Create 20 emissive quads with `DomePlacement` on each. These are ambience: untick `clampToComfortableZone`, randomise azimuth over 360, elevation over 20–55, distance over 10–20. Then make one bigger quad, the subject: leave the clamp on and place it at azimuth 0, elevation 40, the sweet spot.
3. Set `azimuthDrift` between −1 and 1. Small. Really small.
4. Add one GameObject with `DomeAudienceInput` and drive the emission intensity of the quads from `DomeAudienceInput.Level`.
5. Press Play. The Game view is a circle with the subject a little below the centre, towards the bottom (front) edge. The centre of the image is 64° up in front of the audience; straight overhead is *above* the centre, towards the top (back) edge.

If the subject drifts towards the top of the circle, it is over the audience's heads or behind them, and nobody will look at it.

## Sending it to the dome

See [Connecting a live piece](../reference/connecting.md).

- **NDI + Dante:** NDI from the Dome Creator rig; sound over Dante.
- **HDMI:** the signal is **16:9**. Show the square master in the middle of a fullscreen 16:9 output with black at the sides. Stereo sound in the same cable.

## Record the fallback

**Unity Recorder → Image Sequence**, 2048 × 2048, 30 fps, from the Dome Creator's output. Encode with the line in the [delivery spec](../reference/delivery-spec.md#video).

## What usually breaks

| Symptom | Cause |
|---|---|
| The horizon goes dark at the edge of the circle | **Post-processing vignette** is computed on the flat master, not on the dome. Turn it off. Bloom is fine and usually helps |
| Shading glitches in a ring or seam | **Screen-space effects** (SSAO, screen-space reflections) break across the fisheye. Avoid them |
| UI appears as a flat rectangle pasted over the fisheye | A **Screen Space** Canvas. Use world-space objects |
| People feel sick | **Camera roll**. Never animate rotation about the view axis |
| The microphone makes a howl | It hears the dome's own speakers. Aim it at the seats, gate it, or lower `gain` |
