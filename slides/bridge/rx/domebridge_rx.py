#!/usr/bin/env python3
"""
domebridge_rx — the UNO Q half of the dome audio bridge.

Receives the 6-channel sound stream from the laptop's audio page (WebSocket, port 9300),
keeps a small buffer, follows the Dante clock with a slow adaptive resampler, and plays into
an ALSA device — Inferno's, so the sound leaves the UNO Q as Dante.

The clock trick: ALSA (aplay) takes samples exactly as fast as the Dante network clock
plays them. The laptop sends at its own sound-card clock. The two differ by some ppm, so
the buffer would slowly fill or empty. A PI controller nudges the resampling ratio
(within ±max-ppm) to hold the buffer at the target. No clicks, no drift.

Also serves a status page + JSON on port 9301 (for the touchscreen and the presenter),
with buttons for mute, channel ident and a test tone that work without the laptop.

Needs: Python 3.9+, numpy, aplay (alsa-utils). No other packages.

    sudo python3 domebridge_rx.py --device dome        # Dante via Inferno (ALSA device 'dome', bridge/dante/)
    python3 domebridge_rx.py --device default          # any local sound output, for testing
    python3 domebridge_rx.py --sink null --skew-ppm 80  # no audio hardware: simulated clock
"""
import re
import argparse, asyncio, base64, hashlib, json, math, os, signal, socket, struct, subprocess, sys, threading, time
from collections import deque

import numpy as np

CH_NAMES = ['L', 'R', 'C', 'LFE', 'Ls', 'Rs']
MAGIC = b'DBR1'
HDR = struct.Struct('<4sIIHH')  # magic, seq, sampleRate, channels, frames  (16 bytes)
WS_GUID = b'258EAFA5-E914-47DA-95CA-C5AB0DC85B11'   # RFC 6455


