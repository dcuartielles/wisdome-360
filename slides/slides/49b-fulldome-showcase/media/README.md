# Media for "Watch: three fulldome pieces"

Download the **Fulldome Preview MP4** of each and save it here with exactly these names.
(The 4K masters are frame archives of 12–186 GB: not needed for the lecture.)

| Save as | Piece | Page (download on the right: "Fulldome Preview") | Licence / credit |
|---|---|---|---|
| `paranal-timelapse.mp4` | Paranal fulldome time-lapse (1 min 33 s, 137 MB) | https://www.eso.org/public/videos/brunier_paranal_fd/ | ESO, CC BY 4.0 · credit **ESO/S. Brunier** |
| `orion-flight.mp4` | Flight through the Orion Nebula in visible and infrared light, dome version (4 min 34 s, 123 MB) | https://esahubble.org/videos/flight_through_orion_vis/ | NASA, ESA, F. Summers, G. Bacon, Z. Levay, J. DePasquale, L. Hustak, L. Frattare, M. Robberto, M. Gennaro (STScI), R. Hurt (Caltech/IPAC); acknowledgement R. Gendler · music Dvořák, Advent Chamber Orchestra, CC BY-SA |
| `waiting-far-away.mp4` | Waiting Far Away, fulldome short (11 min 23 s, 926 MB) | https://www.eso.org/public/videos/waitingfaraway/ | CC BY-ND 4.0 + exhibition licence from the Charles Hayden Planetarium, Museum of Science, Boston · show the credits after the screening · do not edit or redistribute |

If OBS will not play an MP4, convert it to VP9 and change the file name in `CLIPS` in `../slide.js`:

    ffmpeg -i waiting-far-away.mp4 -c:v libvpx-vp9 -b:v 12M -c:a libopus waiting-far-away.webm
