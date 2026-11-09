# Dome audio bridge — Arduino UNO Q → Dante (open-source route)

Branch `html5-live` · `live/bridge/` · drafted 2026-10-11 · status: **spec, nothing built**
Parent spec: `live/SPEC.md` (the live slides). This is the **optional open-source audio
route**. The licensed route (Dante Virtual Soundcard) stays as plan B until this one
passes the venue test.

---

## 1. What it is

A small box made from an **Arduino UNO Q** with a **touchscreen**. It receives the 6
audio channels from the presenting machine over the network, and transmits them into
the dome's Dante network using **Inferno**, an open-source, unofficial Dante
implementation.

Why do it this way:
- The laptop (or the Mac) needs **one network cable and no audio driver**. That removes
  the riskiest step on Windows (Chrome → DVS in 5.1).
- **No licence** to buy, and everything in the chain can be opened and explained to
  students.
- The touchscreen shows, at a glance, whether every link in the chain is working.

What it is **not**: proven. Inferno's own README calls it highly experimental and
unauthorised by Audinate. A Dante firmware update at the venue could break it. So it
only goes on the critical path after it passes the gates in §9.

## 2. System overview

```
                         our managed switch (802.1Q VLANs + QoS)
                    ┌────────────────────────────────────────────┐
 venue NDI cable ───┤ p1  VLAN 10 (NDI)  access                  │
 venue Dante cable ─┤ p2  VLAN 20 (Dante) access                 │
 laptop / Mac ──────┤ p3  VLAN 10 access   (NDI video out + audio stream to bridge)
 UNO Q bridge ──────┤ p4  trunk: VLAN 10 + 20 tagged            │
 (spare) ───────────┤ p5–p8 unused / mirror for debugging        │
                    └────────────────────────────────────────────┘

 laptop:  video.html ─ OBS + DistroAV ─► NDI ───────────────► VLAN 10 ─► dome video
          audio.html ─ AudioWorklet ─► WebSocket PCM, 6 ch ─► VLAN 10 ─► UNO Q

 UNO Q:   eth0.10 ◄─ PCM stream ─► jitter buffer ─► adaptive resampler ─► Inferno TX
          eth0.20 ◄─ PTP (Statime fork) ─┘                                  │
                                                     Dante flow, 6 ch ─► VLAN 20 ─► dome audio
          HDMI + USB touch ─► status / control screen
          STM32 (MCU side) ─► heartbeat LED + hardware MUTE button (optional)
```

The switch never routes between VLAN 10 and VLAN 20, so the venue's two networks stay
as separate as they are today. **Ask the venue's permission** before plugging in our
switch, and before putting an unofficial Dante device on their network.

## 3. Hardware

| Part | Choice | Notes |
|---|---|---|
| Computer | **Arduino UNO Q, 4 GB** (ABX00173) | Qualcomm QRB2210, 4 × Cortex-A53 at 2.0 GHz, Debian. STM32U585 MCU on board. No Ethernet, one USB-C port |
| Hub | **Arduino USB-C Hub 8-in-1** (TPX00241) | Made for the UNO Q: power passthrough (needs an external PD supply), HDMI, 2 × USB-A (one is USB 3.0), **100 Mbps** Ethernet |
| Network | **Gigabit USB 3.0 Ethernet adapter, Realtek RTL8153**, on the hub's USB 3.0 port | Supported by the mainline Linux `r8152` driver. The main link. The hub's own 100 Mbps port is the backup: 6 ch of Dante is ~6 Mbit/s, so 100 Mbps also works |
| Screen | **7" HDMI capacitive touchscreen, 1024 × 600, touch over USB** | HDMI from the hub; touch and power from a hub USB-A port. Standard USB HID multitouch, so no driver |
| Power | **USB-C PD supply, 45–65 W**, into the hub's PD input | Arduino's 45 W supply, or any good PD charger. Powers the Q, the screen and the adapter |
| Optional | **Modulino Buttons + Modulino Pixels** on the UNO Q's Qwiic connector | Driven by the STM32: a physical MUTE button and a heartbeat LED that works even if Linux hangs |
| Enclosure | 3D-printed stand holding the Q and the screen together | Cable strain relief for the hub and the network cable |

Later option: the **UNO Media Carrier** adds a MIPI DSI display connector. Arduino
announced it in March 2026 as "rolling out soon". If it's available and we want a
neater box, it could replace the HDMI screen. Not needed for v1.

## 4. Network design

| VLAN | Name | Carries | Our switch ports |
|---|---|---|---|
| 10 | NDI | NDI video laptop → dome, audio stream laptop → bridge, the status dashboard | p1 (venue), p3 (laptop), p4 tagged |
| 20 | DANTE | Dante audio, PTP clock, Dante discovery | p2 (venue), p4 tagged |

Switch settings:
- **QoS: trust DSCP, strict priority.** PTP event packets are DSCP 56 (CS7); PTP
  general and audio are DSCP 46 (EF); control is DSCP 8 (CS1). Map them to the highest
  queues, and don't let the switch rewrite DSCP.
