#!/usr/bin/env python3
"""Blender Carrier entrypoint for the KayKit-derived protagonist builder.

The real KayKit Knight meshes and Rig_Medium remain the authored source. This shim
only supplies carrier/runtime compatibility plus conservative part-level edits that
turn those copied Knight pieces into humble village clothing. No replacement body is
synthesized.
"""
from __future__ import annotations

import importlib.util
from pathlib import Path

import bmesh
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


def _face_components(obj: bpy.types.Object) -> list[list[int]]:
    vertex_faces: dict[int, list[int]] = {}
    for polygon in obj.data.polygons:
        for vertex in polygon.vertices:
            vertex_faces.setdefault(vertex, []).append(polygon.index)
    unseen = {polygon.index for polygon in obj.data.polygons}
    components: list[list[int]] = []
    while unseen:
        seed = unseen.pop()
        stack = [seed]
        component = [seed]
        while stack:
            face_index = stack.pop()
            polygon = obj.data.polygons[face_index]
            for vertex in polygon.vertices:
                for neighbor in vertex_faces.get(vertex, ()):
                    if neighbor in unseen:
                        unseen.remove(neighbor)
                        stack.append(neighbor)
                        component.append(neighbor)
        components.append(component)
    return components


def _remove_knight_chest_badge(obj: bpy.types.Object) -> int:
    """Remove only the loose asymmetric Knight crest components from the copied body.

    The badge and chevron are disconnected islands on the source Body mesh. We delete
    those islands through bmesh vertex deletion so the authored torso shell, skinning,
    UVs and all mirrored clothing panels remain intact.
    """
    if "body" not in obj.name.lower() or not obj.data.vertices:
        return 0
    minimum, maximum = _world_bounds(obj)
    size = maximum - minimum
    center = (minimum + maximum) * 0.5
    remove_vertices: set[int] = set()
    removed_components = 0
    for faces in _face_components(obj):
        if len(faces) > 20:
            continue
        centers = [_world_center(obj, obj.data.polygons[index]) for index in faces]
        if not centers:
            continue
        point = sum(centers, Vector((0.0, 0.0, 0.0))) / len(centers)
        vertical = (point.y - minimum.y) / max(size.y, 1e-6)
        on_badge_side = point.x < center.x - size.x * 0.18
        on_front = point.z > center.z + size.z * 0.22
        in_chest_band = 0.48 <= vertical <= 0.82
        if on_badge_side and on_front and in_chest_band:
            removed_components += 1
            for face_index in faces:
                remove_vertices.update(obj.data.polygons[face_index].vertices)
    if not remove_vertices:
        return 0

    mesh = obj.data
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bm.verts.ensure_lookup_table()
    targets = [bm.verts[index] for index in sorted(remove_vertices) if index < len(bm.verts)]
    bmesh.ops.delete(bm, geom=targets, context="VERTS")
    bm.to_mesh(mesh)
    bm.free()
    mesh.update()
    return removed_components


def _soften_knight_sleeve(obj: bpy.types.Object) -> None:
    """Pull the copied Knight shoulder shell inward without changing arm length/rig."""
    if "arm" not in obj.name.lower() or not obj.data.vertices:
        return
    world_points = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    radial = [abs(point.x) for point in world_points]
    start, end = min(radial), max(radial)
    span = max(end - start, 1e-6)
    shoulder_points = [
        point for point, distance in zip(world_points, radial)
        if (distance - start) / span <= 0.20
    ]
    if not shoulder_points:
        return
    center_y = sum(point.y for point in shoulder_points) / len(shoulder_points)
    center_z = sum(point.z for point in shoulder_points) / len(shoulder_points)
    inverse = obj.matrix_world.inverted()
    for vertex, point, distance in zip(obj.data.vertices, world_points, radial):
        along = (distance - start) / span
        if along >= 0.42:
            continue
        t = max(0.0, min(1.0, along / 0.42))
        smooth = t * t * (3.0 - 2.0 * t)
        factor = 0.76 + 0.24 * smooth
        point.y = center_y + (point.y - center_y) * factor
        point.z = center_z + (point.z - center_z) * factor
        vertex.co = inverse @ point
    obj.data.update()


def _material_slots(obj: bpy.types.Object, materials: list[bpy.types.Material]) -> None:
    obj.data.materials.clear()
    for mat in materials:
        obj.data.materials.append(mat)


def villageize_source_parts(meshes: list[bpy.types.Object]) -> None:
    """Dress copied Knight pieces as linen sleeves, bare hands, trousers and boots."""
    linen = module.material("PROTAGONIST_LINEN", (0.36, 0.26, 0.15, 1.0))
    olive = module.material("PROTAGONIST_OLIVE", (0.15, 0.18, 0.075, 1.0))
    leather = module.material("PROTAGONIST_LEATHER", (0.085, 0.045, 0.020, 1.0))
    skin = module.material("PROTAGONIST_SKIN", (0.48, 0.28, 0.17, 1.0))
    accent = module.material("PROTAGONIST_BLUE_GRAY", (0.12, 0.20, 0.25, 1.0))

    for obj in meshes:
        name = obj.name.lower()
        if "head" in name or "hair" in name:
            continue
        if "body" in name:
            _remove_knight_chest_badge(obj)
        if "arm" in name:
            _soften_knight_sleeve(obj)

        minimum, maximum = _world_bounds(obj)
        size = maximum - minimum

        if "arm" in name:
            _material_slots(obj, [linen, leather, skin])
            abs_x = [abs((obj.matrix_world @ vertex.co).x) for vertex in obj.data.vertices]
            start, end = min(abs_x), max(abs_x)
            span = max(end - start, 1e-6)
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                along = (abs(point.x) - start) / span
                polygon.material_index = 2 if along >= 0.82 else 1 if along >= 0.68 else 0
            continue

        if "leg" in name:
            _material_slots(obj, [olive, leather])
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                vertical = (point.y - minimum.y) / max(size.y, 1e-6)
                polygon.material_index = 0 if vertical >= 0.56 else 1
            continue

        if "body" in name:
            _material_slots(obj, [linen, leather, accent])
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                vertical = (point.y - minimum.y) / max(size.y, 1e-6)
                if 0.075 <= vertical <= 0.145:
                    polygon.material_index = 1
                elif vertical >= 0.90:
                    polygon.material_index = 2
                else:
                    polygon.material_index = 0
            continue

        _material_slots(obj, [linen])
        for polygon in obj.data.polygons:
            polygon.material_index = 0


module.reset_scene = reset_scene_with_world
module.villageize_materials = villageize_source_parts
module.main()
