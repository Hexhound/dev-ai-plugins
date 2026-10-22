"""Decimates a 3D model into triangle-budget variants and saves one .blend per variant,
with the original material, an unlit-albedo material, or both.

Runs inside Blender (see the `model-variants` wrapper next to this file):

    blender -b --factory-startup --python model_variants.py -- \
        INPUT OUT_DIR [--tris all | 12000 | 8000,5000] [--material original|unlit|both]
        [--name NAME] [--saturation 1.0] [--preview sheet.png]

INPUT may be .glb/.gltf/.fbx/.obj/.stl/.ply/.blend. Every variant is decimated from the
previous, larger one (same result as decimating from the original, much faster), after
welding the vertices that importers split along UV seams so the mesh doesn't crack.
"""
import argparse
import os
import shutil
import sys
import tempfile

import bmesh
import bpy
import numpy as np
from mathutils import Vector

LADDER = [40000, 20000, 12000, 8000, 5000, 2500, 1000]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser(prog="model_variants")
    p.add_argument("input")
    p.add_argument("out_dir")
    p.add_argument("--tris", default="all", help="'all' or comma-separated triangle counts")
    p.add_argument("--material", default="original", choices=("original", "unlit", "both"))
    p.add_argument("--name", default=None, help="file name prefix (default: input file name)")
    p.add_argument("--saturation", type=float, default=1.0, help="unlit albedo saturation")
    p.add_argument("--weld", type=float, default=1e-5, help="weld distance, relative to model size")
    p.add_argument("--preview", default=None, help="write a labelled comparison sheet PNG here")
    a = p.parse_args(argv)
    a.targets = LADDER if a.tris == "all" else sorted({int(t.replace("_", "")) for t in a.tris.split(",")},
                                                       reverse=True)
    a.name = a.name or os.path.splitext(os.path.basename(a.input))[0]
    return a


# ------------------------------------------------------------------------------- loading

def load(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
        return
    bpy.ops.wm.read_factory_settings(use_empty=True)
    importers = {
        ".glb": lambda: bpy.ops.import_scene.gltf(filepath=path),
        ".gltf": lambda: bpy.ops.import_scene.gltf(filepath=path),
        ".fbx": lambda: bpy.ops.import_scene.fbx(filepath=path),
        ".obj": lambda: bpy.ops.wm.obj_import(filepath=path),
        ".stl": lambda: bpy.ops.wm.stl_import(filepath=path),
        ".ply": lambda: bpy.ops.wm.ply_import(filepath=path),
    }
    if ext not in importers:
        sys.exit(f"model_variants: unsupported input type {ext}")
    importers[ext]()


def mesh_objects():
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def tri_count(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)


def bounds(objects):
    pts = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    lo = Vector([min(p[i] for p in pts) for i in range(3)])
    hi = Vector([max(p[i] for p in pts) for i in range(3)])
    return lo, hi


# ---------------------------------------------------------------------------- decimating

def with_object(ob, fn):
    with bpy.context.temp_override(active_object=ob, object=ob, selected_objects=[ob],
                                   selected_editable_objects=[ob]):
        return fn()


def welded_copy(ob, dist):
    me = ob.data.copy()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=dist)
    bm.to_mesh(me)
    bm.free()
    return me


def decimated(ob, src_mesh, target):
    """New mesh with ~target triangles, collapse-decimated from src_mesh."""
    tmp = bpy.data.objects.new("variant_tmp", src_mesh.copy())
    bpy.context.scene.collection.objects.link(tmp)
    if tmp.data.has_custom_normals:
        with_object(tmp, bpy.ops.mesh.customdata_custom_splitnormals_clear)
    mod = tmp.modifiers.new("Decimate", "DECIMATE")
    mod.ratio = min(1.0, target / max(tri_count(tmp.data), 1))
    mod.use_collapse_triangulate = True
    with_object(tmp, lambda: bpy.ops.object.modifier_apply(modifier=mod.name))
    me = tmp.data
    me.polygons.foreach_set("use_smooth", [True] * len(me.polygons))
    me.update()
    bpy.data.objects.remove(tmp)
    return me


def build_variants(objects, targets, weld):
    """{target: {object name: mesh}}; each object gets its share of the triangle budget."""
    lo, hi = bounds(objects)
    dist = weld * max((hi - lo).length, 1e-6)
    counts = {o.name: tri_count(o.data) for o in objects}
    total = sum(counts.values())
    current = {o.name: welded_copy(o, dist) for o in objects}
    variants = {}
    for target in targets:
        if target >= total:
            print(f"model_variants: skipping {target} (original has only {total} triangles)")
            continue
        meshes = {}
        for o in objects:
            share = max(4, round(target * counts[o.name] / total))
            meshes[o.name] = decimated(o, current[o.name], share)
        current = meshes
        variants[target] = meshes
    return variants


