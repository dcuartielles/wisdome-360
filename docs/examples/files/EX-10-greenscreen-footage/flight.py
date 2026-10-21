#!/usr/bin/env python3
"""
EX-10  "FLIGHT"  --  real footage in the dome: a green-screen dove, keyed and flown.
====================================================================================
    pip install numpy opencv-python
    python3 flight.py                     # uses source/dove_greenscreen.mkv

Every other example in this folder GENERATES its picture. This one starts from
someone else's video -- a 1080p stock clip of a dove flapping in place on a
green screen -- and answers the question people ask first: "can I put my
own footage in the dome?"  Yes, in three steps, all in this file:

  1. KEY    remove the green, keep an alpha matte              key()
  2. PLACE  hang the keyed frame on a flat card out in the room,
            facing the audience, nose along the flight path      place_bird()
  3. FLY    move the card in (AZIMUTH, ELEVATION), as always     flight_path()

The card is placed in the AUDIENCE's angles -- azimuth 0 = the front of the
room, elevation 0 = eye level -- exactly like EX-02. The dome's 26 degree tilt
lives in one place only, master_to_room(). Because each master pixel is turned
into a ray and the ray is intersected with the card, the bird bends correctly
wherever it is on the dome. Pasting the 2-D clip straight into the master
would not: it would stretch and curl as it moved toward the rim.

The dove circles the whole audience once every 30 s. It is lowest and closest
in front (the comfortable zone) and climbs behind, because behind the
audience the picture only starts about 36 degrees up.

Source clip: "Flying Dove - Free Green screen Stock Footage" by UltraKey,
https://ultrakey.gumroad.com/l/flyingdove -- free for non-commercial use with
credit to UltraKey. A commercial show needs their paid licence.
"""
import math, os, subprocess, sys
import numpy as np
import cv2

# --------------------------------------------------------------- settings
SRC     = "source/dove_greenscreen.mkv"
RES     = 2048          # the delivery size; 1024 while you design
FPS     = 30
SECONDS = 30            # one lap of the room
MP4     = "EX-10_flight_%dx%d_30fps.mp4" % (RES, RES)
KEYED   = "EX-10_dove_keyed_alpha.webm"   # the bird alone, with transparency

TILT    = 26.0          # dome tilt in degrees, back raised (Wisdome Malmo)

# where the bird is in the 1920x1080 source (found by scanning every frame for
# non-green pixels, plus a margin so the wing tips never touch the edge)
CROP    = (560, 200, 1352, 880)            # x0, y0, x1, y1

BIRD_DEG = 30.0         # angular width of the card, so the wingspan is ~26 deg


# ------------------------------------------------------- 1. KEY the footage
def key(rgb):
    """Green-screen key. rgb uint8 HxWx3 -> float RGBA in 0..1.

    'spill' is how much greener than its other channels a pixel is: about 1
    on the backing, about 0 on white feathers. The ramp between 0.04 and 0.34
    is the soft edge. Then DESPILL: clamp green to the brighter of red/blue,
    or the feather edges keep a green fringe that the dark sky makes obvious.
    """
    f = rgb.astype(np.float32) / 255.0
    r, g, b = f[..., 0], f[..., 1], f[..., 2]
    spill = g - np.maximum(r, b)
    a = 1.0 - np.clip((spill - 0.04) / 0.30, 0, 1)
    a = cv2.GaussianBlur(a, (3, 3), 0)
    a[a < 0.02] = 0
    g = np.minimum(g, np.maximum(r, b) + 0.02)
    return np.dstack([r, g, b, a])


# ------------------------------------- the one place the 26 deg tilt lives
def master_to_room(n):
    """For every pixel of an n x n dome master: its direction in the ROOM.

    Dome master: centre = the dome's zenith, rim = 180 deg across, radius
    linear in angle, front of the room at the BOTTOM of the image. The dome
    is tilted, so its zenith is 64 deg up in front of the audience; the dome
    direction is rotated by TILT about the left-right axis to get the room's.
    Room axes: x = right, y = front, z = up.
    """
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2.0
    dx, dy = xx - c, yy - c
    r = np.sqrt(dx * dx + dy * dy) / (n / 2.0)
    inside = r <= 1.0
    th = np.radians(90.0) * np.clip(r, 0, 1)
    a = np.arctan2(dx, dy)                                  # 0 = bottom = front
    lx, ly, lz = np.sin(th) * np.sin(a), np.sin(th) * np.cos(a), np.cos(th)
    ct, st = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
    room = np.stack([lx, ly * ct + lz * st, -ly * st + lz * ct], -1).astype(np.float32)
    return room, inside


