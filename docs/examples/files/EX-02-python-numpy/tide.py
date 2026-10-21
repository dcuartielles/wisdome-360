#!/usr/bin/env python3
"""
EX-02  "TIDE"  --  a pre-rendered dome master written from scratch in Python.
=========================================================================
    python3 tide.py            # renders PNG frames, then encodes an mp4

No 3-D package, no game engine. About 120 lines of numpy. The point of this
example is the IDEA, not the tool:

    Author your picture in (AZIMUTH, ELEVATION) as the AUDIENCE sees it --
    azimuth 0 = the front of the room, elevation 0 = eye level -- and convert
    to a fisheye dome master at the very last step.

Everything a dome cares about becomes easy in those coordinates:
  * "put the subject where people can comfortably see it" is a box:
        -60 <= azimuth <= 60  and  15 <= elevation <= 60   (in FRONT)
    with the sweet spot straight ahead at azimuth 0, elevation 40
  * "put it at the front of the room" is azimuth 0
  * "sweep it around the audience" is adding to azimuth over time
  * "no roll" is simply never rotating the image

Wisdome Malmo is tilted 26 degrees, raised at the back. That is handled in
ONE place, to_fisheye(): the audience's angles are tilted into the dome's
angles there, and nowhere else. Behind the audience the projected image
only starts about 36 degrees up, so low ribbons simply disappear behind
them -- which is fine for ambience, and why the subject goes in front.

Try changing BANDS at the bottom. Each entry is one ribbon of light.
"""
import numpy as np, os, subprocess, math
from PIL import Image

# --------------------------------------------------------------- settings
RES     = 2048          # the delivery size; 1024 while you design
FRAMES  = 600           # 600 @ 30 fps = 20 s
FPS     = 30
OUTDIR  = "frames"
MP4     = "EX-02_tide_%dx%d_30fps.mp4" % (RES, RES)

TILT    = 26.0          # dome tilt in degrees, back raised (Wisdome Malmo)

# The (azimuth, elevation) canvas, in the AUDIENCE's angles. Width covers
# 360 deg; height covers -30..90 deg, because at the front of a tilted dome
# the picture reaches below eye level. W = 3*H keeps one pixel = the same
# angle in both directions, which keeps all the maths below honest.
EL_MIN = -30.0
H_EQ = 1024
W_EQ = H_EQ * 3
PPD  = H_EQ / (90.0 - EL_MIN)          # pixels per degree

AZ = np.linspace(0, 360, W_EQ, endpoint=False)[None, :]       # azimuth of each column
EL = np.linspace(90, EL_MIN, H_EQ, endpoint=False)[:, None]   # elevation of each row


def ribbon(t, elev0, amp, lobes, speed, thickness, colour, glow=1.0,
           rise=0.0, rise_rate=0.0):
    """One ribbon of light: a closed curve at a wobbling elevation.

    elev0     centre elevation above eye level, in degrees
    amp       how far the ribbon wanders above and below elev0, in degrees
    lobes     how many times it wobbles around the full 360 deg
    speed     degrees of AZIMUTH the whole ribbon drifts per second
    thickness vertical half-width, in degrees
    rise      how far the ribbon's centre elevation breathes, in degrees
    rise_rate how fast it breathes, in radians per second

    NOTE ON THE DRIFT -- this is the bug everybody writes first.
    The drift has to be subtracted from AZIMUTH *before* multiplying by
    `lobes`:

        phase = radians((AZ - speed * t) * lobes)        # correct
        phase = radians(AZ * lobes + speed * t)          # WRONG

    The wrong version still animates, but it moves the pattern by
    speed*t/lobes degrees instead of speed*t -- so with lobes = 3 you get a
    third of the motion you asked for, and the piece looks frozen. Keeping
    the drift in the same units as the thing it drifts (degrees of azimuth)
    is what makes it checkable.
    """
    drift  = speed * t
    phase  = np.radians((AZ - drift) * lobes)
    centre = elev0 + amp * np.sin(phase)
    if rise:
        centre = centre + rise * math.sin(t * rise_rate + elev0 * 0.11)
    d = np.abs(EL - centre) / thickness
    # smooth falloff -- a hard edge would alias badly once it is stretched
    # across the dome, and thin hard lines are exactly what a dome cannot show
    a = np.exp(-(d ** 2) * 2.2) * glow
    return a[..., None] * np.array(colour)[None, None, :]


def horizon_glow(t, height, colour, strength):
    """A soft wash rising from eye level. Grounds the image without lighting
    up the whole dome -- the lower elevations are the least visible, so a
    glow there costs almost nothing in average picture level."""
    a = np.clip(1.0 - EL / height, 0, 1) ** 2.2 * np.clip((EL + 12.0) / 12.0, 0, 1)  # fades out below eye level
    a = a * (0.62 + 0.38 * math.sin(t * 0.62))
    return (a * strength)[..., None] * np.array(colour)[None, None, :]


def stars(seed=3, n=900):
    """A static point field, drawn once. Texture at the zenith, not content."""
    rng = np.random.default_rng(seed)
    img = np.zeros((H_EQ, W_EQ, 3), np.float32)
    # uniform ON THE DOME, not uniform in the canvas -- higher elevations
    # occupy far fewer square degrees, so sampling cos(elevation) avoids a
    # dense clump at the zenith
    el = np.degrees(np.arcsin(rng.random(n)))
    az = rng.random(n) * 360.0
    ys = ((90 - el) / (90 - EL_MIN) * H_EQ).astype(int).clip(0, H_EQ - 1)
    xs = ((az / 360) * W_EQ).astype(int).clip(0, W_EQ - 1)
    b = rng.random(n) ** 2.5 * 0.55
    img[ys, xs] = np.stack([b * 0.75, b * 0.85, b], 1)
    return img