- **Energy-Efficient Ethernet (EEE / "green Ethernet") off** on every port.
- **IGMP snooping on** for VLAN 20, but **no querier of our own**: the venue's network
  already has one.
- No routing between the VLANs. The management interface goes on VLAN 10 only.

UNO Q network setup (systemd-networkd):
- `eth0` untagged with no address; `eth0.10` gets DHCP or a fixed address on the NDI
  network; `eth0.20` gets an address on the Dante network.
- Needs the `8021q` kernel module. **Check it exists in Arduino's Debian image (B0).**
- The device is reachable as `dome-bridge.local` (mDNS) on VLAN 10.

## 5. Software on the UNO Q

All of it runs as systemd services, starts on boot, and needs no keyboard.

| Service | What it does | Built from |
|---|---|---|
| `vlan` | sets up the VLAN interfaces (NDI 10, Dante 20, management untagged) | NetworkManager, `scripts/setup-vlans.sh` |
| `statime` | PTP clock follower on `eth0.20` (PTPv1, which Dante uses without AES67), software timestamps | teodly's Statime fork, `inferno-dev` branch |
| `inferno` | Dante device **DOME-BRIDGE**, 6 TX channels named `L R C LFE Ls Rs`, latency 5 ms (10 ms if unstable) | Inferno, `alsa_pcm_inferno` as an ALSA playback device |
| `domebridge-rx` | **our code, written 2026-11-01** (`rx/domebridge_rx.py`). Receives the PCM stream on :9300, keeps a 60 ms buffer, follows the Dante clock with an adaptive resampler, plays into the Inferno ALSA device via aplay. Ident, test tone and mute. Status page + JSON on **:9301** (the touchscreen dashboard) | **Python 3 + numpy, stdlib only** (no build). Chosen over Rust so it runs without a build step; ~1 % CPU-class load at 6 ch |
| `kiosk` | shows the dashboard full screen on the touchscreen | `cage` (a Wayland kiosk compositor) + Chromium in kiosk mode |
| `mcu` (optional) | STM32 sketch: heartbeat LED, MUTE button | Arduino App Lab / Bridge between Linux and the MCU |

### 5.1 The audio stream (laptop → bridge) — as built 2026-11-01
- Source: the audio page's 6-channel mix, tapped **after** the audio delay and mute by an
  AudioWorklet (`lib/bridge-worklet.js`), sent by `lib/bridgeout.js` over a **WebSocket**
  to `ws://<bridge>:9300`. Reconnects every 2 s by itself.
- Block format (little-endian): `'DBR1'` · u32 seq · u32 sample rate · u16 channels · u16
  frames, then frames × 6 float32 interleaved, L R C LFE Ls Rs. **10 ms blocks** (480 frames
  at 48 kHz), ≈ 9.2 Mbit/s. The bridge answers with a JSON status line every second.
- Audio page output switch: **this computer only** (e.g. DVS, plan B) / **UNO Q bridge** /
  **both**. In bridge-only mode the laptop's own output is turned down (`engine.setMonitor`).
- The presenter shows a *bridge* line (buffer, clock correction, underruns, mute).

### 5.2 Clock matching — as built
aplay takes samples at Inferno's pace, i.e. the Dante clock; the laptop sends at its own
sound-card clock. A PI controller on the buffer level (smoothed over 2 s, because the
level saws by one 10 ms block) nudges a linear-interpolation resampler, within
**±1000 ppm** (1.7 cents, inaudible), to hold the buffer at **60 ms**. Playback starts half
a block above the target; after a stall the backlog is trimmed while the output is silent
anyway; the integral doesn't wind up while saturated. On an underrun it fades out and
refills.

Measured in simulation (sender vs Dante clock 0…±250 ppm apart, 2 ms jitter, a 50 ms stall
a minute): buffer 60 ± 0.5 ms, correction within 1–10 % of the true offset, no dropouts.
A 40 ms buffer dropped out on every 50 ms stall, hence 60.

End-to-end audio latency ≈ 60 ms buffer + ~40 ms aplay buffer + 5–10 ms Dante ≈
**100–110 ms**. NDI video is usually later than that; the presenter's **audio delay** lines
them up.

### 5.3 Failure behaviour
| Event | Bridge does | Screen shows |
|---|---|---|
| Laptop stream stops | fade to silence in 20 ms, keep Dante running | INPUT red, time since last block |
| PTP lock lost | keep sending; Inferno follows the clock again | PTP amber/red, offset |
| Dante network unplugged | services keep running and reconnect by themselves | LINK DANTE red |
| Linux hangs | — | heartbeat LED on the MCU stops (optional part) |
| Total failure | switch `audio.html` to **audio device** (DVS) or to the fallback recordings | — |

## 6. The touchscreen

1024 × 600, dark, big type, readable from 2 m. One status screen and one controls
screen.

