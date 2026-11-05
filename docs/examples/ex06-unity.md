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
3. Add the **Dome Creator** rig to the scene. It replaces your normal camera and renders an equidistant fisheye dome master. Set its view angle to **160°**, not 180°: Wisdome's player spreads the *whole* circle of the master over its 160° screen, so a 180° master arrives squeezed towards the centre by 8/9. (DomeTools' *Dome Warp* mode is fixed at 180°; use its *Cubemap* mode, whose view angle can be set.)
4. Output **2048 × 2048**, square. Work at 1024 if the laptop struggles.
5. Drop in the two scripts.
6. DomeTools also ships **Dome Viewer**, which shows the rig's output on a Quest 3 (DomeTools sends it to the headset over NDI), so you can rehearse inside a virtual dome. That is for rehearsal only: the dome itself takes your picture over HDMI (below).

## The conventions the scripts assume

```text
+Y   up, towards the zenith
-Z   the FRONT of the room          -> azimuth 0
+X   the audience's right            -> azimuth +90
elevation 0 = eye level, 90 = straight up
comfortable zone = IN FRONT: elevation ~-16 (the rim) to ~45, azimuth -60 to +60
sweet spot       = azimuth 0, elevation ~19.6
```

The sweet spot comes from the venue's own scale: Wisdome counts angles **in the image**, 0 at the rim and 90 at the centre, and their sweet spot is "40". Straight ahead that is `(90 - Tilt) - (1 - SweetSpotVenue / 90) * Fov / 2` ≈ 19.6°; the zone runs from the rim at the front (about −16°) to 25° above the sweet spot (about 45°). All of these are constants at the top of `DomePlacement.cs`. Components already in your scene keep the zone values they were saved with: reset them, or retype them.

These are the **audience's** angles. Wisdome Malmö is tilted 26°, raised at the back, so tilt the Dome Creator rig to match: its zenith leaning 26° towards the front (−Z), with the world kept level. Then the angles above are what people in the seats see. Check which edge of the master is the front by looking at the output in the [Dome Simulator](../tools/dome-simulator.html) with the front marker on (++f++).

## A five-minute first scene

1. Empty scene, black skybox, no ambient light. **Keep the dome dark**: a bright field cross-reflects and greys out the whole image.
2. Create 20 emissive quads with `DomePlacement` on each. These are ambience: untick `clampToComfortableZone`, randomise azimuth over 360, elevation over 10–50, distance over 10–20. Then make one bigger quad, the subject: leave the clamp on and place it at azimuth 0, elevation ~20, the sweet spot.
3. Set `azimuthDrift` between −1 and 1. Small. Really small.
4. Add one GameObject with `DomeAudienceInput` and drive the emission intensity of the quads from `DomeAudienceInput.Level`.
5. Press Play. The Game view is a circle with the subject about halfway from the centre to the bottom (front) edge. The centre of the image is 64° up in front of the audience; straight overhead is *above* the centre, towards the top (back) edge.

If the subject drifts towards the top of the circle, it is over the audience's heads or behind them, and nobody will look at it.

## Sending it to the dome

See [Connecting a live piece](../reference/connecting.md).

- **Picture over HDMI:** the Game view fullscreen on the HDMI display, or captured in OBS and shown with its Fullscreen Projector. The display runs at 3840 × 2160, with the square master in the middle, 2160 × 2160, and black at the sides.
- **Sound over Dante:** 5.1, through Dante Virtual Soundcard or the course's Dante box. If Dante fails, the HDMI cable carries stereo sound.
- **Rehearse** in the [Dome Simulator](../tools/dome-simulator.html): share the window, use a virtual Dome monitor, or use a USB HDMI capture card.

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
