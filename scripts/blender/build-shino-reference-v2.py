"""Build Shino Reference v2 as a dedicated Blender-authored DCC character.

The script deliberately produces reviewable skin / hair / clothing / accessory surfaces
on the audited Shino humanoid skeleton. It is a DCC PRIMARY asset, not automatic
RUNTIME_READY approval.

Usage:
  blender --background --python scripts/blender/build-shino-reference-v2.py -- \
    --source generated/SHINO_review.glb --source-vrm apps/rinne/public/simulator/assets/SHINO_review.vrm \
    --out generated/shino-reference-v2
"""
from __future__ import annotations

import argparse
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def args_after_double_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-vrm", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args_after_double_dash())


def glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise RuntimeError(f"Not a GLB/VRM: {path}")
    _, version, total = struct.unpack_from("<4sII", data, 0)
    if version != 2 or total != len(data):
        raise RuntimeError("Unsupported GLB header")
    offset = 12
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            return json.loads(payload.decode("utf-8").rstrip(" \t\r\n\x00"))
    raise RuntimeError("GLB JSON chunk missing")


def humanoid_names(source_vrm: Path) -> dict[str, str]:
    doc = glb_json(source_vrm)
    rows = doc.get("extensions", {}).get("VRMC_vrm", {}).get("humanoid", {}).get("humanBones", {})
    nodes = doc.get("nodes", [])
    result: dict[str, str] = {}
    for human, row in rows.items():
        index = row.get("node")
        if isinstance(index, int) and 0 <= index < len(nodes) and nodes[index].get("name"):
            result[human] = nodes[index]["name"]
    required = [
        "hips", "spine", "head", "leftUpperArm", "leftLowerArm", "leftHand",
        "rightUpperArm", "rightLowerArm", "rightHand", "leftUpperLeg",
        "leftLowerLeg", "leftFoot", "rightUpperLeg", "rightLowerLeg", "rightFoot",
    ]
    missing = [name for name in required if name not in result]
    if missing:
        raise RuntimeError("Source VRM humanoid names missing: " + ", ".join(missing))
    return result


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transform(obj: bpy.types.Object) -> None:
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def ensure_uv(obj: bpy.types.Object) -> None:
    if obj.type == "MESH" and len(obj.data.uv_layers) == 0:
        obj.data.uv_layers.new(name="UVMap")


def smooth(obj: bpy.types.Object) -> None:
    if obj.type != "MESH":
        return
    for poly in obj.data.polygons:
        poly.use_smooth = True


