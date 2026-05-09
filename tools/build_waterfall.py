"""
build_waterfall.py — Render the calm-mode trade→impact "water-text" hero.

Two-line headline ("ONE LITER IN,\\nONE LITER FORWARD.") rendered as
extruded 3D text with a glassy cream-water material, with a single
drop falling from above and splashing into a thin pool below the text.

The text IS the water — the splash is a flourish that lands at frame 60
(=2s, =33% of duration), syncing with the HTML mask reveal in app.js.

Usage:
  blender --background --python tools/build_waterfall.py -- --test --diagnostic
    Pure white emissive material — verify text geometry is in frame.
  blender --background --python tools/build_waterfall.py -- --test
    Render frame 60 only with real material (~30-60s).
  blender --background --python tools/build_waterfall.py
    Full render (180 frames, ~30-90 min depending on samples & caustics).

Encode output PNGs to MP4:
  ffmpeg -framerate 30 -i tools/_artifacts/waterfall_render/####.png \\
    -c:v libx264 -profile:v main -pix_fmt yuv420p \\
    -movflags +faststart -g 15 -an \\
    b2b-lead-generation-site-for-a-premium-brand/project/site-v3/assets/water-trails.mp4
"""

import argparse
import math
import os
import site
import subprocess
import sys
from pathlib import Path

_USER_SITE = site.getusersitepackages()
for _p in (_USER_SITE, os.path.expanduser("~/.local/lib/python3.13/site-packages")):
    if _p and _p not in sys.path:
        sys.path.append(_p)

import bpy

SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
ARTIFACTS = SCRIPT_DIR / "_artifacts"
RENDER_DIR = ARTIFACTS / "waterfall_render"
CACHE_DIR = ARTIFACTS / "waterfall_cache"

for d in (ARTIFACTS, RENDER_DIR, CACHE_DIR):
    d.mkdir(parents=True, exist_ok=True)

# Built-in macOS font for the headline text.
FONT_PATH = "/System/Library/Fonts/HelveticaNeue.ttc"


# ─────────────────────────────────────────────────────────────────────────────
# Args
# ─────────────────────────────────────────────────────────────────────────────
def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--test", action="store_true", help="Render only one frame near the splash")
    p.add_argument("--bake-only", action="store_true", help="Bake fluid sim, skip render")
    p.add_argument("--diagnostic", action="store_true", help="Pure white emissive material — confirm geometry is in frame")
    p.add_argument("--samples", type=int, default=64, help="Cycles samples per frame")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--res", type=int, default=96, help="Fluid domain resolution (higher = slower bake)")
    return p.parse_args(argv)


# ─────────────────────────────────────────────────────────────────────────────
# Frame range / timing
# ─────────────────────────────────────────────────────────────────────────────
FPS = 30
DURATION_SEC = 6
TOTAL_FRAMES = FPS * DURATION_SEC          # 180 frames
SPLASH_FRAME = int(TOTAL_FRAMES * 0.33)    # ~frame 60 — splash impact moment

# Scene units. Domain large enough for splash spread above the text.
DOMAIN_W = 12.0
DOMAIN_D = 6.0
DOMAIN_H = 7.0

SPLASH_Z = 1.2       # invisible obstacle plane — drop bounces off here, ABOVE text
DROP_SPAWN_Z = 2.8   # drop spawns at top of frame
GRAVITY_Z = -0.8     # tuned so 1.6 units of free fall takes 2 sec → frame 60
CAMERA_Z = -0.2      # camera at center of text composition

TEXT_LINE_1 = "One liter in,"
TEXT_LINE_2 = "one liter forward."


# ─────────────────────────────────────────────────────────────────────────────
# Scene reset
# ─────────────────────────────────────────────────────────────────────────────
def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    for collection in list(bpy.data.collections):
        bpy.data.collections.remove(collection)
    for material in list(bpy.data.materials):
        bpy.data.materials.remove(material)