# ----------------------------------------------------------------------------------------------
# Input FIFO + adaptive resampler
# ----------------------------------------------------------------------------------------------
class Stream:
    """Thread-safe FIFO of float32 frames (n, ch) plus the resampler state."""

    def __init__(self, ch, out_rate, target_ms, max_ppm):
        self.ch, self.out_rate = ch, out_rate
        self.lock = threading.Lock()
        self.chunks = deque()
        self.frames = 0                     # frames queued (input rate)
        self.in_rate = out_rate
        self.pos = 0.0                      # fractional read position into the head
        self.hist = np.zeros((1, ch), np.float32)  # last frame consumed, for interpolation
        self.target = target_ms / 1000.0
        self.max_adj = max_ppm * 1e-6
        self.integral = 0.0
        self.integral_ok = 0.0              # the integral last time the level was near the target
        self.adj = 0.0                      # current ratio adjustment (e.g. +23e-6)
        self.fill_s = 0.0                   # smoothed fill, seconds
        self.state = 'waiting'              # waiting · prefill · playing
        self.fade = 0.0                     # 0..1 gain ramp
        self.play_t = 0.0                   # seconds since playing (re)started
        self.block_s = 0.01                 # size of the last input block, seconds
        self.underruns = 0
        self.drops = 0
        self.blocks = 0
        self.last_rx = 0.0
        self.seq = None
        self.seq_gaps = 0

    # -- producer side (network) -----------------------------------------------------------------
    def push(self, seq, rate, data):
        with self.lock:
            if self.seq is not None and seq != (self.seq + 1) & 0xFFFFFFFF:
                self.seq_gaps += 1
            self.seq = seq
            self.in_rate = rate
            self.chunks.append(data)
            self.block_s = len(data) / rate
            self.frames += len(data)
            self.blocks += 1
            self.last_rx = time.monotonic()
            # way too much queued (e.g. the browser tab stalled then burst): drop to target
            limit = int(4 * self.target * rate) + len(data)
            if self.frames > limit:
                keep = int(self.target * rate)
                while self.frames - len(self.chunks[0]) >= keep:
                    self.frames -= len(self.chunks.popleft())
                self.pos = 0.0
                self.drops += 1

    def reset(self):
        with self.lock:
            self.chunks.clear(); self.frames = 0; self.pos = 0.0
            self.state = 'waiting'; self.fade = 0.0; self.integral = self.integral_ok = 0.0; self.adj = 0.0
            self.seq = None

    # -- consumer side (audio thread) ------------------------------------------------------------
    def _take(self, n):
        """Concatenate the first n input frames (n <= self.frames) without removing them."""
        out, need = [], n
        for c in self.chunks:
            if need <= 0: break
            out.append(c[:need]); need -= len(c[:need])
        return np.concatenate(out) if out else np.zeros((0, self.ch), np.float32)

    def _drop(self, n):
        while n > 0 and self.chunks:
            c = self.chunks[0]
            if len(c) <= n:
                n -= len(c); self.frames -= len(c); self.chunks.popleft()
            else:
                self.chunks[0] = c[n:]; self.frames -= n; n = 0

    def pull(self, n, dt):
        """Return n output frames (float32, (n, ch)). dt = duration of n frames, seconds."""
        with self.lock:
            fill = self.frames / self.in_rate
            # 2 s smoothing: sound arrives in 10 ms blocks, so the raw level is a sawtooth
            self.fill_s += (fill - self.fill_s) * min(1.0, dt / 2.0)

            if self.state == 'waiting':
                if self.frames:
                    self.state = 'prefill'
                else:
                    return np.zeros((n, self.ch), np.float32)
            if self.state == 'prefill':
                # start half an input block above the target: the level saws down by one block
                # between arrivals, so this puts the *average* on the target from the first second
                start = self.target + 0.5 * self.block_s
                if fill >= start:
                    # after a stall the backlog arrives in a burst: trim it now, while we're silent
                    # anyway, instead of letting the controller (and its integral) chase it
                    excess = self.frames - int(start * self.in_rate)
                    if excess > int(0.01 * self.in_rate):
                        self._drop(excess); self.drops += 1
                    self.state = 'playing'; self.fade = 0.0
                    self.fill_s = self.frames / self.in_rate; self.play_t = 0.0
                else:
                    if time.monotonic() - self.last_rx > 1.0 and self.frames == 0:
                        self.state = 'waiting'
                    return np.zeros((n, self.ch), np.float32)

            # A stall the buffer survived still ends in a burst: the backlog stays queued and the
            # controller can only drain it at max-ppm (1 ms per second), i.e. minutes of extra
            # latency (seen on the bench: 200-330 ms for 4-5 min). Over twice the target, fade
            # out this block, drop the excess, fade back in: a 30 ms dip instead.
            if self.play_t > 3.0 and fill > self.target + max(self.target, 0.05):
                need = int(math.floor(self.pos + (self.in_rate / self.out_rate) * (n - 1))) + 2
                src = self._take(need)
                x = self.pos + (self.in_rate / self.out_rate) * np.arange(n)
                i = np.floor(x).astype(np.int64)
                f = (x - i).astype(np.float32)[:, None]
                out = (src[i] * (1.0 - f) + src[i + 1] * f) * np.linspace(self.fade, 0.0, n, dtype=np.float32)[:, None]
                self._drop(self.frames - int((self.target + 0.5 * self.block_s) * self.in_rate))
                self.pos = 0.0; self.fade = 0.0; self.drops += 1
                self.fill_s = self.frames / self.in_rate
                self.integral = self.integral_ok   # forget what the excursion taught the integral
                return out

            # PI control on the smoothed fill. x = fill error in seconds. The buffer integrates the
            # ratio error, so this is a 2nd-order loop. A ±1 ms wobble moves the ratio by ~±100 ppm
            # at most (inaudible: 1 cent = 578 ppm); the integral learns the real clock offset.
            # (w ≈ 0.03 rad/s, damping ≈ 0.6: settles in a couple of minutes; clock drift is slow.)
            x = max(-self.target, min(self.target, self.fill_s - self.target))
            self.play_t += dt
            p = 0.04 * x
            if self.play_t > 3.0:    # let the smoothed level settle before learning from it
                # anti-windup: don't keep integrating while the output is already at its limit
                if abs(p + self.integral) < self.max_adj or (p + self.integral) * x < 0:
                    self.integral = max(-self.max_adj, min(self.max_adj, self.integral + 0.001 * x * dt))
                if abs(x) < 0.01: self.integral_ok = self.integral
            self.adj = max(-self.max_adj, min(self.max_adj, p + self.integral))
            step = (self.in_rate / self.out_rate) * (1.0 + self.adj)

            need = int(math.floor(self.pos + step * (n - 1))) + 2   # input frames touched
            if need > self.frames:
                # underrun: play what is left, faded out, then wait for the buffer to refill
                avail = self.frames
                out = np.zeros((n, self.ch), np.float32)
                if avail > 1:
                    seg = self._take(avail)
                    m = min(n, avail)
                    out[:m] = seg[:m] * np.linspace(self.fade, 0.0, m, dtype=np.float32)[:, None]
                self._drop(avail)
                self.pos = 0.0; self.fade = 0.0
                self.state = 'prefill'; self.underruns += 1
                return out

            src = self._take(need)
            x = self.pos + step * np.arange(n)
            i = np.floor(x).astype(np.int64)
            f = (x - i).astype(np.float32)[:, None]
            out = src[i] * (1.0 - f) + src[i + 1] * f
            adv = self.pos + step * n
            whole = int(math.floor(adv))
            self._drop(whole)
            self.pos = adv - whole

            if self.fade < 1.0:   # 20 ms fade-in after (re)start
                ramp = np.clip(self.fade + np.arange(1, n + 1) * (1.0 / (0.02 * self.out_rate)), 0, 1)
                out *= ramp.astype(np.float32)[:, None]
                self.fade = float(ramp[-1])
            return out

    def status(self):
        with self.lock:
            return dict(state=self.state, fill_ms=round(self.fill_s * 1000, 1), target_ms=self.target * 1000,
                        ppm=round(self.adj * 1e6, 1), in_rate=self.in_rate, underruns=self.underruns,
                        drops=self.drops, blocks=self.blocks, seq_gaps=self.seq_gaps,
                        since_rx_s=round(time.monotonic() - self.last_rx, 2) if self.last_rx else None)


