#!/usr/bin/env python3
"""EX-09 — Type size: how small can text be on the dome?

Writes dome masters (square, equidistant fisheye, 180°, bottom edge = front of the
room) for Wisdome Malmö (tilted 26°, raised at the back):

  ex09_ladder_<res>.png      one line of text at cap heights from 8° down to 0.75°,
                             top to bottom inside the comfortable zone, each labelled
                             in degrees and in master pixels (2K | 4K)
  ex09_detail_<res>.png      what breaks first: hairline weights, small serifs,
                             thin white on black, 1–8 px lines, fine stripes
  ex09_ladder_typed-flat_2048.png
                             the SAME ladder typed straight into the dome master, for
                             comparison: on the dome its lines curve and its sizes drift

Measure type in DEGREES, not points or pixels. 2048 px span 180°, so 1° ≈ 11.4 px
of a 2K master and ≈ 22.8 px of a 4K master. Sizes here are CAP HEIGHT (the
height of a capital H) seen from the centre seat.

Projection: the EX-08 method. The card is one flat screen hanging in the room,
centred on the sweet spot (straight ahead, 40° up), photographed through the 180°
fisheye with the dome's 26° tilt. From the seats every line is upright and straight.
A flat screen magnifies towards its edges, so each row's font size is corrected for
its height on the screen: the cap height is true where the row crosses the middle.

    pip install numpy pillow scipy
    python3 type_card.py                 # 2048 and 4096
    python3 type_card.py --res 2048      # just one

Fonts are in ./fonts (SIL Open Font Licence), so the result is the same everywhere.
"""
import argparse
from math import radians, degrees, tan, sin, cos, pi
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import map_coordinates

HERE = Path(__file__).resolve().parent
FONTS = HERE / "fonts"
TILT = radians(26)                       # Wisdome Malmö: tilted 26°, raised at the back
SWEET_EL = 40.0                          # the screen's centre: straight ahead, 40° up
SAMPLE = "Hej Malmö"
LADDER = [8, 6, 4, 3, 2, 1.5, 1, 0.75]   # cap height, degrees
LABEL_CAP = 1.6                          # the labels: just above the minimum
SS = 3                                   # draw 3x finer, filter down = clean anti-aliasing

CLASSES = [(6.0, (255, 126, 77), "titles"),
           (3.0, (90, 240, 140), "comfortable body text"),
           (1.5, (255, 216, 77), "the minimum"),
           (0.0, (255, 95, 95), "too small")]
WHITE, DIM, FRAME, HEAD = (242, 245, 250), (143, 163, 190), (70, 90, 125), (255, 126, 77)


def ppd(res):
    return (res / 2) / 90.0               # equidistant 180°: the radius spans 90°


def F(name, px):
    return ImageFont.truetype(str(FONTS / name), max(1, int(round(px))))


_cap = {}
def cap_ratio(name):
    if name not in _cap:
        l, t, r, b = F(name, 1000).getbbox("H")
        _cap[name] = (b - t) / 1000.0
    return _cap[name]


def cls(cap):
    for lo, col, name in CLASSES:
        if cap >= lo - 1e-9:
            return col


class Screen:
    """A flat screen in the room, facing the audience, centred at (az 0, SWEET_EL).
    Positions: x in screen units (tan of the angle sideways), rows by elevation in degrees."""
    def __init__(self, res, half_w=58.0, el_lo=6.0, el_hi=70.0, ss=SS):
        self.res, self.ss = res, ss
        self.k = ss * ppd(res) * 180 / pi            # image px per screen unit
        self.xmax = tan(radians(half_w))
        self.ytop = tan(radians(el_hi - SWEET_EL))
        self.ybot = tan(radians(el_lo - SWEET_EL))
        W, H = int(2 * self.xmax * self.k), int((self.ytop - self.ybot) * self.k)
        self.im = Image.new("RGB", (W, H), (0, 0, 0))
        self.d = ImageDraw.Draw(self.im)

    def y(self, el):                                  # elevation (at x = 0) -> image row
        return (self.ytop - tan(radians(el - SWEET_EL))) * self.k

    def x(self, u):                                   # screen units -> image column
        return (u + self.xmax) * self.k

    def size_px(self, el, deg):                       # an angle `deg` tall, centred on row `el`
        return self.k * (tan(radians(el + deg / 2 - SWEET_EL)) - tan(radians(el - deg / 2 - SWEET_EL)))

    def text(self, s, font, cap, colour, u, el, align="l"):
        """Capital H `cap` degrees tall, its middle on elevation `el`. Returns width in screen units."""
        cp = self.size_px(el, cap)
        f = F(font, cp / cap_ratio(font))
        base = self.y(el) + cp / 2
        anchor = {"l": "ls", "r": "rs", "m": "ms"}[align]
        self.d.text((self.x(u), base), s, font=f, fill=colour, anchor=anchor)
        l, t, r, b = self.d.textbbox((0, 0), s, font=f, anchor="ls")
        return (r - l) / self.k

    def rect(self, u0, el0, u1, el1, colour, width_px2k=None, fill=None):
        w = 0 if width_px2k is None else max(1, round(self.size_px((el0 + el1) / 2, width_px2k / ppd(2048))))
        self.d.rectangle([self.x(u0), self.y(el1), self.x(u1), self.y(el0)], outline=colour if w else None,
                         width=w, fill=fill)


