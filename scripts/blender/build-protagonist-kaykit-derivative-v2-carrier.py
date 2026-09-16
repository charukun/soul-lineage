#!/usr/bin/env python3
"""Carrier shim for the KayKit-derived village-start protagonist.

The protagonist is assembled from shipped CC0 KayKit character parts instead of a
procedural replacement body.  Knight remains the identity/proportion source: head,
arms, legs and Rig_Medium stay Knight-authored.  Only the torso clothing is swapped
to the same pack's Rogue_Body because Knight_Body contains the permanent knight badge.
No Rogue weapons/cape/accessories are retained.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bpy
from mathutils import Vector

BUILDER = Path(__file__).with_name("build-protagonist-kaykit-derivative-v2.py")
spec = importlib.util.spec_from_file_location("rinne_protagonist_kaykit_builder", BUILDER)
if spec is None or spec.loader is None:
    raise RuntimeError(f"Unable to load builder: {BUILDER}")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def reset_scene_with_world() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system = "METRIC"
    scene.unit_settings.scale_length = 1.0
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if scene.world is None:
        scene.world = bpy.data.worlds.new("RINNE Character Review World")
    scene.world.color = (0.035, 0.045, 0.05)


def _world_center(obj: bpy.types.Object, polygon: bpy.types.MeshPolygon) -> Vector:
    point = Vector((0.0, 0.0, 0.0))
    for vertex_index in polygon.vertices:
        point += obj.matrix_world @ obj.data.vertices[vertex_index].co
    return point / max(1, len(polygon.vertices))


def _world_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    if not points:
        zero = Vector((0.0, 0.0, 0.0))
        return zero.copy(), zero.copy()
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def _material_slots(obj: bpy.types.Object, materials: list[bpy.types.Material]) -> None:
    obj.data.materials.clear()
    for mat in materials:
        obj.data.materials.append(mat)


def _rebind_to_knight_rig(obj: bpy.types.Object, donor_armatures: list[bpy.types.Object], knight_armature: bpy.types.Object) -> None:
    donor_bones = {bone.name for armature in donor_armatures for bone in armature.data.bones}
    knight_bones = {bone.name for bone in knight_armature.data.bones}
    if donor_bones and not donor_bones.issubset(knight_bones):
        missing = sorted(donor_bones - knight_bones)
        raise RuntimeError(f"Rogue donor rig is not Rig_Medium-compatible: {missing}")

    world = obj.matrix_world.copy()
    for modifier in obj.modifiers:
        if modifier.type == "ARMATURE":
            modifier.object = knight_armature
    if obj.parent in donor_armatures:
        obj.parent = knight_armature
        obj.matrix_world = world


def add_rogue_tunic_donor(work_dir: Path, knight_armature: bpy.types.Object, meshes: list[bpy.types.Object]) -> tuple[list[bpy.types.Object], list[str]]:
    """Replace only Knight_Body with the same-pack Rogue_Body clothing shell.

    The Rogue body is almost dimension-identical and uses the same Rig_Medium bone
    names.  Its weapons, cape, head and limbs are discarded.  This removes the knight
    medal at the source instead of carving the badge out of a skinned torso.
    """
    rogue_path = module.download_verified(module.ROGUE, work_dir / module.ROGUE["file"])
    imported = module.import_gltf(rogue_path)
    rogue_armatures = [obj for obj in imported if obj.type == "ARMATURE"]
    bodies = [obj for obj in imported if obj.type == "MESH" and obj.name == "Rogue_Body"]
    if len(bodies) != 1:
        raise RuntimeError(f"Rogue.glb expected exactly one Rogue_Body, got {[obj.name for obj in bodies]}")
    rogue_body = bodies[0]

    knight_bodies = [obj for obj in meshes if "body" in obj.name.lower()]
    if len(knight_bodies) != 1:
        raise RuntimeError(f"Knight protagonist expected one body part before torso swap: {[obj.name for obj in knight_bodies]}")
    knight_body = knight_bodies[0]

    _rebind_to_knight_rig(rogue_body, rogue_armatures, knight_armature)
    rogue_body.name = "Protagonist_RogueTunic_Body"
    rogue_body["rinneSourceModel"] = "Rogue.glb"
    rogue_body["rinneSourcePart"] = "Rogue_Body"
    rogue_body["rinneUsage"] = "village-tunic-torso-only"

    result = [obj for obj in meshes if obj is not knight_body]
    module.remove_object(knight_body)
    result.append(rogue_body)

    # Hair is optional and only retained if the pack exposes an explicit hair object.
    hair = [
        obj for obj in imported
        if obj.type == "MESH" and obj.name.lower().startswith("rogue_") and "hair" in obj.name.lower()
    ]
    used_hair = []
    if not any("hair" in obj.name.lower() for obj in result):
        for obj in hair:
            _rebind_to_knight_rig(obj, rogue_armatures, knight_armature)
            obj.name = obj.name.replace("Rogue_", "Protagonist_KayKitHair_", 1)
            obj["rinneSourceModel"] = "Rogue.glb"
            obj["rinneUsage"] = "hair-only"
            result.append(obj)
            used_hair.append(obj.name)

    keep = {rogue_body, *[obj for obj in result if obj in hair]}
    for obj in imported:
        if obj not in keep:
            module.remove_object(obj)

    return result, used_hair


def _soften_knight_sleeve(obj: bpy.types.Object) -> None:
    if "arm" not in obj.name.lower() or not obj.data.vertices:
        return
    points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    radial = [abs(point.x) for point in points]
    start, end = min(radial), max(radial)
    span = max(end - start, 1e-6)
    shoulder = [point for point, distance in zip(points, radial) if (distance - start) / span <= 0.20]
    if not shoulder:
        return
    center_y = sum(point.y for point in shoulder) / len(shoulder)
    center_z = sum(point.z for point in shoulder) / len(shoulder)
    inverse = obj.matrix_world.inverted()
    for vertex, point, distance in zip(obj.data.vertices, points, radial):
        along = (distance - start) / span
        if along >= 0.42:
            continue
        t = max(0.0, min(1.0, along / 0.42))
        smooth = t * t * (3.0 - 2.0 * t)
        factor = 0.74 + 0.26 * smooth
        point.y = center_y + (point.y - center_y) * factor
        point.z = center_z + (point.z - center_z) * factor
        vertex.co = inverse @ point
    obj.data.update()


def villageize_source_parts(meshes: list[bpy.types.Object]) -> None:
    """Use source geometry unchanged apart from mild Knight sleeve softening."""
    linen = module.material("PROTAGONIST_LINEN", (0.52, 0.40, 0.26, 1.0))
    olive = module.material("PROTAGONIST_OLIVE", (0.15, 0.18, 0.075, 1.0))
    leather = module.material("PROTAGONIST_LEATHER", (0.085, 0.045, 0.020, 1.0))
    skin = module.material("PROTAGONIST_SKIN", (0.48, 0.28, 0.17, 1.0))

    for obj in meshes:
        name = obj.name.lower()
        if "head" in name or "hair" in name:
            continue

        if "body" in name:
            _material_slots(obj, [linen])
            for polygon in obj.data.polygons:
                polygon.material_index = 0
            continue

        if "arm" in name:
            _soften_knight_sleeve(obj)
            _material_slots(obj, [linen, skin])
            minimum, maximum = _world_bounds(obj)
            size = maximum - minimum
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                lateral = abs(point.x)
                outer = max(abs(minimum.x), abs(maximum.x))
                inner = min(abs(minimum.x), abs(maximum.x))
                along = (lateral - inner) / max(outer - inner, 1e-6)
                polygon.material_index = 1 if along >= 0.80 else 0
            continue

        if "leg" in name:
            _material_slots(obj, [olive, leather])
            minimum, maximum = _world_bounds(obj)
            size = maximum - minimum
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                vertical = (point.z - minimum.z) / max(size.z, 1e-6)
                polygon.material_index = 0 if vertical >= 0.48 else 1
            continue

        _material_slots(obj, [linen])
        for polygon in obj.data.polygons:
            polygon.material_index = 0


module.reset_scene = reset_scene_with_world
module.add_optional_kaykit_hair = add_rogue_tunic_donor
module.villageize_materials = villageize_source_parts
module.main()
