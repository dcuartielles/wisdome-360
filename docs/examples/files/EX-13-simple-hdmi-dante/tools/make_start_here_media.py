#!/usr/bin/env python3
"""Make the picture and the sound the "start here" slide uses (they are already in the kit;
this script is only here to show how they were made).

    pip install numpy pillow
    python3 tools/make_start_here_media.py

Writes slides/start-here/media/picture.png (a 3:2 picture) and sound.wav (a 4 s loop, mono, 48 kHz).
Everything here is generated, so it is ours: CC BY-SA 4.0, like the rest of the kit.
"""
import os, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

KIT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(KIT, 'slides', 'start-here', 'media')
os.makedirs(OUT, exist_ok=True)


def font(size):
    for name in ('DejaVuSans-Bold.ttf', 'Arial Bold.ttf', 'arialbd.ttf', 'Helvetica.ttc'):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()


# the picture: a blue-green gradient with a few circles and two lines of text
W, H = 1200, 800
y, x = np.mgrid[0:H, 0:W] / np.array([H, W]).reshape(2, 1, 1)
r = np.clip(30 + 40 * x, 0, 255)
g = np.clip(70 + 90 * (1 - y), 0, 255)
b = np.clip(120 + 110 * x * (1 - y), 0, 255)
img = Image.fromarray(np.dstack([r, g, b]).astype(np.uint8))
d = ImageDraw.Draw(img)
for cx, cy, rad in ((260, 230, 120), (930, 560, 170), (640, 140, 60)):
    d.ellipse((cx - rad, cy - rad, cx + rad, cy + rad), outline=(255, 255, 255), width=10)
d.rectangle((12, 12, W - 13, H - 13), outline=(255, 255, 255), width=12)
for text, size, yy in (('YOUR PICTURE', 120, 330), ('replace media/picture.png', 52, 480)):
    f = font(size)
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, yy), text, font=f, fill=(255, 255, 255))
img.save(os.path.join(OUT, 'picture.png'), optimize=True)

# the sound: a soft chord with a slow shimmer, looping cleanly every 4 s
RATE, SEC = 48000, 4.0
t = np.arange(int(RATE * SEC)) / RATE
s = np.zeros_like(t)
for f, a in ((220.0, 0.5), (330.0, 0.3), (440.0, 0.2), (550.0, 0.12)):
    s += a * np.sin(2 * np.pi * f * t)          # whole cycles in 4 s, so the loop has no click
s *= 0.75 + 0.25 * np.sin(2 * np.pi * 1.0 * t)  # 1 Hz shimmer, also whole cycles
s = s / np.max(np.abs(s)) * 0.5                  # peaks at -6 dBFS
with wave.open(os.path.join(OUT, 'sound.wav'), 'wb') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
    w.writeframes((s * 32767).astype('<i2').tobytes())
print('wrote', OUT)
