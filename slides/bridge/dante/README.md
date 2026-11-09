# Dante side of the UNO Q bridge — Statime + Inferno

Three scripts, run on the UNO Q. They turn the two builds from the dry-run checklist (step 4)
into a working Dante device called **DOME-BRIDGE** with 6 transmit channels.

| Script | Does |
|---|---|
| `sudo bash start-dante.sh [iface]` | installs Inferno's ALSA plugin, defines the ALSA device **`dome`** in `/etc/asound.conf`, pauses time sync, starts **Statime** (follows the Dante clock, exports it on `/tmp/ptp-usrvclock`) |
| `bash check-dante.sh` | read-only health check: Statime running, clock socket, last log lines, multicast groups, Dante UDP ports, ALSA device, firewall, time sync |
| `sudo bash stop-dante.sh` | stops Statime, restarts the time-sync service it paused |

Logs and the generated Statime config: `~/bridge/logs/`.

## Order
1. Network up (flat: `192.168.0.2` on the USB Ethernet; or VLANs via `../scripts/setup-vlans.sh`).
2. A Dante clock leader on the network: **Dante Via** on the laptop (or the venue's devices).
3. `sudo bash start-dante.sh` → wait 10–20 s → `bash check-dante.sh`.
4. Something must keep `dome` open, otherwise DOME-BRIDGE doesn't exist on the network:
   - quick test: `sudo speaker-test -D dome -c 6 -F S32_LE -r 48000 -t sine -f 440`
   - the bridge: `sudo python3 ~/bridge/rx/domebridge_rx.py --device dome` (Tone / Ident on `:9301`)
5. Dante Controller on the laptop: DOME-BRIDGE appears (it can take ~10 s); subscribe Via to it.

## Why these settings (from Inferno's and Statime's own source and READMEs, checked 2026-11-02)
- **PTPv1, follower only.** Dante without AES67 uses PTPv1; the Statime fork can follow it but not
  lead it, hence `priority1 = 251` and a separate leader (Dante Via / the venue).
- **`virtual-system-clock-base = "monotonic_raw"`**: Statime keeps its own clock and never
  touches system time. Inferno's README still advises pausing NTP; `start-dante.sh` does that and
  `stop-dante.sh` undoes it.
- **`hardware-clock = "none"`**: USB Ethernet adapters have no PTP hardware clock.
- **`loglevel = "info"`**: the fork's example uses `trace`, which floods the terminal.
- **ALSA device**: Inferno accepts **S32 samples only**, power-of-two buffers **≥ 1024 frames**
  and periods ≥ 16 frames; the device exists **only while a program has it open**, which is why
  `domebridge_rx.py` keeps playing silence when the laptop isn't connected.
- **`RX_CHANNELS 0`**: the bridge only transmits (Inferno's README: channels can be set to 0).
- **`BIND_IP` = the board's Dante address**, picked by `start-dante.sh`: the first address on the Dante interface that is not 192.168.0.x (the venue's DHCP or link-local 169.254.x.x), else the only one. Override with `sudo DANTE_IP=… bash start-dante.sh`.
  (Wi-Fi, management, VLANs).
- **Run the sound side as root (`sudo`)**: Statime runs as root and creates the clock socket;
  Inferno's own container tests also raise the memory-lock limit. `start-dante.sh` also opens
  the socket to all users (`chmod 666`) in case you run as `arduino`.
- **Firewall**: Inferno needs UDP 319/320 (PTP), 4455, 8700, 8800, 4400 and 5353 (mDNS) open,
  plus incoming UDP from transmitters. The UNO Q's Debian normally has no firewall;
  `check-dante.sh` reports one if present.

## If it doesn't work
| Symptom | Look at |
|---|---|
| `/tmp/ptp-usrvclock` never appears | `tail -50 ~/bridge/logs/statime.log`: wrong interface? no IPv4 address? |
| Statime never reports a master | Dante Via running and on the same network? multicast `224.0.1.129` listed by `check-dante.sh`? |
| `speaker-test`/`aplay` can't open `dome` | plugin installed? (`check-dante.sh` → ALSA device); format must be `S32_LE` |
| DOME-BRIDGE missing in Dante Controller | is `dome` open by a program right now? UDP ports listed? Same subnet as the laptop? |
| Appears, but Via shows a broken/red stream | clock: is Statime locked? try `TX_LATENCY_NS "20000000"` in the `pcm.dome` block of `/etc/asound.conf` |
| Clicks | raise Inferno latency as above; check `domebridge_rx` underruns |

Inferno: https://github.com/teodly/inferno · Statime fork: https://github.com/teodly/statime/tree/inferno-dev
Inferno is unofficial and not endorsed by Audinate.

## Sample rate
Easiest: the bridge's status page (touch screen, or `http://192.168.0.2:9301/` from the laptop) has a
**Dante sample rate** box: type the rate, press Set. The receiver rewrites the `dome` device, reopens it and
remembers the rate for the next start. From the command line:
`start-dante.sh` makes a 48 kHz Dante device by default. If the venue's Dante network runs at
another rate (Dante Controller → Device Config shows it), start it with that rate and give the
receiver the same one; it resamples the laptop's stream:
```
sudo RATE=96000 bash ~/bridge/dante/start-dante.sh
sudo python3 ~/bridge/rx/domebridge_rx.py --device dome --rate 96000
```
Supported: 44100, 48000, 88200, 96000. Not yet tested at anything but 48 kHz. At 96 kHz the board
does twice the resampling work; check the CPU on the status page.
