"""
EX-01  "DRIFT"  --  a pre-rendered dome master built in Blender / Cycles.
=====================================================================
Run it either way:

    blender --background --python drift.py          # normal Blender
    python3 drift.py                                # pip-installed `bpy` module

WHAT THIS EXAMPLE DEMONSTRATES
  1. The ONLY camera setting that matters for a dome:
        camera.data.type          = 'PANO'
        camera.data.panorama_type = 'FISHEYE_EQUIDISTANT'
        camera.data.fisheye_fov   = radians(180)
     Everything else is ordinary Blender.
  2. Square output. 2048 x 2048 for delivery, 1024 for iterating.
  3. Composition by ANGLE, not by eyeballing it -- see place_at(). The subject
     (the drifting orbs) lives in the COMFORTABLE ZONE: in front of the
     audience, 15-60 deg above eye level, within 60 deg of the front, around
     the sweet spot at 40 deg up. The shards ring the room as ambience.
  3b. The camera is tilted like the venue: Wisdome Malmo is tilted 26 deg,
     raised at the back, so the dome's zenith is 64 deg up in front of the
     audience. Leaning the camera the same way keeps the world level.
  4. Motion that will not make an audience ill: slow yaw only, zero roll.
  5. Low average picture level: a dark field with bright elements, so the dome
     does not wash itself out by cross-reflection.

CHANGE THESE FIRST
  RES, FRAMES, SAMPLES below. Start at RES=1024 / SAMPLES=24 while you design.
"""
import bpy, math, random
from math import radians, sin, cos, tau

# ----------------------------------------------------------------- settings
RES      = 1024      # 2048 for delivery
FRAMES   = 1200    # 1200 @ 30fps = 40 s
SAMPLES  = 16
OUT      = "/tmp/drift/frame_"
SEED     = 7

random.seed(SEED)
sc = bpy.context.scene

# ------------------------------------------------------------- clean slate
for c in (bpy.data.objects, bpy.data.meshes, bpy.data.materials,
          bpy.data.cameras, bpy.data.lights):
    for x in list(c):
        c.remove(x)

# -------------------------------------------------------------- the camera
# This block is the whole trick. Copy it into any Blender project.
cam_data = bpy.data.cameras.new("DomeCam")
cam_data.type          = 'PANO'
cam_data.panorama_type = 'FISHEYE_EQUIDISTANT'
cam_data.fisheye_fov   = radians(180)          # a full hemisphere, nothing less
cam = bpy.data.objects.new("DomeCam", cam_data)
sc.collection.objects.link(cam)
sc.camera = cam
# Camera sits at seated eye height, looking UP -- leaning towards the front
# exactly as much as the dome does.
#
# Blender's camera looks down its own -Z. Rotating 180 deg about X swings that
# to world +Z, straight up. Get this wrong (90 deg is the classic slip) and you
# render the horizon instead, which looks fine on a monitor and is completely
# wrong on a dome.
#
# Wisdome Malmo is tilted 26 deg, raised at the back: the dome's zenith is
# 64 deg up, in front of the audience. So rotate 180 - 26 = 154 deg, and the
# camera's zenith leans the same way. Then elevation in this scene is the
# elevation the audience sees from their seats.
#
# That rotation puts world +Y at the BOTTOM of the rendered image, so
# +Y is the FRONT of the room. Confirm your venue's convention before delivery.
TILT = 26.0
cam.location       = (0.0, 0.0, 1.6)
cam.rotation_euler = (radians(180 - TILT), 0.0, 0.0)

# ------------------------------------------------------------ helper: angle
def place_at(obj, elevation_deg, azimuth_deg, distance):
    """Put an object at a given ELEVATION and AZIMUTH as seen from the camera.

    elevation 0 deg  = eye level
    elevation 90 deg = straight up (with the tilted camera, this is NOT the
                       centre of the dome master: the centre is 64 deg up,
                       in front)
    azimuth   0 deg  = the FRONT of the room, +ve turns to the right

    Comfortable zone: -60 <= azimuth <= 60 and 15 <= elevation <= 60.
    Sweet spot: azimuth 0, elevation 40.

    Composing by angle instead of by position is the single habit that
    separates dome work that reads from dome work that does not.
    """
    e, a = radians(elevation_deg), radians(azimuth_deg)
    obj.location = (distance * cos(e) * sin(a),
                    distance * cos(e) * cos(a),
                    1.6 + distance * sin(e))

