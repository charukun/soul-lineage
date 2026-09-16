#!/usr/bin/env python3
"""Build a Meshy-based RINNE protagonist / Shino review candidate.

The visible surface comes from one pinned public Meshy community model whose page
is declared CC0.  The runtime armature comes from the clean KayKit Rig_Medium DCC
candidate already built in this repository.  This first carrier pass is REFERENCE
stage only: it proves source acquisition, clean re-rigging, export and fixed-view
review without claiming topology, deformation, polish or runtime readiness.
"""
from __future__ import annotations

import argparse
import hashlib
import html
import json
import re
import struct
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import bpy
from mathutils import Vector

CHARACTER_ID = "protagonist.meshy-shino.v1"
ASSET_ID = "character.protagonist-meshy-shino.v1"
REFERENCE_PATH = "docs/characters/references/protagonist-villager-v1.svg"
MESHY_MODEL_ID = "0196ad16-605f-735d-9d1c-ec04032a2e02"
MESHY_AUTHOR = "ktmarine1999"
MESHY_LICENSE = "CC0-1.0"
MESHY_PAGE = (
    "https://www.meshy.ai/3d-models/"
    "A-stylized-3D-model-of-a-chibistyle-female-adventurer-A-young-hero-with-a-short-green-hoodie-"
    "under-a-light-brown-leather-tunic-dark-short-skirt-leather-boots-and-a-simple-belt-Tousled-long-"
    "brown-hair-and-expressive-bright-blue-eyes-Confident-pose-stylized-for-a-fantasy-actionadventure-"
    "gameStylized-Fantasy-Game-Assets-Legend-of-Zelda-Pixar-Style-World-of-Warcraft-Chibi-Full-Body-"
    f"APose-v2-{MESHY_MODEL_ID}"
)
MESHY_PAGE_FALLBACK = f"https://www.meshy.ai/3d-models/{MESHY_MODEL_ID}"
TARGET_HEIGHT = 1.85
MAX_SOURCE_BYTES = 80 * 1024 * 1024

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


def args_after_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, help="Repository-local clean KayKit rig donor GLB")
    parser.add_argument("--source-vrm", required=True, help="Original repository path recorded by carrier")
    parser.add_argument("--out", required=True)
    return parser.parse_args(args_after_dash())


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_name(value: str) -> str:
    return "".join(ch.lower() for ch in value if ch.isalnum())


def reset_scene() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("RINNE Meshy Character Review World")
    scene.world.color = (0.035, 0.045, 0.05)


def import_gltf(path: Path) -> list[bpy.types.Object]:
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    return [obj for obj in bpy.data.objects if obj not in before]


def remove_object(obj: bpy.types.Object) -> None:
    bpy.data.objects.remove(obj, do_unlink=True)


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
        for corner in obj.bound_box:
            point = obj.matrix_world @ Vector(corner)
            for axis in range(3):
                minimum[axis] = min(minimum[axis], point[axis])
                maximum[axis] = max(maximum[axis], point[axis])
    return minimum, maximum


def http_get(url: str, *, referer: str | None = None) -> tuple[bytes, str]:
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/126.0 Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
    }
    if referer:
        headers["Referer"] = referer
    request = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(request, timeout=90) as response:
        data = response.read(MAX_SOURCE_BYTES + 1)
        final_url = response.geturl()
    if len(data) > MAX_SOURCE_BYTES:
        raise RuntimeError(f"external source exceeds {MAX_SOURCE_BYTES} bytes: {url}")
    return data, final_url


def normalized_page_text(data: bytes) -> str:
    text = data.decode("utf-8", errors="replace")
    for _ in range(3):
        text = html.unescape(text)
        text = text.replace("\\/", "/").replace("\\u0026", "&").replace("\\u003d", "=")
    return text


