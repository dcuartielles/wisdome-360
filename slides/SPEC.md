# Live HTML5 dome slides — technical spec

Branch `html5-live` · started 2026-10-11 · rev 2 (laptop first, Mac mini spare) · status: **draft, nothing built yet**
Backup: everything made before this branch is on `main`, tagged `v1.1-docs`
(printed brief, cheatsheet, .pptx deck, fisheye PNG slides, examples). If the live setup
fails on the day, that material is still there and works without any of this.

---

## 1. Goal

A set of **interactive slides, written in HTML5, presented live in the Wisdome dome**.
They run on one machine in the room (the laptop, with the Mac mini as spare) and show how the system works with demos that
actually run: fisheye geometry you can drag around, 5.1 sound you can move around the room,
live video in the dome, things the audience can control.

The output goes to the dome the same way a Track B student's laptop would: **NDI for
video, Dante for audio**. So the lecture also tests the student pipeline before the
students rely on it.

## 2. What the venue gives us (confirmed 2026-10-11)

| | |
|---|---|
| Video in | **NDI** (dedicated Ethernet) or **HDMI** |
| Audio in | **Dante** (dedicated Ethernet), **6 channels**: L, R, C, LFE, Ls, Rs |
| Network | **2 Ethernet links**, one per network. They are separate networks |
| Image | fisheye. Start at **2048 × 2048**, max **6144 × 6144** |
| Geometry | **160°** opening · tilt **26°**, raised at the back · the venue spreads the **whole file over 160°** (a 180° file is squeezed), so we render at **160°** · venue angles count **0 at the image edge, 90 at the image centre** (= 64° up, ahead) · sweet spot = **their 40° ≈ 20° above eye level**, straight ahead · comfortable zone **in front**: about 0–45° up, ±60° to the sides (first guess, check in the dome) |
| Slides (venue's own guidance) | 16:9, ~2K high, content centred, consider a fisheye render |
| Unknown | NDI latency · whether NDI maps to the full fisheye or a flat window · which edge of the image faces the front · whether a guest machine can join their Dante network on its own, or a technician has to route it |

## 3. Which machine

### Candidates
| | **Mac mini M4, 64 GB** | **Current laptop** |
|---|---|---|
| CPU | Apple M4: 10 cores, built for sustained load | Intel Core i7-1355U: 10 cores (2 performance + 8 efficiency), 15 W class |
| GPU | Apple M4 GPU, hardware video encode/decode | Intel Iris Xe (integrated) |
| RAM | 64 GB unified | 32 GB |
| OS | macOS | Windows |
| Ethernet | 1 built in + 1 via Thunderbolt/USB-C adapter | probably 0 built in → 2 adapters |
| Display out | HDMI built in + Thunderbolt | depends on model |
| Cooling | desktop, does not throttle | thin laptop, throttles under sustained load |

### Decision (2026-10-11): build for the laptop, keep the Mac mini as the spare
**The laptop is the target.** Everything is designed and tuned to run on the i7-1355U.
**The Mac mini is the warm spare**, set up identically. If the laptop can't keep up,
the same code runs on the Mac with no changes. Moving over means plugging the two
Ethernet cables into the other machine and starting the same launch script.

What this means for the build:
- **Portable by rule.** Plain HTML/JS + Node, nothing platform-specific. Audio devices
  and NDI names are chosen by name on the presenter page, never hard-coded. One launch
  script per OS (`setup/start-win.ps1`, `setup/start-mac.sh`), doing the same steps.
- **A performance budget set by the laptop.** Every slide has to hold **30 fps at
  2048²** on the laptop, with NDI and Dante running, for 20 minutes without throttling.
  A slide that only holds up on the Mac gets simplified, or turned into a pre-rendered
  video inside the slide.
- **Quality tiers.** Each slide has `low / normal / high` settings: cubemap face size,
  particle counts, shader steps. The laptop runs `normal`. The Mac can run `high`
  without anyone touching the code.
- **A live fps/CPU meter on the presenter page**, so you see trouble before the
  audience does.
- **The Windows audio path gets tested first.** On Windows, Chrome reaches Dante
  Virtual Soundcard through the shared system mixer. The 6 channels only arrive
  discretely if the DVS device is set to **5.1** in Windows sound settings. That is
  the riskiest step on the laptop, so phase 1 tests it before anything else. On the
  Mac the same step is straightforward.
- **Fallbacks stay.** Every demo still gets a pre-rendered fisheye .mp4 plus 6 WAVs
  (Track A spec), stored on both machines and on a USB stick.

The laptop needs: mains power the whole time, Windows set to **Best performance**,
Windows Update and notifications paused, and **two Ethernet ports**, which probably
means two USB-C adapters (or one dock with two ports). 32 GB of RAM is plenty. *To check: which ports it has.*

## 4. Signal path

```
            ┌──────────────── laptop (main)  ·  Mac mini (spare, identical) ────────────────┐
            │                                                                               │
            │  local server (Node) ── one shared state over WebSocket ──┬──────────────┐   │
            │        ▲                                                  │              │   │
            │        │                                                  ▼              ▼   │
            │  presenter.html  (Chrome, on the laptop screen)    video.html        audio.html
            │  next/prev · notes · demo controls · flat preview  in OBS Browser    in a Chrome tab
            │  fps/CPU meter · audio delay                       Source, 2048²     Web Audio, 6 ch
            │                                                       │                 │
            │                                                OBS + DistroAV   Dante Virtual Soundcard
            └───────────────────────────────────────────────────────┼─────────────────┼──────────┘
                                                                     ▼                 ▼
                                                      Ethernet A → dome video   Ethernet B → dome audio
                                                           (NDI)                     (Dante)
            phone(s) ──WS──► local server   (optional: audience interaction, own Wi-Fi)
```

**Picture and sound run in two separate pages, driven by one shared state.** Every
interaction goes into the server first, and both pages follow it.
- The laptop screen is about 1920 × 1200, and a 2048 × 2048 page doesn't fit on it. So
  the picture can't come from capturing a normal browser window. An **OBS Browser
  Source** renders the page off-screen at any size, so the picture is exactly 2048²
  on both machines, whatever screen is attached.
- Sound comes from an ordinary Chrome tab, so it can open Dante Virtual Soundcard with 6
  discrete channels. Audio from inside OBS is harder to get out as 6 separate channels.
- Mouse and keyboard demos are driven from the presenter page. The dome picture is
  never clicked directly.

### 4.1 Video: browser → NDI
A browser can't send NDI by itself. Something has to render the page and send it.
Options, simplest first:

| Route | How | For | Against |
|---|---|---|---|
| **A. OBS Browser Source + DistroAV** (formerly obs-ndi) | `video.html` loaded as a 2048² Browser Source, 30 fps. DistroAV publishes OBS's output as an NDI source | Free, the same on Windows and Mac, renders off-screen at an exact size, OBS shows render stats | OBS's built-in browser lags behind Chrome by a few versions. Camera access inside it needs checking |
| **B. Chrome on a virtual 2048² display + capture** | A virtual display driver (Windows) or a virtual screen (Mac), Chrome full screen on it, OBS display capture → NDI | Real Chrome, camera access is easy | A display driver to install, and more parts to break |
| **C. Node + NDI SDK** | The page sends its frames to the local server, which sends them with the NDI SDK | Fully under our control | Custom native code, and the heaviest load on the laptop's CPU |

**Start with A.** If a slide needs something the OBS browser can't do (most likely the
live camera), test B for that slide in phase 1.
HDMI out is the fallback: the same page full screen on the machine's HDMI port.

