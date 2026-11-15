# Read-only inspection of a character GLB in headless Blender. It imports the
# file into an emptied scene, measures the mesh, and renders a few views.
# It never saves a .blend, never exports, and refuses to write inside this
# repository: measurements go to stdout and <outdir>/inspect.json.
#
#   Blender -b --factory-startup --python scripts/blender/inspect-wizard.py -- \
#       assets/models/wizard.glb <outdir outside the repo> [samples]
#
# "rig frame" below is the frame src/render/rig.js works in: glTF axes
# (X right, Y up, Z toward the viewer), centred on the bounds in X and Z,
# lowest point at Y = 0, scaled so the height is 1.
import json
import math
import sys
from collections import deque
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

args = sys.argv[sys.argv.index("--") + 1:]
glb = Path(args[0]).resolve()
outdir = Path(args[1]).resolve()
samples = int(args[2]) if len(args) > 2 else 64
repo = Path(__file__).resolve().parents[2]
if outdir == repo or repo in outdir.parents:
    sys.exit(f"refusing to write inside the repository: {outdir}")
outdir.mkdir(parents=True, exist_ok=True)

# Hard-coded wizard numbers copied from src/render/rig.js (rig frame, +X side,
# which rig.js names "left"). Only used to measure them against the real mesh.
RIG_JS = {
    "shoulder": (.126, .546, -.012), "elbow": (.219, .452, .015),
    "wrist": (.278, .397, .072), "palm": (.301, .356, .109),
    "wizardStaffGrip": (.283, .347, .108),
}

r = lambda x, n=4: round(float(x), n)
vec = lambda v, n=4: [r(c, n) for c in v]

bpy.data.batch_remove(list(bpy.data.objects))
bpy.ops.import_scene.gltf(filepath=str(glb))
scene = bpy.context.scene
objects = list(scene.objects)
meshes = [o for o in objects if o.type == "MESH"]

out = {
    "blender": bpy.app.version_string,
    "file": glb.name,
    "objects": [{"name": o.name, "type": o.type, "parent": o.parent.name if o.parent else None,
                 "location": vec(o.matrix_world.translation), "rotation_euler": vec(o.matrix_world.to_euler()),
                 "scale": vec(o.matrix_world.to_scale())} for o in objects],
    "armatures": sum(o.type == "ARMATURE" for o in objects),
    "actions": len(bpy.data.actions),
    "objects_with_animation_data": sum(o.animation_data is not None for o in objects),
    "mesh_objects": [],
}


def bounds(points):
    lo = Vector((min(p.x for p in points), min(p.y for p in points), min(p.z for p in points)))
    hi = Vector((max(p.x for p in points), max(p.y for p in points), max(p.z for p in points)))
    return lo, hi


# All mesh objects welded into one bmesh in world space. The importer keeps
# vertices split at UV seams, so loose parts are only meaningful after welding.
bm = bmesh.new()
for o in meshes:
    me = o.data
    me.calc_loop_triangles()
    out["mesh_objects"].append({
        "name": o.name, "vertices": len(me.vertices), "polygons": len(me.polygons),
        "triangles": len(me.loop_triangles), "material_slots": [s.material.name if s.material else None for s in o.material_slots],
        "polygons_per_material_slot": {str(i): sum(p.material_index == i for p in me.polygons) for i in range(max(1, len(o.material_slots)))},
        "vertex_groups": len(o.vertex_groups), "shape_keys": len(me.shape_keys.key_blocks) if me.shape_keys else 0,
        "modifiers": [m.type for m in o.modifiers], "uv_layers": len(me.uv_layers),
        "color_attributes": len(me.color_attributes),
    })
    part = bmesh.new()
    part.from_mesh(me)
    part.transform(o.matrix_world)
    tmp = bpy.data.meshes.new("tmp")
    part.to_mesh(tmp)
    part.free()
    bm.from_mesh(tmp)
    bpy.data.meshes.remove(tmp)

used = {s.material for o in meshes for s in o.material_slots if s.material}
out["materials"] = [{
    "name": m.name,
    "images": [{"name": n.image.name, "size": list(n.image.size)} for n in (m.node_tree.nodes if m.node_tree else [])
               if n.type == "TEX_IMAGE" and n.image],
} for m in used]

