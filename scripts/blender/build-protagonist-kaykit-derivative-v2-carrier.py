#!/usr/bin/env python3
"""Blender Carrier entrypoint for the KayKit-derived protagonist builder.

The real KayKit Knight meshes and Rig_Medium remain the authored source.  This shim
only supplies carrier/runtime compatibility and a village-clothing material pass; it
does not synthesize a replacement body.
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
    minimum = Vector(tuple(min(point[axis] for point in points) for axis in range(3)))
    maximum = Vector(tuple(max(point[axis] for point in points) for axis in range(3)))
    return minimum, maximum


def _face_components(obj: bpy.types.Object) -> list[list[int]]:
    vertex_faces: dict[int, list[int]] = {}
    for polygon in obj.data.polygons:
        for vertex in polygon.vertices:
            vertex_faces.setdefault(vertex, []).append(polygon.index)
    unseen = {polygon.index for polygon in obj.data.polygons}
    components = []
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


def _remove_asymmetric_chest_ornament(obj: bpy.types.Object) -> None:
    """Remove Knight's loose one-sided chest badge while keeping mirrored body panels."""
    if "Body" not in obj.name:
        return
    minimum, maximum = _world_bounds(obj)
    size = maximum - minimum
    center = (minimum + maximum) * 0.5
    components = []
    for faces in _face_components(obj):
        centers = [_world_center(obj, obj.data.polygons[index]) for index in faces]
        point = sum(centers, Vector((0.0, 0.0, 0.0))) / len(centers)
        components.append({"faces": faces, "point": point, "count": len(faces)})

    candidates = []
    for component in components:
        point = component["point"]
        vertical = (point.z - minimum.z) / max(size.z, 1e-6)
        front = point.y < center.y - size.y * 0.04
        off_center = abs(point.x - center.x) > size.x * 0.08
        if component["count"] <= 20 and 0.40 <= vertical <= 0.80 and front and off_center:
            candidates.append(component)

    remove = set()
    for component in candidates:
        point = component["point"]
        mirrored_x = 2 * center.x - point.x
        mirrored = any(
            other is not component
            and abs(other["point"].x - mirrored_x) <= size.x * 0.045
            and abs(other["point"].z - point.z) <= size.z * 0.045
            and abs(other["point"].y - point.y) <= size.y * 0.055
            and abs(other["count"] - component["count"]) <= max(2, component["count"] * 0.40)
            for other in components
        )
        if not mirrored:
            remove.update(component["faces"])
    if not remove:
        return
    for polygon in obj.data.polygons:
        polygon.select = polygon.index in remove
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.delete(type="FACE")
    bpy.ops.object.mode_set(mode="OBJECT")
    obj.select_set(False)


def _material_slots(obj: bpy.types.Object, materials: list[bpy.types.Material]) -> None:
    obj.data.materials.clear()
    for mat in materials:
        obj.data.materials.append(mat)


def villageize_source_parts(meshes: list[bpy.types.Object]) -> None:
    """Reassign the copied Knight parts as cloth, bare hands, trousers and boots."""
    linen = module.material("PROTAGONIST_LINEN", (0.36, 0.26, 0.15, 1.0))
    olive = module.material("PROTAGONIST_OLIVE", (0.15, 0.18, 0.075, 1.0))
    leather = module.material("PROTAGONIST_LEATHER", (0.085, 0.045, 0.020, 1.0))
    skin = module.material("PROTAGONIST_SKIN", (0.48, 0.28, 0.17, 1.0))
    accent = module.material("PROTAGONIST_BLUE_GRAY", (0.12, 0.20, 0.25, 1.0))

    for obj in meshes:
        name = obj.name.lower()
        if "head" in name or "hair" in name:
            continue
        _remove_asymmetric_chest_ornament(obj)
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
                vertical = (point.z - minimum.z) / max(size.z, 1e-6)
                polygon.material_index = 0 if vertical >= 0.56 else 1
            continue

        if "body" in name:
            _material_slots(obj, [linen, leather, accent])
            for polygon in obj.data.polygons:
                point = _world_center(obj, polygon)
                vertical = (point.z - minimum.z) / max(size.z, 1e-6)
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
