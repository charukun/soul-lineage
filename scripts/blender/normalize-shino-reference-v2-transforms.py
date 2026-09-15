"""Normalize authored detail transforms for Shino Reference v2.

This post-pass keeps the production audit strict. It bakes rotation/scale only on
boot-eyelet detail meshes that are intentionally rotated during authoring, then
re-saves the Blender source and re-exports the GLB from that normalized source.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import bpy


PREFIXES = ("DETAIL_BootEyelet_", "DETAIL_BootEyelet2_")


def args_after_double_dash() -> list[str]:
    return sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--glb", required=True)
    return parser.parse_args(args_after_double_dash())


def select_only(obj: bpy.types.Object) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def main() -> None:
    args = parse_args()
    blend_path = Path(args.blend).resolve()
    glb_path = Path(args.glb).resolve()
    glb_path.parent.mkdir(parents=True, exist_ok=True)

    targets = [
        obj
        for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.name.startswith(PREFIXES)
    ]
    if len(targets) != 20:
        raise RuntimeError(f"Expected 20 boot eyelet meshes, found {len(targets)}")

    normalized = []
    for obj in targets:
        select_only(obj)
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
        normalized.append(obj.name)

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))

    rig = bpy.data.objects.get("ShinoReferenceV2Rig")
    if rig is None:
        raise RuntimeError("ShinoReferenceV2Rig missing after transform normalization")

    bpy.ops.object.select_all(action="DESELECT")
    rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.name != "ReviewGround":
            obj.select_set(True)
    bpy.context.view_layer.objects.active = rig
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        use_selection=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
    )

    print(f"Normalized {len(normalized)} authored detail transforms")
    for name in normalized:
        print(name)


if __name__ == "__main__":
    main()