def room_dir(az, el):
    """(azimuth, elevation) in degrees -> unit vector in the room."""
    a, e = math.radians(az), math.radians(el)
    return np.array([math.cos(e) * math.sin(a), math.cos(e) * math.cos(a), math.sin(e)], np.float32)


ROOM, INSIDE = master_to_room(RES)
EL = np.degrees(np.arcsin(np.clip(ROOM[..., 2], -1, 1)))
AZ = np.degrees(np.arctan2(ROOM[..., 0], ROOM[..., 1]))      # -180..180, 0 = front


# --------------------------------------------------------------- the sky
def make_sky():
    """The house background: near-black, a warm dusk glow low at the FRONT,
    cool behind, sparse stars as texture at the top. Dark on purpose -- the
    dome cross-reflects, and a bright sky would grey out the white bird."""
    front = 0.5 + 0.5 * np.cos(np.radians(AZ))                 # 1 in front, 0 behind
    low = np.exp(-np.clip(EL, 0, 90) / 14.0)                   # strongest at eye level
    base = np.array([0.010, 0.014, 0.030], np.float32)
    warm = np.array([0.30, 0.12, 0.035], np.float32)
    cool = np.array([0.025, 0.05, 0.11], np.float32)
    sky = base + (low * front ** 2)[..., None] * warm + (low * (1 - front) * 0.8)[..., None] * cool
    # stars: uniform ON THE SPHERE (arcsin), so they do not clump at the zenith
    rng = np.random.default_rng(10)
    m = 2600
    saz = rng.uniform(-180, 180, m)
    sel = np.degrees(np.arcsin(rng.uniform(math.sin(math.radians(10)), 1, m)))
    sbr = rng.uniform(0.25, 0.9, m) ** 2
    stars = np.zeros(sky.shape[:2], np.float32)
    # splat each star at the master pixel whose room direction matches it
    dirs = np.stack([np.cos(np.radians(sel)) * np.sin(np.radians(saz)),
                     np.cos(np.radians(sel)) * np.cos(np.radians(saz)),
                     np.sin(np.radians(sel))], -1)
    px, ok = room_to_master(dirs)
    for (x, y), b, k in zip(px, sbr, ok):
        if k:
            stars[int(y), int(x)] += b
    stars = cv2.GaussianBlur(stars, (0, 0), RES / 2048 * 0.8)
    stars *= (1 - low * front) * 6.0                           # fade into the glow
    sky += stars[..., None] * np.array([0.9, 0.93, 1.0], np.float32)
    return sky


def room_to_master(d):
    """Inverse of master_to_room for a list of room directions -> pixel xy."""
    ct, st = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
    x, y, z = d[:, 0], d[:, 1], d[:, 2]
    lx, ly, lz = x, y * ct - z * st, y * st + z * ct
    th = np.arccos(np.clip(lz, -1, 1)); a = np.arctan2(lx, ly)
    r = th / (np.pi / 2) * (RES / 2.0); c = (RES - 1) / 2.0
    xy = np.stack([c + r * np.sin(a), c + r * np.cos(a)], -1)
    return xy, (th <= np.pi / 2) & (xy.min(1) >= 0) & (xy.max(1) < RES)


# ------------------------------------------------------- 3. FLY the path
def flight_path(t):
    """(azimuth, elevation) of the bird at time t, in degrees.

    One lap per SECONDS, left to right across the front. Lowest in front
    (30 deg, inside the comfortable zone), highest behind (48 deg, so it
    stays above the 36 deg where the picture starts behind the audience),
    with a slow bob so the flight does not look like a turntable."""
    az = -60.0 + 360.0 * t / SECONDS
    back = 0.5 - 0.5 * math.cos(math.radians(az))              # 0 front, 1 behind
    el = 30.0 + 18.0 * back + 3.0 * math.sin(2 * math.pi * t / 6.0)
    return az, el


