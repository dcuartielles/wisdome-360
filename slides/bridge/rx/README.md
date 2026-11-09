# domebridge-rx — the UNO Q half of the audio bridge

Receives the 6-channel sound from the laptop's audio page and plays it into Inferno's ALSA
device, so it leaves the UNO Q as Dante. One Python file; needs only numpy and aplay.

```
laptop  audio page ──WebSocket :9300──►  domebridge_rx.py ──aplay──►  Inferno (ALSA) ──►  Dante
                     6 ch float32, 10 ms blocks      buffer 100 ms + clock matching
```
On the laptop the worklet hands blocks to a dedicated Worker (`lib/bridge-net-worker.js`) that
owns the WebSocket, so the page's busy main thread can't delay them. One sender at a time: a
new connection replaces the old one.

## Install on the UNO Q
```
sudo apt install -y python3-numpy alsa-utils
mkdir -p ~/bridge && scp -r rx arduino@dome-bridge.local:~/bridge/    # from the laptop
```

## Run
```
sudo python3 ~/bridge/rx/domebridge_rx.py --device dome   # into Dante (ALSA device 'dome', set up by ../dante/start-dante.sh)
python3 ~/bridge/rx/domebridge_rx.py --device default     # any local output, to hear it without Dante
python3 ~/bridge/rx/domebridge_rx.py --sink null          # no audio at all: just the network + buffer
```
It prints a status line every 5 s: state, buffer, clock correction, underruns.

- **Status cards (touchscreen):** `http://<uno-q>:9301/` shows three tiles. Left: the board (green = all good;
  amber as soon as something is wrong; red if it stays wrong for 20 s), with buffer, clock match, dropouts, Dante rate,
  temperature, levels and Tone / Ident / Mute. Right top: **Laptop · sound in** with *me* (the board's address:port the
  laptop connects to) and *them* (the laptop's address:port). Right bottom: **Dante · sound out** with *me* (the
  board's Dante address) and *them* (the clock leader, or the Dante devices the board exchanges packets with, from the
  neighbour table). Green = working, red = not working, amber = a warning (dropouts, lost blocks, clock lock lost,
  device errors) that stays until you touch the tile. The previous page is at `/classic` (the ⋯ button): sample rate, reset.
  `/status` now also carries `net` (addresses, Statime state, Inferno ports, peers) and the laptop connection's ports.
- **Status page (classic):** `http://<uno-q>:9301/classic` (on the board itself: `http://localhost:9301/`).
  Buttons: MUTE, Ident (noise burst per channel, L C R Rs Ls LFE), Tone (440 Hz moving L R C Ls Rs),
  Reset. Ident and Tone work with no laptop connected. Full screen on the DSI screen, if Chromium
  is installed: `chromium --kiosk http://localhost:9301/`.
- **JSON:** `GET /status` · `POST /cmd {"action": "mute"|"ident"|"tone"|"reset", "on": true}`.
- **On the laptop:** audio page → **Out: UNO Q bridge**, address `192.168.0.2` (or `dome-bridge.local`).
  The presenter shows a *bridge* line: buffer, clock correction, underruns.

## Options worth knowing
| Option | Default | When to change |
|---|---|---|
| `--device` | `default` | `dome` = Inferno/Dante (needs `sudo`: root avoids clock-socket and memory-lock limits) |
| `--format` | `S32_LE` | Inferno only accepts S32; other formats are only for testing on other devices |
| `--target-ms` | 100 | 60 was too little on the real laptop (Windows stalls of 100–300 ms); the audio-delay control absorbs it |
| `--max-ppm` | 1000 | largest clock correction (1000 ppm = 1.7 cents, inaudible) |
| `--aplay-buffer` / `--aplay-period` | 2048 / 512 frames | powers of two, buffer ≥ 1024 (Inferno's rule). 2048 ≈ 43 ms |
| `--dump FILE` | — | record what would be played (raw float32 × 6) instead of playing it |
| `--tone` | off | start with the test tone on |

## How the clock matching works
aplay takes samples exactly as fast as Inferno plays them, i.e. at the Dante clock. The laptop
sends at its own sound-card clock. They differ by some ppm, so the buffer would slowly fill or
empty. A PI controller on the (2 s smoothed) buffer level nudges the resampling ratio to hold
it at the target. After a stall, the backlog is trimmed: while the output is silent anyway, or,
if the buffer overfills while playing, with a short fade down to the target.
The sender's once-a-second diagnostics (blocks, longest gap, socket backlog) are logged only
for bad seconds.
Latency ≈ 100 ms buffer + aplay ≤ 43 ms + Dante 10 ms ≈ 100–115 ms; NDI video is usually
later than that, and the presenter's audio-delay control lines them up.

## Tested (2026-11-01, in the cloud, no UNO Q yet)
- `test/sim.py`: 10 virtual minutes per case, sender vs Dante clock off by 0…±250 ppm, 2 ms
  jitter, a 50 ms stall a minute → buffer 60 ± 0.5 ms, correction within 1–10 % of the true
  offset, no dropouts, no glitches.
- Real headless Chromium running `lib/bridgeout.js` + `lib/bridge-worklet.js` → this receiver:
  all 6 channels in the right order at the right pitch, no gaps, no distortion; 96 s with no
  underruns while the browser's clock ran ~1000 ppm off.

## Tested on the bench (2026-11-02, real UNO Q + ThinkPad, null sink)
See `../DRY-RUN-2026-11-02.md` → Notes for the full story. What the bridge needs:
- UNO Q Ethernet: EEE off and the link at **100 Mb/s** (`scripts/90-domebridge-ethernet.rules`);
  at 1 Gb/s the USB 2 host port overflowed after laptop hiccups.
- A small TCP receive window on the sound socket (`--rcvbuf-kb`, default 64): with Linux's
  default (~1.7 MB) the laptop's 1 Gb/s catch-up bursts overflowed the switch's 100 Mb/s port and
  every lost packet cost a ~300 ms Windows retransmit. 20 min: ~60 underruns → 3.
- Laptop: a clean USB Ethernet adapter (Belkin yes, Lenovo hub no), EEE off, and not much else
  running: the underruns that remain follow Windows stalls of 100–300 ms.
- **Not tested yet:** aplay into Inferno (dry-run steps 6–8b).
