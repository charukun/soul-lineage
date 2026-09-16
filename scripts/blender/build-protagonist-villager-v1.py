"""Build the RINNE protagonist's humble village-start DCC candidate.

The audited humanoid rig is retained for animation compatibility. Visible surfaces are
rebuilt as a compact KayKit-family low-poly character with no armor, helmet, shield,
or military insignia. This is PRIMARY review evidence only; visualApproval remains
pending until the generated fixed-view renders are reviewed.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector

CHARACTER_ID = "protagonist.villager.v1"
REFERENCE_PATH = "docs/characters/references/protagonist-villager-v1.svg"
PALETTE = {
    "skin": (0.72, 0.48, 0.34, 1.0),
    "hair": (0.19, 0.14, 0.11, 1.0),
    "eyes": (0.08, 0.07, 0.06, 1.0),
    "linen": (0.72, 0.66, 0.53, 1.0),
    "linen_shadow": (0.57, 0.51, 0.40, 1.0),
    "trousers": (0.30, 0.34, 0.23, 1.0),
    "leather": (0.23, 0.16, 0.11, 1.0),
    "accent": (0.30, 0.40, 0.46, 1.0),
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


def ensure_uv(obj: bpy.types.Object) -> None:
    if obj.type == "MESH" and len(obj.data.uv_layers) == 0:
        obj.data.uv_layers.new(name="UVMap")


def material(name: str, rgba, roughness: float = 0.84) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = 0.0
    return mat


def bevel(obj: bpy.types.Object, width: float) -> None:
    modifier = obj.modifiers.new("Village bevel", "BEVEL")
    modifier.width = width
    modifier.segments = 1
    modifier.limit_method = "ANGLE"
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def bind_rigid(obj: bpy.types.Object, armature: bpy.types.Object, bone_name: str) -> None:
    ensure_uv(obj)
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    modifier = obj.modifiers.new("Village Humanoid", "ARMATURE")
    modifier.object = armature
    obj.parent = armature


def add_uv_sphere(name, location, scale, mat, armature, bone_name, segments=12, rings=8):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_round_cube(name, location, scale, mat, armature, bone_name, rotation=(0, 0, 0), radius=0.008):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    if radius > 0:
        bevel(obj, radius)
    obj.data.materials.append(mat)
    bind_rigid(obj, armature, bone_name)
    return obj


def add_segment(name, a: Vector, b: Vector, radius_a, radius_b, mat, armature, bone_name):
    delta = b - a
    length = delta.length
    if length < 1e-5:
        raise RuntimeError(f"Zero-length segment {name}")
    bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=radius_a, radius2=radius_b, depth=length, location=(a + b) * 0.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(delta.normalized())
    apply_transform(obj)
    obj.data.materials.append(mat)
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
    return {key: material("PROTAGONIST_" + key.upper(), value) for key, value in PALETTE.items()}


def build_character(armature, names, mats) -> None:
    head = bone_point(armature, names, "head")
    head_tail = bone_point(armature, names, "head", tail=True)
    head_center = head.lerp(head_tail, 0.62)
    spine = bone_point(armature, names, "spine")
    hips = bone_point(armature, names, "hips")

    add_uv_sphere("PROTAGONIST_Head", head_center, (0.145, 0.132, 0.155), mats["skin"], armature, names["head"])
    for side, x in (("L", -0.050), ("R", 0.050)):
        add_uv_sphere(f"PROTAGONIST_Eye_{side}", head_center + Vector((x, -0.126, 0.014)), (0.016, 0.008, 0.021), mats["eyes"], armature, names["head"], 8, 6)

    add_uv_sphere("PROTAGONIST_HairCap", head_center + Vector((0, 0.006, 0.058)), (0.151, 0.137, 0.108), mats["hair"], armature, names["head"], 10, 7)
    fringe = [
        (-0.082, -0.116, 0.068, -0.20), (-0.032, -0.132, 0.078, -0.07),
        (0.024, -0.132, 0.074, 0.08), (0.076, -0.112, 0.058, 0.22),
    ]
    for i, (x, y, z, rz) in enumerate(fringe):
        add_round_cube(f"PROTAGONIST_Fringe_{i}", head_center + Vector((x, y, z)), (0.038, 0.018, 0.070), mats["hair"], armature, names["head"], rotation=(0.14, 0, rz), radius=0.006)

    add_round_cube("PROTAGONIST_TunicTorso", spine + Vector((0, 0.002, 0.080)), (0.205, 0.135, 0.245), mats["linen"], armature, names["spine"], radius=0.018)
    add_round_cube("PROTAGONIST_TunicSkirtFront", hips + Vector((0, -0.052, -0.055)), (0.185, 0.045, 0.180), mats["linen_shadow"], armature, names["hips"], rotation=(0.03, 0, 0), radius=0.012)
    add_round_cube("PROTAGONIST_TunicSkirtBack", hips + Vector((0, 0.070, -0.055)), (0.180, 0.035, 0.170), mats["linen"], armature, names["hips"], rotation=(-0.03, 0, 0), radius=0.010)
    add_round_cube("PROTAGONIST_Neckline_L", spine + Vector((-0.045, -0.139, 0.190)), (0.050, 0.010, 0.016), mats["leather"], armature, names["spine"], rotation=(0, -0.30, -0.36), radius=0.003)
    add_round_cube("PROTAGONIST_Neckline_R", spine + Vector((0.045, -0.139, 0.190)), (0.050, 0.010, 0.016), mats["leather"], armature, names["spine"], rotation=(0, 0.30, 0.36), radius=0.003)

    for side in ("left", "right"):
        upper = side + "UpperArm"; lower = side + "LowerArm"; hand = side + "Hand"
        shoulder = bone_point(armature, names, upper); elbow = bone_point(armature, names, lower); wrist = bone_point(armature, names, hand)
        add_segment(f"PROTAGONIST_{side}_SleeveUpper", shoulder, elbow, 0.062, 0.052, mats["linen"], armature, names[upper])
        add_segment(f"PROTAGONIST_{side}_SleeveLower", elbow, wrist, 0.052, 0.038, mats["linen_shadow"], armature, names[lower])
        add_round_cube(f"PROTAGONIST_{side}_Cuff", elbow.lerp(wrist, 0.80), (0.047, 0.047, 0.035), mats["accent"], armature, names[lower], radius=0.006)
        add_uv_sphere(f"PROTAGONIST_{side}_Hand", wrist, (0.045, 0.036, 0.052), mats["skin"], armature, names[hand], 10, 6)

        upper_leg = side + "UpperLeg"; lower_leg = side + "LowerLeg"; foot = side + "Foot"
        thigh = bone_point(armature, names, upper_leg); knee = bone_point(armature, names, lower_leg); ankle = bone_point(armature, names, foot)
        add_segment(f"PROTAGONIST_{side}_TrouserUpper", thigh, knee, 0.075, 0.060, mats["trousers"], armature, names[upper_leg])
        add_segment(f"PROTAGONIST_{side}_TrouserLower", knee, ankle, 0.060, 0.047, mats["trousers"], armature, names[lower_leg])
        add_round_cube(f"PROTAGONIST_{side}_Boot", ankle + Vector((0, -0.040, -0.010)), (0.072, 0.112, 0.054), mats["leather"], armature, names[foot], rotation=(0.04, 0, 0), radius=0.010)

    add_round_cube("PROTAGONIST_Belt", hips + Vector((0, -0.004, 0.095)), (0.200, 0.130, 0.024), mats["leather"], armature, names["hips"], radius=0.006)
    add_round_cube("PROTAGONIST_BeltBuckle", hips + Vector((0, -0.139, 0.095)), (0.030, 0.012, 0.028), mats["linen_shadow"], armature, names["hips"], radius=0.004)
    add_round_cube("PROTAGONIST_Pouch", hips + Vector((0.190, -0.020, 0.030)), (0.070, 0.050, 0.085), mats["leather"], armature, names["hips"], rotation=(0, -0.08, 0.05), radius=0.010)
    add_round_cube("PROTAGONIST_PouchFlap", hips + Vector((0.190, -0.071, 0.085)), (0.072, 0.014, 0.030), mats["linen_shadow"], armature, names["hips"], rotation=(0, -0.08, 0.05), radius=0.004)
    add_round_cube("PROTAGONIST_HeroCloth", hips + Vector((-0.128, -0.100, -0.115)), (0.055, 0.018, 0.145), mats["accent"], armature, names["hips"], rotation=(0.06, 0.08, -0.08), radius=0.006)


def setup_scene() -> None:
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.035, 0.040, 0.050)
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            break
        except TypeError:
            continue
    else:
        raise RuntimeError("No supported Blender render engine is available")


def look_at(obj, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_views(out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.object.camera_add(location=(0, -3.8, 0.98))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.85
    bpy.context.scene.camera = camera
    for name, location, energy, size, color in [
        ("Key", (-2.6, -3.0, 3.4), 760, 3.5, (1.0, 0.90, 0.77)),
        ("Fill", (2.8, -1.8, 2.4), 430, 3.0, (0.76, 0.84, 1.0)),
        ("Rim", (0.3, 2.6, 2.9), 560, 2.8, (0.78, 0.87, 1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, Vector((0, 0, 0.72)))
    bpy.ops.mesh.primitive_plane_add(size=7, location=(0, 0, -0.01))
    ground = bpy.context.object
    ground.data.materials.append(material("PROTAGONIST_STUDIO_GROUND", (0.14, 0.15, 0.17, 1.0), 0.96))
    target = Vector((0, 0, 0.72))
    views = {
        "front": (0, -3.8, 0.98),
        "side": (3.8, 0, 0.98),
        "back": (0, 3.8, 0.98),
        "three-quarter": (2.7, -2.7, 1.04),
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
    armature.name = "ProtagonistVillagerRig"
    armature.scale = (1.05, 1.05, 0.72)
    apply_transform(armature)
    clear_source_meshes(armature)
    mats = setup_materials()
    build_character(armature, names, mats)

    blend_path = source_dir / "ProtagonistVillagerV1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    export_path = export_dir / "ProtagonistVillagerV1.glb"
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.parent == armature:
            obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(filepath=str(export_path), export_format="GLB", use_selection=True, export_skins=True, export_animations=False, export_yup=True)

    render_views(review_dir)
    mesh_objects = [obj for obj in bpy.data.objects if obj.type == "MESH" and obj.parent == armature]
    triangles = sum(max(0, len(poly.vertices) - 2) for obj in mesh_objects for poly in obj.data.polygons)
    build = {
        "schema": "protagonist-villager-dcc-build",
        "version": 1,
        "characterId": CHARACTER_ID,
        "referencePath": REFERENCE_PATH,
        "sourceRigSha256": sha256(source_vrm),
        "blenderVersion": bpy.app.version_string,
        "meshObjects": len(mesh_objects),
        "trianglesApprox": triangles,
        "materials": len({mat.name for obj in mesh_objects for mat in obj.data.materials if mat}),
        "styleFamily": "kaykit-compatible-rinne-low-poly",
        "role": "protagonist",
        "wardrobe": "humble-village-start",
        "armor": False,
        "blendSha256": sha256(blend_path),
        "glbSha256": sha256(export_path),
        "productionReady": False,
        "visualApproval": "pending",
    }
    (out / "build.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