# ----------------------------------------------------------------------------- materials

def make_unlit(mat, saturation):
    """Routes the albedo (whatever feeds Base Color) through Hue/Saturation into an
    Emission shader, keeping alpha. The Principled BSDF stays in the tree, unwired."""
    if mat.node_tree is None:
        mat.use_nodes = True
    nodes, links = mat.node_tree.nodes, mat.node_tree.links
    bsdf = next((n for n in nodes if n.bl_idname == "ShaderNodeBsdfPrincipled"), None)
    out = next((n for n in nodes if n.bl_idname == "ShaderNodeOutputMaterial" and n.is_active_output), None) \
        or next((n for n in nodes if n.bl_idname == "ShaderNodeOutputMaterial"), None)
    if bsdf is None or out is None:
        print(f"model_variants: material {mat.name!r} has no Principled BSDF; left as is")
        return
    x, y = bsdf.location.x, bsdf.location.y + 420
    hs = nodes.new("ShaderNodeHueSaturation")
    hs.name = hs.label = "Albedo Saturation"
    hs.location = (x, y)
    hs.inputs["Saturation"].default_value = saturation
    base = bsdf.inputs["Base Color"]
    if base.is_linked:
        links.new(base.links[0].from_socket, hs.inputs["Color"])
    else:
        hs.inputs["Color"].default_value = base.default_value
    emit = nodes.new("ShaderNodeEmission")
    emit.name = emit.label = "Albedo Unlit"
    emit.location = (x + 220, y)
    emit.inputs["Strength"].default_value = 1.0
    links.new(hs.outputs["Color"], emit.inputs["Color"])
    shader = emit.outputs["Emission"]
    alpha = bsdf.inputs["Alpha"]
    if alpha.is_linked or alpha.default_value < 1.0:
        clear = nodes.new("ShaderNodeBsdfTransparent")
        clear.location = (x + 220, y + 160)
        mix = nodes.new("ShaderNodeMixShader")
        mix.name = mix.label = "Albedo Alpha"
        mix.location = (x + 440, y)
        if alpha.is_linked:
            links.new(alpha.links[0].from_socket, mix.inputs["Fac"])
        else:
            mix.inputs["Fac"].default_value = alpha.default_value
        links.new(clear.outputs["BSDF"], mix.inputs[1])
        links.new(shader, mix.inputs[2])
        shader = mix.outputs["Shader"]
    links.new(shader, out.inputs["Surface"])


def setup_view(unlit):
    scene = bpy.context.scene
    if unlit:
        # AgX/Filmic wash out emission colours; Standard shows the texture as painted.
        scene.view_settings.view_transform = "Standard"
        scene.view_settings.look = "None"
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                area.spaces.active.shading.type = "MATERIAL"


def frame_views(objects):
    lo, hi = bounds(objects)
    centre, size = (lo + hi) / 2, (hi - lo).length
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type == "VIEW_3D":
                r3d = area.spaces.active.region_3d
                r3d.view_location = centre
                r3d.view_distance = size * 1.6


# ------------------------------------------------------------------------------- preview

def render_views(objects, label, out_prefix):
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = scene.render.resolution_y = 520
    scene.render.film_transparent = False
    world = bpy.data.worlds.new("variants_preview")
    if world.node_tree is None:
        world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.08, 0.08, 0.09, 1.0)
    scene.world = world
    sun = bpy.data.objects.new("variants_sun", bpy.data.lights.new("variants_sun", "SUN"))
    sun.data.energy = 3.0
    sun.rotation_euler = (0.9, 0.0, -0.6)
    scene.collection.objects.link(sun)
    lo, hi = bounds(objects)
    centre, ext = (lo + hi) / 2, max(hi - lo)
    cam = bpy.data.objects.new("variants_cam", bpy.data.cameras.new("variants_cam"))
    scene.collection.objects.link(cam)
    scene.camera = cam
    cam.data.type = "ORTHO"
    cam.data.ortho_scale = ext * 1.3
    text = bpy.data.curves.new("variants_label", "FONT")
    text.body = label
    text.align_x = "CENTER"
    text.size = ext * 0.075
    label_ob = bpy.data.objects.new("variants_label", text)
    scene.collection.objects.link(label_ob)
    label_ob.parent = cam
    label_ob.location = (0, -ext * 0.6, -1.0)
    ink = bpy.data.materials.new("variants_label")
    if ink.node_tree is None:
        ink.use_nodes = True
    ink.node_tree.nodes.clear()
    emit = ink.node_tree.nodes.new("ShaderNodeEmission")
    emit.inputs["Color"].default_value = (1, 1, 1, 1)
    ink.node_tree.links.new(emit.outputs[0], ink.node_tree.nodes.new("ShaderNodeOutputMaterial").inputs["Surface"])
    text.materials.append(ink)
    paths = []
    for view, d in (("front", Vector((0, -1, 0.08))), ("three_quarter", Vector((-0.7, -0.7, 0.18)))):
        cam.location = centre + d.normalized() * ext * 3
        cam.rotation_euler = (-d).to_track_quat("-Z", "Y").to_euler()
        scene.render.filepath = f"{out_prefix}_{view}.png"
        bpy.ops.render.render(write_still=True)
        paths.append(scene.render.filepath)
    return paths


