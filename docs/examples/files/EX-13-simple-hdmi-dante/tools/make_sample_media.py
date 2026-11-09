#!/usr/bin/env python3
"""Make the sample pictures and films the demo slides use, so the kit runs without anyone else's media.

    pip install numpy pillow        (ffmpeg must be installed and on the PATH)
    python3 tools/make_sample_media.py

Writes:
  slides/03-carousel/media/sample-1.png, sample-2.png, sample-3.png   three still pictures (16:9)
  slides/03-carousel/media/sample-clip.webm                           a 6 s flat video with a tone
  slides/04-dome-film/media/sample-dome.webm                          an 8 s dome master (1024², 160°
                                                                      fisheye for a dome tilted 26°)

Everything here is generated, so it is ours: CC BY-SA 4.0, like the rest of the kit.
The dome film is also a small worked example of how a dome master is computed: for every pixel,
find the direction it shows in the room, then decide the colour for that direction.
"""
import math, os, subprocess, sys, tempfile, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
KIT = os.path.dirname(HERE)
CAR = os.path.join(KIT, 'slides', '03-carousel', 'media')
FILM = os.path.join(KIT, 'slides', '04-dome-film', 'media')
os.makedirs(CAR, exist_ok=True); os.makedirs(FILM, exist_ok=True)


def font(size):
    for name in ('DejaVuSans-Bold.ttf', 'Arial Bold.ttf', 'arialbd.ttf', 'Helvetica.ttc'):
        try: return ImageFont.truetype(name, size)
        except OSError: pass
    return ImageFont.load_default()


def ffmpeg(args):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-y'] + args)
    if r.returncode: sys.exit('ffmpeg failed: is it installed?')


