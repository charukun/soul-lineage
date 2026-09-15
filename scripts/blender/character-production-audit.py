"""Headless Blender audit for Character Production Pipeline v2.

Usage:
  blender --background character.blend --python scripts/blender/character-production-audit.py -- --out character-audit.json

This script records objective scene evidence only. It never grants visual approval.
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy


def args_after_double_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", required=True)
    parser.add_argument("--character-id", default="unknown")
    return parser.parse_args(args_after_double_dash())


def near(value: float, target: float, epsilon: float = 1e-4) -> bool:
    return abs(value - target) <= epsilon


def transform_applied(obj: bpy.types.Object) -> bool:
    return all(near(v, 1.0) for v in obj.scale) and all(near(v, 0.0) for v in obj.rotation_euler)


def triangulated_count(mesh: bpy.types.Mesh) -> int:
    return sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)


def main() -> None:
    args = parse_args()
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    materials = {slot.material.name for obj in meshes for slot in obj.material_slots if slot.material}
    uv_meshes = [obj.name for obj in meshes if len(obj.data.uv_layers) > 0]
    shape_keys = sorted({key.name for obj in meshes if obj.data.shape_keys for key in obj.data.shape_keys.key_blocks})
    unapplied = [obj.name for obj in meshes + armatures if not transform_applied(obj)]
    non_manifold_candidates = []
    for obj in meshes:
        mesh = obj.data
        if any(len(poly.vertices) < 3 for poly in mesh.polygons):
            non_manifold_candidates.append(obj.name)

    triangles = sum(triangulated_count(obj.data) for obj in meshes)
    vertices = sum(len(obj.data.vertices) for obj in meshes)
    bones = sum(len(obj.data.bones) for obj in armatures)

    report = {
        "schema": "character-dcc-audit",
        "version": 1,
        "characterId": args.character_id,
        "dcc": {"tool": "Blender", "version": bpy.app.version_string},
        "scene": {
            "unitSystem": bpy.context.scene.unit_settings.system,
            "scaleLength": bpy.context.scene.unit_settings.scale_length,
            "meshObjects": len(meshes),
            "armatures": len(armatures),
            "vertices": vertices,
            "triangles": triangles,
            "materials": len(materials),
            "uvMeshCount": len(uv_meshes),
            "shapeKeys": shape_keys,
            "bones": bones,
        },
        "checks": {
            "hasMesh": len(meshes) > 0,
            "singleArmature": len(armatures) == 1,
            "hasUVs": len(uv_meshes) == len(meshes) and len(meshes) > 0,
            "transformsApplied": len(unapplied) == 0,
            "noDegeneratePolygons": len(non_manifold_candidates) == 0,
        },
        "diagnostics": {
            "unappliedTransforms": unapplied,
            "meshesWithoutUV": sorted({obj.name for obj in meshes} - set(uv_meshes)),
            "degeneratePolygonMeshes": non_manifold_candidates,
        },
        "visualApproval": "pending",
        "note": "Objective DCC audit only. Topology quality, silhouette, deformation, materials, animation appeal and visual approval remain separate production gates."
    }

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    failures = [name for name, passed in report["checks"].items() if not passed]
    print(json.dumps(report, ensure_ascii=False, indent=2))
    if failures:
        raise SystemExit("Blender character audit failed: " + ", ".join(failures))


if __name__ == "__main__":
    main()
