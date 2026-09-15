"""Build a Blender-authored Arcanist Atlas comparison character.

The audited Shino humanoid armature is retained for compatibility, while all visible
meshes are rebuilt as a dedicated Arcanist DCC candidate. The output is review-only
PRIMARY evidence, not RUNTIME_READY approval.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

CHARACTER_ID = "arcanist.atlas-dcc.v1"
REFERENCE_PATH = "docs/characters/references/npc-role-set/arcanist.avif"

PALETTE = {
    "skin": (0.86, 0.70, 0.62, 1.0),
    "hair": (0.36, 0.30, 0.35, 1.0),
    "eyes": (0.38, 0.31, 0.52, 1.0),
    "primary": (0.30, 0.24, 0.42, 1.0),
    "secondary": (0.64, 0.58, 0.70, 1.0),
    "accent": (0.65, 0.54, 0.32, 1.0),
    "dark": (0.13, 0.11, 0.16, 1.0),
    "metal": (0.55, 0.52, 0.61, 1.0),
    "leather": (0.25, 0.18, 0.23, 1.0),
    "wood": (0.31, 0.23, 0.29, 1.0),
}


def args_after_double_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-vrm", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args_after_double_dash())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


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


def smooth(obj: bpy.types.Object) -> None:
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True


def ensure_uv(obj: bpy.types.Object) -> None:
    if obj.type == "MESH" and len(obj.data.uv_layers) == 0:
        obj.data.uv_layers.new(name="UVMap")


def material(name: str, rgba, roughness: float = 0.72, metallic: float = 0.0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    return mat


def bevel(obj: bpy.types.Object, width: float, segments: int = 3) -> None:
    mod = obj.modifiers.new("Atlas Bevel", "BEVEL")
    mod.width = width
    mod.segments = segments
    mod.limit_method = "ANGLE"
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def bind_rigid(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    ensure_uv(obj)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Atlas Humanoid", "ARMATURE")
    modifier.object = armature
    obj.parent = armature


def add_uv_sphere(name, location, scale, mat, armature, bone_name, segments=24, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_round_cube(name, location, scale, mat, armature, bone_name, rotation=(0, 0, 0), radius=0.012):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    bevel(obj, radius, 3)
    smooth(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_cylinder(name, location, radius, depth, mat, armature, bone_name, rotation=(0, 0, 0), vertices=18):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    apply_transform(obj)
    bevel(obj, min(radius * 0.18, 0.009), 3)
    smooth(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_torus(name, location, major, minor, mat, armature, bone_name, rotation=(0, 0, 0), scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, major_segments=28, minor_segments=8, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_segment(name, a: Vector, b: Vector, radius_a, radius_b, mat, armature, bone_name):
    delta = b - a
    length = delta.length
    if length < 1e-5:
        raise RuntimeError(f"Zero-length segment {name}")
    bpy.ops.mesh.primitive_cone_add(vertices=18, radius1=radius_a, radius2=radius_b, depth=length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    apply_transform(obj)
    bevel(obj, min(radius_a, radius_b) * 0.15, 3)
    smooth(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_curve_lock(name, points, radius, mat, armature, bone_name):
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
    curve.materials.append(mat)
    select_only(obj)
    bpy.ops.object.convert(target="MESH")
    smooth(obj)
    bind_rigid(obj, armature, bone_name)
    return obj


def bone_point(armature, names, human, tail=False) -> Vector:
    bone = armature.data.bones.get(names[human])
    if not bone:
        raise RuntimeError(f"Armature bone missing: {human} / {names[human]}")
    point = bone.tail_local if tail else bone.head_local
    return armature.matrix_world @ point


def clear_source_meshes(armature) -> None:
    for obj in list(bpy.context.scene.objects):
        if obj != armature and obj.type == "MESH":
            bpy.data.objects.remove(obj, do_unlink=True)


def setup_materials():
    return {
        "skin": material("ARC_SKIN", PALETTE["skin"], 0.78),
        "hair": material("ARC_HAIR", PALETTE["hair"], 0.82),
        "eyes": material("ARC_EYES", PALETTE["eyes"], 0.44),
        "primary": material("ARC_PRIMARY", PALETTE["primary"], 0.80),
        "secondary": material("ARC_SECONDARY", PALETTE["secondary"], 0.76),
        "accent": material("ARC_ACCENT", PALETTE["accent"], 0.55, 0.08),
        "dark": material("ARC_DARK", PALETTE["dark"], 0.88),
        "metal": material("ARC_METAL", PALETTE["metal"], 0.34, 0.68),
        "leather": material("ARC_LEATHER", PALETTE["leather"], 0.86),
        "wood": material("ARC_WOOD", PALETTE["wood"], 0.91),
    }


def build_character(armature, names, mats) -> None:
    head = bone_point(armature, names, "head")
    head_tail = bone_point(armature, names, "head", tail=True)
    head_center = head.lerp(head_tail, 0.58)
    spine = bone_point(armature, names, "spine")
    hips = bone_point(armature, names, "hips")

    add_uv_sphere("ARC_Head", head_center + Vector((0, -0.005, 0.005)), (0.105, 0.095, 0.128), mats["skin"], armature, names["head"])
    add_uv_sphere("ARC_Torso", spine + Vector((0, 0.005, 0.10)), (0.18, 0.125, 0.255), mats["secondary"], armature, names["spine"])
    add_uv_sphere("ARC_Hips", hips + Vector((0, 0, 0.065)), (0.16, 0.115, 0.135), mats["dark"], armature, names["hips"])

    for side, x in (("L", -0.038), ("R", 0.038)):
        add_uv_sphere(f"ARC_Eye_{side}", head_center + Vector((x, -0.088, 0.022)), (0.019, 0.008, 0.025), mats["eyes"], armature, names["head"], 16, 10)
        add_uv_sphere(f"ARC_Pupil_{side}", head_center + Vector((x, -0.095, 0.022)), (0.008, 0.004, 0.012), mats["dark"], armature, names["head"], 12, 8)
    add_round_cube("ARC_Mouth", head_center + Vector((0, -0.098, -0.028)), (0.026, 0.004, 0.004), mats["accent"], armature, names["head"], radius=0.003)

    for side, x in (("L", -0.042), ("R", 0.042)):
        add_torus(f"ARC_Glasses_{side}", head_center + Vector((x, -0.099, 0.022)), 0.034, 0.004, mats["metal"], armature, names["head"], rotation=(math.pi / 2, 0, 0), scale=(1.0, 0.82, 1.0))
    add_round_cube("ARC_Glasses_Bridge", head_center + Vector((0, -0.100, 0.022)), (0.025, 0.003, 0.003), mats["metal"], armature, names["head"], radius=0.002)

    add_uv_sphere("ARC_HairCap", head_center + Vector((0, 0.004, 0.055)), (0.116, 0.105, 0.105), mats["hair"], armature, names["head"])
    for side, x in (("L", -0.086), ("R", 0.086)):
        add_curve_lock(f"ARC_HairLock_{side}", [
            tuple(head_center + Vector((x, -0.035, 0.050))),
            tuple(head_center + Vector((x * 1.12, -0.030, -0.030))),
            tuple(head_center + Vector((x * 1.02, 0.000, -0.150))),
        ], 0.020, mats["hair"], armature, names["head"])
    add_torus("ARC_HairTie", head_center + Vector((0, 0.092, 0.010)), 0.040, 0.009, mats["accent"], armature, names["head"], rotation=(math.pi / 2, 0, 0))
    add_curve_lock("ARC_Ponytail", [
        tuple(head_center + Vector((0, 0.102, 0.020))),
        tuple(head_center + Vector((0.018, 0.128, -0.100))),
        tuple(head_center + Vector((-0.012, 0.110, -0.245))),
        tuple(head_center + Vector((0.025, 0.080, -0.355))),
    ], 0.034, mats["hair"], armature, names["head"])

    for side in ("left", "right"):
        upper = side + "UpperArm"; lower = side + "LowerArm"; hand = side + "Hand"
        upper_a = bone_point(armature, names, upper); upper_b = bone_point(armature, names, lower); lower_b = bone_point(armature, names, hand)
        add_segment(f"ARC_{side}_UpperArm", upper_a, upper_b, 0.050, 0.044, mats["secondary"], armature, names[upper])
        add_segment(f"ARC_{side}_LowerArm", upper_b, lower_b, 0.044, 0.035, mats["secondary"], armature, names[lower])
        add_uv_sphere(f"ARC_{side}_Hand", lower_b, (0.043, 0.034, 0.055), mats["skin"], armature, names[hand], 16, 10)
        add_cylinder(f"ARC_{side}_Cuff", upper_b.lerp(lower_b, 0.82), 0.052, 0.075, mats["accent"], armature, names[lower])

        upper_leg = side + "UpperLeg"; lower_leg = side + "LowerLeg"; foot = side + "Foot"
        hip_p = bone_point(armature, names, upper_leg); knee = bone_point(armature, names, lower_leg); ankle = bone_point(armature, names, foot)
        add_segment(f"ARC_{side}_Thigh", hip_p, knee, 0.066, 0.055, mats["dark"], armature, names[upper_leg])
        add_segment(f"ARC_{side}_Calf", knee, ankle, 0.054, 0.044, mats["dark"], armature, names[lower_leg])
        add_round_cube(f"ARC_{side}_Boot", ankle + Vector((0, -0.035, -0.010)), (0.065, 0.105, 0.052), mats["leather"], armature, names[foot], rotation=(0.05, 0, 0), radius=0.014)

    add_torus("ARC_Collar", spine + Vector((0, -0.005, 0.235)), 0.145, 0.023, mats["secondary"], armature, names["spine"], rotation=(math.pi / 2, 0, 0), scale=(1.05, 0.86, 0.72))
    add_uv_sphere("ARC_Mantle_L", spine + Vector((-0.150, 0.000, 0.165)), (0.145, 0.135, 0.065), mats["secondary"], armature, names["spine"], 20, 12)
    add_uv_sphere("ARC_Mantle_R", spine + Vector((0.150, 0.000, 0.165)), (0.145, 0.135, 0.065), mats["secondary"], armature, names["spine"], 20, 12)
    add_round_cube("ARC_Mantle_Back", spine + Vector((0, 0.105, 0.070)), (0.205, 0.026, 0.205), mats["secondary"], armature, names["spine"], rotation=(0.06, 0, 0), radius=0.018)
    add_round_cube("ARC_Lapel_L", spine + Vector((-0.060, -0.122, 0.060)), (0.055, 0.020, 0.205), mats["primary"], armature, names["spine"], rotation=(0, -0.15, -0.16), radius=0.010)
    add_round_cube("ARC_Lapel_R", spine + Vector((0.060, -0.122, 0.060)), (0.055, 0.020, 0.205), mats["primary"], armature, names["spine"], rotation=(0, 0.15, 0.16), radius=0.010)
    add_torus("ARC_Sash", hips + Vector((0, 0, 0.105)), 0.168, 0.014, mats["leather"], armature, names["hips"], rotation=(math.pi / 2, 0, 0), scale=(1.0, 0.84, 1.0))
    add_round_cube("ARC_RobePanel_L", hips + Vector((-0.083, -0.045, -0.155)), (0.088, 0.032, 0.285), mats["primary"], armature, names["hips"], rotation=(0.02, 0.03, -0.035), radius=0.012)
    add_round_cube("ARC_RobePanel_R", hips + Vector((0.083, -0.045, -0.155)), (0.088, 0.032, 0.285), mats["primary"], armature, names["hips"], rotation=(0.02, -0.03, 0.035), radius=0.012)
    add_round_cube("ARC_RobeHem_L", hips + Vector((-0.083, -0.050, -0.425)), (0.088, 0.035, 0.018), mats["accent"], armature, names["hips"], radius=0.008)
    add_round_cube("ARC_RobeHem_R", hips + Vector((0.083, -0.050, -0.425)), (0.088, 0.035, 0.018), mats["accent"], armature, names["hips"], radius=0.008)

    add_cylinder("ARC_ScrollTube_A", hips + Vector((-0.215, -0.070, 0.020)), 0.023, 0.245, mats["leather"], armature, names["hips"], rotation=(0.12, 0.05, -0.14))
    add_cylinder("ARC_ScrollTube_B", hips + Vector((-0.255, -0.055, 0.010)), 0.022, 0.220, mats["leather"], armature, names["hips"], rotation=(0.08, -0.04, -0.07))
    add_round_cube("ARC_Satchel", hips + Vector((0.215, 0.070, -0.025)), (0.105, 0.050, 0.135), mats["leather"], armature, names["hips"], rotation=(0, -0.10, 0.04), radius=0.018)
    add_round_cube("ARC_SatchelFlap", hips + Vector((0.215, 0.020, 0.075)), (0.108, 0.012, 0.045), mats["accent"], armature, names["hips"], rotation=(0, -0.10, 0.04), radius=0.008)

    right_hand = bone_point(armature, names, "rightHand")
    left_hand = bone_point(armature, names, "leftHand")
    add_cylinder("ARC_Staff", right_hand + Vector((0.030, 0.010, 0.420)), 0.012, 1.42, mats["wood"], armature, names["rightHand"], rotation=(0.0, 0.0, -0.08))
    add_uv_sphere("ARC_StaffGem", right_hand + Vector((0.030, 0.010, 1.130)), (0.058, 0.058, 0.058), mats["accent"], armature, names["rightHand"], 16, 10)
    add_torus("ARC_StaffHalo", right_hand + Vector((0.030, 0.010, 1.130)), 0.082, 0.010, mats["metal"], armature, names["rightHand"], rotation=(math.pi / 2, 0, 0))
    add_round_cube("ARC_Book", left_hand + Vector((-0.015, -0.050, 0.040)), (0.105, 0.036, 0.140), mats["leather"], armature, names["leftHand"], rotation=(0.08, 0.0, 0.12), radius=0.012)
    add_round_cube("ARC_BookPages", left_hand + Vector((-0.015, -0.088, 0.040)), (0.086, 0.012, 0.118), mats["secondary"], armature, names["leftHand"], rotation=(0.08, 0.0, 0.12), radius=0.006)


def setup_scene() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.040, 0.050)
    engines = {item.identifier for item in scene.bl_rna.properties["render_engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"


def look_at(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_views(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.camera_add(location=(0, -4.2, 1.15))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 2.10
    bpy.context.scene.camera = camera
    for name, location, energy, size, color in [
        ("Key", (-2.8, -3.2, 4.0), 850, 4.0, (1.0, 0.88, 0.75)),
        ("Fill", (3.0, -2.0, 2.6), 520, 3.5, (0.74, 0.84, 1.0)),
        ("Rim", (0.4, 2.8, 3.1), 700, 3.0, (0.76, 0.86, 1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, Vector((0, 0, 0.92)))
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -0.01))
    ground = bpy.context.object
    ground.data.materials.append(material("ARC_STUDIO_GROUND", (0.16, 0.17, 0.20, 1), 0.96))
    target = Vector((0, 0, 0.90))
    views = {
        "front": (0, -4.2, 1.10),
        "side": (4.2, 0, 1.10),
        "back": (0, 4.2, 1.10),
        "three-quarter": (3.0, -3.0, 1.18),
    }
    for name, location in views.items():
        camera.location = location
        look_at(camera, target)
        bpy.context.scene.render.filepath = str(out_dir / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    source = Path(args.source).resolve()
    source_vrm = Path(args.source_vrm).resolve()
    out = Path(args.out).resolve()
    source_dir = out / "source"
    export_dir = out / "export"
    review_dir = out / "review"
    source_dir.mkdir(parents=True, exist_ok=True)
    export_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    setup_scene()
    names = humanoid_names(source_vrm)
    bpy.ops.import_scene.gltf(filepath=str(source))
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected exactly one armature, got {len(armatures)}")
    armature = armatures[0]
    armature.name = "ArcanistAtlasRig"
    clear_source_meshes(armature)
    mats = setup_materials()
    build_character(armature, names, mats)

    blend_path = source_dir / "ArcanistAtlasDCC.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    export_path = export_dir / "ArcanistAtlasDCC.glb"
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.parent == armature:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(filepath=str(export_path), export_format="GLB", use_selection=True, export_skins=True, export_animations=False, export_yup=True)

    render_views(review_dir)
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.parent == armature]
    triangles = sum(len(poly.vertices) - 2 for obj in mesh_objects for poly in obj.data.polygons)
    build = {
        "schema": "arcanist-atlas-dcc-build",
        "version": 1,
        "characterId": CHARACTER_ID,
        "referencePath": REFERENCE_PATH,
        "sourceRigSha256": sha256(source_vrm),
        "blenderVersion": bpy.app.version_string,
        "meshObjects": len(mesh_objects),
        "trianglesApprox": triangles,
        "materials": len({mat.name for obj in mesh_objects for mat in obj.data.materials if mat}),
        "blendSha256": sha256(blend_path),
        "glbSha256": sha256(export_path),
        "productionReady": False,
        "visualApproval": "pending",
    }
    (out / "build.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