def write_wav(path, stereo, rate=48000):
    data = (np.clip(stereo, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(rate); w.writeframes(data.tobytes())


# ---- three stills ----------------------------------------------------------------------------
W, H = 1600, 900
for i, (hue, word) in enumerate([((255, 150, 60), 'ONE'), ((90, 190, 255), 'TWO'), ((120, 230, 140), 'THREE')], 1):
    y, x = np.mgrid[0:H, 0:W]
    r = np.hypot(x - W * (0.3 + 0.2 * i), y - H * 0.45) / W
    base = np.stack([np.full((H, W), c, float) for c in hue], -1)
    img = (base * (0.25 + 0.75 * np.exp(-r * 3.5))[..., None] * (0.6 + 0.4 * (np.sin(r * 60) > 0))[..., None]).astype(np.uint8)
    im = Image.fromarray(img); d = ImageDraw.Draw(im)
    d.text((W / 2, H / 2), word, font=font(220), fill=(255, 255, 255), anchor='mm')
    d.text((W / 2, H * 0.78), f'sample picture {i} · replace me', font=font(48), fill=(255, 255, 255), anchor='mm')
    im.save(os.path.join(CAR, f'sample-{i}.png'))
print('stills done')

with tempfile.TemporaryDirectory() as tmp:
    # ---- a short flat clip: moving rings and a counter, with a tone ----------------------------
    fps, secs, W, H = 30, 6, 960, 540
    y, x = np.mgrid[0:H, 0:W]
    for f in range(fps * secs):
        t = f / fps
        r = np.hypot(x - W / 2 - 200 * math.cos(t), y - H / 2 - 100 * math.sin(2 * t)) / 40.0
        v = 0.5 + 0.5 * np.sin(r - t * 6)
        img = np.stack([v * 255, v * 120 + 60, (1 - v) * 200], -1).astype(np.uint8)
        im = Image.fromarray(img); d = ImageDraw.Draw(im)
        d.text((W / 2, H / 2), f'{t:4.1f} s', font=font(110), fill=(255, 255, 255), anchor='mm')
        im.save(os.path.join(tmp, f'c{f:04d}.png'))
    n = np.arange(48000 * secs) / 48000
    tone = 0.2 * np.sin(2 * math.pi * 440 * n) * (0.5 + 0.5 * np.sin(2 * math.pi * 2 * n))
    write_wav(os.path.join(tmp, 'clip.wav'), np.stack([tone, tone], -1))
    ffmpeg(['-framerate', str(fps), '-i', os.path.join(tmp, 'c%04d.png'), '-i', os.path.join(tmp, 'clip.wav'),
            '-c:v', 'libvpx-vp9', '-b:v', '1M', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-shortest',
            os.path.join(CAR, 'sample-clip.webm')])
    print('clip done')

    # ---- a dome master, computed pixel by pixel -------------------------------------------------
    # The master is an equidistant ("angular") fisheye: distance from the centre = angle from the
    # dome's own zenith. Wisdome spreads the whole circle over 160°, and the dome is tilted 26°
    # (raised at the back), so the centre of the file is 64° up, in front of the audience.
    RES, FOV, TILT, fps, secs = 1024, 160.0, 26.0, 30, 8
    px = (np.arange(RES) + 0.5) / RES * 2 - 1
    u, v = np.meshgrid(px, -px)                     # u right, v up; the bottom edge is the front
    rr = np.hypot(u, v); inside = rr <= 1
    th = rr * math.radians(FOV / 2)                 # angle from the dome's zenith
    az = np.arctan2(u, -v)                          # 0 = towards the bottom edge = the front
    lx, ly, lz = np.sin(th) * np.sin(az), np.sin(th) * np.cos(az), np.cos(th)
    c, s = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
    rx, ry, rz = lx, ly * c + lz * s, -ly * s + lz * c      # tilt the dome back into the room
    el = np.degrees(np.arcsin(np.clip(rz, -1, 1)))  # elevation above eye level
    raz = np.degrees(np.arctan2(rx, ry))            # azimuth, 0 = straight ahead
    sweet = (90 - TILT) - (1 - 40 / 90) * FOV / 2   # the venue's sweet spot, about 19.6° up
    for f in range(fps * secs):
        t = f / fps
        sky = np.clip((el + 10) / 80, 0, 1)
        col = np.stack([0.02 + 0.10 * (1 - sky), 0.03 + 0.08 * (1 - sky), 0.08 + 0.25 * sky], -1)
        # meridians every 30° turning slowly, and rings every 15° of elevation
        mer = (np.abs(((raz - t * 10 + 15) % 30) - 15) < 0.4) * 0.35
        ring = (np.abs(((el + 7.5) % 15) - 7.5) < 0.3) * 0.25
        horizon = (np.abs(el) < 0.5) * 0.9
        col += (mer + ring)[..., None] * np.array([0.4, 0.6, 1.0]) + horizon[..., None] * np.array([1.0, 0.6, 0.3])
        # a glowing ball circling the room at the sweet-spot height
        bz = math.radians(t * 45); be = math.radians(sweet)
        bx, by, bzz = math.cos(be) * math.sin(bz), math.cos(be) * math.cos(bz), math.sin(be)
        ang = np.degrees(np.arccos(np.clip(rx * bx + ry * by + rz * bzz, -1, 1)))
        col += (np.exp(-ang ** 2 / 8) + 0.3 * np.exp(-ang ** 2 / 120))[..., None] * np.array([1.0, 0.85, 0.5])
        img = (np.clip(col, 0, 1) * 255 * inside[..., None]).astype(np.uint8)
        Image.fromarray(img).save(os.path.join(tmp, f'd{f:04d}.png'))
    # its sound: a soft tone panned left/right with the ball (a stereo film; the slide spreads it to L R C)
    n = np.arange(48000 * secs) / 48000
    pan = np.sin(np.radians(n * 45))                # -1 left .. +1 right as the ball goes round
    tone = 0.18 * np.sin(2 * math.pi * 220 * n) + 0.08 * np.sin(2 * math.pi * 330 * n)
    write_wav(os.path.join(tmp, 'dome.wav'), np.stack([tone * np.sqrt((1 - pan) / 2), tone * np.sqrt((1 + pan) / 2)], -1))
    ffmpeg(['-framerate', str(fps), '-i', os.path.join(tmp, 'd%04d.png'), '-i', os.path.join(tmp, 'dome.wav'),
            '-c:v', 'libvpx-vp9', '-b:v', '3M', '-pix_fmt', 'yuv420p', '-c:a', 'libopus', '-shortest',
            os.path.join(FILM, 'sample-dome.webm')])
    print('dome film done')
print('All sample media written.')