raw_verts = len(bm.verts)
WELD = 1e-6
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=WELD)
bm.verts.ensure_lookup_table()
tris = lambda faces: sum(len(f.verts) - 2 for f in faces)
lo, hi = bounds([v.co for v in bm.verts])
size = hi - lo
height = size.z
centre = (lo + hi) / 2


def rig_frame(p):  # Blender world (Z up, -Y front) -> rig.js frame
    return Vector(((p.x - centre.x) / height, (p.z - lo.z) / height, (centre.y - p.y) / height))


def from_rig_frame(p):
    return Vector((centre.x + p[0] * height, centre.y - p[2] * height, lo.z + p[1] * height))


out["totals"] = {
    "vertices_as_imported": raw_verts, "weld_distance": WELD, "vertices_welded": len(bm.verts),
    "faces": len(bm.faces), "triangles": tris(bm.faces),
    "boundary_edges": sum(e.is_boundary for e in bm.edges),
    "wire_edges": sum(e.is_wire for e in bm.edges),
    "edges_with_3plus_faces": sum(len(e.link_faces) > 2 for e in bm.edges),
}
out["bounds_blender_world"] = {
    "min": vec(lo), "max": vec(hi), "dimensions": vec(size), "centre": vec(centre),
    "up_axis": "Z in Blender (glTF +Y); the importer converts Y-up to Z-up",
    "lowest_vertex_z": r(lo.z, 5), "origin_height_as_fraction_of_height": r(-lo.z / height),
    "origin_x_offset_from_centre": r(-centre.x, 5), "origin_y_offset_from_centre": r(-centre.y, 5),
}

# Loose parts: connected components of the welded mesh.
seen, islands = set(), []
for start in bm.verts:
    if start.index in seen:
        continue
    seen.add(start.index)
    queue, verts, faces = deque([start]), [], set()
    while queue:
        v = queue.popleft()
        verts.append(v)
        faces.update(v.link_faces)
        for e in v.link_edges:
            other = e.other_vert(v)
            if other.index not in seen:
                seen.add(other.index)
                queue.append(other)
    ilo, ihi = bounds([v.co for v in verts])
    islands.append({"vertices": len(verts), "triangles": tris(faces), "min": vec(ilo), "max": vec(ihi),
                    "dimensions": vec(ihi - ilo), "rig_frame_min": vec(rig_frame(Vector((ilo.x, ihi.y, ilo.z))), 3),
                    "rig_frame_max": vec(rig_frame(Vector((ihi.x, ilo.y, ihi.z))), 3)})
islands.sort(key=lambda i: -i["triangles"])
rest = islands[12:]
out["islands"] = {
    "count": len(islands), "largest": islands[:12],
    "others": {"count": len(rest), "triangles": sum(i["triangles"] for i in rest),
               "vertices": sum(i["vertices"] for i in rest)},
    "largest_share_of_triangles": r(islands[0]["triangles"] / max(1, tris(bm.faces))),
}

# Arm and hand, measured rather than read off the bounding box: slices across
# the lateral axis on each side, in the rig frame.
rf = [rig_frame(v.co) for v in bm.verts]
out["lateral_extreme_rig_frame"] = {
    "plus_x": vec(max(rf, key=lambda p: p.x), 3), "minus_x": vec(min(rf, key=lambda p: p.x), 3)}
slices = {}
for sign, name in ((1, "plus_x"), (-1, "minus_x")):
    rows = []
    for k in range(4, 20):
        a, b = k * .02, k * .02 + .02
        pts = [p for p in rf if a <= p.x * sign < b]
        if not pts:
            continue
        rows.append({"x": [r(a, 2), r(b, 2)], "n": len(pts),
                     "y": [r(min(p.y for p in pts), 3), r(max(p.y for p in pts), 3)],
                     "z": [r(min(p.z for p in pts), 3), r(max(p.z for p in pts), 3)]})
    slices[name] = rows
out["lateral_slices_rig_frame"] = slices

# Everything above rig.js's neck band (y > .66) is head, beard top and hat.
# Its reach bounds how high and how close to the head a hand can travel.
top = [p for p in rf if p.y > .66]
outer = lambda sign: [p for p in top if p.x * sign >= .22]
out["above_neck_rig_frame"] = {
    "threshold_y": .66, "x": [r(min(p.x for p in top), 3), r(max(p.x for p in top), 3)],
    "z": [r(min(p.z for p in top), 3), r(max(p.z for p in top), 3)],
    "lowest_y_where_abs_x_ge_0.22": {"plus_x": r(min(p.y for p in outer(1)), 3), "minus_x": r(min(p.y for p in outer(-1)), 3)},
}

