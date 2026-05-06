"""
build_bottle_v2.py — Render the bold/Liquid-Death-style premiumwater bottle.

Phase A (test):   blender --background --python tools/build_bottle_v2.py -- --test
Phase B (full):   blender --background --python tools/build_bottle_v2.py

Renders 800x800 PNGs with alpha, then converts each to WebP via cwebp.
Outputs land in project/site-v3/assets/bottle-sequence/_v2/ (or _v2/_test/).
"""

import argparse
import math
import os
import site
import subprocess
import sys
from pathlib import Path

# Pillow lives in user site, not Blender's bundled site-packages.
# Append both common locations so `from PIL import ...` resolves.
_USER_SITE = site.getusersitepackages()
for _p in (_USER_SITE, os.path.expanduser("~/.local/lib/python3.13/site-packages")):
    if _p and _p not in sys.path:
        sys.path.append(_p)

import bpy
import bmesh

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
SITE = REPO_ROOT / "b2b-lead-generation-site-for-a-premium-brand" / "project" / "site-v3"
ARTIFACTS = SCRIPT_DIR / "_artifacts"
LABEL_PATH = ARTIFACTS / "label.png"
PNG_DIR = ARTIFACTS / "png_render"
OUT_DIR = SITE / "assets" / "bottle-sequence" / "_v2"
TEST_DIR = OUT_DIR / "_test"

CWEBP = "/opt/homebrew/bin/cwebp"

for d in (ARTIFACTS, PNG_DIR, OUT_DIR, TEST_DIR):
    d.mkdir(parents=True, exist_ok=True)


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--test", action="store_true", help="Render only frame 0")
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--start", type=int, default=0, help="First frame index (inclusive)")
    p.add_argument("--end", type=int, default=60, help="Last frame index (exclusive)")
    return p.parse_args(argv)


# ─────────────────────────────────────────────────────────────────────────────
# 1. Label texture (Pillow)
# ─────────────────────────────────────────────────────────────────────────────
LABEL_W, LABEL_H = 1600, 2000

def make_label_png():
    from PIL import Image, ImageDraw, ImageFont

    BLACK = (8, 8, 10, 255)
    RED = (220, 40, 40, 255)
    CREAM = (245, 240, 230, 255)

    impact = "/Library/Fonts/Impact.ttf"
    if not Path(impact).exists():
        impact = "/System/Library/Fonts/Supplemental/Impact.ttf"
    arial_bold = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

    img = Image.new("RGBA", (LABEL_W, LABEL_H), BLACK)
    d = ImageDraw.Draw(img)
    inset = 70  # margin used by the design column elements

    f_header = ImageFont.truetype(arial_bold, 22)
    header = "EST 2025  ·  ANDEAN SOURCE  ·  COLOMBIA"
    bbox = d.textbbox((0, 0), header, font=f_header)
    d.text(((LABEL_W - (bbox[2] - bbox[0])) / 2, 470), header, font=f_header, fill=RED)

    # Wordmark sized to occupy the central ~33% of the texture width so that
    # when the texture wraps the full can circumference, the design lands on
    # the front 120° arc and the rest is uniform black wrap.
    f_word = ImageFont.truetype(impact, 130)
    word = "premiumwater"
    bbox = d.textbbox((0, 0), word, font=f_word)
    word_y = 540
    d.text(((LABEL_W - (bbox[2] - bbox[0])) / 2, word_y), word, font=f_word, fill=CREAM)

    rule_y = word_y + 170
    rule_pad = inset + 540  # narrow rule fits within the design column
    d.line([(rule_pad, rule_y), (LABEL_W - rule_pad, rule_y)], fill=RED, width=4)
    cx = LABEL_W // 2
    d.ellipse([cx - 10, rule_y - 10, cx + 10, rule_y + 10], fill=RED)

    f_drink = ImageFont.truetype(arial_bold, 70)
    drink_y = rule_y + 50
    bbox = d.textbbox((0, 0), "DRINK WATER", font=f_drink)
    d.text(((LABEL_W - (bbox[2] - bbox[0])) / 2, drink_y), "DRINK WATER", font=f_drink, fill=CREAM)
    like_y = drink_y + 80
    bbox = d.textbbox((0, 0), "LIKE YOU MEAN IT.", font=f_drink)
    d.text(((LABEL_W - (bbox[2] - bbox[0])) / 2, like_y), "LIKE YOU MEAN IT.", font=f_drink, fill=RED)

    # Footer band — full-width red stripe wraps continuously around the can
    band_h = 70
    band_y = like_y + 130
    d.rectangle([0, band_y, LABEL_W, band_y + band_h], fill=RED)
    f_foot = ImageFont.truetype(arial_bold, 26)
    foot = "750 ML   ·   STILL   ·   ALUMINIUM   ·   NATURAL MINERAL WATER"
    bbox = d.textbbox((0, 0), foot, font=f_foot)
    th = bbox[3] - bbox[1]
    d.text(((LABEL_W - (bbox[2] - bbox[0])) / 2, band_y + (band_h - th) / 2 - 4),
           foot, font=f_foot, fill=CREAM)

    img.save(LABEL_PATH)
    print(f"[label] wrote {LABEL_PATH} ({LABEL_W}x{LABEL_H})")