Bandwidth: full-bandwidth NDI at 2048² and 30 fps is a few hundred Mbit/s at most, well
within gigabit. NDI|HX uses far less if it's ever needed.

### 4.2 Audio: browser → Dante

**Before paying for anything, ask the venue whether audio can come in another way.**
NDI carries multichannel audio inside the video stream, and HDMI carries up to 8
channels of PCM. If the dome's media server will take the 6 channels from NDI (or HDMI)
and route them to the speakers, we don't need Dante at all, and nothing has to be paid
for. Ask this first.

**If it has to be Dante** (checked 2026-10-11):
| Route | Cost | Platforms | Verdict |
|---|---|---|---|
| **Dante Virtual Soundcard, Transferable licence** | about US$93 + VAT, one-off; free trial available | Windows (ASIO/WDM), macOS (Core Audio) | **Default.** One licence moves between the laptop and the Mac, active on one at a time. It must check in online every 30 days. Do phase 1 on the trial |
| **AES67** (open standard) via **PipeWire** (`pipewire-aes67`, open source) | free | **Linux only** | Works only if the technician switches the dome's Dante gear to **AES67 mode** (multicast, PTP clock). Not every Dante device supports it. Would mean presenting from Linux. A fallback experiment, not the plan |
| **Inferno** (open-source, reverse-engineered Dante) | free, GPL/AGPL | Linux only | Its own README calls it highly experimental, fine for non-critical use. Not for a live class |
| RAVENNA/AES67 virtual sound cards (Merging/Neumann VAD) | paid unless you own their hardware | macOS | No better than DVS for us |