**Status screen**
```
┌ DOME-BRIDGE ─────────────────────────────────── 14:02:11 ─ ● ALL OK ┐
│ LINK NDI   ● 1000 Mb  10.0.10.23     │ LINK DANTE ● 1000 Mb 169.254.x │
│ INPUT      ● laptop-dc  buf 41 ms  drift +23 ppm  underruns 0         │
│ PTP        ● locked  leader <venue device>  offset 12 µs              │
│ DANTE TX   ● 6 ch  subscribed by dome: yes  latency 5 ms              │
│  L ▮▮▮▮▮▯▯  R ▮▮▮▮▯▯▯  C ▮▮▯▯▯▯▯  LFE ▮▯▯▯▯▯▯  Ls ▮▮▮▯▯▯▯  Rs ▮▮▮▯▯▯▯  │
│ CPU 18 %   temp 51 °C   uptime 2 h 14 min                             │
└───────────────────────────────────────────── [ CONTROLS ]  [ MUTE ] ┘
```
Every row is green, amber or red. The header dot is the worst of them.

**Controls screen** (touch)
- **MUTE ALL**: large; also the optional hardware button
- **Ident**: a voice or tone on one channel at a time (L, R, C, LFE, Ls, Rs) to check
  the routing in the dome. Produced on the bridge, so it works without the laptop
- **Pink noise**, all channels or one at a time, at −20 dBFS
- **Sync test**: a click every second, paired with the flash slide on the laptop
- **Latency** 5 / 10 ms (restarts Inferno)
- **Network info**: addresses, MACs, VLANs, as a QR code to photograph
- **Restart audio** · **Safe shutdown**

The same dashboard opens from the laptop at `http://dome-bridge.local:8080`, and the
presenter page shows a one-line summary of it (INPUT / PTP / DANTE status).

## 7. Testing at home (no venue network)

A Dante network needs one device acting as **clock leader**. The bridge can't be it:
Inferno only follows the clock in a Dante-only (PTPv1) network. So the home setup needs
something else that can lead.

**Default: the Mac mini running the Dante Via trial. No extra hardware.**
- Dante Via can be the clock leader, which standard Dante Virtual Soundcard can't
  (only its Pro subscription can). Inferno's README lists Via on macOS and Windows 11
  as tested with it.
- Via also receives the bridge's 6 channels and plays them on the Mac's speakers or
  headphones, so you can hear the result.
- **Dante Controller** (free) on the Mac subscribes Via to DOME-BRIDGE and shows the
  clock status and latency.
- Connect the Mac to a **VLAN 20 port on our switch**. That rebuilds the venue layout
  at home: laptop on VLAN 10 → bridge → VLAN 20 → Mac.
- Keep the roles separate: the **laptop** streams, the **Mac** leads the clock and
  listens. Don't test with one machine doing both.
- **Watch the trial clock:** start the Via trial only once B0 is done and the bridge
  can transmit. Plan B1–B4 inside the trial period.

Caveats: a software clock leader on a Mac is less stable than hardware, so home results
are, if anything, pessimistic. The real check is still the venue's own leader at B5.

**Optional: an Audinate AVIO adapter**, bought or borrowed from MaU's AV department.
Only if the Via trial runs out before testing is done, or if you want a permanent
hardware reference.

## 8. Build phases

| # | Phase | Done when |
|---|---|---|
| B0 | **Bench** | Q boots, hub + gigabit adapter + touchscreen work, VLANs come up, `8021q` present, Rust toolchain builds Inferno + Statime on the Q |
| B1 | **Dante TX** | Inferno sends a test tone; Dante Controller sees DOME-BRIDGE; the home test device plays it cleanly for 2 h |
| B2 | **Stream in** | laptop → bridge stream, resampler loop steady, **8 h soak with 0 underruns** and no clicks |
| B3 | **Screen** | status + controls screens, dashboard over the network, idents and mute work |
| B4 | **Switch** | VLAN/QoS config saved and exported; 2 h with NDI 2048² video and Dante on the same switch, no clock slips |
| B5 | **Venue test** | in the dome alongside the DVS route: routing, clock lock, latency, 1 h without dropouts |

## 9. Go / no-go

The bridge becomes the main audio path only if **all** of these hold at the venue test:
- PTP stays locked for the whole hour, with no clock warnings in Dante Controller
- no audible clicks or dropouts over 1 h, at the latency we chose
- the venue technician is happy to have it on their network
- falling back to DVS (or to the recordings) takes under a minute

Otherwise it stays a demo piece. It's still a good thing to show students in the
lecture ("this is what's inside a Dante box"), even if the audio itself goes through DVS.

## 10. Open questions

- Venue: may we plug **our switch** into their two drops? May an **unofficial Dante
  device** join their Dante network? Which PTP version and latency do they use?
- Does Arduino's Debian image for the UNO Q include `8021q`, and does `r8152` handle the
  RTL8153 adapter? (Both are expected; checked in B0)
- Can the UNO Q take power through the hub while it's acting as USB host? (The hub is
  designed for this; confirm in B0)
- Home test device: buy an AVIO adapter, or borrow one?