# ─────────────────────────────────────────────────────────────────────────────
# Materials
# ─────────────────────────────────────────────────────────────────────────────
def make_water_glass(diagnostic=False, gold=False):
    """Glass-like cream water for both text + splash. With caustics enabled
    in Cycles, refraction produces the cinematic 'liquid letterforms' look
    seen in the reference 'Splash' image.

    gold=True: warmer accent tint for the second line ('forward.')."""
    name = "WaterGold" if gold else "Water"
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)

    if diagnostic:
        emit = nt.nodes.new("ShaderNodeEmission")
        emit.inputs["Color"].default_value = (1, 1, 1, 1)
        emit.inputs["Strength"].default_value = 4.0
        nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
        return mat

    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    if gold:
        # Warmer cream-gold for the italic-gold "forward" accent line.
        # Saturated enough that the tint reads even through the glass.
        bsdf.inputs["Base Color"].default_value = (0.94, 0.78, 0.42, 1.0)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.94, 0.78, 0.42, 1.0)
    else:
        bsdf.inputs["Base Color"].default_value = (0.96, 0.93, 0.86, 1.0)
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (0.96, 0.93, 0.86, 1.0)
    bsdf.inputs["Roughness"].default_value = 0.04
    bsdf.inputs["IOR"].default_value = 1.33
    bsdf.inputs["Transmission Weight"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.5
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.25

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


# ─────────────────────────────────────────────────────────────────────────────
# 3D text object
# ─────────────────────────────────────────────────────────────────────────────
def make_text(text, location, size, name, font_path=FONT_PATH):
    """Create extruded 3D text with bevel for a soft 'water glass' edge."""
    bpy.ops.object.text_add(location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.body = text
    obj.data.size = size
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.extrude = 0.025          # subtle 3D depth — visible without blobbing
    obj.data.bevel_depth = 0.004      # whisper of rounding so glass reads
    obj.data.bevel_resolution = 3

    # Load the font if not already loaded
    if font_path and Path(font_path).exists():
        try:
            font = bpy.data.fonts.load(font_path, check_existing=True)
            obj.data.font = font
        except Exception as e:
            print(f"[waterfall] font load failed ({font_path}): {e}; using default")
    return obj


# ─────────────────────────────────────────────────────────────────────────────
# Build scene
# ─────────────────────────────────────────────────────────────────────────────
def build_scene(args):
    clear_scene()

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    if hasattr(scene.cycles, "device"):
        scene.cycles.device = "GPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    # Caustics on so the water-text refracts light onto its surroundings
    if hasattr(scene.cycles, "caustics_reflective"):
        scene.cycles.caustics_reflective = True
    if hasattr(scene.cycles, "caustics_refractive"):
        scene.cycles.caustics_refractive = True
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES
    scene.render.fps = FPS
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False  # solid bg

    # World background = #0E0C08 (calm bg color)
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        bg.inputs["Color"].default_value = (0.0029, 0.0023, 0.0017, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # ─── Materials ──────────────────────────────────────────────────────
    diagnostic = getattr(args, "diagnostic", False)
    cream_mat = make_water_glass(diagnostic=diagnostic, gold=False)
    gold_mat = make_water_glass(diagnostic=diagnostic, gold=True)

    # ─── 3D headline text (two lines, stacked vertically) ───────────────
    # Line 1: "One liter in," in cream
    text1 = make_text(TEXT_LINE_1, location=(0, 0, 0.45), size=0.95, name="HeadLine1")
    text1.data.materials.append(cream_mat)
    # Line 2: "one liter forward." in gold accent
    text2 = make_text(TEXT_LINE_2, location=(0, 0, -0.65), size=0.95, name="HeadLine2")
    text2.data.materials.append(gold_mat)

    # ─── Fluid domain ───────────────────────────────────────────────────
    bpy.ops.mesh.primitive_cube_add(size=1)
    domain = bpy.context.active_object
    domain.name = "Domain"
    domain.scale = (DOMAIN_W / 2, DOMAIN_D / 2, DOMAIN_H / 2)
    domain.location = (0, 0, 1.5)  # raised so text sits below splash
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    bpy.ops.object.modifier_add(type="FLUID")
    fluid = domain.modifiers["Fluid"]
    fluid.fluid_type = "DOMAIN"
    fluid.domain_settings.domain_type = "LIQUID"
    fluid.domain_settings.resolution_max = args.res
    fluid.domain_settings.use_mesh = True
    fluid.domain_settings.mesh_scale = 2
    fluid.domain_settings.particle_radius = 1.5
    fluid.domain_settings.simulation_method = "FLIP"
    fluid.domain_settings.cache_directory = str(CACHE_DIR)
    fluid.domain_settings.cache_type = "ALL"
    fluid.domain_settings.cache_frame_start = 1
    fluid.domain_settings.cache_frame_end = TOTAL_FRAMES
    if hasattr(fluid.domain_settings, "gravity"):
        fluid.domain_settings.gravity = (0, 0, GRAVITY_Z)

    # The fluid mesh on the domain inherits whatever material is applied
    domain.data.materials.append(cream_mat)

    # ─── Splash plate: invisible obstacle the drop bounces off ─────────
    # Thin disc at SPLASH_Z. Acts as a hard surface so the drop splashes
    # outward when it lands. Hidden from render so we only see the water,
    # not the plate. This replaces the previous pre-existing pool which
    # was too large and covered the text below.
    bpy.ops.mesh.primitive_cylinder_add(
        radius=1.0, depth=0.05, location=(0, 0, SPLASH_Z)
    )
    plate = bpy.context.active_object
    plate.name = "SplashPlate"
    bpy.ops.object.modifier_add(type="FLUID")
    plate.modifiers["Fluid"].fluid_type = "EFFECTOR"
    plate.modifiers["Fluid"].effector_settings.effector_type = "COLLISION"
    plate.hide_render = True
    plate.hide_viewport = False  # still participate in sim

    # ─── Drop ───────────────────────────────────────────────────────────
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0, 0, DROP_SPAWN_Z))
    drop = bpy.context.active_object
    drop.name = "Drop"
    bpy.ops.object.modifier_add(type="FLUID")
    drop.modifiers["Fluid"].fluid_type = "FLOW"
    drop.modifiers["Fluid"].flow_settings.flow_type = "LIQUID"
    drop.modifiers["Fluid"].flow_settings.flow_behavior = "GEOMETRY"
    drop.modifiers["Fluid"].flow_settings.velocity_coord = (0, 0, 0)
    drop.hide_render = True

    # ─── Camera ─────────────────────────────────────────────────────────
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "PERSP"
    cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, -7.0, CAMERA_Z)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    # ─── Lighting ───────────────────────────────────────────────────────
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 5.0
    sun.color = (1.0, 0.96, 0.88)
    sun_obj = bpy.data.objects.new("Sun", sun)
    sun_obj.location = (0, -3, 6)
    sun_obj.rotation_euler = (math.radians(60), 0, math.radians(-20))
    bpy.context.collection.objects.link(sun_obj)

    rim = bpy.data.lights.new("Rim", "AREA")
    rim.size = 5.0
    rim.energy = 1500.0
    rim.color = (0.95, 0.82, 0.58)
    rim_obj = bpy.data.objects.new("Rim", rim)
    rim_obj.location = (4, 4, 1)
    rim_obj.rotation_euler = (math.radians(110), 0, math.radians(45))
    bpy.context.collection.objects.link(rim_obj)

    fill = bpy.data.lights.new("Fill", "AREA")
    fill.size = 6.0
    fill.energy = 1000.0
    fill.color = (0.96, 0.93, 0.86)
    fill_obj = bpy.data.objects.new("Fill", fill)
    fill_obj.location = (-3, -3, 4)
    fill_obj.rotation_euler = (math.radians(40), 0, math.radians(-30))
    bpy.context.collection.objects.link(fill_obj)