# ----------------------------------------------------------------------------- projection
def room_to_master(res, X, Y, Z):
    yl = Y * cos(TILT) - Z * sin(TILT)
    zl = Y * sin(TILT) + Z * cos(TILT)
    th = np.arccos(np.clip(zl, -1, 1))
    A = np.arctan2(X, yl)
    r = th / (np.pi / 2) * (res / 2)
    return res / 2 + r * np.sin(A) - 0.5, res / 2 + r * np.cos(A) - 0.5


def project(scr, flat=False):
    res, ss = scr.res, scr.ss
    small = scr.im.resize((scr.im.width // ss, scr.im.height // ss), Image.LANCZOS)
    P = np.asarray(small, np.float32)
    h, w = P.shape[:2]
    k = scr.k / ss                                    # px of `small` per screen unit
    out = np.zeros((res, res, 3), np.float32)
    if flat:   # typed straight into the master: paste 1:1 with the screen centre on the sweet spot
        e = radians(SWEET_EL)
        cx, cy = room_to_master(res, 0.0, cos(e), sin(e))
        cx0, cy0 = int(round(cx - (scr.xmax * k))), int(round(cy - scr.ytop * k))
        x0, y0 = max(0, cx0), max(0, cy0)
        x1, y1 = min(res, cx0 + w), min(res, cy0 + h)
        out[y0:y1, x0:x1] = P[y0 - cy0:y1 - cy0, x0 - cx0:x1 - cx0]
    else:
        e = radians(SWEET_EL)
        f = np.array([0.0, cos(e), sin(e)])          # X right, Y front, Z up
        right = np.array([1.0, 0.0, 0.0])
        up = np.array([0.0, -sin(e), cos(e)])
        c = res / 2
        for y0 in range(0, res, 256):                 # in strips, to keep memory low at 4096
            yy, xx = np.mgrid[y0:min(res, y0 + 256), 0:res].astype(np.float32)
            dx, dy = (xx + 0.5 - c) / c, (yy + 0.5 - c) / c
            r = np.hypot(dx, dy)
            th = r * (np.pi / 2); A = np.arctan2(dx, dy)
            xl, yl, zl = np.sin(th) * np.sin(A), np.sin(th) * np.cos(A), np.cos(th)
            X, Y, Z = xl, yl * cos(TILT) + zl * sin(TILT), -yl * sin(TILT) + zl * cos(TILT)
            qf = X * f[0] + Y * f[1] + Z * f[2]
            ok = (qf > 0.05) & (r <= 1)
            qf = np.where(ok, qf, 1.0)
            u = (X * right[0] + Y * right[1] + Z * right[2]) / qf
            v = (X * up[0] + Y * up[1] + Z * up[2]) / qf
            px = (u + scr.xmax) * k - 0.5
            py = (scr.ytop - v) * k - 0.5
            for ch in range(3):
                s = map_coordinates(P[..., ch], [py, px], order=1, mode="constant", cval=0.0)
                out[y0:y0 + s.shape[0], :, ch] = np.where(ok, s, 0)
    cc = (res - 1) / 2
    yy, xx = np.ogrid[0:res, 0:res]
    out[(xx - cc) ** 2 + (yy - cc) ** 2 > (res / 2) ** 2] = 0
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8))


# ----------------------------------------------------------------------------- the cards
def legend(scr, el=9.0):
    parts = [(col, (f"≥ {lo:g}°  {name}" if lo > 0 else f"< 1.5°  {name}")) for lo, col, name in CLASSES]
    widths = [scr.text(t, "Poppins-Regular.ttf", 1.3, (0, 0, 0), 0, el) for _, t in parts]   # measure
    gap = 0.08
    u = -(sum(widths) + gap * (len(parts) - 1)) / 2
    for (col, t), w in zip(parts, widths):
        scr.text(t, "Poppins-Regular.ttf", 1.3, col, u, el); u += w + gap