def emission(name, colour, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    em  = nt.nodes.new("ShaderNodeEmission")
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    em.inputs[0].default_value = (*colour, 1.0)
    em.inputs[1].default_value = strength
    nt.links.new(em.outputs[0], out.inputs[0])
    return m

def glossy_dark(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (0.012, 0.016, 0.028, 1)
    b.inputs["Roughness"].default_value  = 0.18
    b.inputs["Metallic"].default_value   = 0.55
    return m

# -------------------------------------------------------------- the world
world = bpy.data.worlds.new("W")
sc.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.004, 0.006, 0.012, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

# NO FLOOR.
# A dome camera sees one hemisphere. Tilted like the venue, it reaches only
# about 16 deg below eye level at the front (the projected edge) and starts
# about 36 deg up at the back, so floors, reflections in floors, the ground
# your shards stand on are almost never projected -- and where they are, at
# the front, they sit behind the seat backs. They only cost render time.
#
# This is worth internalising: half of a normal 3-D scene is invisible on a
# dome. Build the half that shows.

# ------------------------------------------------- the ring of light shards
# Ambience, all the way round the room. Colour drifts from cold at the back to
# warm at the front. (Behind the audience the picture only starts about 36 deg
# up, so there you see just the tops of the tallest shards.)
COLD = (0.05, 0.16, 0.95)
WARM = (1.00, 0.24, 0.03)
N = 42
for i in range(N):
    az   = 360.0 * i / N + random.uniform(-5, 5)
    dist = random.uniform(14, 44)
    # Height is chosen so the TOP of each shard lands between about 25 and 65
    # degrees of elevation -- pick the angle, solve for the height.
    top_elev = random.uniform(25, 65)
    h    = 1.6 + dist * math.tan(radians(top_elev))
    w    = random.uniform(0.30, 0.95)
    bpy.ops.mesh.primitive_cube_add(size=1)
    s = bpy.context.object
    s.scale = (w, w, h / 2.0)
    # front-ness: 1 at the front of the room, 0 at the back
    f = (cos(radians(az)) + 1.0) / 2.0
    col = tuple(COLD[k] + (WARM[k] - COLD[k]) * f for k in range(3))
    s.data.materials.append(emission(f"Shard{i}", col, random.uniform(0.7, 1.9)))
    place_at(s, 0.0, az, dist)
    s.location.z = h / 2.0
    s.rotation_euler = (0, 0, radians(az))

# ------------------------------------------------------- faint point field
# Texture, not content. It gives the upper dome depth so the zenith is not a
# dead black hole, while keeping the average picture level very low.
dust_mat = emission("Dust", (0.55, 0.70, 1.0), 1.4)
for i in range(150):
    bpy.ops.mesh.primitive_ico_sphere_add(radius=random.uniform(0.05, 0.16), subdivisions=1)
    p = bpy.context.object
    p.data.materials.append(dust_mat)
    place_at(p, random.uniform(12, 88), random.uniform(0, 360), random.uniform(26, 60))

# -------------------------------------------------- drifting light spheres
# The SUBJECT: what the eye follows. They live in the comfortable zone in
# front of the audience (15-60 deg up, within 60 deg of the front), drifting
# around the 40 deg sweet spot.
orbs = []
for i in range(9):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=random.uniform(0.5, 1.5), segments=24, ring_count=12)
    o = bpy.context.object
    bpy.ops.object.shade_smooth()
    warm = random.random() < 0.45
    col  = (1.0, 0.36, 0.08) if warm else (0.16, 0.55, 1.0)
    o.data.materials.append(emission(f"Orb{i}", col, random.uniform(2.5, 5.5)))
    orbs.append({
        "obj": o,
        "elev": random.uniform(22, 54),          # inside the comfortable zone
        "az0":  random.uniform(-30, 30),         # in front of the audience
        "speed": random.uniform(-26, 26),        # degrees across the whole shot: stays roughly in front
        "dist": random.uniform(13, 26),
        "bob":  random.uniform(1.0, 3.0),
        "ph":   random.uniform(0, tau),
    })

# --------------------------------------------------------------- animation
# Yaw only. No roll, ever. Roll in a dome is the fastest route to nausea.
# MOTION
#
# Over forty seconds a straight dolly is a problem: it either barely moves, or
# it travels far enough to push out through the far side of your scene and the
# composition falls apart at the end. So the camera walks a slow CLOSED LOOP --
# out, around, and back to where it started. The parallax changes continuously,
# the framing stays balanced, and the piece has somewhere to end.
#
# Translation is also much kinder than rotation. A yaw turns the whole room
# around the audience and is the quickest way to make somebody ill, so it is
# kept small; roll is never used at all.
TOTAL_YAW  = 14.0     # degrees of yaw across the whole shot
LOOP_X     = 5.5      # metres, half-width of the camera's loop
LOOP_Y     = 4.0      # metres, half-depth of the loop (+Y = towards the front)
BOB_Z      = 0.55     # metres of vertical drift
for fr in range(1, FRAMES + 1):
    t = (fr - 1) / max(1, FRAMES - 1)                   # 0 -> 1
    # ease in and out so nothing starts or stops abruptly
    te = t * t * (3 - 2 * t)

    cam.rotation_euler = (radians(180 - TILT), 0.0, radians(TOTAL_YAW * sin(t * tau)))
    cam.location.x     = LOOP_X * sin(t * tau)               # out and back
    cam.location.y     = LOOP_Y * (1.0 - cos(t * tau))       # forward and back
    cam.location.z     = 1.6 + BOB_Z * sin(t * tau * 2.0)
    cam.keyframe_insert("rotation_euler", frame=fr)
    cam.keyframe_insert("location", frame=fr)

    for o in orbs:
        place_at(o["obj"],
                 o["elev"] + o["bob"] * sin(t * tau + o["ph"]),
                 o["az0"] + o["speed"] * te,
                 o["dist"])
        o["obj"].keyframe_insert("location", frame=fr)

def _fcurves(action):
    """Blender 4.x exposes action.fcurves; Blender 5 moved them into slots."""
    if hasattr(action, "fcurves"):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, "layers", []):
        for strip in getattr(layer, "strips", []):
            for bag in getattr(strip, "channelbags", []):
                out.extend(bag.fcurves)
    return out