# ─────────────────────────────────────────────────────────────────────────────
# 2. Tallboy can mesh (Liquid-Death-style 500ml aluminium)
# ─────────────────────────────────────────────────────────────────────────────
SEGMENTS = 64
CAN_R = 0.033            # 66mm diameter
BODY_BOT_H = 0.005
BODY_TOP_H = 0.155
NECK_END_H = 0.162       # slight inward taper at the very top
RIM_OUTER_R = CAN_R * 0.96
TOP_RECESS_R = CAN_R * 0.86
RIM_H = 0.165
TOP_H = 0.170


def bottle_profile():
    """Tallboy can profile in (radius_m, height_m), bottom up.
    Returns (profile points, label-wrap ring-pair indices)."""
    profile = []
    profile.append((0.0, 0.0))                                  # 0: bottom center
    profile.append((CAN_R * 0.85, 0.0))                          # 1: bottom inner
    profile.append((CAN_R, BODY_BOT_H))                          # 2: bottom rim → body start
    body_start = 2

    n_body = 16
    for i in range(1, n_body + 1):
        t = i / n_body
        profile.append((CAN_R, BODY_BOT_H + t * (BODY_TOP_H - BODY_BOT_H)))
    body_end = len(profile) - 1                                  # last body ring (top of cylinder)

    # Top inward neck taper
    n_neck = 4
    for i in range(1, n_neck + 1):
        t = i / n_neck
        r = CAN_R - (CAN_R - RIM_OUTER_R) * t
        profile.append((r, BODY_TOP_H + t * (NECK_END_H - BODY_TOP_H)))

    # Rolled rim → flat recessed top
    profile.append((RIM_OUTER_R, RIM_H))
    profile.append((TOP_RECESS_R, RIM_H + 0.0015))               # step inward to recess
    profile.append((TOP_RECESS_R * 0.5, TOP_H - 0.001))
    profile.append((0.0, TOP_H))                                  # top center

    body_pairs = set(range(body_start, body_end))                 # cylinder ring-pairs
    return profile, body_pairs


def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def build_bottle():
    profile, body_pairs = bottle_profile()
    mesh = bpy.data.meshes.new("BottleMesh")
    obj = bpy.data.objects.new("Bottle", mesh)
    bpy.context.collection.objects.link(obj)

    bm = bmesh.new()
    rings = []
    for r, h in profile:
        if r == 0.0:
            rings.append([bm.verts.new((0, 0, h))])
        else:
            ring = []
            for i in range(SEGMENTS):
                a = (i / SEGMENTS) * 2 * math.pi
                ring.append(bm.verts.new((r * math.cos(a), r * math.sin(a), h)))
            rings.append(ring)
    bm.verts.ensure_lookup_table()

    faces_meta = []  # list of (bmface, is_body_pair_index)
    for ri in range(len(rings) - 1):
        r0, r1 = rings[ri], rings[ri + 1]
        is_body = ri in body_pairs
        if len(r0) == 1:
            for i in range(SEGMENTS):
                f = bm.faces.new([r0[0], r1[i], r1[(i + 1) % SEGMENTS]])
                faces_meta.append((f, is_body))
        elif len(r1) == 1:
            for i in range(SEGMENTS):
                f = bm.faces.new([r0[i], r0[(i + 1) % SEGMENTS], r1[0]])
                faces_meta.append((f, is_body))
        else:
            for i in range(SEGMENTS):
                f = bm.faces.new([r0[i], r0[(i + 1) % SEGMENTS],
                                  r1[(i + 1) % SEGMENTS], r1[i]])
                faces_meta.append((f, is_body))
    bm.faces.ensure_lookup_table()
    bm.normal_update()

    # Two-slot material plan:
    #   slot 0 = aluminium (cap, rim, neck taper, bottom)
    #   slot 1 = label (entire body cylinder, full 360° wrap)
    # Design content sits in the central horizontal band of the texture, the
    # rest of the texture is uniform black — wrapping the can like a real
    # printed LD wrap. No material boundaries to confuse rotating views.
    label_idx = {f.index for f, is_body in faces_meta if is_body}

    # Cylindrical UV with seam handling — front (-Y) maps to U=0.5 so the
    # design panel lands camera-facing at frame 0.
    uv_layer = bm.loops.layers.uv.new("UVMap")
    body_lo, body_hi = BODY_BOT_H, BODY_TOP_H

    def angle_to_u(a):
        return ((a - math.pi / 2) % (2 * math.pi)) / (2 * math.pi)

    for f, is_body in faces_meta:
        if f.index not in label_idx:
            for loop in f.loops:
                loop[uv_layer].uv = (0.0, 0.0)
            continue
        fc = f.calc_center_median()
        face_u = angle_to_u(math.atan2(fc.y, fc.x))
        for loop in f.loops:
            v = loop.vert
            u = angle_to_u(math.atan2(v.co.y, v.co.x))
            if u - face_u > 0.5:
                u -= 1.0
            elif u - face_u < -0.5:
                u += 1.0
            v_uv = max(0.0, min(1.0, (v.co.z - body_lo) / (body_hi - body_lo)))
            loop[uv_layer].uv = (u, v_uv)

    bm.to_mesh(mesh)
    bm.free()
    for poly in mesh.polygons:
        poly.use_smooth = True
    return obj, label_idx