def write_sheet(rows, path):
    """rows: list of [png, png]; tiles them into one PNG."""
    tiles = []
    for row in rows:
        imgs = []
        for p in row:
            im = bpy.data.images.load(p)
            w, h = im.size
            imgs.append(np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4))
            bpy.data.images.remove(im)
        tiles.append(np.concatenate(imgs, axis=1))
    sheet = np.concatenate(tiles[::-1], axis=0)
    h, w = sheet.shape[:2]
    out = bpy.data.images.new("variants_sheet", w, h)
    out.pixels.foreach_set(sheet.ravel())
    out.filepath_raw = path
    out.file_format = "PNG"
    out.save()


# ---------------------------------------------------------------------------------- main

def main():
    a = parse_args()
    src = os.path.abspath(a.input)
    out_dir = os.path.abspath(a.out_dir)
    os.makedirs(out_dir, exist_ok=True)
    work_dir = tempfile.mkdtemp(prefix=".variants_work_", dir=out_dir)
    try:
        load(src)
        objects = mesh_objects()
        if not objects:
            sys.exit("model_variants: no mesh objects in the input")
        original_tris = sum(tri_count(o.data) for o in objects)
        print(f"model_variants: {len(objects)} mesh object(s), {original_tris} triangles")
        variants = build_variants(objects, a.targets, a.weld)
        for meshes in variants.values():
            for me in meshes.values():
                me.use_fake_user = True
        # Opening the work file below invalidates these references; keep names.
        variants = {t: {ob: me.name for ob, me in meshes.items()} for t, meshes in variants.items()}
        work = os.path.join(work_dir, "work.blend")
        bpy.ops.wm.save_as_mainfile(filepath=work, copy=True)

        modes = {"original": ["original"], "unlit": ["unlit"], "both": ["original", "unlit"]}[a.material]
        width = len(str(max(variants))) if variants else 1
        preview_rows, written = [], []
        if a.preview:
            # The work file is already saved, so this only changes the preview render.
            if "unlit" in modes:
                for mat in {s.material for o in mesh_objects() for s in o.material_slots if s.material}:
                    make_unlit(mat, a.saturation)
            setup_view("unlit" in modes)
            preview_rows.append(render_views(mesh_objects(), f"original {original_tris:,} tris",
                                             os.path.join(work_dir, "original")))
        for target in sorted(variants, reverse=True):
            for mode in modes:
                bpy.ops.wm.open_mainfile(filepath=work)
                objects = mesh_objects()
                for o in objects:
                    o.data = bpy.data.meshes[variants[target][o.name]]
                for me in bpy.data.meshes:
                    me.use_fake_user = False
                bpy.data.orphans_purge(do_local_ids=True, do_linked_ids=True, do_recursive=True)
                if mode == "unlit":
                    for mat in {s.material for o in objects for s in o.material_slots if s.material}:
                        make_unlit(mat, a.saturation)
                setup_view(mode == "unlit")
                frame_views(objects)
                tris = sum(tri_count(o.data) for o in objects)
                suffix = "_unlit" if mode == "unlit" else ""
                path = os.path.join(out_dir, f"{a.name}_{target:0{width}d}{suffix}.blend")
                bpy.ops.wm.save_as_mainfile(filepath=path, compress=True)
                written.append((path, tris))
                print(f"VARIANT {tris} {path}")
                if a.preview and mode == modes[-1]:
                    preview_rows.append(render_views(objects, f"{tris:,} tris",
                                                     os.path.join(work_dir, f"v{target}")))
        if a.preview:
            write_sheet(preview_rows, os.path.abspath(a.preview))
            print(f"PREVIEW {os.path.abspath(a.preview)}")
        print("SUMMARY")
        print(f"  original  {original_tris:>9,} tris  {src}")
        for path, tris in written:
            print(f"  variant   {tris:>9,} tris  {path}")
    finally:
        shutil.rmtree(work_dir, ignore_errors=True)


main()
