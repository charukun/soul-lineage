"""Build and finalize protagonist village-start DCC GLB with VRM1 humanoid metadata."""
from __future__ import annotations

import argparse
import json
import runpy
import struct
import sys
from pathlib import Path

JSON_CHUNK = 0x4E4F534A
CHARACTER_ID = "protagonist.villager.v1"
BASE_BUILDER = Path("scripts/blender/build-protagonist-villager-v1.py")


def args_after_double_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True)
    parser.add_argument("--source-vrm", required=True)
    parser.add_argument("--out", required=True)
    return parser.parse_args(args_after_double_dash())


def read_glb(path: Path):
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise RuntimeError(f"Not a GLB/VRM: {path}")
    _, version, total = struct.unpack_from("<4sII", data, 0)
    if version != 2 or total != len(data):
        raise RuntimeError(f"Unsupported/corrupt GLB: {path}")
    offset = 12
    document = None
    chunks = []
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset:offset + length]
        offset += length
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.decode("utf-8").rstrip(" \t\r\n\x00"))
        else:
            chunks.append((chunk_type, payload))
    if document is None:
        raise RuntimeError(f"GLB JSON chunk missing: {path}")
    return document, chunks


def write_glb(path: Path, document, chunks):
    raw = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    raw += b" " * ((4 - len(raw) % 4) % 4)
    encoded = [struct.pack("<II", len(raw), JSON_CHUNK) + raw]
    for chunk_type, payload in chunks:
        padded = payload + b"\x00" * ((4 - len(payload) % 4) % 4)
        encoded.append(struct.pack("<II", len(padded), chunk_type) + padded)
    body = b"".join(encoded)
    path.write_bytes(struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body)


def patch_runtime_contract(source_vrm: Path, target_path: Path) -> int:
    source, _ = read_glb(source_vrm)
    target, chunks = read_glb(target_path)

    source_nodes = source.get("nodes", [])
    source_bones = source.get("extensions", {}).get("VRMC_vrm", {}).get("humanoid", {}).get("humanBones", {})
    human_names = {}
    for human, row in source_bones.items():
        index = row.get("node")
        if isinstance(index, int) and 0 <= index < len(source_nodes):
            name = source_nodes[index].get("name")
            if name:
                human_names[human] = name

    target_nodes = target.get("nodes", [])
    by_name = {row.get("name"): index for index, row in enumerate(target_nodes) if row.get("name")}
    human_bones = {}
    required = {
        "hips", "spine", "head",
        "leftUpperArm", "leftLowerArm", "leftHand",
        "rightUpperArm", "rightLowerArm", "rightHand",
        "leftUpperLeg", "leftLowerLeg", "leftFoot",
        "rightUpperLeg", "rightLowerLeg", "rightFoot",
    }
    missing = []
    for human, name in human_names.items():
        if name in by_name:
            human_bones[human] = {"node": by_name[name]}
        elif human in required:
            missing.append(f"{human}:{name}")
    if missing:
        raise RuntimeError("Exported protagonist GLB lost required humanoid nodes: " + ", ".join(missing))
    if not required.issubset(human_bones):
        absent = sorted(required - human_bones.keys())
        raise RuntimeError("Source rig lacks required humanoid contract: " + ", ".join(absent))

    source_meta = dict(source.get("extensions", {}).get("VRMC_vrm", {}).get("meta", {}))
    source_meta.pop("thumbnailImage", None)
    source_meta.update({
        "name": "RINNE Protagonist Villager v1",
        "version": "dcc-primary-v1",
        "authors": ["RINNE Character Production Pipeline", "VRoid Project / pixiv Inc. (rig provenance)"],
        "copyrightInformation": "Original RINNE protagonist village-start surfaces; humanoid rig derived from audited Sendagaya_Shino source",
        "licenseUrl": source_meta.get("licenseUrl", "https://vrm.dev/licenses/1.0/"),
    })
    target.setdefault("extensions", {})["VRMC_vrm"] = {
        "specVersion": "1.0",
        "meta": source_meta,
        "humanoid": {"humanBones": human_bones},
        "firstPerson": {},
        "lookAt": {"type": "bone"},
        "expressions": {"preset": {}, "custom": {}},
    }
    target["extensions"].pop("VRMC_springBone", None)
    used = [value for value in target.get("extensionsUsed", []) if value != "VRMC_springBone"]
    if "VRMC_vrm" not in used:
        used.append("VRMC_vrm")
    target["extensionsUsed"] = used
    target.setdefault("asset", {}).setdefault("extras", {})["rinneCharacter"] = {
        "id": CHARACTER_ID,
        "productionStage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "visualApproval": "pending",
    }
    write_glb(target_path, target, chunks)
    return len(human_bones)


def main() -> None:
    args = parse_args()
    runpy.run_path(str(BASE_BUILDER), run_name="__main__")
    target = Path(args.out).resolve() / "export" / "ProtagonistVillagerV1.glb"
    count = patch_runtime_contract(Path(args.source_vrm).resolve(), target)
    build_path = Path(args.out).resolve() / "build.json"
    build = json.loads(build_path.read_text(encoding="utf-8"))
    build["humanoidMetadata"] = "VRMC_vrm/1.0 restored from audited SHINO_review.vrm by bone name"
    build["humanoidBones"] = count
    import hashlib
    build["glbSha256"] = hashlib.sha256(target.read_bytes()).hexdigest()
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"characterId": CHARACTER_ID, "runtimeContract": "VRMC_vrm/1.0", "humanoidBones": count}, indent=2))


if __name__ == "__main__":
    main()