# ─────────────────────────────────────────────────────────────────────────────
# 3. Materials
# ─────────────────────────────────────────────────────────────────────────────
def make_body_material():
    """Polished aluminium — bright enough to read against the matte-black wrap
    even after the strong negative exposure that crushes the body to true black."""
    mat = bpy.data.materials.new("Aluminium")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Base Color"].default_value = (0.97, 0.97, 0.99, 1.0)
    bsdf.inputs["Metallic"].default_value = 1.0
    bsdf.inputs["Roughness"].default_value = 0.18
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


def make_label_material():
    """Pure emission — printed matte wrap on a real LD can has no specular,
    and emission keeps the design colors fixed regardless of which side faces
    the lights as the can rotates."""
    mat = bpy.data.materials.new("Label")
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    img = bpy.data.images.load(str(LABEL_PATH))
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img
    tex.interpolation = "Cubic"

    emit = nt.nodes.new("ShaderNodeEmission")
    emit.inputs["Strength"].default_value = 4.5

    nt.links.new(tex.outputs["Color"], emit.inputs["Color"])
    nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])

    out.location = (400, 0); emit.location = (200, 0); tex.location = (-100, 0)
    return mat


def assign_materials(obj, label_faces):
    obj.data.materials.append(make_body_material())   # 0 — aluminium (cap/rim)
    obj.data.materials.append(make_label_material())  # 1 — full-wrap label
    for poly in obj.data.polygons:
        poly.material_index = 1 if poly.index in label_faces else 0


# ─────────────────────────────────────────────────────────────────────────────
# 4. Lights, camera, world
# ─────────────────────────────────────────────────────────────────────────────
def make_lights():
    bpy.ops.object.light_add(type='AREA', location=(-0.32, -0.38, 0.22))
    key = bpy.context.object
    key.data.energy = 140
    key.data.size = 0.5
    key.data.color = (1.0, 0.98, 0.95)
    key.rotation_euler = (math.radians(78), math.radians(-12), math.radians(-40))

    bpy.ops.object.light_add(type='AREA', location=(0.40, -0.22, 0.18))
    fill = bpy.context.object
    fill.data.energy = 70
    fill.data.size = 0.45
    fill.data.color = (0.95, 0.96, 1.0)
    fill.rotation_euler = (math.radians(82), 0, math.radians(60))

    # Rim lights placed slightly FRONT of the can (still camera-side) so they
    # define the can's edges without illuminating the back face when the can
    # rotates 180°. Lower energy than world-rim setup.
    bpy.ops.object.light_add(type='AREA', location=(-0.50, -0.05, 0.18))
    rim_l = bpy.context.object
    rim_l.data.energy = 35
    rim_l.data.size = 0.25
    rim_l.rotation_euler = (math.radians(90), 0, math.radians(-95))

    bpy.ops.object.light_add(type='AREA', location=(0.50, -0.05, 0.18))
    rim_r = bpy.context.object
    rim_r.data.energy = 35
    rim_r.data.size = 0.25
    rim_r.rotation_euler = (math.radians(90), 0, math.radians(95))

    # Overhead softbox — picks up the aluminium cap top
    bpy.ops.object.light_add(type='AREA', location=(0.0, -0.10, 0.55))
    top = bpy.context.object
    top.data.energy = 220
    top.data.size = 0.45
    top.rotation_euler = (math.radians(20), 0, 0)

    return [key, fill, rim_l, rim_r, top]


