#!/usr/bin/env python3
"""Build protagonist.villager.v1 from real KayKit character parts.

This builder deliberately does not synthesize a replacement humanoid body.  The
protagonist keeps KayKit Knight Rig_Medium proportions and copies the shipped
Knight_* mesh parts.  Military accessories are removed and the retained source
parts are re-materialed as humble village clothing.  If the free Knight has no
hair mesh, an optional hair-only donor is taken from the same pinned CC0 pack's
Rogue model.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
import sys
import urllib.request
from pathlib import Path

import bpy
from mathutils import Vector

CHARACTER_ID = "protagonist.villager.v1"
ASSET_ID = "character.protagonist-villager.v1"
SOURCE_REPOSITORY = "KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0"
SOURCE_REVISION = "672074b73ba276876a19e8816ecdc5241817ab47"
SOURCE_BASE = f"https://raw.githubusercontent.com/{SOURCE_REPOSITORY}/{SOURCE_REVISION}/addons/kaykit_character_pack_adventures/Characters/gltf"
KNIGHT = {
    "file": "Knight.glb",
    "gitBlobSha": "717b56ca2b5ff5392679774725201ba03a3eefab",
    "bytes": 3659532,
}
ROGUE = {
    "file": "Rogue.glb",
    "gitBlobSha": "c8827661105eef7b2bfbef3bc676d41a47625733",
    "bytes": 3616284,
}
REFERENCE_PATH = "docs/characters/references/protagonist-villager-v1.svg"
TARGET_HEIGHT = 1.85

# Keep torso/limb geometry even if it was originally knightly; a material pass
# turns it into cloth/leather. Remove only unmistakably military silhouette pieces.
MILITARY_TOKENS = (
    "helmet", "helm", "pauldron", "shoulder", "cape", "cloak", "crest",
    "shield", "sword", "weapon", "scabbard",
)

BONE_ALIASES = {
    "hips": ("hips",),
    "spine": ("spine",),
    "chest": ("chest",),
    "head": ("head",),
    "leftUpperArm": ("upperarm.l", "leftupperarm"),
    "leftLowerArm": ("lowerarm.l", "leftlowerarm"),
    "leftHand": ("hand.l", "lefthand"),
    "leftUpperLeg": ("upperleg.l", "leftupperleg"),
    "leftLowerLeg": ("lowerleg.l", "leftlowerleg"),
    "leftFoot": ("foot.l", "leftfoot"),
    "rightUpperArm": ("upperarm.r", "rightupperarm"),
    "rightLowerArm": ("lowerarm.r", "rightlowerarm"),
    "rightHand": ("hand.r", "righthand"),
    "rightUpperLeg": ("upperleg.r", "rightupperleg"),
    "rightLowerLeg": ("lowerleg.r", "rightlowerleg"),
    "rightFoot": ("foot.r", "rightfoot"),
}
REQUIRED_HUMANOID = tuple(key for key in BONE_ALIASES if key != "chest")

PALETTE = {
    "linen": (0.72, 0.65, 0.50, 1.0),
    "olive": (0.30, 0.34, 0.22, 1.0),
    "leather": (0.22, 0.14, 0.09, 1.0),
    "accent": (0.30, 0.40, 0.46, 1.0),
}


def args_after_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-vrm", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args_after_dash())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def download_verified(spec: dict[str, object], destination: Path) -> Path:
    url = f"{SOURCE_BASE}/{spec['file']}"
    request = urllib.request.Request(url, headers={"User-Agent": "RINNE-Character-DCC-Carrier"})
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read()
    if len(data) != spec["bytes"]:
        raise RuntimeError(f"{spec['file']} byte length mismatch: {len(data)} != {spec['bytes']}")
    actual = git_blob_sha(data)
    if actual != spec["gitBlobSha"]:
        raise RuntimeError(f"{spec['file']} git blob mismatch: {actual} != {spec['gitBlobSha']}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(data)
    return destination


def normalize_name(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def source_meshes(prefix: str) -> list[bpy.types.Object]:
    key = prefix.lower()
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.name.lower().startswith(key)]


def remove_object(obj: bpy.types.Object) -> None:
    bpy.data.objects.remove(obj, do_unlink=True)


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    scene.world.color = (0.035, 0.045, 0.05)


def import_gltf(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.data.objects if obj not in before]


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    node = next((n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
    if node is None:
        node = mat.node_tree.nodes.new("ShaderNodeBsdfPrincipled")
    node.inputs["Base Color"].default_value = color
    node.inputs["Roughness"].default_value = 0.86
    node.inputs["Metallic"].default_value = 0.0
    return mat


def category_for(obj: bpy.types.Object) -> str | None:
    text = obj.name.lower()
    # Preserve official source skin / head / hair shading where it exists.
    if any(token in text for token in ("head", "face", "hair", "eye", "skin")):
        return None
    if any(token in text for token in ("boot", "shoe", "glove", "belt", "strap", "bracer", "gauntlet", "greave")):
        return "leather"
    if any(token in text for token in ("leg", "pant", "trouser")):
        return "olive"
    if any(token in text for token in ("trim", "sash", "cloth", "tabard")):
        return "accent"
    return "linen"


def villageize_materials(meshes: list[bpy.types.Object]) -> None:
    mats = {key: material(f"PROTAGONIST_{key.upper()}", value) for key, value in PALETTE.items()}
    for obj in meshes:
        category = category_for(obj)
        if category is None:
            continue
        obj.data.materials.clear()
        obj.data.materials.append(mats[category])


def apply_rotation_scale(obj: bpy.types.Object) -> None:
    if all(abs(v - 1.0) < 1e-6 for v in obj.scale) and all(abs(v) < 1e-6 for v in obj.rotation_euler):
        return
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    obj.select_set(False)


def mesh_bounds(meshes: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    minimum = Vector((float("inf"),) * 3)
    maximum = Vector((float("-inf"),) * 3)
    for obj in meshes:
        obj.update_from_editmode()
        for corner in obj.bound_box:
            world = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                minimum[axis] = min(minimum[axis], world[axis])
                maximum[axis] = max(maximum[axis], world[axis])
    return minimum, maximum


def add_optional_kaykit_hair(work_dir: Path, knight_armature: bpy.types.Object, meshes: list[bpy.types.Object]) -> tuple[list[bpy.types.Object], list[str]]:
    if any("hair" in obj.name.lower() for obj in meshes):
        return meshes, []
    rogue_path = download_verified(ROGUE, work_dir / ROGUE["file"])
    imported = import_gltf(rogue_path)
    rogue_armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    hair = [obj for obj in imported if obj.type == "MESH" and obj.name.lower().startswith("rogue_") and "hair" in obj.name.lower()]
    used = []
    for obj in hair:
        world = obj.matrix_world.copy()
        for modifier in obj.modifiers:
            if modifier.type == "ARMATURE":
                modifier.object = knight_armature
        if obj.parent in rogue_armatures:
            obj.parent = knight_armature
            obj.matrix_world = world
        obj.name = obj.name.replace("Rogue_", "Protagonist_KayKitHair_", 1)
        used.append(obj.name)
    for obj in imported:
        if obj not in hair:
            remove_object(obj)
    return meshes + hair, used


def prepare_kaykit_character(work_dir: Path) -> tuple[bpy.types.Object, list[bpy.types.Object], dict[str, object]]:
    knight_path = download_verified(KNIGHT, work_dir / KNIGHT["file"])
    imported = import_gltf(knight_path)
    armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Knight.glb expected one armature, got {len(armatures)}")
    armature = armatures[0]
    all_knight = [obj for obj in imported if obj.type == "MESH" and obj.name.startswith("Knight_")]
    if len(all_knight) < 3:
        raise RuntimeError(f"Knight.glb did not expose expected Knight_* parts: {[o.name for o in all_knight]}")
    military = [obj for obj in all_knight if any(token in obj.name.lower() for token in MILITARY_TOKENS)]
    kept = [obj for obj in all_knight if obj not in military]
    # Do not destroy the source body if a pack revision collapses parts. Removing sword/shield
    # is guaranteed by prefix filtering; the soft military filter is only used when enough real
    # body parts remain to preserve a coherent silhouette.
    if len(kept) < 3:
        military = [obj for obj in military if any(token in obj.name.lower() for token in ("helmet", "helm", "shield", "sword", "weapon"))]
        kept = [obj for obj in all_knight if obj not in military]
    keep_set = {armature, *kept}
    removed = []
    for obj in list(imported):
        if obj not in keep_set:
            removed.append(obj.name)
            remove_object(obj)
    armature.name = "ProtagonistKayKitRig_Medium"
    for obj in kept:
        obj.name = obj.name.replace("Knight_", "Protagonist_KnightPart_", 1)
    kept, hair_donor = add_optional_kaykit_hair(work_dir, armature, kept)
    villageize_materials(kept)

    minimum, maximum = mesh_bounds(kept)
    source_height = maximum.z - minimum.z
    if source_height <= 0.1:
        raise RuntimeError("KayKit protagonist has no measurable height")
    scale = TARGET_HEIGHT / source_height
    armature.scale = (scale, scale, scale)
    apply_rotation_scale(armature)
    for obj in kept:
        apply_rotation_scale(obj)
    bpy.context.view_layer.update()

    return armature, kept, {
        "sourceHeight": round(source_height, 4),
        "targetHeight": TARGET_HEIGHT,
        "sourceParts": [obj.name for obj in kept],
        "removedParts": removed,
        "hairDonorParts": hair_donor,
    }


def glb_chunks(path: Path) -> tuple[dict, list[tuple[int, bytes]]]:
    data = path.read_bytes()
    if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise RuntimeError("Expected GLB 2.0")
    total = struct.unpack_from("<I", data, 8)[0]
    if total != len(data):
        raise RuntimeError("GLB length mismatch")
    offset = 12
    document = None
    chunks: list[tuple[int, bytes]] = []
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset:offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            document = json.loads(payload.rstrip(b" \t\r\n\0").decode("utf-8"))
        else:
            chunks.append((chunk_type, payload))
    if document is None:
        raise RuntimeError("GLB JSON chunk missing")
    return document, chunks


def find_node(document: dict, aliases: tuple[str, ...]) -> int | None:
    wanted = tuple(normalize_name(alias) for alias in aliases)
    rows = document.get("nodes", [])
    for index, node in enumerate(rows):
        name = normalize_name(node.get("name", ""))
        if name in wanted:
            return index
    for index, node in enumerate(rows):
        name = normalize_name(node.get("name", ""))
        if any(name.endswith(alias) for alias in wanted):
            return index
    return None


def patch_runtime_contract(path: Path) -> int:
    document, chunks = glb_chunks(path)
    human_bones = {}
    for key, aliases in BONE_ALIASES.items():
        node = find_node(document, aliases)
        if node is not None:
            human_bones[key] = {"node": node}
    missing = [key for key in REQUIRED_HUMANOID if key not in human_bones]
    if missing:
        names = [row.get("name", "") for row in document.get("nodes", [])]
        raise RuntimeError(f"KayKit Rig_Medium humanoid nodes missing: {missing}; nodes={names}")

    meta = {
        "name": "RINNE Protagonist Villager / KayKit derivative",
        "version": "2",
        "authors": ["RINNE"],
        "copyrightInformation": "KayKit Character Pack Adventurers CC0 1.0 derivative",
        "contactInformation": "",
        "references": [f"https://github.com/{SOURCE_REPOSITORY}/tree/{SOURCE_REVISION}"],
        "thirdPartyLicenses": "KayKit Character Pack Adventurers: CC0 1.0",
        "avatarPermission": "everyone",
        "commercialUsage": "personalProfit",
        "creditNotation": "unnecessary",
        "allowRedistribution": True,
        "modification": "allowModificationRedistribution",
        "allowExcessivelyViolentUsage": False,
        "allowExcessivelySexualUsage": False,
        "politicalOrReligiousUsage": "allow",
        "antisocialOrHateUsage": "disallow",
    }
    document.setdefault("extensions", {})["VRMC_vrm"] = {
        "specVersion": "1.0",
        "meta": meta,
        "humanoid": {"humanBones": human_bones},
        "expressions": {"preset": {}, "custom": {}},
    }
    used = document.setdefault("extensionsUsed", [])
    if "VRMC_vrm" not in used:
        used.append("VRMC_vrm")
    document.setdefault("asset", {}).setdefault("extras", {})["rinneCharacter"] = {
        "id": CHARACTER_ID,
        "assetId": ASSET_ID,
        "modelingMode": "dcc-blender",
        "sourceFamily": "kaykit.adventurers.v1",
        "sourceRevision": SOURCE_REVISION,
        "sourceModel": "Knight.glb",
        "sourceGitBlobSha": KNIGHT["gitBlobSha"],
        "license": "CC0-1.0",
    }

    json_bytes = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    json_bytes += b" " * ((4 - len(json_bytes) % 4) % 4)
    encoded = bytearray(b"glTF" + struct.pack("<I", 2) + b"\0\0\0\0")
    encoded.extend(struct.pack("<II", len(json_bytes), 0x4E4F534A))
    encoded.extend(json_bytes)
    for chunk_type, payload in chunks:
        encoded.extend(struct.pack("<II", len(payload), chunk_type))
        encoded.extend(payload)
    struct.pack_into("<I", encoded, 8, len(encoded))
    path.write_bytes(encoded)
    return len(human_bones)


def configure_render() -> None:
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_views(meshes: list[bpy.types.Object], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    configure_render()
    minimum, maximum = mesh_bounds(meshes)
    center = (minimum + maximum) * 0.5
    height = max(0.5, maximum.z - minimum.z)
    extent = max(height, maximum.x - minimum.x, maximum.y - minimum.y)
    bpy.ops.object.camera_add(location=(center.x, center.y - extent * 2.6, center.z + height * 0.08))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.28
    bpy.context.scene.camera = camera
    for name, location, energy, size, color in [
        ("Key", (-2.6, -3.0, 3.4), 720, 3.5, (1.0, 0.90, 0.77)),
        ("Fill", (2.8, -1.8, 2.4), 390, 3.0, (0.76, 0.84, 1.0)),
        ("Rim", (0.3, 2.6, 2.9), 500, 2.8, (0.78, 0.87, 1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        light.name = name
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, center)
    bpy.ops.mesh.primitive_plane_add(size=max(5.0, extent * 4.0), location=(center.x, center.y, minimum.z - 0.01))
    ground = bpy.context.object
    ground.data.materials.append(material("PROTAGONIST_STUDIO_GROUND", (0.14, 0.15, 0.17, 1.0)))
    distance = extent * 2.6
    views = {
        "front": (center.x, center.y - distance, center.z + height * 0.08),
        "side": (center.x + distance, center.y, center.z + height * 0.08),
        "back": (center.x, center.y + distance, center.z + height * 0.08),
        "three-quarter": (center.x + distance * 0.70, center.y - distance * 0.70, center.z + height * 0.11),
    }
    for name, location in views.items():
        camera.location = location
        look_at(camera, center)
        bpy.context.scene.render.filepath = str(out_dir / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def main() -> None:
    args = parse_args()
    out = Path(args.out).resolve()
    source_dir = out / "source"
    export_dir = out / "export"
    review_dir = out / "review"
    work_dir = out / "input" / "kaykit"
    for directory in (source_dir, export_dir, review_dir, work_dir):
        directory.mkdir(parents=True, exist_ok=True)

    reset_scene()
    armature, meshes, provenance = prepare_kaykit_character(work_dir)

    # DCC truth is saved before review cameras/lights/ground are added.
    blend_path = source_dir / "ProtagonistVillagerV1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    export_path = export_dir / "ProtagonistVillagerV1.glb"
    bpy.ops.object.select_all(action="DESELECT")
    armature.select_set(True)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = armature
    bpy.ops.export_scene.gltf(
        filepath=str(export_path),
        export_format="GLB",
        use_selection=True,
        export_skins=True,
        export_animations=False,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
    )
    humanoid_count = patch_runtime_contract(export_path)
    render_views(meshes, review_dir)

    triangles = sum(max(0, len(poly.vertices) - 2) for obj in meshes for poly in obj.data.polygons)
    materials = sorted({mat.name for obj in meshes for mat in obj.data.materials if mat})
    build = {
        "schema": "protagonist-villager-dcc-build",
        "version": 2,
        "characterId": CHARACTER_ID,
        "referencePath": REFERENCE_PATH,
        "blenderVersion": bpy.app.version_string,
        "meshObjects": len(meshes),
        "trianglesApprox": triangles,
        "materials": len(materials),
        "styleFamily": "kaykit.adventurers.v1",
        "construction": "kaykit-source-part-reuse",
        "role": "protagonist",
        "wardrobe": "humble-village-start",
        "armor": False,
        "sourceRepository": SOURCE_REPOSITORY,
        "sourceRevision": SOURCE_REVISION,
        "sourceModel": KNIGHT,
        "optionalHairDonor": ROGUE if provenance["hairDonorParts"] else None,
        "sourceParts": provenance["sourceParts"],
        "removedParts": provenance["removedParts"],
        "hairDonorParts": provenance["hairDonorParts"],
        "sourceHeight": provenance["sourceHeight"],
        "targetHeight": provenance["targetHeight"],
        "rigFamily": "Rig_Medium",
        "license": "CC0-1.0",
        "blendSha256": sha256(blend_path),
        "glbSha256": sha256(export_path),
        "productionReady": False,
        "visualApproval": "pending",
        "humanoidMetadata": "VRMC_vrm/1.0 mapped onto KayKit Rig_Medium bones",
        "humanoidBones": humanoid_count,
    }
    (out / "build.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