def extract_glb_urls(text: str) -> list[str]:
    patterns = [
        r"https://assets\.meshy\.ai/[^\"'<>\s\\]+?\.glb(?:\?[^\"'<>\s\\]*)?",
        r"https://[^\"'<>\s\\]+?\.glb(?:\?[^\"'<>\s\\]*)?",
    ]
    found: list[str] = []
    for pattern in patterns:
        for value in re.findall(pattern, text, flags=re.IGNORECASE):
            value = value.rstrip(",);]}")
            if value not in found:
                found.append(value)
    return sorted(found, key=lambda value: ("pre_remeshed" in value.lower(), "model.glb" not in value.lower(), len(value)))


def fetch_meshy_source(out_dir: Path) -> tuple[Path, dict[str, object]]:
    failures: list[str] = []
    for page_url in (MESHY_PAGE, MESHY_PAGE_FALLBACK):
        try:
            page_bytes, final_page = http_get(page_url)
        except Exception as error:
            failures.append(f"page fetch {page_url}: {error}")
            continue
        text = normalized_page_text(page_bytes)
        lowered = text.lower()
        if MESHY_MODEL_ID.lower() not in lowered and MESHY_MODEL_ID.lower() not in final_page.lower():
            failures.append(f"page identity mismatch: {final_page}")
            continue
        if "cc0" not in lowered:
            failures.append(f"page did not expose CC0 license token: {final_page}")
            continue
        if MESHY_AUTHOR.lower() not in lowered:
            failures.append(f"page did not expose expected author {MESHY_AUTHOR}: {final_page}")
            continue
        urls = extract_glb_urls(text)
        if not urls:
            failures.append(f"page exposes no downloadable GLB URL without authenticated state: {final_page}")
            continue
        for asset_url in urls:
            try:
                payload, final_asset = http_get(asset_url, referer=final_page)
            except Exception as error:
                failures.append(f"GLB fetch {asset_url}: {error}")
                continue
            if len(payload) < 1024 or payload[:4] != b"glTF":
                failures.append(f"download was not GLB: {final_asset} bytes={len(payload)}")
                continue
            path = out_dir / "meshy-community-source.glb"
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(payload)
            return path, {
                "page": final_page,
                "modelId": MESHY_MODEL_ID,
                "author": MESHY_AUTHOR,
                "declaredLicense": MESHY_LICENSE,
                "downloadUrlHost": urllib.parse.urlparse(final_asset).netloc,
                "sourceSha256": sha256(path),
                "sourceBytes": path.stat().st_size,
            }
    raise RuntimeError(
        "Unable to materialize the exact public Meshy model without authenticated/mutable substitution. "
        + " | ".join(failures)
    )


def load_clean_rig(path: Path) -> bpy.types.Object:
    imported = import_gltf(path)
    armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"clean KayKit donor must contain exactly one armature, got {[obj.name for obj in armatures]}")
    armature = armatures[0]
    for obj in list(imported):
        if obj is not armature:
            remove_object(obj)
    armature.name = "ProtagonistMeshyShino_KayKitRig_Medium"
    armature["rinneRigProvenance"] = "kaykit.Rig_Medium.v1"
    apply_rotation_scale(armature)
    return armature


def detach_imported_rigs(imported: list[bpy.types.Object]) -> list[bpy.types.Object]:
    armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    meshes = [obj for obj in imported if obj.type == "MESH"]
    armature_set = set(armatures)
    for obj in meshes:
        world = obj.matrix_world.copy()
        for modifier in list(obj.modifiers):
            if modifier.type == "ARMATURE":
                obj.modifiers.remove(modifier)
        if obj.parent in armature_set:
            obj.parent = None
            obj.matrix_world = world
        for group in list(obj.vertex_groups):
            obj.vertex_groups.remove(group)
        apply_rotation_scale(obj)
    for obj in imported:
        if obj.type != "MESH":
            remove_object(obj)
    if not meshes:
        raise RuntimeError("Meshy source contains no mesh objects")
    return meshes


