#!/usr/bin/env python3
"""Stand-in for the laptop's audio page: streams 6 sine tones (440 550 660 55 770 880 Hz on
L R C LFE Ls Rs) to a running domebridge_rx. Useful to test the bridge without the slides.
    python3 send_test.py [host] [seconds] [clock offset ppm]
"""
import socket, base64, os, struct, time, math, sys
import numpy as np
host = sys.argv[1] if len(sys.argv) > 1 else '127.0.0.1'
secs = float(sys.argv[2]) if len(sys.argv) > 2 else 60
ppm = float(sys.argv[3]) if len(sys.argv) > 3 else 0
s = socket.create_connection((host, 9300))
key = base64.b64encode(os.urandom(16)).decode()
s.sendall((f"GET / HTTP/1.1\r\nHost: {host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n"
           f"Sec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n").encode())
assert b'101' in s.recv(1024).split(b'\r\n')[0], 'no WebSocket upgrade'
def frame(op, payload):
    mask = os.urandom(4); n = len(payload)
    head = struct.pack('!BB', 0x80 | op, 0x80 | (n if n < 126 else 126)) + (struct.pack('!H', n) if 126 <= n < 65536 else b'')
    return head + mask + (np.frombuffer(payload, np.uint8) ^ np.frombuffer(mask * (n // 4 + 1), np.uint8)[:n]).tobytes()
freqs = np.array([440, 550, 660, 55, 770, 880])
rate = 48000 * (1 + ppm * 1e-6); t0 = time.monotonic(); seq = 0; n0 = 0
print(f'sending to {host}:9300 for {secs:.0f} s ...')
while time.monotonic() - t0 < secs:
    k = np.arange(n0, n0 + 480)[:, None]
    d = (0.25 * np.sin(2 * math.pi * freqs * k / 48000)).astype('<f4').ravel()
    s.sendall(frame(2, struct.pack('<4sIIHH', b'DBR1', seq, 48000, 6, 480) + d.tobytes()))
    seq += 1; n0 += 480
    wait = t0 + n0 / rate - time.monotonic()
    if wait > 0: time.sleep(wait)
s.sendall(frame(8, b'')); s.close(); print('done,', seq, 'blocks')