# --------------------------------------------- 2. PLACE the card in the room
def place_bird(img, bird, t):
    """Hang the keyed frame on a flat card facing the audience and draw it.

    The card's right edge points along the flight path (the dove faces right
    in the source), its top edge points as close to the room's UP as it can:
    zero roll, so the horizon never tips. Every master pixel's ray is
    intersected with the card plane; where it lands on the card, that is the
    pixel of the source frame it sees."""
    b = room_dir(*flight_path(t))
    v = room_dir(*flight_path(t + 1 / FPS)) - room_dir(*flight_path(t - 1 / FPS))
    u = v - b * (v @ b); u /= np.linalg.norm(u)                # heading
    up = np.array([0, 0, 1], np.float32)
    w = up - b * (up @ b) - u * (up @ u); w /= np.linalg.norm(w)  # card up, zero roll

    ch, cw = bird.shape[:2]
    hw = math.tan(math.radians(BIRD_DEG / 2)); hh = hw * ch / cw
    # only work on the pixels near the bird
    cos_r = math.cos(math.atan(math.hypot(hw, hh)) + 0.02)
    near = (ROOM @ b > cos_r) & INSIDE
    if not near.any():
        return img
    ys, xs = np.where(near)
    y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
    d = ROOM[y0:y1, x0:x1]
    p = d / np.maximum(d @ b, 1e-4)[..., None]                 # ray meets the card plane
    mx = ((p @ u) / hw * 0.5 + 0.5) * cw - 0.5
    my = (-(p @ w) / hh * 0.5 + 0.5) * ch - 0.5
    pre = bird.copy(); pre[..., :3] *= pre[..., 3:4]           # premultiply: clean edges
    s = cv2.remap(pre, mx.astype(np.float32), my.astype(np.float32),
                  cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT, borderValue=0)
    img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - s[..., 3:4]) + s[..., :3]
    return img


# ------------------------------------------------------------------ main
def main():
    sw, sh = 1920, 1080
    x0, y0, x1, y1 = CROP
    sky = make_sky()
    dec = subprocess.Popen(["ffmpeg", "-v", "error", "-i", SRC, "-f", "rawvideo",
                            "-pix_fmt", "rgb24", "-"], stdout=subprocess.PIPE)
    enc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24",
                            "-s", f"{RES}x{RES}", "-r", str(FPS), "-i", "-",
                            "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
                            "-crf", "16", "-movflags", "+faststart", MP4], stdin=subprocess.PIPE)
    kenc = subprocess.Popen(["ffmpeg", "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba",
                             "-s", f"{x1 - x0}x{y1 - y0}", "-r", str(FPS), "-i", "-",
                             "-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p", "-b:v", "2M",
                             "-auto-alt-ref", "0", KEYED], stdin=subprocess.PIPE)
    os.makedirs("preview", exist_ok=True)
    for i in range(FPS * SECONDS):
        raw = dec.stdout.read(sw * sh * 3)
        if len(raw) < sw * sh * 3:
            sys.exit("source clip ended early -- it must be at least %d s" % SECONDS)
        bird = key(np.frombuffer(raw, np.uint8).reshape(sh, sw, 3)[y0:y1, x0:x1])
        kenc.stdin.write((bird * 255).astype(np.uint8).tobytes())
        img = place_bird(sky.copy(), bird, i / FPS)
        img[~INSIDE] = 0
        out = (np.clip(img, 0, 1) * 255).astype(np.uint8)
        enc.stdin.write(out.tobytes())
        if i % 225 == 0:
            cv2.imwrite(f"preview/still_{i:04d}.png", out[..., ::-1])
        if i % 60 == 0:
            print(f"  frame {i + 1}/{FPS * SECONDS}", flush=True)
    dec.kill(); enc.stdin.close(); kenc.stdin.close(); enc.wait(); kenc.wait()
    print("done ->", MP4, "and", KEYED)


if __name__ == "__main__":
    main()
