---
title: Where to put things
---

# Where to put things in the dome

## A dome master in four facts

A dome master is a square image in **equidistant azimuthal fisheye** projection. At Wisdome it is rendered with a **160°** field of view.

- **The centre of the circle is the dome's zenith, not straight up.** Wisdome Malmö is tilted 26°, raised at the back, so the centre of the image is **64° above eye level, straight ahead**.
- **The edge of the circle is the edge of the screen**: 16° below eye level at the front, 36° above eye level behind the audience. The venue's player spreads the **whole** circle over its 160° screen, so nothing is cropped.
- **Radius is linear in angle.** The edge is 80° from the centre, so a pixel halfway out is 40° from the dome's zenith.
- **The corners outside the circle are black** and are never projected.

Render at 160°, not 180°. A 180° master still plays, but everything in it is squeezed towards the centre by 8/9, and your angles no longer match the room.

## The comfortable zone

Measured from the seats, in room angles (0° = eye level, straight ahead):

| | Where | Use it for |
|---|---|---|
| **Sweet spot** | Straight ahead, **about 20° above eye level** | The one thing you most want people to see |
| **Comfortable zone** | From the bottom of the screen at the front (about −16°) up to **about 45°**, within **±60°** of the front | Your subject, text, faces |
| Behind and far to the sides | Outside the zone | Ambience: colour, texture, weather |
| Overhead | Above about 45° | Events and texture, not content: nobody can hold their head back for long |

Because the dome is tilted, this zone is **not a ring around the centre of the master**. Use a guide overlay that undoes the tilt: the Dome Simulator and every example draw one.

**Where the numbers come from.** The venue's technicians count angles in the image, 0 at the edge and 90 at the centre, like Paul Bourke's fulldome test pattern. Their sweet spot is "40". Straight ahead that is (90 − 26) − (1 − 40/90) × 160/2 ≈ **19.6° above eye level**. The zone follows Yu, Neafus & Wyatt's guidelines for a dome tilted like ours (*Filmmaking for Fulldome*, Planetarian, 2016–17): a relaxed gaze sits near eye level and reaches about 45° up.

## The five decisions every example makes

| Decision | Why |
|---|---|
| Near-black field, bright elements | A dome cross-reflects; a bright picture greys out the whole hemisphere |
| The subject in front, in the zone, aimed at the sweet spot | Below is behind seat backs, above needs a craned neck, behind means turning round |
| A front | The dome is tilted; warm at azimuth 0 and cool behind gives the image a direction |
| Texture at the zenith, never content | So the middle isn't a dead hole, but nothing there needs to be seen |
| Slow motion, zero roll | Think in degrees per second, not per frame. Never rotate around the view axis |

## Text size

A 2048 master spans 160°, so **1° = 12.8 px** at 2K and 25.6 px at 4K.

| | Cap height | At 2048² | At 4096² |
|---|---|---|---|
| Absolute minimum | 1.5° | 19 px | 38 px |
| Body text people must read | 3° | 38 px | 77 px |
| Titles | 6° and up | 77 px and up | 154 px and up |

Check your own font with the EX-09 type-size card from the back row of the simulator.
