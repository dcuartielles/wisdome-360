---
title: Problems
---

# Problems and fixes

Find your symptom. If it isn't here, MaU students ask in the help-desk discussion on Canvas; anyone else can [open an issue](https://github.com/dcuartielles/wisdome-360/issues). Answers that help get added to this page.

## Picture

??? question "My subject sits too high, almost overhead"
    You probably centred it in the dome master. The centre of the master is the dome's zenith, which is 64° up. Move the subject towards the **bottom edge** of the master (the front) and aim it at 40° elevation. Turn on the guides in the Dome Simulator and check from the reference seat.

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

??? question "My NDI source doesn't show up on eduroam"
    eduroam blocks the discovery messages NDI uses. Start the bridge and the test sender with `--ips` and the other computer's address, or connect both computers to the same phone hotspot or a small switch.

??? question "The NDI picture stutters or lags"
    Your laptop is doing too much at once. Run the NDI bridge with `--half`, and close other programs. The status bar shows frames in and out.

??? question "My 5.1 sound comes out as stereo"
    You are probably connected by HDMI. HDMI carries stereo only. For 5.1 the piece has to send its sound by Dante, with the picture by NDI: see [Connecting a live piece](reference/connecting.md). If you stay on HDMI, make a stereo mix.
