"""Blender-only static-mesh normalization. Run with --background --factory-startup."""
import argparse
import json
import math
from pathlib import Path
import sys
import bpy
from mathutils import Matrix, Vector


def triangles(obj):
    obj.data.calc_loop_triangles()
    return len(obj.data.loop_triangles)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--request', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    settings = json.loads(Path(args.request).read_text())['postprocess']
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    bpy.ops.import_scene.gltf(filepath=str(Path(args.input).resolve()))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == 'MESH']
    if not meshes or any(obj.modifiers or obj.vertex_groups for obj in meshes):
        raise ValueError('STATIC_GENERATED_MESH_REQUIRED')
    before = sum(triangles(obj) for obj in meshes)
    for obj in meshes:
        world = obj.matrix_world.copy()
        obj.parent = None
        obj.matrix_world = world
    for obj in list(bpy.context.scene.objects):
        if obj not in meshes:
            bpy.data.objects.remove(obj, do_unlink=True)
    bpy.ops.object.select_all(action='DESELECT')
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = 'RINNE_Experimental_Generated_Prop'
    rotation = Matrix.Rotation(math.radians(settings['yawDegrees']), 4, 'Z')
    for vertex in obj.data.vertices:
        vertex.co = rotation @ vertex.co
        if not all(math.isfinite(value) for value in vertex.co):
            raise ValueError('NONFINITE_VERTEX')
    bounds = [[min(v.co[i] for v in obj.data.vertices) for i in range(3)],
              [max(v.co[i] for v in obj.data.vertices) for i in range(3)]]
    height = bounds[1][2] - bounds[0][2]
    if height < 1e-6:
        raise ValueError('DEGENERATE_SOURCE_HEIGHT')
    scale = settings['heightMeters'] / height
    offset = Vector(((bounds[0][0]+bounds[1][0])/2, (bounds[0][1]+bounds[1][1])/2, bounds[0][2]))
    for vertex in obj.data.vertices:
        vertex.co = (vertex.co - offset) * scale
    limit = settings['maxTriangles']
    for attempt in range(2):
        count = triangles(obj)
        if count <= limit:
            break
        modifier = obj.modifiers.new('Explicit triangle budget', 'DECIMATE')
        modifier.ratio = max(.001, (limit - 20) / count)
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    modifier = obj.modifiers.new('Export triangles', 'TRIANGULATE')
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    count = triangles(obj)
    if not 1 <= count <= limit:
        raise ValueError('TRIANGLE_BUDGET_EXCEEDED')
    for poly in obj.data.polygons:
        poly.use_smooth = True
    neutral_added = len(obj.data.materials) == 0
    if neutral_added:
        material = bpy.data.materials.new('Neutral untextured generated mesh')
        material.diffuse_color = (.55,.57,.55,1)
        material.use_nodes = True
        material.node_tree.nodes.get('Principled BSDF').inputs['Roughness'].default_value = .72
        obj.data.materials.append(material)
    final_min = [min(v.co[i] for v in obj.data.vertices) for i in range(3)]
    final_max = [max(v.co[i] for v in obj.data.vertices) for i in range(3)]
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=str(Path(args.output).resolve()), export_format='GLB',
        use_selection=True, export_yup=True, export_apply=True, export_cameras=False, export_lights=False)
    report = {'tool': 'Blender', 'version': bpy.app.version_string, 'inputTriangles': before,
        'triangles': count, 'heightMeters': settings['heightMeters'], 'scaleApplied': scale,
        'origin': 'ground-center', 'up': '+Y', 'yawDegrees': settings['yawDegrees'],
        'headingVerified': False, 'neutralMaterialAdded': neutral_added,
        'boundingBox': {'min': [final_min[0],final_min[2],-final_max[1]],
                        'max': [final_max[0],final_max[2],-final_min[1]]},
        'operations': ['bake-world-transform','explicit-yaw','normalize-height','ground-center','decimate-if-needed','triangulate','GLB-Y-up']}
    Path(args.report).write_text(json.dumps(report, indent=2, allow_nan=False)+'\n')
    print(json.dumps({'stage':'postprocess','state':'succeeded','triangles':count}), flush=True)


if __name__ == '__main__':
    main()
