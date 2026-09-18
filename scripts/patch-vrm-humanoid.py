#!/usr/bin/env python3
"""Patch a Blender GLB with VRM 1.0 humanoid metadata from the audited Shino rig.

Only humanoid/meta metadata is transferred. Spring-bone/expression node indices from
source are intentionally not copied because the DCC model owns different meshes.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

JSON_CHUNK = 0x4E4F534A
BIN_CHUNK = 0x004E4942


def read_glb(path: Path) -> tuple[dict, list[tuple[int, bytes]]]:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b"glTF":
        raise SystemExit(f"Not a GLB/VRM: {path}")
    _, version, total = struct.unpack_from("<4sII", data, 0)
    if version != 2 or total != len(data):
        raise SystemExit("Unsupported/corrupt GLB")
    offset = 12
    document = None
    chunks: list[tuple[int, bytes]] = []
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        payload = data[offset : offset + length]
        offset += length
        if chunk_type == JSON_CHUNK:
            document = json.loads(payload.decode("utf-8").rstrip(" \t\r\n\x00"))
        else:
            chunks.append((chunk_type, payload))
    if document is None:
        raise SystemExit("GLB JSON chunk missing")
    return document, chunks


def write_glb(path: Path, document: dict, chunks: list[tuple[int, bytes]]) -> None:
    raw = json.dumps(document, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    raw += b" " * ((4 - len(raw) % 4) % 4)
    encoded = [struct.pack("<II", len(raw), JSON_CHUNK) + raw]
    for chunk_type, payload in chunks:
        padded = payload + b"\x00" * ((4 - len(payload) % 4) % 4)
        encoded.append(struct.pack("<II", len(padded), chunk_type) + padded)
    body = b"".join(encoded)
    header = struct.pack("<4sII", b"glTF", 2, 12 + len(body))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(header + body)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-vrm", required=True)
    parser.add_argument("--input", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    source, _ = read_glb(Path(args.source_vrm))
    target, chunks = read_glb(Path(args.input))

    source_nodes = source.get("nodes", [])
    source_bones = source.get("extensions", {}).get("VRMC_vrm", {}).get("humanoid", {}).get("humanBones", {})
    names: dict[str, str] = {}
    for human, row in source_bones.items():
        index = row.get("node")
        if isinstance(index, int) and 0 <= index < len(source_nodes):
            name = source_nodes[index].get("name")
            if name:
                names[human] = name

    target_nodes = target.get("nodes", [])
    by_name = {row.get("name"): i for i, row in enumerate(target_nodes) if row.get("name")}
    human_bones = {}
    missing = []
    for human, name in names.items():
        if name in by_name:
            human_bones[human] = {"node": by_name[name]}
        elif human in {"hips","spine","head","leftUpperArm","leftLowerArm","leftHand","rightUpperArm","rightLowerArm","rightHand","leftUpperLeg","leftLowerLeg","leftFoot","rightUpperLeg","rightLowerLeg","rightFoot"}:
            missing.append(f"{human}:{name}")
    if missing:
        raise SystemExit("Exported GLB lost required humanoid nodes: " + ", ".join(missing))

    source_meta = dict(source.get("extensions", {}).get("VRMC_vrm", {}).get("meta", {}))
    source_meta.pop("thumbnailImage", None)
    source_meta.update({
        "name": "Shino Reference v2",
        "version": "dcc-primary-v1",
        "authors": ["RINNE Character Production Pipeline", "VRoid Project / pixiv Inc. (rig provenance)"],
        "copyrightInformation": "Original DCC surfaces for Shino Reference v2; humanoid rig derived from audited Sendagaya_Shino source",
        "licenseUrl": source_meta.get("licenseUrl", "https://vrm.dev/licenses/1.0/"),
    })

    vrm = {
        "specVersion": "1.0",
        "meta": source_meta,
        "humanoid": {"humanBones": human_bones},
        "firstPerson": {},
        "lookAt": {"type": "bone"},
        "expressions": {"preset": {}, "custom": {}},
    }
    target.setdefault("extensions", {})["VRMC_vrm"] = vrm
    used = list(target.get("extensionsUsed", []))
    if "VRMC_vrm" not in used:
        used.append("VRMC_vrm")
    target["extensionsUsed"] = used
    # Blender exports no VRM spring metadata for the new rigid hair surfaces. Do not
    # carry source spring indices across meshes/armatures.
    target.get("extensions", {}).pop("VRMC_springBone", None)
    target["asset"].setdefault("extras", {})["rinneCharacter"] = {
        "id": "shino.reference.v2",
        "productionStage": "PRIMARY",
        "modelingMode": "dcc-blender",
        "visualApproval": "pending",
    }

    write_glb(Path(args.output), target, chunks)
    print(json.dumps({"output": args.output, "humanoidBones": len(human_bones), "nodes": len(target_nodes)}, indent=2))


if __name__ == "__main__":
    main()
