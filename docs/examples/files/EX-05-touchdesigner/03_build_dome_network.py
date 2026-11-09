# =====================================================================
# EX-05c  build_dome_network.py  --  run inside TouchDesigner
# =====================================================================
# Builds a small, complete dome network in /project1/dome:
#
#   cam  (Camera COMP, leaning 26 deg like Wisdome)
#   orbs (8 Geo COMPs placed BY ANGLE in the comfortable zone, slowly orbiting)
#   light
#   render  (Render TOP, Fish-Eye (180), 2048 x 2048, square)
#   to160   (Transform TOP: 180 -> 160 deg, what the venue spreads over its screen)
#   guide   (GLSL TOP: 01_domemaster_guide.glsl drawn over the render)
#   out     (Null TOP: what goes to the dome)
#
# How to run it (TouchDesigner 2022 or later, free licence is fine):
#   1. Open TouchDesigner (a new, empty project).
#   2. Dialogs > Textport and DATs  (or Alt+T).
#   3. Paste these two lines (change the folder if yours is elsewhere) and press Enter:
#
#   EX05 = r'C:\Users\dcuar\Documents\00 - chronos\2026\MaU\10 - Wisdome 360 projection\outputs\06-examples\EX-05-touchdesigner'
#   exec(open(EX05 + r'\03_build_dome_network.py', encoding='utf-8').read())
#
#   4. Go into /project1/dome (double-click it). Press "h" to frame the network.
#      Click the blue "display" flag of the "guide" TOP to see the dome master.
#   5. File > Save As... to keep it as a .toe.
#
# The Textport prints what it set. TouchDesigner versions name a few parameters
# differently, so every setting is tried by name and reported if it was not found.
# =====================================================================
import math, os

FOLDER = globals().get('EX05') or os.path.dirname(os.path.abspath(globals().get('__file__', '.')))
TILT = 26.0                     # Wisdome Malmo: raised 26 deg at the back
FOV = 160.0                     # the venue spreads the master over 160 deg
RES = 2048
SWEET_EL = (90 - TILT) - (1 - 40 / 90) * FOV / 2      # ~19.6 deg above eye level

log = []
def say(msg):
    log.append(msg); print('[dome] ' + msg)

def setp(o, names, value):
    """set the first parameter that exists among names"""
    for n in names:
        p = getattr(o.par, n, None)
        if p is not None:
            try:
                p.val = value; return n
            except Exception as e:
                say(f'{o.name}.{n}: could not set {value!r} ({e})')
    say(f'{o.name}: none of {names} found -- set it by hand')
    return None

def set_menu_containing(o, words):
    """find a menu parameter whose items contain one of the words (e.g. 'fish'); set it"""
    for p in o.pars():
        if not p.isMenu: continue
        for name, label in zip(p.menuNames, p.menuLabels):
            if any(w in (name + ' ' + label).lower() for w in words):
                p.val = name
                say(f'{o.name}.{p.name} = {label}')
                return p
    return None

def place(az, el, dist):
    """audience angles -> TouchDesigner xyz (Y up, -Z is the front)"""
    a, e = math.radians(az), math.radians(el)
    return dist * math.cos(e) * math.sin(a), dist * math.sin(e), -dist * math.cos(e) * math.cos(a)

# ---- container -------------------------------------------------------
root = op('/project1')
old = root.op('dome')
if old: old.destroy()
dome = root.create(baseCOMP, 'dome')
dome.nodeX, dome.nodeY = 0, 0
say(f'building in {dome.path}')

# ---- camera: leaning like the dome ----------------------------------
# (TouchDesigner's fisheye lives on the Render TOP, not on the Camera COMP)
cam = dome.create(cameraCOMP, 'cam')
cam.nodeX, cam.nodeY = -600, 300
cam.par.tx, cam.par.ty, cam.par.tz = 0, 0, 0   # the audience's eye: the centre of the dome (TD's default is z = 5)
cam.par.rx = 90 - TILT                     # 64: the master's centre is 64 deg up, in front

# ---- light -----------------------------------------------------------
light = dome.create(lightCOMP, 'light')
light.nodeX, light.nodeY = -600, 150
light.par.tx, light.par.ty, light.par.tz = 0, 8, 4