def make_material(name: str, rgba: tuple[float, float, float, float], roughness: float = 0.65, metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    if "Specular IOR Level" in bsdf.inputs:
        bsdf.inputs["Specular IOR Level"].default_value = 0.32
    elif "Specular" in bsdf.inputs:
        bsdf.inputs["Specular"].default_value = 0.32
    return mat


def add_bevel(obj: bpy.types.Object, width: float = 0.012, segments: int = 3) -> None:
    mod = obj.modifiers.new("DCC Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def add_subsurf(obj: bpy.types.Object, levels: int = 1) -> None:
    mod = obj.modifiers.new("DCC Subdivision", "SUBSURF")
    mod.levels = levels
    mod.render_levels = levels
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def add_uv_sphere(name: str, location, scale, material, segments: int = 32, rings: int = 20) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def add_round_cube(name: str, location, scale, material, bevel: float = 0.025) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    add_bevel(obj, bevel, 4)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def add_tapered(name: str, a: Vector, b: Vector, r1: float, r2: float, material, vertices: int = 20) -> bpy.types.Object:
    delta = b - a
    length = delta.length
    if length < 1e-5:
        raise RuntimeError(f"Zero-length segment {name}")
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    apply_transform(obj)
    add_bevel(obj, min(r1, r2) * 0.18, 3)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def ring_shell(name: str, z_top: float, z_bottom: float, top_xy, bottom_xy, material, open_front: float = 0.0, segments: int = 36) -> bpy.types.Object:
    start = open_front
    arc = math.tau - open_front * 2 if open_front > 0 else math.tau
    verts = []
    faces = []
    columns = segments + 1 if open_front > 0 else segments
    for row, (z, radii) in enumerate(((z_top, top_xy), (z_bottom, bottom_xy))):
        rx, ry = radii
        for i in range(columns):
            denominator = segments if open_front > 0 else segments
            t = i / denominator
            angle = start + arc * t
            verts.append((math.sin(angle) * rx, -math.cos(angle) * ry, z))
    count = columns
    limit = count - 1 if open_front > 0 else count
    for i in range(limit):
        j = (i + 1) % count
        faces.append((i, j, count + j, count + i))
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solid = obj.modifiers.new("Cloth Thickness", "SOLIDIFY")
    solid.thickness = 0.012
    solid.offset = 0
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=solid.name)
    add_bevel(obj, 0.007, 3)
    smooth(obj)
    ensure_uv(obj)
    return obj


def curve_lock(name: str, points: list[tuple[float, float, float]], radius: float, material) -> bpy.types.Object:
    curve = bpy.data.curves.new(name + "Curve", "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 4
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = "AUTO"
        bp.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(material)
    select_only(obj)
    bpy.ops.object.convert(target="MESH")
    smooth(obj)
    ensure_uv(obj)
    return obj


def bind_rigid(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    ensure_uv(obj)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Shino Humanoid", "ARMATURE")
    modifier.object = armature
    obj.parent = armature


def retarget_rest_pose(armature: bpy.types.Object, human_names: dict[str, str]) -> None:
    select_only(armature)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    bpy.ops.object.mode_set(mode="EDIT")
    bones = armature.data.edit_bones

    target = {
        "hips": ((0, 0, 0.72), (0, 0, 0.84)),
        "spine": ((0, 0, 0.82), (0, 0, 1.02)),
        "chest": ((0, 0, 1.00), (0, 0, 1.14)),
        "upperChest": ((0, 0, 1.12), (0, 0, 1.22)),
        "neck": ((0, 0, 1.20), (0, 0, 1.29)),
        "head": ((0, 0, 1.27), (0, 0, 1.45)),
        "leftUpperArm": ((0.14, 0, 1.16), (0.34, 0, 1.04)),
        "leftLowerArm": ((0.34, 0, 1.04), (0.49, 0, 0.94)),
        "leftHand": ((0.49, 0, 0.94), (0.57, 0, 0.91)),
        "rightUpperArm": ((-0.14, 0, 1.16), (-0.34, 0, 1.04)),
        "rightLowerArm": ((-0.34, 0, 1.04), (-0.49, 0, 0.94)),
        "rightHand": ((-0.49, 0, 0.94), (-0.57, 0, 0.91)),
        "leftUpperLeg": ((0.085, 0, 0.72), (0.095, 0, 0.40)),
        "leftLowerLeg": ((0.095, 0, 0.40), (0.095, 0, 0.11)),
        "leftFoot": ((0.095, 0, 0.11), (0.095, -0.13, 0.055)),
        "rightUpperLeg": ((-0.085, 0, 0.72), (-0.095, 0, 0.40)),
        "rightLowerLeg": ((-0.095, 0, 0.40), (-0.095, 0, 0.11)),
        "rightFoot": ((-0.095, 0, 0.11), (-0.095, -0.13, 0.055)),
    }
    for human, (head, tail) in target.items():
        name = human_names.get(human)
        bone = bones.get(name) if name else None
        if bone:
            bone.head = head
            bone.tail = tail
    bpy.ops.object.mode_set(mode="OBJECT")


def setup_scene() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    if "BLENDER_EEVEE_NEXT" in {item.identifier for item in scene.bl_rna.properties["render_engine"].enum_items}:
        scene.render.engine = "BLENDER_EEVEE_NEXT"
    else:
        scene.render.engine = "BLENDER_EEVEE"
    scene.world.color = (0.035, 0.045, 0.050)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_studio() -> tuple[bpy.types.Object, bpy.types.Object]:
    bpy.ops.object.camera_add(location=(0, -4.0, 1.0))
    camera = bpy.context.object
    camera.name = "ReviewCamera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.95
    bpy.context.scene.camera = camera

    for name, location, energy, size, color in [
        ("Key", (-2.6, -3.2, 4.2), 850, 4.0, (1.0, 0.86, 0.72)),
        ("Fill", (3.0, -2.0, 2.4), 520, 3.5, (0.72, 0.84, 1.0)),
        ("Rim", (0.5, 2.8, 3.1), 700, 3.0, (0.75, 0.88, 1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, Vector((0, 0, 0.85)))

    ground_mat = make_material("MAT_STUDIO_GROUND", (0.16, 0.18, 0.17, 1), 0.95)
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.005))
    ground = bpy.context.object
    ground.name = "StudioGround"
    ground.data.materials.append(ground_mat)
    return camera, ground


def render_views(camera: bpy.types.Object, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    target = Vector((0, 0, 0.82))
    views = {
        "front": (0, -3.6, 0.88),
        "side": (3.6, 0, 0.88),
        "back": (0, 3.6, 0.88),
        "three-quarter": (2.55, -2.55, 1.08),
    }
    for name, position in views.items():
        camera.location = position
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(out_dir / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    out = Path(args.out).resolve()
    (out / "source").mkdir(parents=True, exist_ok=True)
    (out / "export").mkdir(parents=True, exist_ok=True)
    (out / "review").mkdir(parents=True, exist_ok=True)

    setup_scene()
    human_names = humanoid_names(Path(args.source_vrm))
    bpy.ops.import_scene.gltf(filepath=str(Path(args.source).resolve()))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one imported armature, found {len(armatures)}")
    armature = armatures[0]
    armature.name = "ShinoReferenceV2Rig"

    # Remove source presentation meshes. The audited humanoid skeleton is retained as
    # rig provenance; all visible surfaces below are newly authored for Reference v2.
    for obj in list(bpy.context.scene.objects):
        if obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)
    retarget_rest_pose(armature, human_names)

    skin = make_material("MAT_SKIN", (0.95, 0.73, 0.66, 1), 0.82)
    hair = make_material("MAT_HAIR", (0.48, 0.27, 0.18, 1), 0.52)
    hair_hi = make_material("MAT_HAIR_HIGHLIGHT", (0.67, 0.42, 0.30, 1), 0.48)
    eye_white = make_material("MAT_EYE_WHITE", (0.98, 0.98, 0.96, 1), 0.35)
    eye = make_material("MAT_EYE", (0.30, 0.16, 0.10, 1), 0.28)
    eye_hi = make_material("MAT_EYE_HIGHLIGHT", (1, 0.96, 0.86, 1), 0.20)
    green = make_material("MAT_CLOTH_GREEN", (0.19, 0.33, 0.15, 1), 0.82)
    green_dark = make_material("MAT_CLOTH_GREEN_DARK", (0.11, 0.21, 0.09, 1), 0.88)
    cream = make_material("MAT_CLOTH_CREAM", (0.86, 0.82, 0.71, 1), 0.90)
    shorts = make_material("MAT_CLOTH_SHORTS", (0.15, 0.12, 0.10, 1), 0.88)
    leather = make_material("MAT_LEATHER", (0.24, 0.15, 0.10, 1), 0.72)
    brass = make_material("MAT_BRASS", (0.55, 0.42, 0.20, 1), 0.38, 0.48)
    mouth = make_material("MAT_MOUTH", (0.42, 0.16, 0.14, 1), 0.72)

    visible: list[tuple[bpy.types.Object, str]] = []
    def add(obj: bpy.types.Object, human: str) -> bpy.types.Object:
        visible.append((obj, human))
        return obj

    # Skin primary forms. The face is a deliberately large 5-head stylized volume,
    # while limbs remain slim enough to preserve the reference-sheet silhouette.
    head = add(add_uv_sphere("SKIN_Head", (0, 0, 1.37), (0.155, 0.135, 0.175), skin, 40, 28), "head")
    # Gentle jaw taper: narrow lower/front vertices without changing the cranium.
    for vertex in head.data.vertices:
        z = vertex.co.z
        if z < 1.34:
            factor = 0.80 + max(0.0, min(1.0, (z - 1.195) / 0.145)) * 0.20
            vertex.co.x *= factor
        if vertex.co.y < -0.09 and z < 1.39:
            vertex.co.y -= 0.008 * (1 - max(0.0, min(1.0, (z - 1.20) / 0.19)))
    add(add_uv_sphere("SKIN_Neck", (0, 0, 1.205), (0.050, 0.047, 0.075), skin, 24, 16), "neck")
    add(add_uv_sphere("SKIN_Torso", (0, 0, 0.99), (0.145, 0.105, 0.23), skin, 28, 18), "spine")
    add(add_uv_sphere("SKIN_Hips", (0, 0, 0.73), (0.135, 0.105, 0.12), skin, 24, 16), "hips")

    limb_specs = [
        ("L_UpperArm", "leftUpperArm", (0.14,0,1.16), (0.34,0,1.04), .050,.042),
        ("L_LowerArm", "leftLowerArm", (0.34,0,1.04), (0.49,0,.94), .043,.034),
        ("R_UpperArm", "rightUpperArm", (-.14,0,1.16), (-.34,0,1.04), .050,.042),
        ("R_LowerArm", "rightLowerArm", (-.34,0,1.04), (-.49,0,.94), .043,.034),
        ("L_UpperLeg", "leftUpperLeg", (.085,0,.72), (.095,0,.40), .070,.055),
        ("L_LowerLeg", "leftLowerLeg", (.095,0,.40), (.095,0,.11), .055,.041),
        ("R_UpperLeg", "rightUpperLeg", (-.085,0,.72), (-.095,0,.40), .070,.055),
        ("R_LowerLeg", "rightLowerLeg", (-.095,0,.40), (-.095,0,.11), .055,.041),
    ]
    for name, human, a, b, r1, r2 in limb_specs:
        add(add_tapered("SKIN_" + name, Vector(a), Vector(b), r1, r2, skin), human)
    for side, x in (("L", .51), ("R", -.51)):
        human = "leftHand" if side == "L" else "rightHand"
        add(add_uv_sphere(f"SKIN_{side}_Hand", (x,0,.925), (.050,.033,.060), skin, 20, 12), human)

    # Face surfaces. Large eyes and tiny mouth match the reference's soft anime read.
    for side, x in (("L", .055), ("R", -.055)):
        eye_human = "head"
        add(add_uv_sphere(f"FACE_{side}_EyeWhite", (x,-.128,1.395), (.046,.014,.052), eye_white, 24, 16), eye_human)
        add(add_uv_sphere(f"FACE_{side}_Iris", (x,-.142,1.394), (.024,.006,.031), eye, 20, 12), eye_human)
        add(add_uv_sphere(f"FACE_{side}_EyeHighlight", (x-.008,-.148,1.408), (.007,.003,.009), eye_hi, 16, 10), eye_human)
    add(add_uv_sphere("FACE_Nose", (0,-.133,1.348), (.016,.010,.018), skin, 16, 10), "head")
    add(add_round_cube("FACE_Mouth", (0,-.139,1.316), (.026,.004,.005), mouth, .004), "head")

    # Hair cap and sculpted curve locks. The locks, bangs and side pieces create the
    # bob silhouette rather than relying on one inflated sphere.
    add(add_uv_sphere("HAIR_Cap", (0,.018,1.405), (.174,.154,.183), hair, 36, 24), "head")
    for i in range(15):
        angle = math.radians(34 + i * (292 / 14))
        x = math.sin(angle) * .142
        y = math.cos(angle) * .118 + .012
        side = abs(x) / .142
        start = (x*.55, y*.55, 1.535)
        mid = (x, y, 1.43)
        end = (x*(1.08 if side>.6 else .96), y*(1.05 if y>0 else .92), 1.25 + .055*(1-side))
        add(curve_lock(f"HAIR_Bob_{i:02}", [start, mid, end], .022 + .004*(1-side), hair), "head")
    for i, x in enumerate((-.075,-.050,-.025,0,.025,.050,.075)):
        lean = -0.010 if i < 3 else 0.010 if i > 3 else 0
        add(curve_lock(f"HAIR_Bang_{i:02}", [(x*.55,-.080,1.545),(x,-.135,1.47),(x+lean,-.142,1.385+abs(x)*.20)], .018, hair_hi if i in (1,5) else hair), "head")
    for side, x in (("L", .145), ("R", -.145)):
        add(curve_lock(f"HAIR_{side}_FaceLock", [(x*.55,-.060,1.51),(x,-.120,1.40),(x*.95,-.115,1.285)], .021, hair), "head")

    # Cream blouse and sleeves, green vest/capelet, dark shorts.
    add(add_uv_sphere("CLOTH_BlouseBody", (0,0,1.005), (.158,.115,.225), cream, 28, 18), "spine")
    for side, sign in (("L",1),("R",-1)):
        human = "leftUpperArm" if sign > 0 else "rightUpperArm"
        add(add_tapered(f"CLOTH_{side}_Sleeve", Vector((.14*sign,0,1.16)), Vector((.32*sign,0,1.055)), .064,.055, cream), human)
        lower_human = "leftLowerArm" if sign > 0 else "rightLowerArm"
        add(add_tapered(f"CLOTH_{side}_Cuff", Vector((.315*sign,0,1.055)), Vector((.365*sign,0,1.02)), .056,.050, green_dark), lower_human)
    add(ring_shell("CLOTH_GreenVest", 1.145, .83, (.155,.112), (.185,.128), green, open_front=.32, segments=40), "spine")
    add(ring_shell("CLOTH_Capelet", 1.19, .99, (.175,.125), (.285,.185), green, open_front=.45, segments=44), "spine")
    add(ring_shell("CLOTH_CapeletTrim", 1.015, .985, (.278,.181), (.288,.190), cream, open_front=.45, segments=44), "spine")
    add(add_round_cube("CLOTH_Collar", (0,-.105,1.165), (.082,.028,.028), cream, .010), "spine")
    for side, x in (("L",.072),("R",-.072)):
        add(add_round_cube(f"CLOTH_{side}_Shorts", (x,0,.665), (.080,.105,.115), shorts, .025), "hips")

    # Belt, brass buckle, boots and small satchel.
    bpy.ops.mesh.primitive_torus_add(major_radius=.137, minor_radius=.012, major_segments=36, minor_segments=8, location=(0,0,.77), rotation=(math.pi/2,0,0))
    belt = bpy.context.object; belt.name="ACC_Belt"; belt.scale=(1,.82,1); apply_transform(belt); belt.data.materials.append(leather); ensure_uv(belt); add(belt,"hips")
    add(add_round_cube("ACC_Buckle", (0,-.112,.77), (.030,.014,.025), brass, .005), "hips")
    for side, x in (("L",.095),("R",-.095)):
        human = "leftLowerLeg" if side == "L" else "rightLowerLeg"
        add(add_tapered(f"CLOTH_{side}_BootShaft", Vector((x,0,.33)), Vector((x,0,.115)), .062,.055, leather), human)
        foot_human = "leftFoot" if side == "L" else "rightFoot"
        add(add_round_cube(f"CLOTH_{side}_BootFoot", (x,-.055,.072), (.070,.125,.060), leather, .020), foot_human)
    add(add_round_cube("ACC_Satchel", (-.185,.045,.72), (.095,.050,.120), leather, .018), "hips")
    add(add_round_cube("ACC_SatchelFlap", (-.185,-.005,.765), (.090,.012,.050), green_dark, .010), "hips")
    add(add_round_cube("ACC_SatchelClasp", (-.185,-.020,.755), (.014,.008,.017), brass, .004), "hips")
    add(curve_lock("ACC_SatchelStrap", [(.12,-.11,1.14),(-.02,-.12,.98),(-.18,-.07,.77)], .010, leather), "spine")

    # Small botanical brooch from the character sheet's green/gold vocabulary.
    add(add_uv_sphere("ACC_Brooch", (0,-.135,1.135), (.022,.010,.022), brass, 16, 10), "spine")
    for sign in (-1,1):
        leaf = add_round_cube(f"ACC_BroochLeaf_{sign}", (.022*sign,-.139,1.145), (.024,.006,.010), green_dark, .005)
        leaf.rotation_euler[1] = math.radians(28*sign)
        apply_transform(leaf)
        add(leaf,"spine")

    # Bind all visible surfaces rigidly to the audited humanoid. Segment overlap and
    # garment coverage hide articulation seams; later DEFORMATION work may replace
    # these weights without changing the asset identity.
    for obj, human in visible:
        bone_name = human_names.get(human)
        if not bone_name:
            raise RuntimeError(f"No source bone for {human} ({obj.name})")
        bind_rigid(obj, armature, bone_name)

    # Keep only asset objects selected for export. Studio objects are excluded.
    for obj in bpy.context.scene.objects:
        obj.select_set(False)
    armature.select_set(True)
    for obj, _ in visible:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature

    # Save source before review-only camera/light staging can affect export ownership.
    blend_path = out / "source" / "ShinoReferenceV2.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_path = out / "export" / "ShinoReferenceV2.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(export_path),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
    )

    camera, ground = setup_studio()
    render_views(camera, out / "review")
    build_report = {
        "schema": "shino-reference-v2-dcc-build",
        "version": 1,
        "blender": bpy.app.version_string,
        "sourceVrm": str(args.source_vrm),
        "meshObjects": len(visible),
        "surfaces": {
            "skin": sum(1 for obj,_ in visible if obj.name.startswith("SKIN_")),
            "face": sum(1 for obj,_ in visible if obj.name.startswith("FACE_")),
            "hair": sum(1 for obj,_ in visible if obj.name.startswith("HAIR_")),
            "clothing": sum(1 for obj,_ in visible if obj.name.startswith("CLOTH_")),
            "accessories": sum(1 for obj,_ in visible if obj.name.startswith("ACC_")),
        },
        "referenceViews": ["front", "side", "back", "three-quarter"],
        "productionStageRequested": "PRIMARY",
        "visualApproval": "pending",
    }
    (out / "build.json").write_text(json.dumps(build_report, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(json.dumps(build_report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
