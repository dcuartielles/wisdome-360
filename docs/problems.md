---
title: Problems
---

# Problems and fixes

Find your symptom. If it isn't here, MaU students ask in the help-desk discussion on Canvas; anyone else can [open an issue](https://github.com/dcuartielles/wisdome-360/issues). Answers that help get added to this page.

## Picture

??? question "My subject sits too high, almost overhead"
    You probably centred it in the dome master. The centre of the master is the dome's zenith, which is 64° up. Move the subject towards the **bottom edge** of the master (the front) and aim it at the sweet spot, about 20° above eye level. Turn on the guides in the Dome Simulator and check from the reference seat.

??? question "The horizon is bent or slopes"
    Your camera isn't tilted like the venue. In Blender rotate the fisheye camera `180° − 26°` about X; in TouchDesigner set Rotate X to 64. Then check again in the simulator.

??? question "Text that was fine on my screen is unreadable"
    It is too small in degrees. The minimum is 1.5° cap height (~17 px at 2K), 3° for anything people must read. Check with the EX-09 type card from the back row (`4` in the simulator). Never type text straight onto the master: put it on a flat card through the fisheye (EX-08).

??? question "A flat picture looks stretched and curled near the edge"
    It was pasted straight onto the dome master. Put it on a flat screen in the room and render it through the fisheye instead: EX-08 for stills and slides, EX-10 for moving footage.

??? question "Everything looks washed out and grey"
    The dome reflects light onto itself. A bright background greys out the whole hemisphere. Keep the field near black and make only the elements bright. The simulator's *Simulate cross-reflection* shows the effect.

??? question "Motion that looked calm on the laptop makes people feel sick"
    On an 11.6 m dome every movement is much bigger. Think in degrees per second, keep camera moves slow, and never roll (rotate around the view axis).

## Simulator and connections

??? question "Screen sharing is refused in the simulator"
    Open the simulator from this site (it is served over HTTPS), or start it with the `start-simulator` launcher. Browsers refuse screen sharing from a file opened directly from disk in some setups.

??? question "My 5.1 sound comes out as stereo"
    Your sound is going inside the HDMI cable, which carries stereo only. For 5.1, send the sound by Dante, with the picture still on HDMI. See [Connecting a live piece](reference/connecting.md).

??? question "The dome shows my picture small, or blurry"
    Your HDMI output is probably running at 1920 × 1080, so the dome only gets a 1080² master. Set the HDMI display to **3840 × 2160** and centre the 2160² square, as on [Connecting a live piece](reference/connecting.md#the-picture-hdmi). Some adapters drop to 1080p without saying so.

??? question "Picture and sound are out of sync"
    They travel by different cables (HDMI and Dante), and OBS adds a frame or two. Delay the sound (or the picture) in your piece until a flash and a click line up, watched from the seats.

??? question "Everything looks smaller and pulled towards the middle"
    You probably rendered a 180° fisheye. Wisdome spreads the whole circle over a 160° screen, so a 180° master is squeezed by 8/9. Render at **160°**: in Blender set the fisheye field of view to 160°; in TouchDesigner set FOV Angle to 160.