# ----------------------------------------------------------------------------------------------
# Local sources: channel ident and test tone (work with no laptop at all)
# ----------------------------------------------------------------------------------------------
class Local:
    IDENT = [0, 2, 1, 5, 4, 3]   # L C R Rs Ls LFE, 1 s each (same order as the audio page)

    def __init__(self, ch, rate):
        self.ch, self.rate = ch, rate
        self.ident_t = None          # seconds into the ident, or None
        self.tone = False
        self.tone_ch = -1            # -1 = all channels in turn (2 s each), else one channel
        self.phase = 0.0
        self.t = 0.0
        self.rng = np.random.default_rng()
        self.lp = 0.0

    def render(self, n):
        out = np.zeros((n, self.ch), np.float32)
        dt = n / self.rate
        if self.ident_t is not None:
            k = int(self.ident_t // 1.0)
            if k >= len(self.IDENT):
                self.ident_t = None
            else:
                frac = self.ident_t - k
                if frac < 0.8:
                    ch = self.IDENT[k]
                    w = self.rng.standard_normal(n).astype(np.float32) * 0.12
                    if ch == 3:   # LFE: crude 1-pole lowpass ~90 Hz
                        a = 1 - math.exp(-2 * math.pi * 90 / self.rate)
                        y = np.empty(n, np.float32); s = self.lp
                        for j in range(n):
                            s += a * (w[j] * 6 - s); y[j] = s
                        self.lp = s; w = y
                    out[:, ch] = w
                self.ident_t += dt
        if self.tone:
            f = 440.0 if self.tone_ch != 3 else 60.0
            ph = self.phase + 2 * math.pi * f * np.arange(n) / self.rate
            s = (0.2 * np.sin(ph)).astype(np.float32)
            self.phase = float((ph[-1] + 2 * math.pi * f / self.rate) % (2 * math.pi))
            ch = self.tone_ch if self.tone_ch >= 0 else [0, 1, 2, 4, 5][int(self.t // 2.0) % 5]
            out[:, ch] += s
        self.t += dt
        return out


# ----------------------------------------------------------------------------------------------
# Sinks
# ----------------------------------------------------------------------------------------------
class AplaySink:
    """Pipes raw PCM into aplay. aplay's blocking writes pace us at the device clock (= Dante's)."""

    def __init__(self, device, ch, rate, fmt, buffer_frames, period_frames):
        # Sizes in frames, powers of two: Inferno's ALSA device only accepts power-of-two buffers
        # of at least 1024 frames (and S32 samples).
        self.cmd = ['aplay', '-q', '-D', device, '-t', 'raw', '-f', fmt, '-c', str(ch), '-r', str(rate),
                    f'--buffer-size={buffer_frames}', f'--period-size={period_frames}']
        self.fmt = fmt
        self.p = None
        self.error = None

    def open(self):
        self.p = subprocess.Popen(self.cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
        threading.Thread(target=self._err, daemon=True).start()

    def _err(self):
        for line in self.p.stderr:
            self.error = line.decode(errors='replace').strip()
            print('aplay:', self.error, file=sys.stderr)

    def write(self, block):
        if self.p is None or self.p.poll() is not None:
            if self.p is not None:
                self.error = self.error or f'aplay exited ({self.p.returncode})'
                time.sleep(2)
            self.open()
        x = np.clip(block, -1.0, 1.0)
        if self.fmt == 'S32_LE':
            data = (x * 2147483647.0).astype('<i4').tobytes()
        elif self.fmt == 'S16_LE':
            data = (x * 32767.0).astype('<i2').tobytes()
        else:  # FLOAT_LE
            data = x.astype('<f4').tobytes()
        try:
            self.p.stdin.write(data); self.p.stdin.flush()
            self.error = None if self.error and 'exited' in self.error else self.error
        except (BrokenPipeError, OSError) as e:
            self.error = str(e)

    def close(self):
        if self.p:
            try: self.p.stdin.close(); self.p.terminate()
            except Exception: pass


class DumpSink:
    """Records exactly what would be played (raw float32, interleaved) and paces like NullSink."""

    def __init__(self, path, rate, skew_ppm=0.0):
        self.f = open(path, 'wb'); self.pace = NullSink(rate, skew_ppm); self.error = None

    def write(self, block):
        self.f.write(np.ascontiguousarray(block, '<f4').tobytes()); self.pace.write(block)

    def close(self): self.f.close()


class NullSink:
    """No audio hardware: consumes samples at the nominal rate, optionally off by skew_ppm (testing)."""

    def __init__(self, rate, skew_ppm=0.0):
        self.rate = rate * (1 + skew_ppm * 1e-6)
        self.t = None
        self.error = None

    def write(self, block):
        now = time.monotonic()
        if self.t is None: self.t = now
        self.t += len(block) / self.rate
        if self.t > now: time.sleep(self.t - now)
        elif now - self.t > 0.5: self.t = now   # fell behind badly: resync

    def close(self): pass


# ----------------------------------------------------------------------------------------------
# Audio thread
# ----------------------------------------------------------------------------------------------
class Bridge:
    def __init__(self, a):
        self.a = a
        self.stream = Stream(a.channels, a.rate, a.target_ms, a.max_ppm)
        self.local = Local(a.channels, a.rate)
        self.muted = False
        self.gain = 1.0
        self.levels = [0.0] * a.channels
        if a.dump: self.sink = DumpSink(a.dump, a.rate, a.skew_ppm)
        elif a.sink == 'null': self.sink = NullSink(a.rate, a.skew_ppm)
        else: self.sink = AplaySink(a.device, a.channels, a.rate, a.format, a.aplay_buffer, a.aplay_period)
        self.client = None
        self.client_port = None
        self.client_local = None
        self.client_since = None
        self.net = NetProbe(a)
        self.t0 = time.time()
        self.running = True
        self.pending_rate = None
        self.rate_msg = None

    # Dante sample rate, changeable live (status page text box). The Dante device (Inferno) takes
    # its rate from /etc/asound.conf, so: rewrite our block there, reopen the device at the new
    # rate, and remember it for the next start (start-dante.sh and this program read RATE_FILE).
    def request_rate(self, rate):
        try: rate = int(rate)
        except Exception: rate = 0
        if rate not in RATES:
            self.rate_msg = f'{rate} Hz not supported (use ' + ', '.join(map(str, RATES)) + ')'
            return False
        self.pending_rate = rate
        return True

    def _apply_rate(self, rate):
        a = self.a
        self.sink.close()
        msg = []
        if a.sink == 'aplay' and a.device == 'dome':
            try:
                txt = open(ASOUND_CONF).read()
                i, j = txt.find('# >>> dome-bridge'), txt.find('# <<< dome-bridge')
                if i < 0 or j < 0: raise RuntimeError('no dome-bridge block (run start-dante.sh)')
                blk = re.sub(r'SAMPLE_RATE\s+"\d+"', f'SAMPLE_RATE "{rate}"', txt[i:j])
                open(ASOUND_CONF, 'w').write(txt[:i] + blk + txt[j:])
            except Exception as e:
                msg.append(f'could not update {ASOUND_CONF}: {e}')
        try:
            os.makedirs(os.path.dirname(RATE_FILE), exist_ok=True)
            open(RATE_FILE, 'w').write(f'{rate}\n')
        except Exception as e:
            msg.append(f'could not save rate: {e}')
        a.rate = rate
        self.stream.out_rate = rate
        self.stream.reset()
        self.local.rate = rate
        if a.dump: self.sink = DumpSink(a.dump, rate, a.skew_ppm)
        elif a.sink == 'null': self.sink = NullSink(rate, a.skew_ppm)
        else: self.sink = AplaySink(a.device, a.channels, rate, a.format, a.aplay_buffer, a.aplay_period)
        self.rate_msg = '; '.join(msg) or f'now {rate} Hz'
        print(f'Dante rate → {rate} Hz', ('(' + self.rate_msg + ')') if msg else '', flush=True)

    def run(self):
        n = int(self.a.rate * self.a.block_ms / 1000)
        dt = n / self.a.rate
        while self.running:
            if self.pending_rate:
                r, self.pending_rate = self.pending_rate, None
                if r != self.a.rate: self._apply_rate(r)
                else: self.rate_msg = f'already {r} Hz'
                n = int(self.a.rate * self.a.block_ms / 1000)
                dt = n / self.a.rate
            block = self.stream.pull(n, dt) + self.local.render(n)
            target = 0.0 if self.muted else 1.0
            if self.gain != target:   # 20 ms mute ramp
                ramp = np.clip(self.gain + np.sign(target - self.gain) * np.arange(1, n + 1) / (0.02 * self.a.rate), 0, 1)
                block *= ramp.astype(np.float32)[:, None]
                self.gain = float(ramp[-1])
            elif self.gain == 0.0:
                block[:] = 0
            rms = np.sqrt(np.mean(block * block, axis=0))
            self.levels = [0.8 * l + 0.2 * float(r) for l, r in zip(self.levels, rms)]
            self.sink.write(block)

    def status(self):
        s = self.stream.status()
        s.update(name=self.a.name, sink=self.a.sink, device=self.a.device, rate=self.a.rate,
                 channels=self.a.channels, muted=self.muted, ident=self.local.ident_t is not None,
                 tone=self.local.tone, tone_ch=self.local.tone_ch, levels=[round(v, 4) for v in self.levels],
                 client=self.client, sink_error=getattr(self.sink, 'error', None), rate_msg=self.rate_msg,
                 uptime_s=int(time.time() - self.t0), cpu_temp_c=cpu_temp(),
                 client_port=self.client_port, client_local=self.client_local,
                 client_since_s=int(time.time() - self.client_since) if self.client else None,
                 ws_port=self.a.ws_port, net=self.net.snapshot())
        return s


class NetProbe:
    """What the board knows about its two sides, refreshed every 2 s in the background (stdlib only):
    the laptop side (its 192.168.0.x address) and the Dante side (the address Inferno is bound to,
    Statime's clock state, Inferno's UDP ports, and the Dante devices the board is exchanging packets with)."""
    DANTE_PORTS = (4455, 8700, 8800, 4400)

    def __init__(self, a):
        self.a = a
        self.data = {}
        self.lock = threading.Lock()
        threading.Thread(target=self._loop, daemon=True, name='netprobe').start()

    def snapshot(self):
        with self.lock:
            return dict(self.data)

    def _loop(self):
        while True:
            try:
                d = self._probe()
            except Exception as e:
                d = {'error': str(e)}
            with self.lock:
                self.data = d
            time.sleep(2.0)

    @staticmethod
    def _run(cmd):
        try:
            return subprocess.run(cmd, capture_output=True, text=True, timeout=2).stdout
        except Exception:
            return ''

    def _probe(self):
        logs = os.path.join(_home, 'bridge', 'logs')
        iface = None
        try:
            m = re.search(r'^interface\s*=\s*"([^"]+)"', open(os.path.join(logs, 'statime.toml')).read(), re.M)
            iface = m.group(1) if m else None
        except Exception:
            pass
        addrs = []   # [(iface, ip/prefix)]
        for line in self._run(['ip', '-4', '-o', 'addr', 'show']).splitlines():
            f = line.split()
            if len(f) >= 4 and f[1] != 'lo':
                addrs.append((f[1], f[3]))
        if not iface:
            wired = [i for i, _ in addrs if re.match(r'^(enx|eth|enp)', i)]
            iface = wired[0] if wired else None
        on_if = [ip for i, ip in addrs if i == iface]
        laptop_ip = next((ip.split('/')[0] for ip in on_if if ip.startswith('192.168.0.')), None)
        # the Dante address: what Inferno is bound to (asound.conf), else the first non-192.168.0 one
        bind = None
        try:
            m = re.search(r'BIND_IP\s+"([\d.]+)"', open(ASOUND_CONF).read())
            bind = m.group(1) if m else None
        except Exception:
            pass
        auto = next((ip.split('/')[0] for ip in on_if if not ip.startswith('192.168.0.')), None)
        dante_ip = bind or auto
        bind_ok = (bind is None) or any(ip.split('/')[0] == bind for _, ip in addrs)
        # Statime: running? which clock state did it log last?
        statime = False
        for pid in os.listdir('/proc'):
            if pid.isdigit():
                try:
                    if open(f'/proc/{pid}/comm').read().strip().startswith('statime'):
                        statime = True; break
                except Exception:
                    pass
        clock, leader = None, None
        try:
            with open(os.path.join(logs, 'statime.log'), 'rb') as f:
                f.seek(0, 2); f.seek(max(0, f.tell() - 32768))
                tail = f.read().decode('utf-8', 'replace').splitlines()
            for line in reversed(tail):
                low = line.lower()
                if clock is None:
                    for word, name in (('slave', 'following'), ('uncalibrated', 'locking'), ('listening', 'listening'),
                                       ('master', 'leading'), ('faulty', 'faulty'), ('passive', 'passive')):
                        if word in low:
                            clock = name; break
                if leader is None and re.search(r'master|leader|parent', low):
                    m = re.search(r'\b(\d{1,3}(?:\.\d{1,3}){3})\b', line)
                    if m and m.group(1) != dante_ip:
                        leader = m.group(1)
                if clock and leader:
                    break
        except Exception:
            pass
        # Inferno's UDP ports open? (it only listens while the 'dome' device is open)
        listening = set()
        for fn in ('/proc/net/udp', '/proc/net/udp6'):
            try:
                for line in open(fn).read().splitlines()[1:]:
                    port = int(line.split()[1].split(':')[1], 16)
                    if port in self.DANTE_PORTS or port in (319, 320):
                        listening.add(port)
            except Exception:
                pass
        # Dante devices we exchange packets with: the neighbour table on the Dante interface
        peers = []
        if iface:
            for line in self._run(['ip', '-4', 'neigh', 'show', 'dev', iface]).splitlines():
                f = line.split()
                if not f or f[0].startswith('192.168.0.') or 'FAILED' in f or 'INCOMPLETE' in f:
                    continue
                peers.append({'ip': f[0], 'state': f[-1]})
        return dict(iface=iface, laptop_ip=laptop_ip, dante_ip=dante_ip, dante_bind=bind, bind_ok=bind_ok,
                    statime=statime, clock=clock, leader=leader, udp=sorted(listening),
                    inferno=all(p in listening for p in (8700, 8800)), peers=peers[:6], t=time.time())


def cpu_temp():
    try:
        vals = []
        for z in os.listdir('/sys/class/thermal'):
            if z.startswith('thermal_zone'):
                with open(f'/sys/class/thermal/{z}/temp') as f: vals.append(int(f.read()) / 1000)
        return round(max(vals), 1) if vals else None
    except Exception:
        return None


# ----------------------------------------------------------------------------------------------
# Minimal WebSocket server (stdlib only)
# ----------------------------------------------------------------------------------------------
async def read_headers(reader):
    data = await reader.readuntil(b'\r\n\r\n')
    lines = data.decode('latin-1').split('\r\n')
    method, path, _ = (lines[0].split(' ') + ['', '', ''])[:3]
    headers = {}
    for l in lines[1:]:
        if ':' in l:
            k, v = l.split(':', 1); headers[k.strip().lower()] = v.strip()
    return method, path, headers


def ws_frame(opcode, payload=b''):
    n = len(payload)
    if n < 126: head = struct.pack('!BB', 0x80 | opcode, n)
    elif n < 65536: head = struct.pack('!BBH', 0x80 | opcode, 126, n)
    else: head = struct.pack('!BBQ', 0x80 | opcode, 127, n)
    return head + payload


async def ws_handler(bridge, reader, writer):
    peer = writer.get_extra_info('peername')
    try:
        method, path, h = await read_headers(reader)
        if h.get('upgrade', '').lower() != 'websocket':
            writer.write(b'HTTP/1.1 400 Bad Request\r\nContent-Length: 0\r\n\r\n'); await writer.drain(); return
        accept = base64.b64encode(hashlib.sha1(h['sec-websocket-key'].encode() + WS_GUID).digest()).decode()
        writer.write(('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n'
                      f'Sec-WebSocket-Accept: {accept}\r\n\r\n').encode())
        await writer.drain()
    except Exception:
        writer.close(); return

    print(f'sender connected: {peer}', flush=True)
    # One sender at a time: the newest wins. An older connection may be half-dead (e.g. the
    # laptop's adapter was swapped) or a second audio page; two writing into one buffer is chaos.
    old = getattr(bridge, 'writer', None)
    if old is not None and not old.is_closing():
        print('closing the previous sender', flush=True)
        old.close()
    bridge.writer = writer
    bridge.client = f'{peer[0]}'
    bridge.client_port = peer[1]
    me = writer.get_extra_info('sockname')
    bridge.client_local = f'{me[0]}:{me[1]}' if me else None
    bridge.client_since = time.time()
    bridge.stream.reset()

    async def push_stats():
        while True:
            await asyncio.sleep(1.0)
            writer.write(ws_frame(0x1, json.dumps(bridge.status()).encode()))
            await writer.drain()

    stats_task = asyncio.create_task(push_stats())
    frag = b''
    try:
        while True:
            b0, b1 = await reader.readexactly(2)
            fin, op, masked, n = b0 & 0x80, b0 & 0x0F, b1 & 0x80, b1 & 0x7F
            if n == 126: n = struct.unpack('!H', await reader.readexactly(2))[0]
            elif n == 127: n = struct.unpack('!Q', await reader.readexactly(8))[0]
            mask = await reader.readexactly(4) if masked else None
            payload = await reader.readexactly(n)
            if mask:
                p = np.frombuffer(payload, np.uint8)
                m = np.frombuffer(mask * (n // 4 + 1), np.uint8)[:n]
                payload = (p ^ m).tobytes()
            if op == 0x8:   # close
                writer.write(ws_frame(0x8)); await writer.drain(); break
            if op == 0x9:   # ping
                writer.write(ws_frame(0xA, payload)); await writer.drain(); continue
            if op == 0xA: continue
            if op in (0x0, 0x2):
                frag += payload
                if not fin: continue
                msg, frag = frag, b''
                if len(msg) < HDR.size: continue
                magic, seq, rate, ch, frames = HDR.unpack_from(msg)
                if magic != MAGIC or len(msg) != HDR.size + frames * ch * 4: continue
                data = np.frombuffer(msg, '<f4', count=frames * ch, offset=HDR.size).reshape(frames, ch)
                if ch != bridge.a.channels:   # adapt channel count (pad / cut)
                    d = np.zeros((frames, bridge.a.channels), np.float32)
                    k = min(ch, bridge.a.channels); d[:, :k] = data[:, :k]; data = d
                bridge.stream.push(seq, rate, data.astype(np.float32, copy=True))
            elif op == 0x1:   # text: hello / keepalive from the audio page
                if payload.startswith(b'{"hello"'): print(f'sender says: {payload.decode(errors="replace")}', flush=True)
                elif payload.startswith(b'{"diag"'):   # once a second; log only the bad seconds
                    try: dg = json.loads(payload)['diag']
                    except ValueError: dg = {}
                    if dg.get('gap_ms', 0) > 40 or dg.get('buf_kb', 0) > 64 or dg.get('blocks', 100) < 95:
                        print(f'sender diag: {dg}  rx since last: {time.monotonic() - bridge.stream.last_rx:.2f}s', flush=True)
    except (asyncio.IncompleteReadError, ConnectionError):
        pass
    finally:
        stats_task.cancel()
        print(f'sender disconnected: {peer}', flush=True)
        if getattr(bridge, 'writer', None) is writer:
            bridge.writer = None; bridge.client = None; bridge.client_port = None; bridge.client_local = None
        writer.close()


# ----------------------------------------------------------------------------------------------
# Status page + JSON API (port 9301)
# ----------------------------------------------------------------------------------------------
PAGE_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'status.html')
CARDS_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'cards.html')
RATES = (44100, 48000, 88200, 96000)
ASOUND_CONF = os.environ.get('DOME_ASOUND_CONF', '/etc/asound.conf')
_home = os.path.expanduser('~' + os.environ['SUDO_USER']) if os.environ.get('SUDO_USER') else os.path.expanduser('~')
RATE_FILE = os.environ.get('DOME_RATE_FILE', os.path.join(_home, 'bridge', 'logs', 'rate'))   # shared with start-dante.sh


def saved_rate(default=48000):
    try:
        r = int(open(RATE_FILE).read().strip())
        return r if r in RATES else default
    except Exception:
        return default


async def http_handler(bridge, reader, writer):
    try:
        method, path, h = await read_headers(reader)
        n = int(h.get('content-length', '0') or 0)
        body = await reader.readexactly(n) if n else b''
        path = path.split('?')[0]
        code, ctype, out = 200, 'application/json', b''
        if path == '/status':
            out = json.dumps(bridge.status()).encode()
        elif path == '/cmd' and method == 'POST':
            try: c = json.loads(body or b'{}')
            except Exception: c = {}
            act = c.get('action')
            if act == 'mute': bridge.muted = bool(c.get('on', not bridge.muted))
            elif act == 'ident': bridge.local.ident_t = 0.0
            elif act == 'tone':
                bridge.local.tone = bool(c.get('on', not bridge.local.tone))
                bridge.local.tone_ch = int(c.get('ch', -1))
            elif act == 'reset': bridge.stream.reset()
            elif act == 'rate': bridge.request_rate(c.get('rate'))
            out = json.dumps(bridge.status()).encode()
        elif path in ('/', '/index.html', '/cards'):
            ctype = 'text/html; charset=utf-8'
            with open(CARDS_PATH if os.path.exists(CARDS_PATH) else PAGE_PATH, 'rb') as f: out = f.read()
        elif path in ('/classic', '/classic.html'):
            ctype = 'text/html; charset=utf-8'
            with open(PAGE_PATH, 'rb') as f: out = f.read()
        else:
            code, out = 404, b'{}'
        writer.write(f'HTTP/1.1 {code} OK\r\nContent-Type: {ctype}\r\nContent-Length: {len(out)}\r\n'
                     'Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type\r\n'
                     'Cache-Control: no-store\r\nConnection: close\r\n\r\n'.encode() + out)
        await writer.drain()
    except Exception:
        pass
    finally:
        writer.close()


async def main_async(bridge, a):
    # Small receive window: the laptop's link is 1 Gb/s, ours 100 Mb/s. After a laptop hiccup TCP
    # would release its whole backlog at once, overflow the switch's port buffer, lose packets and
    # wait ~300 ms (Windows' minimum retransmit timeout) — an underrun. A small window caps each burst.
    # Set on the listening socket so accepted connections inherit it before the handshake.
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    if a.rcvbuf_kb > 0:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_RCVBUF, a.rcvbuf_kb * 1024)
    sock.bind((a.bind, a.ws_port))
    ws = await asyncio.start_server(lambda r, w: ws_handler(bridge, r, w), sock=sock)
    http = await asyncio.start_server(lambda r, w: http_handler(bridge, r, w), a.bind, a.http_port)
    print(f'{a.name}: sound in ws://<this host>:{a.ws_port}  ·  status http://<this host>:{a.http_port}/  ·  '
          f'out: {a.sink}' + (f' ({a.device}, {a.format})' if a.sink == 'aplay' else f' (skew {a.skew_ppm} ppm)'),
          flush=True)
    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for s in (signal.SIGINT, signal.SIGTERM):
        try: loop.add_signal_handler(s, stop.set)
        except NotImplementedError: pass
    if a.log_every:
        async def logger():
            while True:
                await asyncio.sleep(a.log_every)
                s = bridge.status()
                print(f"[{s['uptime_s']:>5}s] {s['state']:<7} fill {s['fill_ms']:>6} ms  adj {s['ppm']:>+7} ppm  "
                      f"underruns {s['underruns']}  drops {s['drops']}  blocks {s['blocks']}", flush=True)
        asyncio.create_task(logger())
    await stop.wait()
    # Don't 'async with' the servers: since Python 3.12 leaving it waits for every open
    # connection, and the laptop's never closes by itself, so SIGTERM hung. asyncio.run()
    # cancels the connection handlers on the way out.
    ws.close(); http.close()


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument('--name', default='DOME-BRIDGE')
    p.add_argument('--sink', choices=['aplay', 'null'], default='aplay')
    p.add_argument('--device', default='default', help="ALSA device for aplay: 'dome' = Inferno/Dante (see bridge/dante/)")
    p.add_argument('--format', default='S32_LE', choices=['S32_LE', 'S16_LE', 'FLOAT_LE'])
    p.add_argument('--rate', type=int, default=None, help='Dante sample rate (default: the last one set, else 48000)')
    p.add_argument('--channels', type=int, default=6)
    p.add_argument('--target-ms', type=float, default=100.0, help='buffer the controller holds (raise if underruns appear)')
    p.add_argument('--max-ppm', type=float, default=1000.0, help='largest clock correction (1000 ppm = 1.7 cents, inaudible)')
    p.add_argument('--block-ms', type=float, default=5.0)
    p.add_argument('--aplay-buffer', type=int, default=2048, help='aplay buffer, frames (power of two >= 1024 for Inferno)')
    p.add_argument('--aplay-period', type=int, default=512, help='aplay period, frames (power of two)')
    p.add_argument('--skew-ppm', type=float, default=0.0, help='null sink only: simulate a clock this far off')
    p.add_argument('--dump', metavar='FILE', help='record the output (raw float32, interleaved) instead of playing it')
    p.add_argument('--bind', default='0.0.0.0')
    p.add_argument('--ws-port', type=int, default=9300)
    p.add_argument('--rcvbuf-kb', type=int, default=64, help='TCP receive buffer for the sound socket (0 = kernel default)')
    p.add_argument('--http-port', type=int, default=9301)
    p.add_argument('--log-every', type=float, default=5.0, help='seconds between console status lines (0 = off)')
    p.add_argument('--tone', action='store_true', help='start with the test tone on (cycles L R C Ls Rs)')
    a = p.parse_args()
    if a.rate is None: a.rate = saved_rate()

    bridge = Bridge(a)
    if a.tone: bridge.local.tone = True
    t = threading.Thread(target=bridge.run, daemon=True, name='audio')
    t.start()
    try:
        asyncio.run(main_async(bridge, a))
    finally:
        bridge.running = False
        bridge.sink.close()


if __name__ == '__main__':
    main()