# Beyond ARM_X only sleeve and hand remain in the slices above (the hat brim
# ends before it). The hand is taken as the lowest HAND_H of that region.
ARM_X, HAND_H = .26, .11
hands = {}
for sign, name in ((1, "plus_x"), (-1, "minus_x")):
    arm = [p for p in rf if p.x * sign >= ARM_X]
    tip = min(arm, key=lambda p: p.y)
    hand = [p for p in arm if p.y <= tip.y + HAND_H]
    box = lambda pts: {"min": [r(min(p[i] for p in pts), 3) for i in range(3)],
                       "max": [r(max(p[i] for p in pts), 3) for i in range(3)]}
    hands[name] = {"arm_x_threshold": ARM_X, "hand_height_window": HAND_H, "lowest_point": vec(tip, 3),
                   "sleeve_and_hand_bounds": box(arm), "hand_bounds": box(hand), "hand_vertices": len(hand)}
out["hands_rig_frame"] = hands

# Where rig.js's hard-coded points sit relative to the real surface.
bm.normal_update()
tree = BVHTree.FromBMesh(bm)
landmarks = {}
for name, p in RIG_JS.items():
    for sign, side in ((1, "plus_x"), (-1, "minus_x")):
        world = from_rig_frame((p[0] * sign, p[1], p[2]))
        hit, normal, _, dist = tree.find_nearest(world)
        landmarks[f"{name}.{side}"] = {
            "rig_frame": [r(p[0] * sign, 3), p[1], p[2]],
            "distance_to_surface_rig_units": r(dist / height),
            "side_of_nearest_face": "inside" if (world - hit).dot(normal) < 0 else "outside"}
out["rig_js_landmarks_vs_surface"] = landmarks

(outdir / "inspect.json").write_text(json.dumps(out, indent=1))
print("INSPECT_JSON_BEGIN")
print(json.dumps(out, indent=1))
print("INSPECT_JSON_END")

# Renders. Cycles on the CPU needs no GPU context in a headless run.
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = samples
scene.cycles.use_denoising = True
scene.view_settings.view_transform = "Standard"
scene.render.image_settings.file_format = "PNG"
scene.render.image_settings.color_mode = "RGB"
scene.render.image_settings.compression = 100
world = bpy.data.worlds.new("flat")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (.62, .62, .62, 1)
scene.world = world
sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN"))
sun.data.energy = 2.5
sun.rotation_euler = (math.radians(55), 0, math.radians(-25))
scene.collection.objects.link(sun)
cam = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
cam.data.type = "ORTHO"
scene.collection.objects.link(cam)
scene.camera = cam


def render(name, target, direction, ortho_scale, px):
    # direction: unit vector from the target toward the camera
    direction = Vector(direction).normalized()
    cam.location = target + direction * (4 * max(size))
    cam.rotation_euler = (-direction).to_track_quat("-Z", "Y").to_euler()
    cam.data.ortho_scale = ortho_scale
    cam.data.clip_start, cam.data.clip_end = .01, 20 * max(size)
    scene.render.resolution_x, scene.render.resolution_y = px
    scene.render.filepath = str(outdir / name)
    try:
        bpy.ops.render.render(write_still=True)
        print(f"RENDER_OK {name} ortho_scale={ortho_scale:.4f} px={px}")
    except Exception as e:  # recorded, not hidden: the numbers above still stand
        print(f"RENDER_FAILED {name}: {type(e).__name__}: {e}")


frame = 1.08 * max(size.x, size.y, size.z)
render("front.png", centre, (0, -1, 0), frame, (520, 520))
render("side-plus-x.png", centre, (1, 0, 0), frame, (520, 520))
for sign, side in ((1, "plus-x"), (-1, "minus-x")):
    b = hands[side.replace("-", "_")]["hand_bounds"]
    mid = from_rig_frame([(b["min"][i] + b["max"][i]) / 2 for i in range(3)])
    render(f"hand-{side}.png", mid, (.55 * sign, -1, .25), .26 * height, (520, 520))
bm.free()