def make_camera():
    # Tallboy framed: camera at can mid-height, slight downward tilt, distance
    # tuned so the can fills ~65% of frame vertically with even padding.
    bpy.ops.object.camera_add(location=(0.0, -0.55, 0.105))
    cam = bpy.context.object
    cam.data.lens = 75
    cam.data.sensor_width = 36
    cam.rotation_euler = (math.radians(83), 0, 0)
    bpy.context.scene.camera = cam
    return cam


def setup_world():
    world = bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0, 0, 0, 1)
    bg.inputs["Strength"].default_value = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# 5. Render setup
# ─────────────────────────────────────────────────────────────────────────────
def setup_render(samples):
    scn = bpy.context.scene
    scn.render.engine = 'CYCLES'
    scn.cycles.samples = samples
    scn.cycles.use_denoising = True
    scn.render.film_transparent = True
    # film_transparent_glass not needed — body is opaque aluminum
    scn.render.resolution_x = 800
    scn.render.resolution_y = 800
    scn.render.resolution_percentage = 100
    scn.render.image_settings.file_format = 'PNG'
    scn.render.image_settings.color_mode = 'RGBA'
    scn.render.image_settings.color_depth = '8'
    scn.view_settings.view_transform = 'Filmic'
    scn.view_settings.look = 'High Contrast'
    scn.view_settings.exposure = -1.4  # crush blacks to true black

    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scn.cycles.device = 'GPU'
        print("[render] using Metal GPU")
    except Exception as e:
        print(f"[render] GPU unavailable, CPU fallback: {e}")
        scn.cycles.device = 'CPU'


def make_rotator(bottle, lights):
    """Only the bottle is parented — lights stay world-fixed in the camera
    reference frame. With a full-wrap label, this gives consistent front-face
    illumination across all rotations: the camera-facing surface is always
    lit the same, and the visible content (design vs black bg) just changes
    as the texture rotates past."""
    bpy.ops.object.empty_add(type='PLAIN_AXES', location=(0, 0, 0))
    rot = bpy.context.object
    rot.name = "BottleRotator"
    bottle.parent = rot
    return rot


# ─────────────────────────────────────────────────────────────────────────────
# 6. Render loop
# ─────────────────────────────────────────────────────────────────────────────
def render_frames(rotator, frames, out_dir, name_fn):
    scn = bpy.context.scene
    for f in frames:
        rotator.rotation_euler = (0, 0, (f / 60.0) * 2 * math.pi)
        png_path = PNG_DIR / f"frame_{f:03d}.png"
        scn.render.filepath = str(png_path)
        bpy.ops.render.render(write_still=True)
        webp_path = out_dir / name_fn(f)
        subprocess.run(
            [CWEBP, "-quiet", "-q", "85", "-alpha_q", "100",
             str(png_path), "-o", str(webp_path)],
            check=True,
        )
        print(f"[frame {f:02d}] {webp_path}")


def main():
    args = parse_args()
    print("[1/6] label PNG ...");      make_label_png()
    print("[2/6] reset scene ...");    clear_scene()
    print("[3/6] bottle mesh ...")
    bottle, label_faces = build_bottle()
    print(f"        label_faces={len(label_faces)}")
    print("[4/6] materials/lights/camera/world ...")
    assign_materials(bottle, label_faces)
    lights = make_lights()
    make_camera(); setup_world()
    print("[5/6] render settings ..."); setup_render(samples=args.samples)
    rotator = make_rotator(bottle, lights)
    print("[6/6] render ...")
    if args.test:
        render_frames(rotator, [0], TEST_DIR, lambda f: f"frame_{f:03d}.webp")
        out = TEST_DIR / "frame_000.webp"
        print(f"\nTEST OK: {out} ({out.stat().st_size} bytes)")
    else:
        frames = list(range(args.start, args.end))
        render_frames(rotator, frames, OUT_DIR,
                      lambda f: f"bottle_{f:03d}.webp")
        print(f"\nFULL OK: rendered frames {args.start}..{args.end - 1} → {OUT_DIR}")


if __name__ == "__main__":
    main()