There is no mature, free Dante implementation for Windows or macOS.

- **Dante Virtual Soundcard** (Audinate, paid licence) on both machines, bound to
  Ethernet B. It appears as an audio device with 6+ channels. *Check whether one
  licence can move between the laptop and the Mac, or whether we need two.*
  → Answered: the **Transferable** licence moves between machines (one active at a time).
- **Windows:** in Sound settings, set the DVS playback device to **5.1** at 48 kHz.
  Otherwise Chrome mixes everything down to stereo. **Mac:** use Audio MIDI Setup to
  check the DVS device is at 48 kHz.
- In `audio.html`: `new AudioContext({ sinkId: <DVS device> })` (Chrome 110+; or
  `setSinkId()`), then `destination.channelCount = 6`,
  `channelCountMode = 'explicit'`, `channelInterpretation = 'discrete'`. Build the mix with
  a `ChannelMergerNode(6)` in the order **L R C LFE Ls Rs**, so nothing gets up- or
  down-mixed.
- The venue technician subscribes the 6 DVS channels to the dome's inputs in Dante
  Controller. **Ask them for this routing in advance.**
- Autoplay: launch Chrome with `--autoplay-policy=no-user-gesture-required`, or start
  the audio engine from a "start" button on the presenter page.

### 4.3 Sync
Video goes browser → capture → NDI → the dome's media server. Audio goes browser → DVS →
Dante. The two paths have **different latencies**, so the page has one global
**audio delay** (a `DelayNode` on every channel), adjustable from the presenter page and
set at the venue against a flash-and-click test slide. NDI is usually the slower of the
two, so audio gets delayed rather than video.

Because picture and sound are two pages, every state change carries a server timestamp.
Both pages act on it at the same moment, not whenever the message happens to arrive.
The delay value is stored per machine, because the laptop and the Mac will differ.

## 5. Software stack

| Layer | Choice | Why |
|---|---|---|
| Rendering | Plain WebGL2 / GLSL, plus **three.js** (bundled offline) when a slide needs 3D | Matches the existing examples (EX-03, the dome viewer) |
| Fisheye | Two helpers in `lib/`: (1) a **per-pixel fisheye ray** for shader/2D slides, which is exact and cheap; (2) **cubemap → fisheye** for three.js scenes | Same maths as EX-05 and the dome viewer |
| Geometry constants | one `dome.js`, two halves: the **file** (fov 160°, tilt 26°) and the **venue** (spreads the file over 160°, tilt 26°, opening 160°); sweet spot on the venue's scale (40) and the zone around it are derived | All five can be changed live from the presenter's **Projection** panel (presets: made right · 180° file squeezed · planetarium file · no tilt · classic planetarium) |
| Audio | Web Audio, 6 ch discrete; panning by **azimuth/elevation → 5.1 gains** (VBAP-style) in `lib/audio51.js` | Lets a sound "sit" at a point on the dome |
| Video in slides | `<video>` → WebGL texture; `getUserMedia` for a live camera | Hardware decode on the M4 |
| Control | Node + `ws` (WebSocket) on the presenting machine; video, audio and presenter pages share one state | Remote control and audience interaction use the same channel |
| Offline | everything vendored: no CDN, no internet assumed in the dome | The venue network is closed |

Resolution: the canvas renders at **2048²** by default, with a `?res=` switch for 3072
or 4096 once performance has been measured. 6K is out of scope.

## 6. Folder layout on this branch

```
live/
  SPEC.md                 this file
  server/                 Node: static files + WebSocket state + /api for the remote
  video/index.html        the dome picture: square canvas, loaded in OBS at 2048²
  audio/index.html        the dome sound: Web Audio, 6 ch → DVS (runs in a Chrome tab)
  presenter/index.html    laptop/phone: next/prev, notes, flat preview, demo controls, fps meter
  lib/                    dome.js · fisheye.js · cube2fish.js · audio51.js · sync.js
  slides/NN-name/         one folder per slide: slide.js (init/render/audio/dispose) + assets
  vendor/                 three.js etc., pinned versions, offline
  test/                   test card · 6-channel ident · AV sync flash · stress slide
  fallback/               rendered .mp4 + 6 WAVs per demo (Track A spec)
  setup/                  start-win.ps1 · start-mac.sh · OBS scene collection (same on both)
                          · DVS notes per OS · machine-swap checklist
```