def normalize_meshy_scale(meshes: list[bpy.types.Object]) -> dict[str, float]:
    minimum, maximum = mesh_bounds(meshes)
    source_height = maximum.z - minimum.z
    if source_height <= 0.01:
        raise RuntimeError("Meshy source has no measurable character height")
    center = (minimum + maximum) * 0.5
    scale = TARGET_HEIGHT / source_height
    for obj in meshes:
        inverse = obj.matrix_world.inverted()
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            point.x = (point.x - center.x) * scale
            point.y = (point.y - center.y) * scale
            point.z = (point.z - minimum.z) * scale
            vertex.co = inverse @ point
        obj.data.update()
        apply_rotation_scale(obj)
    bpy.context.view_layer.update()
    return {"sourceHeight": round(source_height, 5), "targetHeight": TARGET_HEIGHT, "scale": round(scale, 6)}


def set_principled(material: bpy.types.Material, *, color: tuple[float, float, float, float] | None = None) -> None:
    material.use_nodes = True
    node = next((row for row in material.node_tree.nodes if row.type == "BSDF_PRINCIPLED"), None)
    if node is None:
        return
    if color is not None and "Base Color" in node.inputs:
        node.inputs["Base Color"].default_value = color
    if "Roughness" in node.inputs:
        node.inputs["Roughness"].default_value = 0.78
    if "Metallic" in node.inputs:
        node.inputs["Metallic"].default_value = min(node.inputs["Metallic"].default_value, 0.15)


def shino_material_pass(meshes: list[bpy.types.Object]) -> dict[str, list[str]]:
    changed: dict[str, list[str]] = {"hair": [], "green": [], "leather": [], "cream": []}
    seen: set[bpy.types.Material] = set()
    for obj in meshes:
        object_key = obj.name.lower()
        for material in obj.data.materials:
            if material is None or material in seen:
                continue
            seen.add(material)
            key = f"{object_key} {material.name.lower()}"
            if "hair" in key:
                set_principled(material, color=(0.31, 0.22, 0.16, 1.0))
                changed["hair"].append(material.name)
            elif any(token in key for token in ("hood", "green", "cape", "vest")):
                set_principled(material, color=(0.24, 0.34, 0.20, 1.0))
                changed["green"].append(material.name)
            elif any(token in key for token in ("boot", "belt", "leather", "strap", "bag")):
                set_principled(material, color=(0.25, 0.14, 0.075, 1.0))
                changed["leather"].append(material.name)
            elif any(token in key for token in ("shirt", "blouse", "cream", "linen")):
                set_principled(material, color=(0.76, 0.69, 0.55, 1.0))
                changed["cream"].append(material.name)
            else:
                set_principled(material)
    return changed


def shorten_named_hair(meshes: list[bpy.types.Object]) -> list[str]:
    minimum, maximum = mesh_bounds(meshes)
    height = maximum.z - minimum.z
    bob_line = minimum.z + height * 0.72
    adjusted: list[str] = []
    for obj in meshes:
        semantic = " ".join([obj.name.lower(), *[mat.name.lower() for mat in obj.data.materials if mat]])
        if "hair" not in semantic:
            continue
        inverse = obj.matrix_world.inverted()
        touched = False
        for vertex in obj.data.vertices:
            point = obj.matrix_world @ vertex.co
            if point.z < bob_line:
                point.z = bob_line + (point.z - bob_line) * 0.18
                vertex.co = inverse @ point
                touched = True
        if touched:
            obj.data.update()
            adjusted.append(obj.name)
    return adjusted


def ensure_uvs(meshes: list[bpy.types.Object]) -> list[str]:
    created: list[str] = []
    for obj in meshes:
        if len(obj.data.uv_layers) == 0:
            obj.data.uv_layers.new(name="UVMap")
            created.append(obj.name)
    return created


