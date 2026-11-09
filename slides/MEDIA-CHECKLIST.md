# Media to prepare for the dome slides

Drop each file into the folder shown, with exactly that name. Until a file is there, the slide
shows a dashed placeholder card with the file name it is waiting for.

**Formats:** pictures .jpg / .png / .webp, about 1600–2500 px wide (on the dome a big picture is
roughly 650 px across at 2K, 1300 px at 4K, so more than 2500 px is wasted). Animated .gif works.
Video: .mp4 (H.264) or .webm, 1080p or less, 10–60 s loops are best; the sound is off until you press
its 🔊 button on the presenter.
**Swapping a picture for a video or GIF:** change the extension in that slide's `slide.js`
(`images: [...]` list), e.g. `eve.jpg` → `eve.mp4`.
**Credits:** note where each file came from (photographer / archive / licence) in the slide's notes.

## Act II · Who did this before (needed)

| ☐ | Folder | File | What | Good sources / video option |
|---|---|---|---|---|
| ☐ | `slides/09-sutherland/media/` | `hmd.jpg` | The head-mounted display with its ceiling arm, 1968 | Computer History Museum; Univ. of Utah archive. Video: the 1968 demo film exists as clips |
| ☐ | | `wireframe.jpg` | What the wearer saw (wireframe room/cube) | Sutherland 1968 paper figures; CHM |
| ☐ | `slides/10-vortex/media/` | `vortex-poster.jpg` | Programme or poster of the Vortex concerts, Morrison Planetarium | Center for Visual Music (Belson archive); Folkways *Highlights of Vortex* LP cover/notes |
| ☐ | | `belson.jpg` | Jordan Belson imagery (still from his films) | Center for Visual Music. **Video option:** a short Belson excerpt as `belson.mp4` |
| ☐ | `slides/11-philips/media/` | `pavilion.jpg` | Philips Pavilion exterior, Expo 58 | Philips company archives; Fondation Le Corbusier; Wikimedia Commons |
| ☐ | | `interior.jpg` | Inside: projections and loudspeakers | Philips archives. **Video option:** *Poème électronique* film excerpt as `interior.mp4` (with sound, nice for 5.1 demo) |
| ☐ | | `xenakis-sketch.jpg` | Xenakis' geometry of the hyperbolic-paraboloid shell | Xenakis archives; books (*Le Corbusier: Le Poème électronique*) |
| ☐ | `slides/12-shaw-zkm/media/` | `place-users-manual.jpg` | PLACE – a user's manual, 1995 (round screen, rotating platform) | jeffreyshawcompendium.com; ZKM |
| ☐ | | `eve.jpg` | EVE, Extended Virtual Environment, 1993 (inflatable dome) | jeffreyshawcompendium.com. **Video option:** `eve.mp4` |
| ☐ | | `place-hampi.jpg` | PLACE-Hampi (with Sarah Kenderdine) | sarahkenderdine.info; iCinema UNSW |
| ☐ | | `avie.jpg` | AVIE, the 360° stereoscopic screen, iCinema | iCinema UNSW |
| ☐ | `slides/13-allosphere/media/` | `allosphere-bridge.jpg` | The bridge through the sphere, people inside | allosphere.ucsb.edu (press images); ask MAT/UCSB |
| ☐ | | `allosphere-data.jpg` | Scientific data shown immersively | allosphere.ucsb.edu. **Video option:** `allosphere-data.mp4` |
| ☐ | `slides/14-sphere-vegas/media/` | `sphere-inside.jpg` | Inside the bowl during a show | Sphere Entertainment press kit. **Video option:** `sphere-inside.mp4` |
| ☐ | | `sphere-outside.jpg` | The exterior LED skin | Sphere press kit; Wikimedia Commons |

15 files. Each slide works with fewer (the carousel just has fewer pictures) and takes up to 6:
add more lines to its `images` list if you find more.

## Optional

| ☐ | Where | File | What |
|---|---|---|---|
| ☐ | `slides/02-flat/media/` | `slide.png` | Your own 16:9 slide (3840 × 2160) to show the three ways of putting a flat image on the dome, instead of the built-in test slide |
| ☐ | (new picture on the TouchDesigner slide) | `td-network.png` | A screenshot of a real TouchDesigner network (fisheye camera → render → NDI out). Tell me and I'll add a picture slot |
| ☐ | (new) | Wisdome photos | Your own photos of the room from Monday's visit (seats, the tilt, the rim): would make a nice picture slot on "The dome in the room" |
| ☐ | (new) | Student / previous dome work | Any finished dome masters (.mp4, square) you'd like to show live like EX-01/EX-02 |

## Already in place (nothing to do)

- EX-01 *Drift*, EX-02 *Tide* and EX-10 *Flight* movies (`outputs/06-examples/…`) for "Our examples: rendered".
- EX-03 *Pulse* and EX-04 *Chorus* pages for "Our examples: live".
- Everything else is drawn by the slides themselves (Malmö dome drawing, diagrams, comet, mic ring…).

## Watch: three fulldome pieces (slide 49b) — needed for that slide

Download the **"Fulldome Preview" MP4** of each (links and credits in
`slides/49b-fulldome-showcase/media/README.md`).

| ☐ | Folder | File | What | Source · licence |
|---|---|---|---|---|
| ☐ | `slides/49b-fulldome-showcase/media/` | `paranal-timelapse.mp4` | Paranal fulldome time-lapse, 1:33 | ESO · CC BY 4.0 · ESO/S. Brunier |
| ☐ | | `orion-flight.mp4` | Flight through the Orion Nebula, dome version, 4:34 | ESA/Hubble, NASA/STScI · see the credit line |
| ☐ | | `waiting-far-away.mp4` | Waiting Far Away, narrated short, 11:23 | ESO / Museum of Science, Boston · CC BY-ND · credits after the screening |

If OBS will not play an MP4, convert it to VP9:
`ffmpeg -i in.mp4 -c:v libvpx-vp9 -b:v 12M -c:a libopus out.webm`, then change the file name in the slide's `CLIPS` list.

## Open content for domes (slide 19b) — sources to know

The carousel already has a card for each source (`slides/19b-open-content/media/*.png`); replace
a card with a screenshot of the site if you prefer, same file name.
ESO (CC BY 4.0, credit in the picture) · ESA/Hubble fulldome archive · free shows to screen
(From Earth to the Universe, Losing the Dark, ESA Webb) · NASA SVS (public domain*) ·
Poly Haven (CC0 360° photos) · Freesound, RØDE ambisonics, Wikimedia Commons.
All with links in `media-sources.csv` / `media-to-collect.xlsx`.