def ladder(res):
    s = Screen(res)
    L, LR = -0.30, -0.36                              # samples start / labels end (screen units)
    s.text("EX-09  TYPE SIZE  ·  cap height in degrees  ·  px of a 2K | 4K master",
           "Poppins-Bold.ttf", 1.6, HEAD, 0, 66.0, "m")
    top = 62.0
    for cap in LADDER:
        el = top - cap / 2
        col = cls(cap)
        s.text(SAMPLE, "Poppins-Regular.ttf", cap, WHITE, L, el)
        s.text(f"{cap:g}°   {cap*ppd(2048):.0f} px  |  {cap*ppd(4096):.0f} px",
               "Poppins-Regular.ttf", LABEL_CAP, col, LR, el, "r")
        tick = max(cap, 1.0)
        s.rect(-0.335, el - tick / 2, -0.322, el + tick / 2, None, fill=col)
        top -= max(cap * 1.42, LABEL_CAP * 1.25) + 0.9
    s.rect(-0.86, 16.0, 0.96, 63.6, FRAME, width_px2k=4)       # the rectangle
    legend(s)
    return s


def detail(res):
    s = Screen(res)
    L, LR = -0.30, -0.36
    s.text("EX-09  WHAT BREAKS FIRST  ·  fine detail on a 2K | 4K master",
           "Poppins-Bold.ttf", 1.6, HEAD, 0, 66.0, "m")
    lab = lambda el, t, col=DIM: s.text(t, "Poppins-Regular.ttf", 1.4, col, LR, el, "r")
    weights = [("Thin", "Inter-Thin.otf"), ("Light", "Inter-Light.otf"),
               ("Regular", "Inter-Regular.otf"), ("Bold", "Inter-Bold.otf"), ("Black", "Inter-Black.otf")]
    for el, cap in ((58.5, 3.0), (52.0, 1.5)):
        lab(el, f"weights at {cap:g}°", cls(cap))
        u = L
        for name, fn in weights:
            u += s.text(name, fn, cap, WHITE, u, el) + 0.03 * cap
    for el, cap in ((45.5, 3.0), (40.0, 1.5)):
        lab(el, f"serif vs sans at {cap:g}°", cls(cap))
        u = L + s.text("Hamburgefonts", "LiberationSerif-Regular.ttf", cap, WHITE, L, el) + 0.06
        s.text("Hamburgefonts", "Poppins-Regular.ttf", cap, WHITE, u, el)
    el = 34.5
    lab(el, "thin white on black", (255, 95, 95))
    u = L
    for t, fn, c in (("thin, pure white", "Inter-Thin.otf", (255, 255, 255)),
                     ("regular, soft white", "Inter-Regular.otf", (215, 220, 228)),
                     ("bold, warm", "Inter-Bold.otf", (255, 214, 170))):
        u += s.text(t, fn, 1.5, c, u, el) + 0.06
    el = 27.5
    lab(el, "lines, px of 2K")
    u = L
    for wpx in (1, 2, 3, 4, 6, 8):
        t = max(1, round(s.size_px(el, wpx / ppd(2048))))
        x0, x1 = s.x(u), s.x(u + 0.08)
        yc = s.y(el)
        s.d.rectangle([x0, yc - t // 2, x1, yc - t // 2 + t - 1], fill=WHITE)
        xm = (x0 + x1) / 2
        s.d.rectangle([xm - t // 2, s.y(el + 2.2), xm - t // 2 + t - 1, s.y(el - 2.2)], fill=WHITE)
        s.text(f"{wpx}", "Poppins-Regular.ttf", 1.0, DIM, u + 0.04, el - 3.6, "m")
        u += 0.14
    el = 19.5
    lab(el, "stripes, px of 2K")
    u = L
    for per in (1, 2, 3, 4, 8):
        p = s.size_px(el, per / ppd(2048))
        x, x1 = s.x(u), s.x(u + 0.10)
        while x < x1:
            s.d.rectangle([round(x), s.y(el + 1.8), round(x + p) - 1, s.y(el - 1.8)], fill=WHITE)
            x += 2 * p
        s.text(f"{per}", "Poppins-Regular.ttf", 1.0, DIM, u + 0.05, el - 3.2, "m")
        u += 0.16
    s.rect(-0.86, 13.0, 1.06, 63.6, FRAME, width_px2k=4)
    return s


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--res", type=int, nargs="*", default=[2048, 4096])
    ap.add_argument("-o", "--out", default=str(HERE))
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    for res in a.res:
        for name, fn in (("ladder", ladder), ("detail", detail)):
            p = out / f"ex09_{name}_{res}.png"
            project(fn(res)).save(p, optimize=True); print("wrote", p.name)
    if 2048 in a.res:
        p = out / "ex09_ladder_typed-flat_2048.png"
        project(ladder(2048), flat=True).save(p, optimize=True); print("wrote", p.name)