def bind_to_rig(meshes: list[bpy.types.Object], armature: bpy.types.Object) -> str:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    armature.select_set(True)
    bpy.context.view_layer.objects.active = armature
    method = "automatic-weights"
    try:
        bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    except Exception as error:
        method = f"armature-parent-fallback:{type(error).__name__}"
        bpy.ops.object.select_all(action="DESELECT")
        for obj in meshes:
            obj.parent = armature
            modifier = obj.modifiers.new(name="RINNE_KayKit_Rig", type="ARMATURE")
            modifier.object = armature
    for obj in meshes:
        obj["rinneVisibleSurfaceSource"] = f"meshy:{MESHY_MODEL_ID}"
        obj["rinneLicense"] = MESHY_LICENSE
        apply_rotation_scale(obj)
    apply_rotation_scale(armature)
    return method


def material(name: str, color: tuple[float, float, float, float]) -> bpy.types.Material:
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    set_principled(mat, color=color)
    return mat


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def configure_render() -> None:
    scene = bpy.context.scene
    for engine in ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE", "BLENDER_WORKBENCH"):
        try:
            scene.render.engine = engine
            break
        except Exception:
            continue


def render_views(meshes: list[bpy.types.Object], out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    configure_render()
    minimum, maximum = mesh_bounds(meshes)
    center = (minimum + maximum) * 0.5
    height = max(0.5, maximum.z - minimum.z)
    extent = max(height, maximum.x - minimum.x, maximum.y - minimum.y)
    bpy.ops.object.camera_add(location=(center.x, center.y - extent * 2.7, center.z + height * 0.06))
    camera = bpy.context.object
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = extent * 1.30
    bpy.context.scene.camera = camera
    for name, location, energy, size, color in [
        ("Key", (-2.7, -3.2, 3.5), 720, 3.6, (1.0, 0.91, 0.80)),
        ("Fill", (2.7, -1.6, 2.5), 380, 3.1, (0.76, 0.84, 1.0)),
        ("Rim", (0.4, 2.8, 3.0), 500, 2.8, (0.78, 0.88, 1.0)),
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
    ground.data.materials.append(material("MESHY_SHINO_STUDIO_GROUND", (0.14, 0.15, 0.17, 1.0)))
    distance = extent * 2.7
    views = {
        "front": (center.x, center.y - distance, center.z + height * 0.06),
        "side": (center.x + distance, center.y, center.z + height * 0.06),
        "back": (center.x, center.y + distance, center.z + height * 0.06),
        "three-quarter": (center.x + distance * 0.70, center.y - distance * 0.70, center.z + height * 0.10),
    }
    for name, location in views.items():
        camera.location = location
        look_at(camera, center)
        bpy.context.scene.render.filepath = str(out_dir / f"{name}.png")
        bpy.ops.render.render(write_still=True)


def glb_chunks(path: Path) -> tuple[dict, list[tuple[int, bytes]]]:
    data = path.read_bytes()
    if data[:4] != b"glTF" or struct.unpack_from("<I", data, 4)[0] != 2:
        raise RuntimeError("Expected GLB 2.0")
    if struct.unpack_from("<I", data, 8)[0] != len(data):
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


def patch_runtime_contract(path: Path, source_meta: dict[str, object]) -> int:
    document, chunks = glb_chunks(path)
    human_bones: dict[str, dict[str, int]] = {}
    for key, aliases in BONE_ALIASES.items():
        node = find_node(document, aliases)
        if node is not None:
            human_bones[key] = {"node": node}
    missing = [key for key in REQUIRED_HUMANOID if key not in human_bones]
    if missing:
        raise RuntimeError(f"KayKit Rig_Medium humanoid nodes missing after export: {missing}")
    document.setdefault("extensions", {})["VRMC_vrm"] = {
        "specVersion": "1.0",
        "meta": {
            "name": "RINNE Protagonist Meshy/Shino candidate",
            "version": "1",
            "authors": ["RINNE", MESHY_AUTHOR],
            "copyrightInformation": "Meshy community CC0 surface + KayKit CC0 Rig_Medium",
            "contactInformation": "",
            "references": [MESHY_PAGE],
            "thirdPartyLicenses": "Meshy community model: CC0; KayKit Character Pack Adventurers: CC0 1.0",
            "avatarPermission": "everyone",
            "commercialUsage": "personalProfit",
            "creditNotation": "unnecessary",
            "allowRedistribution": True,
            "modification": "allowModificationRedistribution",
            "allowExcessivelyViolentUsage": False,
            "allowExcessivelySexualUsage": False,
            "politicalOrReligiousUsage": "allow",
            "antisocialOrHateUsage": "disallow",
        },
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
        "visibleSurfaceSource": f"meshy:{MESHY_MODEL_ID}",
        "visibleSurfaceSha256": source_meta["sourceSha256"],
        "visibleSurfaceLicense": MESHY_LICENSE,
        "rigSource": "kaykit.Rig_Medium.v1",
        "referencePath": REFERENCE_PATH,
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


def main() -> None:
    args = parse_args()
    out = Path(args.out).resolve()
    source_dir = out / "source"
    export_dir = out / "export"
    review_dir = out / "review"
    input_dir = out / "input" / "meshy"
    for directory in (source_dir, export_dir, review_dir, input_dir):
        directory.mkdir(parents=True, exist_ok=True)

    reset_scene()
    rig_path = Path(args.source).resolve()
    armature = load_clean_rig(rig_path)
    meshy_path, source_meta = fetch_meshy_source(input_dir)
    imported = import_gltf(meshy_path)
    meshes = detach_imported_rigs(imported)
    scale_meta = normalize_meshy_scale(meshes)
    hair_adjusted = shorten_named_hair(meshes)
    material_changes = shino_material_pass(meshes)
    uv_created = ensure_uvs(meshes)
    bind_method = bind_to_rig(meshes, armature)

    armature["rinneVisibleSurfaceSource"] = f"meshy:{MESHY_MODEL_ID}"
    armature["rinneVisibleSurfaceSha256"] = source_meta["sourceSha256"]
    armature["rinneVisibleSurfaceLicense"] = MESHY_LICENSE
    armature["rinneCharacterId"] = CHARACTER_ID

    blend_path = source_dir / "ProtagonistMeshyShinoV1.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    export_path = export_dir / "ProtagonistMeshyShinoV1.glb"
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
        export_extras=True,
    )
    humanoid_count = patch_runtime_contract(export_path, source_meta)
    render_views(meshes, review_dir)

    triangles = sum(max(0, len(poly.vertices) - 2) for obj in meshes for poly in obj.data.polygons)
    materials = sorted({mat.name for obj in meshes for mat in obj.data.materials if mat})
    build = {
        "schema": "protagonist-meshy-shino-dcc-build",
        "version": 1,
        "characterId": CHARACTER_ID,
        "referencePath": REFERENCE_PATH,
        "blenderVersion": bpy.app.version_string,
        "productionStage": "REFERENCE",
        "visibleSurface": source_meta,
        "visibleSurfaceConstruction": "downloaded Meshy CC0 surface retained and re-rigged; no procedural humanoid replacement",
        "rig": {
            "id": "kaykit.Rig_Medium.v1",
            "donorSha256": sha256(rig_path),
            "bindMethod": bind_method,
        },
        "stylePass": {
            "goal": "current RINNE protagonist proportions with Shino moss/cream/leather palette and shorter named hair where semantic source parts allow",
            "scale": scale_meta,
            "hairAdjustedObjects": hair_adjusted,
            "materialChanges": material_changes,
            "uvLayersCreatedForReferenceAudit": uv_created,
        },
        "meshObjects": len(meshes),
        "trianglesApprox": triangles,
        "materials": len(materials),
        "humanoidBones": humanoid_count,
        "blendSha256": sha256(blend_path),
        "glbSha256": sha256(export_path),
        "visualApproval": "pending",
        "productionReady": False,
        "remainingGates": ["BLOCKOUT review", "PRIMARY topology/UV review", "DEFORMATION", "MOTION", "POLISH", "runtime performance", "visual approval"],
    }
    (out / "build.json").write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(build, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