for ob in [cam] + [o["obj"] for o in orbs]:
    if ob.animation_data and ob.animation_data.action:
        for fc in _fcurves(ob.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'

# ----------------------------------------------------------------- render
sc.render.engine                = 'CYCLES'
sc.cycles.device                = 'CPU'
sc.cycles.samples               = SAMPLES
# DENOISING IS OFF ON PURPOSE.
# Almost every surface here is an emission shader seen directly, so there is
# barely any noise to remove -- the only sampling work is anti-aliasing the
# edges, and 16 samples covers that. On this machine the OIDN denoise pass
# cost about 7 seconds a frame while the render itself cost 3. Turning it off
# made a 40-second piece go from four hours to one.
#
# Turn it back on the moment you add real lights, glass, volumetrics or
# depth of field, because then you WILL have noise and you will need it.
sc.cycles.use_denoising         = False
sc.cycles.max_bounces           = 2
sc.cycles.transparent_max_bounces = 1
sc.cycles.transmission_bounces  = 0
sc.render.resolution_x          = RES
sc.render.resolution_y          = RES        # SQUARE. Always.
sc.render.resolution_percentage = 100
sc.render.fps                   = 30
sc.render.image_settings.file_format = 'PNG'
sc.render.image_settings.color_mode  = 'RGB'
sc.render.filepath              = OUT
sc.frame_start, sc.frame_end    = 1, FRAMES
sc.view_settings.view_transform = 'AgX'
sc.view_settings.look           = 'AgX - Punchy'

if __name__ == "__main__":
    import sys
    if "--no-render" not in sys.argv:
        bpy.ops.render.render(animation=True)
        print("rendered", FRAMES, "frames to", OUT)