# ---- eight orbs, placed by angle, orbiting slowly --------------------
#  inside the comfortable zone: +-60 deg either side, from eye level to ~45 deg up
spots = [(-50, 10), (-30, 30), (-12, 12), (0, SWEET_EL), (12, 32), (30, 8), (48, 26), (0, 42)]
colours = [(1, .45, .2), (.3, .7, 1), (1, .8, .3), (1, 1, 1), (.6, .4, 1), (.3, 1, .6), (1, .35, .5), (.4, .9, 1)]
geos = []
for i, ((az, el), col) in enumerate(zip(spots, colours)):
    g = dome.create(geometryCOMP, f'orb{i}')
    g.nodeX, g.nodeY = -300 + (i % 4) * 150, 300 - (i // 4) * 150
    for c in g.children: c.destroy()        # remove the default torus
    s = g.create(sphereSOP, 'sphere')
    r = 0.55 if i != 3 else 0.9             # the one at the sweet spot is the subject
    for n in ('radx', 'rady', 'radz'): setp(s, [n], r)
    s.render = True; s.display = True
    m = dome.create(constantMAT, f'mat{i}')
    m.nodeX, m.nodeY = g.nodeX, g.nodeY - 75
    m.par.colorr, m.par.colorg, m.par.colorb = col
    g.par.material = m.name
    # x, y, z from (azimuth, elevation, distance); the azimuth drifts with time
    g.par.tx.expr = f"10*math.cos(math.radians({el}))*math.sin(math.radians({az} + 6*math.sin(absTime.seconds*0.3 + {i})))"
    g.par.ty.expr = f"10*math.sin(math.radians({el} + 2*math.sin(absTime.seconds*0.5 + {i})))"
    g.par.tz.expr = f"-10*math.cos(math.radians({el}))*math.cos(math.radians({az} + 6*math.sin(absTime.seconds*0.3 + {i})))"
    geos.append(g)
say(f'{len(geos)} orbs placed by angle; orb3 is the subject, at the sweet spot ({SWEET_EL:.1f} deg up)')

# ---- render: square ----------------------------------------------------
render = dome.create(renderTOP, 'render')
render.nodeX, render.nodeY = 400, 300
render.par.camera = cam.name
render.par.geometry = 'orb*'
render.par.lights = light.name
setp(render, ['outputresolution', 'resolution'], 'custom')
setp(render, ['resolutionw'], RES); setp(render, ['resolutionh'], RES)
setp(render, ['bgcolorr'], 0.01); setp(render, ['bgcolorg'], 0.012); setp(render, ['bgcolorb'], 0.03)
if setp(render, ['rendermode'], 'fisheye180') is None and not set_menu_containing(render, ['fish']):
    say('NO FISHEYE FOUND: set the Render TOP > Render Mode to Fish-Eye (180) by hand')

# ---- 180 -> 160: the venue spreads the master over 160 deg ---------------
# TouchDesigner's fisheye is fixed at 180 deg. Scale it up by 180/160 = 1.125 so the
# 160 deg circle fills the square: what the venue projects edge to edge.
to160 = dome.create(transformTOP, 'to160')
to160.nodeX, to160.nodeY = 400, 150
to160.inputConnectors[0].connect(render)
setp(to160, ['sx'], 180.0 / FOV); setp(to160, ['sy'], 180.0 / FOV)
say(f'to160: scaled by {180.0 / FOV:.3f} so the 160 deg circle fills the frame')

# ---- guide overlay -----------------------------------------------------
guide_src = os.path.join(FOLDER, '01_domemaster_guide.glsl')
gdat = dome.create(textDAT, 'guide_glsl')
gdat.nodeX, gdat.nodeY = 550, 450
try:
    gdat.text = open(guide_src, encoding='utf-8').read()
    say(f'guide shader loaded from {guide_src}')
except Exception as e:
    say(f'could not read {guide_src} ({e}): set EX05 to the EX-05 folder and run again')
guide = dome.create(glslTOP, 'guide')
guide.nodeX, guide.nodeY = 550, 300
guide.inputConnectors[0].connect(to160)
setp(guide, ['pixeldat'], gdat.name)
setp(guide, ['outputresolution', 'resolution'], 'custom')
setp(guide, ['resolutionw'], RES); setp(guide, ['resolutionh'], RES)
uniforms = [('uTilt', TILT), ('uGuide', 1.0), ('uFront', 1.0), ('uRotate', 0.0)]
for k, (name, val) in enumerate(uniforms):
    a = setp(guide, [f'uniname{k}', f'vec{k}name'], name)
    b = setp(guide, [f'value{k}x', f'vec{k}valuex'], val)
    if not (a and b): say(f'guide: add uniform {name} = {val} by hand on the Vectors page')

# ---- out: what goes to the dome ---------------------------------------
out = dome.create(nullTOP, 'out')
out.nodeX, out.nodeY = 700, 300
out.inputConnectors[0].connect(guide)
# To the dome: Wisdome takes the picture over HDMI (3840 x 2160, the square master in the
# middle). Add a Window COMP showing 'out', fullscreen on the HDMI display. Sound: an Audio
# Device Out CHOP with 6 channels to Dante. (No NDI: the venue doesn't use it for our pieces.)

guide.viewer = True
out.display = True
say('done. Double-click /project1/dome, press h. Save with File > Save As.')
