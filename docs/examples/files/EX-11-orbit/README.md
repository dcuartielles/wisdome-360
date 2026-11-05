# EX-11 Orbit · the dome as a musical instrument

**A live piece · WebGL + Web Audio · one HTML file · picture and 5.1 sound**

Three spheres of metal mesh orbit one another in a void: a **keyboard**, **drums** and a distorted **guitar**. You start at the centre of the keyboard. Bars ("readers") orbit inside each sphere and hum. White lines are notes. When a reader sweeps over a line at its own height, the line plays.

Open `orbit.html` in Chrome, Edge or Firefox and press **Start sound**. No install, no server, no libraries. It works from disk (`file://`) and from the course site.

Code: GPL-3.0. Text and pictures: CC BY-SA 4.0. The instrument was designed for the course's live dome slides; this is a standalone port of that slide.

## The instrument

| | |
|---|---|
| **Height is pitch** | Each sphere is cut into 10° bands, from its rim up to its pole. One note per band. Keyboard: C major pentatonic, C4 at the rim up to E5 (or A minor pentatonic). Drums: kick, toms, snare, clap, hats. Guitar: E minor pentatonic from E2 |
| **Below the rim** | The southern half of each sphere goes on down the scale. The drums have a second kit there (rim, cowbell, shaker, congas, clave, tambourine, woodblock, bongo, crash). Shift + drag up or down to tip it into view |
| **Position is space** | Every sound comes from where its line or reader is, in 5.1 |
| **Time is the orbit** | One orbit per 2 s once the notes start. A note lasts 0.5 s |

## The score (in the keyboard)

| Time | What happens |
|---|---|
| 0 s | One reader in the 20–30° band (E4), starting behind the audience, one orbit every 4 s, humming |
| 20 s | A line straight ahead. The reader speeds up over 3 s to one orbit every 2 s, then plays the line once per orbit |
| 30 s | Two more lines at ±120°: three notes per orbit |

**Next line(s) now** (or `N`) brings each stage in early. Switch off **Play the score by itself** to play it all by hand. `R` restarts. `orbit.html?t=31` starts 31 s into the score.

## Play it

Click on the dome master.

| Do | What happens |
|---|---|
| Click an empty cell | A line. If that height has no reader yet, one starts on the line, so you hear it at once |
| Click a line | Another reader at that height, starting from that line |
| Shift-click a line | Removes it. A height's last line takes its readers with it |
| Shift + drag | Turns the sphere you are in (from outside: the one under the mouse) |
| **Fly out** (`O`) | Leave backwards. The three spheres float ahead of you. Further away is quieter |
| Double-click a sphere from outside, or **Into …** (`1` `2` `3`) | Fly into it |
| **Clear my notes** (`C`) | Removes everything you added |

Other keys: `L` note names, `G` comfortable zone and sweet spot, `F` front marker, `H` hide the panel.

## Sound output

If the output device has 6 or more channels (Dante Virtual Soundcard set to 5.1, or the course's Dante box), the page sends discrete 5.1 in the order L R C LFE Ls Rs. Otherwise it downmixes to stereo. The panel shows which. In Chrome and Edge you can also pick the output device in the panel; otherwise set the default output in the operating system before you press **Start sound**.

## How picture and sound agree

Nothing is detected. A reader's angle is a closed-form function of time, so the moment of every hit is solved for (`hitsBetween`). The sound schedules each note on the audio clock about 250 ms ahead, and the picture runs the same function to flash the line. Everything (clicks, flights, rotations) is a timed entry in a log, and the world is rebuilt from that log every frame.

## Files

| File | |
|---|---|
| `orbit.html` | The whole piece |
| `preview/still-master.jpg` | The dome master at 31 s, note names on |
| `preview/still-flyout.jpg` | After **Fly out**: the three spheres from outside |
