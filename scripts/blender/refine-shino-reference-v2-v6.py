"""Visual correction pass 6 for Shino Reference v2.

Pass 5 proved that blending source rest matrices without bone-length scaling can
produce visually catastrophic limb stretching while still passing structural DCC
audits. This pass replaces that body with the audited skin topology again, but
uses one dominant VRM humanoid bone per vertex and explicitly scales coordinates
along each bone by target/source bone length before placing them in the Reference
v2 rest pose. Secondary J_Sec bones are deliberately excluded at PRIMARY stage.

The result is intentionally conservative: deformation blending is still a later
production gate, but PRIMARY review must remain visually coherent.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


CORE_HUMANS = {
    'hips', 'spine', 'chest', 'upperChest', 'neck', 'head',
    'leftShoulder', 'leftUpperArm', 'leftLowerArm', 'leftHand',
    'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
    'leftUpperLeg', 'leftLowerLeg', 'leftFoot', 'leftToes',
    'rightUpperLeg', 'rightLowerLeg', 'rightFoot', 'rightToes',
}


def cli():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-vrm', required=True)
    parser.add_argument('--out', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b'glTF':
        raise RuntimeError(f'Not a GLB/VRM: {path}')
    _, version, total = struct.unpack_from('<4sII', data, 0)
    if version != 2 or total != len(data):
        raise RuntimeError('Unsupported GLB header')
    offset = 12
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from('<II', data, offset)
        offset += 8
        payload = data[offset:offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            return json.loads(payload.decode('utf-8').rstrip(' \t\r\n\x00'))
    raise RuntimeError('GLB JSON chunk missing')


def humanoid_names(path: Path) -> dict[str, str]:
    doc = glb_json(path)
    nodes = doc.get('nodes', [])
    rows = doc.get('extensions', {}).get('VRMC_vrm', {}).get('humanoid', {}).get('humanBones', {})
    result = {}
    for human, row in rows.items():
        index = row.get('node')
        if human in CORE_HUMANS and isinstance(index, int) and 0 <= index < len(nodes):
            name = nodes[index].get('name')
            if name:
                result[human] = name
    return result


def mat_name(obj, index):
    if index < 0 or index >= len(obj.material_slots):
        return ''
    mat = obj.material_slots[index].material
    return mat.name.lower() if mat else ''


def body_material(name):
    return 'body' in name and 'skin' in name and 'face' not in name


def copy_body_surface(source):
    allowed = {i for i in range(len(source.material_slots)) if body_material(mat_name(source, i))}
    if not allowed:
        return None
    obj = source.copy()
    obj.data = source.data.copy()
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = [face for face in bm.faces if face.material_index not in allowed]
    if dead:
        bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()
    obj.data.update()
    if not obj.data.polygons:
        bpy.data.objects.remove(obj, do_unlink=True)
        return None
    return obj


def select(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def remove_shape_keys(obj):
    if not obj.data.shape_keys:
        return
    select(obj)
    while obj.data.shape_keys and obj.data.shape_keys.key_blocks:
        obj.shape_key_remove(obj.data.shape_keys.key_blocks[-1])


def nearest_bone(source_point, source_rig, allowed_names):
    best = None
    best_distance = float('inf')
    for name in allowed_names:
        bone = source_rig.data.bones.get(name)
        if not bone:
            continue
        midpoint = (bone.head_local + bone.tail_local) * 0.5
        distance = (source_point - midpoint).length_squared
        if distance < best_distance:
            best_distance = distance
            best = name
    return best


def transfer_body(obj, source_rig, target_rig, allowed_names):
    remove_shape_keys(obj)
    source_inv = source_rig.matrix_world.inverted()
    source_obj_world = obj.matrix_world.copy()
    target_world = target_rig.matrix_world.copy()
    group_names = {i: group.name for i, group in enumerate(obj.vertex_groups)}
    usable = {
        name for name in allowed_names
        if source_rig.data.bones.get(name) and target_rig.data.bones.get(name)
    }
    if not usable:
        raise RuntimeError('No shared core humanoid bones for body transfer')

    assignments: dict[str, list[int]] = {}
    ratios = []
    fallback_count = 0
    for vertex in obj.data.vertices:
        source_point = source_inv @ (source_obj_world @ vertex.co)
        candidates = [
            (membership.weight, group_names.get(membership.group))
            for membership in vertex.groups
            if membership.weight > 0 and group_names.get(membership.group) in usable
        ]
        if candidates:
            _, bone_name = max(candidates, key=lambda row: row[0])
        else:
            bone_name = nearest_bone(source_point, source_rig, usable)
            fallback_count += 1
        source_bone = source_rig.data.bones[bone_name]
        target_bone = target_rig.data.bones[bone_name]
        source_length = max(source_bone.length, 1e-5)
        target_length = max(target_bone.length, 1e-5)
        length_ratio = target_length / source_length
        radial_ratio = max(0.58, min(1.08, math.sqrt(length_ratio)))
        local = source_bone.matrix_local.inverted() @ source_point
        # Blender bone local +Y follows the bone. Scale axial length explicitly;
        # preserve a fuller chibi silhouette radially rather than uniformly shrinking.
        local.x *= radial_ratio
        local.y *= length_ratio
        local.z *= radial_ratio
        target_point = target_bone.matrix_local @ local
        vertex.co = target_world @ target_point
        assignments.setdefault(bone_name, []).append(vertex.index)
        ratios.append(length_ratio)

    obj.matrix_world = Matrix.Identity(4)
    obj.parent = None
    for modifier in list(obj.modifiers):
        obj.modifiers.remove(modifier)
    obj.vertex_groups.clear()
    for bone_name, indices in assignments.items():
        group = obj.vertex_groups.new(name=bone_name)
        group.add(indices, 1.0, 'REPLACE')
    modifier = obj.modifiers.new('Shino Reference Humanoid PRIMARY', 'ARMATURE')
    modifier.object = target_rig
    obj.parent = target_rig
    obj.matrix_parent_inverse = target_rig.matrix_world.inverted()
    if not obj.data.uv_layers:
        obj.data.uv_layers.new(name='UVMap')
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return {
        'vertices': len(obj.data.vertices),
        'assignedBones': len(assignments),
        'fallbackVertices': fallback_count,
        'minLengthRatio': min(ratios) if ratios else None,
        'maxLengthRatio': max(ratios) if ratios else None,
    }


def material(name):
    return bpy.data.materials.get(name)


def studio():
    scene = bpy.context.scene
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (.028, .035, .039)
    try:
        scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except (TypeError, ValueError):
        scene.render.engine = 'BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0, -4, 1))
    camera = bpy.context.object
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = 1.82
    scene.camera = camera
    for position, energy, size, color in [
        ((-2.5, -3.4, 4), 900, 4, (1, .84, .68)),
        ((3, -1.8, 2.5), 500, 3.5, (.72, .84, 1)),
        ((.4, 2.8, 3.2), 750, 3, (.72, .84, 1)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light = bpy.context.object
        light.data.energy = energy
        light.data.size = size
        light.data.color = color
        light.rotation_euler = (Vector((0, 0, .84)) - light.location).to_track_quat('-Z', 'Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, -.005))
    ground = bpy.context.object
    ground.name = 'ReviewGround'
    ground.data.materials.append(material('MAT_CLOTH_GREEN_DARK'))
    return camera, ground


def render(camera, out):
    out.mkdir(parents=True, exist_ok=True)
    target = Vector((0, 0, .84))
    views = {
        'front': (0, -3.6, .92),
        'side': (3.6, 0, .92),
        'back': (0, 3.6, .92),
        'three-quarter': (2.55, -2.55, 1.08),
    }
    for name, position in views.items():
        camera.location = position
        camera.rotation_euler = (target - camera.location).to_track_quat('-Z', 'Y').to_euler()
        bpy.context.scene.render.filepath = str(out / f'{name}.png')
        bpy.ops.render.render(write_still=True)


def main():
    args = cli()
    out = Path(args.out).resolve()
    target_rig = bpy.data.objects.get('ShinoReferenceV2Rig')
    if not target_rig:
        raise RuntimeError('Main Reference rig missing')

    old_body = bpy.data.objects.get('SKIN_DCC_BodyBasemesh')
    if old_body:
        bpy.data.objects.remove(old_body, do_unlink=True)

    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.source_vrm).resolve()))
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    source_rigs = [obj for obj in imported if obj.type == 'ARMATURE']
    if len(source_rigs) != 1:
        raise RuntimeError(f'Expected one source armature, found {len(source_rigs)}')
    source_rig = source_rigs[0]

    candidates = []
    for source in [obj for obj in imported if obj.type == 'MESH']:
        candidate = copy_body_surface(source)
        if candidate is not None:
            candidates.append(candidate)
    if not candidates:
        raise RuntimeError('Audited source has no Body SKIN material subset')
    body = max(candidates, key=lambda obj: len(obj.data.vertices))
    for candidate in candidates:
        if candidate != body:
            bpy.data.objects.remove(candidate, do_unlink=True)

    human = humanoid_names(Path(args.source_vrm))
    stats = transfer_body(body, source_rig, target_rig, set(human.values()))
    for obj in imported:
        if obj == body:
            continue
        if obj.name in bpy.context.scene.objects:
            bpy.data.objects.remove(obj, do_unlink=True)
    body.name = 'SKIN_DCC_BodyBasemesh'

    blend = out / 'source' / 'ShinoReferenceV2.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT')
    target_rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH' and obj.name != 'ReviewGround':
            obj.select_set(True)
    bpy.context.view_layer.objects.active = target_rig
    bpy.ops.export_scene.gltf(
        filepath=str(out / 'export' / 'ShinoReferenceV2.glb'),
        export_format='GLB',
        use_selection=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_apply=False,
    )

    camera, _ = studio()
    render(camera, out / 'review')
    build_path = out / 'build.json'
    build = json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement'] = {
        'version': 6,
        'auditedFaceDonor': True,
        'auditedBodyBasemesh': True,
        'bodyRestTransfer': 'dominant-humanoid-length-scaled',
        'bodyWeighting': 'single-dominant-bone-primary',
        **stats,
        'faceSkinning': 'pending-deformation-stage',
        'bodyBlendSkinning': 'pending-deformation-stage',
        'sourceHairReused': False,
        'sourceClothingReused': False,
        'sourceBodySkinTopologyReused': True,
        'visualApproval': 'pending',
    }
    build_path.write_text(json.dumps(build, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(build['refinement'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
