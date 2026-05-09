"""
build_waterfall.py — Render the calm-mode trade→impact water-falling transition.

Produces a 6-second cream/white water-drop+splash sequence that integrates
with the calm-mode .calm-water-transition band. Splash impact lands at
frame 60 (~33% of duration) so the HTML mask reveal in app.js (anchored
at scroll progress 0.30) syncs visually with the splash moment.

Test (1 frame, ~30s):
    blender --background --python tools/build_waterfall.py -- --test

Bake fluid sim only (~5-15 min):
    blender --background --python tools/build_waterfall.py -- --bake-only

Full bake + render (1-2 hours):
    blender --background --python tools/build_waterfall.py

Outputs PNG sequence to tools/_artifacts/waterfall_render/. Encode to MP4 with:
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

# Allow `from PIL import` etc. if needed later
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
    p.add_argument("--samples", type=int, default=32, help="Cycles samples per frame")
    p.add_argument("--width", type=int, default=1280)
    p.add_argument("--height", type=int, default=720)
    p.add_argument("--res", type=int, default=128, help="Fluid domain resolution (higher = slower bake)")
    return p.parse_args(argv)


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
# Frame range / timing
# ─────────────────────────────────────────────────────────────────────────────
FPS = 30
DURATION_SEC = 6
TOTAL_FRAMES = FPS * DURATION_SEC          # 180 frames
SPLASH_FRAME = int(TOTAL_FRAMES * 0.33)    # ~frame 60 — splash impact moment

# Scene units: domain is 8 units wide × 4.5 tall × 8 deep (16:9-ish).
# Drop spawns at top, hits invisible obstacle at y=-1.5 (lower-middle).
DOMAIN_W = 8.0
DOMAIN_H = 4.5
DOMAIN_D = 8.0
SPLASH_Z = -0.6                            # impact z (so splash sits at 60% from top of camera frame)
DROP_SPAWN_Z = 1.0                         # drop spawns just inside the top of camera frame
GRAVITY_Z = -0.8                           # tuned so drop free-falls from spawn → splash exactly at SPLASH_FRAME
CAMERA_Z = -0.32                           # places camera so splash lands at 60% from top of frame


# ─────────────────────────────────────────────────────────────────────────────
# Materials
# ─────────────────────────────────────────────────────────────────────────────
def make_water_material(diagnostic=False):
    """Cream/white water. Against a near-black world, a fully-transparent
    glass shader would be invisible — we'd just see the dark background
    refracted. Solution: mix a glossy reflection over a brighter cream
    diffuse base so the water has visible surface AND a hint of refractive
    transmission. Plus a small emission so the water reads even where the
    key light doesn't directly hit it.

    diagnostic mode: pure white emissive — used to validate geometry is
    actually in frame before tuning the real material."""
    mat = bpy.data.materials.new(name="WaterCream")
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

    # Real material: glass-like cream water. Reduced transmission so the
    # water has visible substance against the dark world. Subtle emission
    # adds a self-lit lift so the highlights read crisply.
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (0, 0)
    bsdf.inputs["Base Color"].default_value = (0.95, 0.92, 0.86, 1.0)  # cream
    bsdf.inputs["Roughness"].default_value = 0.08
    bsdf.inputs["IOR"].default_value = 1.33
    bsdf.inputs["Transmission Weight"].default_value = 0.6
    bsdf.inputs["Metallic"].default_value = 0.0
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.6
    if "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (0.95, 0.92, 0.86, 1.0)
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.4

    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return mat


# ─────────────────────────────────────────────────────────────────────────────
# Fluid scene
# ─────────────────────────────────────────────────────────────────────────────
def build_scene(args):
    clear_scene()

    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "GPU" if hasattr(scene.cycles, "device") else "CPU"
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.frame_start = 1
    scene.frame_end = TOTAL_FRAMES
    scene.render.fps = FPS
    scene.render.resolution_x = args.width
    scene.render.resolution_y = args.height
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False  # solid bg matching --bg-d

    # World background = #0E0C08 (calm bg color) so the band blends seamlessly
    world = scene.world or bpy.data.worlds.new("World")
    scene.world = world
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    if bg:
        # #0E0C08 → linear ~ (0.0029, 0.0023, 0.0017)
        bg.inputs["Color"].default_value = (0.0029, 0.0023, 0.0017, 1.0)
        bg.inputs["Strength"].default_value = 1.0

    # ─── Domain ──────────────────────────────────────────────────────────
    # Blender axes: X=width, Y=depth, Z=height (vertical).
    bpy.ops.mesh.primitive_cube_add(size=1)
    domain = bpy.context.active_object
    domain.name = "Domain"
    domain.scale = (DOMAIN_W / 2, DOMAIN_D / 2, DOMAIN_H / 2)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)

    # Add fluid modifier (Mantaflow liquid domain)
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
    # Cache frame range
    fluid.domain_settings.cache_frame_start = 1
    fluid.domain_settings.cache_frame_end = TOTAL_FRAMES
    # Reduced gravity so the drop free-falls slowly enough to hit the pool
    # exactly at SPLASH_FRAME (frame 60). At default 9.81 the drop arrives
    # in ~half a second; we want it to take 2 seconds.
    if hasattr(fluid.domain_settings, "gravity"):
        fluid.domain_settings.gravity = (0, 0, GRAVITY_Z)
    if hasattr(fluid.domain_settings, "use_gravity"):
        fluid.domain_settings.use_gravity = True

    # NOTE: do NOT hide the domain — the Mantaflow mesh is RENDERED ONTO
    # the domain object itself (replacing the cube during render). Hiding
    # it hides the water.

    # ─── Pool: pre-existing thin puddle just below splash height ────────
    # Wide enough to span the visible camera frame, thin enough that the
    # splash is the dominant motion. Centered horizontally on x=0 so the
    # drop hits the middle of the pool. Top surface at SPLASH_Z so the
    # splash impact lands at the correct viewport position.
    pool_top_z = SPLASH_Z
    pool_thickness = 0.15
    pool_center_z = pool_top_z - pool_thickness / 2
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, pool_center_z))
    pool = bpy.context.active_object
    pool.name = "Pool"
    pool.scale = (3.0, 1.5, pool_thickness / 2)  # 6w × 3d × 0.15h
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bpy.ops.object.modifier_add(type="FLUID")
    pool.modifiers["Fluid"].fluid_type = "FLOW"
    pool.modifiers["Fluid"].flow_settings.flow_type = "LIQUID"
    pool.modifiers["Fluid"].flow_settings.flow_behavior = "GEOMETRY"
    pool.hide_render = True

    # ─── Drop: a single sphere converted to liquid at frame 1 ───────────
    # No initial velocity — gravity (set on domain) does all the work.
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(0, 0, DROP_SPAWN_Z))
    drop = bpy.context.active_object
    drop.name = "Drop"
    bpy.ops.object.modifier_add(type="FLUID")
    drop.modifiers["Fluid"].fluid_type = "FLOW"
    drop.modifiers["Fluid"].flow_settings.flow_type = "LIQUID"
    drop.modifiers["Fluid"].flow_settings.flow_behavior = "GEOMETRY"
    drop.modifiers["Fluid"].flow_settings.velocity_coord = (0, 0, 0)
    drop.hide_render = True

    # ─── Apply water material to domain (mesh fluid renders with this) ───
    water_mat = make_water_material(diagnostic=getattr(args, "diagnostic", False))
    if domain.data.materials:
        domain.data.materials[0] = water_mat
    else:
        domain.data.materials.append(water_mat)

    # ─── Camera (16:9 wide framing, looking at impact zone) ──────────────
    # Camera at -Y, rotated 90° on X so its local -Z (default look direction)
    # points toward +Y (into the scene). Up is +Z.
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "PERSP"
    cam_data.lens = 50
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    cam.location = (0, -7.0, CAMERA_Z)
    cam.rotation_euler = (math.radians(90), 0, 0)
    scene.camera = cam

    # ─── Lighting: water against a near-black world needs strong key.
    # Sun lamp + a couple of area fills so highlights read crisply.

    # Sun lamp from upper-left-front, warm cream tone
    sun = bpy.data.lights.new("Sun", "SUN")
    sun.energy = 6.0
    sun.color = (1.0, 0.96, 0.88)
    sun_obj = bpy.data.objects.new("Sun", sun)
    sun_obj.location = (0, -3, 6)
    # Point sun toward origin: from (0,-3,6) toward (0,0,0) = direction (0,3,-6)
    # As a rotation on X axis: angle = atan2(-3, -6) ... use simpler euler
    sun_obj.rotation_euler = (math.radians(60), 0, math.radians(-20))
    bpy.context.collection.objects.link(sun_obj)

    # Rim light from behind-right — gold-ish for "forward" accent echo
    rim = bpy.data.lights.new("Rim", "AREA")
    rim.size = 4.0
    rim.energy = 1200.0
    rim.color = (0.95, 0.82, 0.58)
    rim_obj = bpy.data.objects.new("Rim", rim)
    rim_obj.location = (4, 4, 1)
    rim_obj.rotation_euler = (math.radians(110), 0, math.radians(45))
    bpy.context.collection.objects.link(rim_obj)

    # Top fill so the falling drop is visible during its descent
    fill = bpy.data.lights.new("Fill", "AREA")
    fill.size = 6.0
    fill.energy = 800.0
    fill.color = (0.95, 0.92, 0.86)
    fill_obj = bpy.data.objects.new("Fill", fill)
    fill_obj.location = (0, -3, 5)
    fill_obj.rotation_euler = (math.radians(35), 0, 0)
    bpy.context.collection.objects.link(fill_obj)


# ─────────────────────────────────────────────────────────────────────────────
# Bake the fluid simulation
# ─────────────────────────────────────────────────────────────────────────────
def bake_fluid():
    print("[waterfall] baking fluid sim — this is the slow part")
    domain = bpy.data.objects["Domain"]
    bpy.context.view_layer.objects.active = domain
    # Bake all (data + mesh) in one go
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
    scene.render.filepath = str(RENDER_DIR / "")  # PNGs named ####.png

    if args.test:
        # One frame at the splash moment
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
