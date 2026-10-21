#!/usr/bin/env python3
"""
EX-08  flat2dome.py  --  put FLAT pictures (slides, photos, video frames) on the dome
=====================================================================================
A flat 16:9 picture pasted into the middle of a dome master is WRONG: the fisheye
bends it, and it lands overhead. The right way is to "apply the fisheye lens":
treat the picture as a flat SCREEN floating in the room, in front of the audience,
and photograph that screen with the same 180-degree fisheye camera the dome uses.
Then the dome bends it back, and the audience sees it flat and straight.

    python3 flat2dome.py slide.png                  -> slide_dome.png  (2048 x 2048)
    python3 flat2dome.py frames/ -o dome_frames/    -> every image in a folder
    python3 flat2dome.py slide.png --width 70 --elev 38 --res 4096

Options (all angles in degrees, measured from the audience):
    --width   how wide the screen looks (default 60). 16:9 at 60 deg is 33.75 deg tall.
    --elev    where its centre sits above eye level (default 40 = the sweet spot)
    --az      left/right (default 0 = straight ahead; + = right)
    --tilt    dome tilt, back raised (default 26 = Wisdome Malmo)
    --curved  bend the screen round the audience like a cinema screen (for wide pictures)
    --res     master size (default 2048, the delivery size)

Only numpy and Pillow. For VIDEO, ffmpeg does the same in one line (see README).
"""
import argparse, math, os, sys
import numpy as np
from PIL import Image


def screen_uv(n, width, elev, az, tilt, aspect, curved, fov=180.0):
    """For every master pixel: where it lands on the flat picture (u, v in 0..1), or nan."""
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float64)
    c = (n - 1) / 2.0
    dx, dy = (xx - c) / (n / 2.0), (yy - c) / (n / 2.0)
    r = np.hypot(dx, dy)
    # 1. master pixel -> direction on the DOME (equidistant fisheye, front at the bottom)
    th = r * math.radians(fov / 2.0)                 # angle from the dome's zenith
    a = np.arctan2(dx, dy)
    lx, ly, lz = np.sin(th) * np.sin(a), np.sin(th) * np.cos(a), np.cos(th)
    # 2. dome -> ROOM (x right, y front, z up): the dome's zenith leans `tilt` deg to the front
    ct, st = math.cos(math.radians(tilt)), math.sin(math.radians(tilt))
    d = np.stack([lx, ly * ct + lz * st, -ly * st + lz * ct], -1)
    # 3. the screen: centre direction f, right vector rr, up vector uu
    e, h = math.radians(elev), math.radians(az)
    f = np.array([math.cos(e) * math.sin(h), math.cos(e) * math.cos(h), math.sin(e)])
    rr = np.cross(f, [0.0, 0.0, 1.0]); rr /= np.linalg.norm(rr)
    uu = np.cross(rr, f)
    half_w = math.radians(width) / 2.0
    df, dr, du = d @ f, d @ rr, d @ uu
    if curved:   # a cylinder round the audience: x by angle, y by height on the cylinder
        x = np.arctan2(dr, df) / half_w
        y = du / np.maximum(np.hypot(dr, df), 1e-9) / (half_w / aspect)
        ok = (r <= 1.0) & (np.hypot(dr, df) > 1e-6)
    else:        # a flat screen: intersect each ray with the plane, like a pinhole camera
        k = np.where(df > 1e-6, df, np.nan)
        x = dr / k / math.tan(half_w)
        y = du / k / (math.tan(half_w) / aspect)
        ok = (r <= 1.0) & (df > 1e-6)
    u, v = (x + 1) / 2, (1 - y) / 2                  # image rows go DOWN
    inside = ok & (u >= 0) & (u <= 1) & (v >= 0) & (v <= 1)
    return u, v, inside


def warp(img, n, **kw):
    src = np.asarray(img.convert('RGB')).astype(np.float32)
    H, W = src.shape[:2]
    u, v, inside = screen_uv(n, aspect=W / H, **kw)
    sx = np.clip(np.nan_to_num(u) * (W - 1), 0, W - 1)
    sy = np.clip(np.nan_to_num(v) * (H - 1), 0, H - 1)
    x0, y0 = np.floor(sx).astype(int), np.floor(sy).astype(int)
    x1, y1 = np.minimum(x0 + 1, W - 1), np.minimum(y0 + 1, H - 1)
    fx, fy = (sx - x0)[..., None], (sy - y0)[..., None]
    out = (src[y0, x0] * (1 - fx) * (1 - fy) + src[y0, x1] * fx * (1 - fy)
           + src[y1, x0] * (1 - fx) * fy + src[y1, x1] * fx * fy)
    out[~inside] = 0
    return Image.fromarray(out.astype(np.uint8))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('input'); ap.add_argument('-o', '--out')
    ap.add_argument('--width', type=float, default=60); ap.add_argument('--elev', type=float, default=40)
    ap.add_argument('--az', type=float, default=0); ap.add_argument('--tilt', type=float, default=26)
    ap.add_argument('--res', type=int, default=2048); ap.add_argument('--curved', action='store_true')
    ap.add_argument('--supersample', type=int, default=1, help='render at N x res and shrink (sharper, slower)')
    a = ap.parse_args()
    kw = dict(width=a.width, elev=a.elev, az=a.az, tilt=a.tilt, curved=a.curved)
    exts = ('.png', '.jpg', '.jpeg', '.webp', '.tif', '.tiff', '.bmp')
    if os.path.isdir(a.input):
        files = sorted(f for f in os.listdir(a.input) if f.lower().endswith(exts))
        out = a.out or a.input.rstrip('/\\') + '_dome'
        os.makedirs(out, exist_ok=True)
        pairs = [(os.path.join(a.input, f), os.path.join(out, os.path.splitext(f)[0] + '.png')) for f in files]
    else:
        pairs = [(a.input, a.out or os.path.splitext(a.input)[0] + '_dome.png')]
    for i, (src, dst) in enumerate(pairs):
        n = a.res * a.supersample
        img = warp(Image.open(src), n, **kw)
        if a.supersample > 1: img = img.resize((a.res, a.res), Image.LANCZOS)
        img.save(dst)
        print(f'[{i + 1}/{len(pairs)}] {dst}')


if __name__ == '__main__':
    main()