Every slide is a module with the same four hooks, so the engine can preload the next
slide and tear down the previous one without leaking GPU memory. A slide declares its
picture part and its sound part; `video.html` loads one, `audio.html` loads the other.

## 7. Phases and gates

| # | Phase | Done when | Gate |
|---|---|---|---|
| 0 | **Branch + spec** | this file on `html5-live`, the old work tagged `v1.1-docs` | ✔ |
| 1 | **Pipeline spike** (laptop first, then the same on the Mac) | test card + 6-ch ident + sync flash → visible in NDI Studio Monitor on the *other* machine; DVS on Windows passes 6 discrete channels; a **stress slide** (cubemap → fisheye, video texture, 6-ch audio) holds 30 fps at 2048² for 20 min | **Which machine presents.** Laptop passes → laptop. Laptop fails, Mac passes → Mac, laptop becomes the remote. Both fail → .pptx/PNGs plus recordings |
| 2 | **Engine** | video + audio + presenter pages + server; slide lifecycle; quality tiers; fps meter; audio delay; preview via the existing `dome-viewer.html` | runs 90 min on the laptop without dropped frames or memory growth |
| 3 | **Venue test** (needs a slot with the technician) | the same spike in the dome: NDI mapping, the front edge, Dante routing, AV offset measured | constants in `dome.js` fixed for good |
| 4 | **Content** | the concept slides (list below), each with its fallback recording | every slide has a fallback |
| 5 | **Rehearsal** | full run in the dome on the laptop, then one swap to the Mac mid-run, timed | swap takes < 2 min |

The point of phase 1 is to prove the whole chain with something trivial **before** any
content exists. Phase 3 comes early because three venue answers change the code.

### Candidate content (to agree)
1. What a dome master is: drag a point, watch it move on the fisheye and in the dome preview
2. 160° opening, the tilt and the front: the same image rotated and cropped live
3. The comfortable zone (a patch in front around the sweet spot, ±60° to the sides), the sweet spot (venue 40° ≈ 20° up) and the venue's own angle scale: overlays you can switch on
4. Motion: slow vs fast global motion, with the speed on a slider (motion sickness, safely)
5. 5.1 in a dome: move a sound around the room from the remote; LFE on its own
6. Flat vs fisheye render: the venue's 16:9 slideshow route shown side by side with a true dome master
7. Live input: camera → dome, and what NDI latency looks like
8. Audience in the loop: phones on a local Wi-Fi (our own travel router) → WebSocket → the dome

## 8. Shopping / setup list

- Laptop + charger. **2 × gigabit Ethernet** on the laptop (2 USB-C adapters or one dock with 2 ports)
- Mac mini M4 + power + **1 extra Ethernet adapter** (it has one port built in), a small screen or HDMI, keyboard/mouse
- 2 Ethernet cables, labelled **NDI** and **DANTE**, long enough to reach either machine
- Audio: **first ask whether NDI/HDMI audio is accepted**. If Dante is needed: **one DVS Transferable licence** (trial first); Dante Controller (free) for checking
- **NDI Tools** (free; Studio Monitor is used for checking) · **OBS Studio + DistroAV** + NDI Runtime
- Chrome (pinned version, auto-update off for the week) and Node, the same versions on both machines
- Optional: a travel router for the audience's phones, kept off the venue's two networks
- Every fallback .mp4/WAV on both machines, plus a USB stick with the same

## 9. Open questions

**For you:**
- ~~Which machine~~ → decided: laptop first, Mac mini spare.
- Laptop: 32 GB RAM ✔ · which ports (USB-C/Thunderbolt, HDMI, Ethernet)?
- Should the audience interact (phones), or only the presenter? This decides whether we need the travel router.
- Is the session one lecture (~45–90 min), or slides used across the week?

**For the venue technician:**
- NDI: full fisheye or a flat window? What latency? Which edge of the image faces the front?
- **Audio: can the media server take the 6 channels from NDI (or HDMI) and send them to the speakers?** If yes, no Dante needed.
- Otherwise Dante: will they route our 6 channels, and at what sample rate and latency? Can their Dante gear run in AES67 mode?
- Can we have a 1–2 h test slot before the class (phase 3)?
- HDMI: what does that input map to (the full dome, or a window)?