def to_fisheye(eq, n):
    """(azimuth, elevation) canvas  ->  equidistant azimuthal dome master.

    In the dome master:
      centre of the circle = the DOME's zenith, edge = the dome's rim,
      radius is LINEAR in angle from the dome's zenith (180 deg across),
      the front of the room is at the BOTTOM of the image.
    Because the dome is tilted, its zenith is not overhead: it is
    90 - TILT = 64 deg up, in front of the audience. So each master pixel
    is turned into a dome direction, tilted into the room, and looked up
    on the canvas by its room azimuth and elevation.
    """
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    c = (n - 1) / 2.0
    dx, dy = xx - c, yy - c
    r = np.sqrt(dx * dx + dy * dy) / (n / 2.0)
    inside = r <= 1.0
    th = np.radians(90.0) * np.clip(r, 0, 1)        # angle from the dome's zenith
    a = np.arctan2(dx, dy)                          # 0 = bottom = front
    lx, ly, lz = np.sin(th) * np.sin(a), np.sin(th) * np.cos(a), np.cos(th)
    ct, st = math.cos(math.radians(TILT)), math.sin(math.radians(TILT))
    x, y, z = lx, ly * ct + lz * st, -ly * st + lz * ct   # dome -> room
    elev = np.degrees(np.arcsin(np.clip(z, -1, 1)))
    az = (np.degrees(np.arctan2(x, y)) + 360.0) % 360.0
    sx = az / 360.0 * (W_EQ - 1)
    sy = np.clip((90.0 - elev) / (90.0 - EL_MIN), 0, 1) * (H_EQ - 1)
    x0 = np.floor(sx).astype(np.int32); y0 = np.floor(sy).astype(np.int32)
    x1 = (x0 + 1) % W_EQ;               y1 = np.clip(y0 + 1, 0, H_EQ - 1)
    fx = (sx - x0)[..., None];          fy = (sy - y0)[..., None]
    out = (eq[y0, x0] * (1 - fx) * (1 - fy) + eq[y0, x1] * fx * (1 - fy)
         + eq[y1, x0] * (1 - fx) * fy      + eq[y1, x1] * fx * fy)
    out[~inside] = 0
    return out


# ------------------------------------------------------------- the picture
# Ribbons are AMBIENCE: they wrap the whole dome. The two warm ones run
# through the comfortable zone in front (15-60 deg up); a subject would go
# there too, near the 40 deg sweet spot.
BANDS = [
    # Each row is one ribbon of light. Tune these first.
    #
    #   elev0  amp lobes speed  thick  colour                glow  rise  rate
    #                          deg/s          (R, G, B)             deg  rad/s
    #
    # `speed` is degrees of azimuth per second. Over the 20 s of this piece,
    # 6 deg/s carries a ribbon 120 degrees around the audience -- a third of
    # the way round. That is a lot of travel and still gentle, because the
    # ribbons move independently instead of the whole world turning as one
    # rigid thing, which is what actually makes people ill.
    (46.0,  7.0,  3,   6.0,  2.6,  (1.00, 0.34, 0.10),  0.95,  5.0, 0.30),
    (34.0,  9.0,  5,  -4.5,  2.0,  (1.00, 0.62, 0.18),  0.80,  4.0, 0.22),
    (26.0,  5.0,  2,   8.0,  3.4,  (0.20, 0.45, 1.00),  0.85,  6.0, 0.17),
    (19.0,  4.0,  7,  -3.0,  1.5,  (0.55, 0.85, 1.00),  0.55,  3.0, 0.41),
    (55.0,  6.0,  4,   2.5,  1.8,  (0.85, 0.30, 0.65),  0.45,  4.5, 0.26),
]

STARS = stars()

def frame(t):
    eq = np.zeros((H_EQ, W_EQ, 3), np.float32)
    eq += STARS
    eq += horizon_glow(t, 22.0, (0.30, 0.16, 0.45), 0.34)
    for (e0, amp, lob, spd, th, col, g, rise, rate) in BANDS:
        # each ribbon breathes on its own clock, so they fall in and out of
        # step instead of pulsing together like a metronome
        pulse = 0.68 + 0.32 * math.sin(t * 0.75 + e0 * 0.09)
        # thickness breathes too -- a thin bright line and a broad soft wash
        # read as completely different materials on a dome
        thick = th * (0.75 + 0.45 * (0.5 + 0.5 * math.sin(t * 0.43 + lob)))
        eq += ribbon(t, e0, amp, lob, spd, thick, col, g * pulse,
                     rise=rise, rise_rate=rate)
    return eq


def main():
    os.makedirs(OUTDIR, exist_ok=True)
    for i in range(FRAMES):
        t = i / FPS
        eq = frame(t)
        img = to_fisheye(eq, RES)
        img = np.clip(img, 0, 1)
        img = img ** (1 / 1.9)                     # gentle gamma, keeps mids alive
        Image.fromarray((img * 255).astype(np.uint8)).save(
            f"{OUTDIR}/frame_{i:04d}.png", optimize=False)
        if i % 25 == 0:
            print(f"  frame {i+1}/{FRAMES}")

    print("encoding", MP4)
    subprocess.run([
        "ffmpeg", "-y", "-framerate", str(FPS), "-i", f"{OUTDIR}/frame_%04d.png",
        "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-b:v", "60M", "-maxrate", "60M", "-bufsize", "120M", "-r", str(FPS),
        MP4], check=True, capture_output=True)
    print("done ->", MP4)


if __name__ == "__main__":
    main()