# ─────────────────────────────────────────────────────────────────────────────
# Bake the fluid simulation
# ─────────────────────────────────────────────────────────────────────────────
def bake_fluid():
    print("[waterfall] baking fluid sim — this is the slow part")
    domain = bpy.data.objects["Domain"]
    bpy.context.view_layer.objects.active = domain
    with bpy.context.temp_override(active_object=domain, object=domain):
        bpy.ops.fluid.bake_all()
    print("[waterfall] bake done")


# ─────────────────────────────────────────────────────────────────────────────
# Render
# ─────────────────────────────────────────────────────────────────────────────
def render(args):
    scene = bpy.context.scene
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGB"
    scene.render.filepath = str(RENDER_DIR / "")

    if args.test:
        scene.frame_set(SPLASH_FRAME)
        scene.render.filepath = str(RENDER_DIR / f"test_splash_{SPLASH_FRAME:04d}")
        bpy.ops.render.render(write_still=True)
        print(f"[waterfall] test frame written: {scene.render.filepath}.png")
        return

    print(f"[waterfall] rendering {TOTAL_FRAMES} frames at {args.width}x{args.height}, {args.samples} samples")
    bpy.ops.render.render(animation=True)
    print("[waterfall] render done")


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────
def main():
    args = parse_args()
    print(f"[waterfall] args: test={args.test} bake_only={args.bake_only} "
          f"samples={args.samples} res={args.res} {args.width}x{args.height}")
    build_scene(args)
    bake_fluid()
    if not args.bake_only:
        render(args)


if __name__ == "__main__":
    main()
