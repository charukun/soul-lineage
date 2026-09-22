"""PRIMARY polish pass 10 for Shino Reference v2.

Fixes the final v9 four-view issue: the waist read as three disconnected layers
(blouse, floating belt, shorts). This pass adds a tucked blouse bridge, hugs the
belt to the hip volume, and closes the crotch silhouette without changing the
approved v9 face/hair/boots.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def cli():
    parser=argparse.ArgumentParser(); parser.add_argument('--out',required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj


def apply_transform(obj):
    select_only(obj); bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)


def ensure_uv(obj):
    if obj.type=='MESH' and not obj.data.uv_layers: obj.data.uv_layers.new(name='UVMap')


def smooth(obj):
    if obj.type=='MESH':
        for polygon in obj.data.polygons: polygon.use_smooth=True


def bevel(obj,width,segments=4):
    modifier=obj.modifiers.new('PRIMARY Waist Bevel','BEVEL'); modifier.width=width; modifier.segments=segments; modifier.limit_method='ANGLE'
    select_only(obj); bpy.ops.object.modifier_apply(modifier=modifier.name)


def rounded_cube(name,location,dimensions,material,radius=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location); obj=bpy.context.object; obj.name=name
    obj.dimensions=dimensions; apply_transform(obj); bevel(obj,radius); smooth(obj); obj.data.materials.append(material); ensure_uv(obj); return obj


def delete_named(name):
    obj=bpy.data.objects.get(name)
    if obj: bpy.data.objects.remove(obj,do_unlink=True)


def render_setup():
    scene=bpy.context.scene; scene.render.resolution_x=768; scene.render.resolution_y=1024; scene.render.resolution_percentage=100; scene.render.image_settings.file_format='PNG'; scene.world.color=(.030,.034,.036)
    try: scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError): scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1)); camera=bpy.context.object; camera.name='ReviewCamera'; camera.data.type='ORTHO'; camera.data.ortho_scale=1.78; scene.camera=camera
    for name,pos,energy,size,color in [('Key',(-2.5,-3.4,4),850,4,(1,.88,.75)),('Fill',(2.8,-1.7,2.5),450,3.5,(.78,.88,1)),('Rim',(.5,2.8,3.2),650,3,(.75,.88,1))]:
        bpy.ops.object.light_add(type='AREA',location=pos); light=bpy.context.object; light.name=name; light.data.energy=energy; light.data.size=size; light.data.color=color; light.rotation_euler=(Vector((0,0,.83))-light.location).to_track_quat('-Z','Y').to_euler()
    ground_mat=bpy.data.materials.get('MAT_STUDIO_GROUND')
    bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005)); ground=bpy.context.object; ground.name='ReviewGround'; ground.data.materials.append(ground_mat)
    return camera


def render_views(camera,out):
    out.mkdir(parents=True,exist_ok=True); target=Vector((0,0,.82))
    for name,pos in {'front':(0,-3.6,.9),'side':(3.6,0,.9),'back':(0,3.6,.9),'three-quarter':(2.55,-2.55,1.05)}.items():
        camera.location=pos; camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); bpy.context.scene.render.filepath=str(out/f'{name}.png'); bpy.ops.render.render(write_still=True)


def main():
    args=cli(); out=Path(args.out).resolve(); rig=bpy.data.objects.get('ShinoReferenceV2Rig')
    if not rig: raise RuntimeError('ShinoReferenceV2Rig missing')
    cream=bpy.data.materials['MAT_CLOTH_CREAM']; shorts=bpy.data.materials['MAT_CLOTH_SHORTS']; leather_dark=bpy.data.materials['MAT_LEATHER_DARK']; brass=bpy.data.materials['MAT_BRASS']

    # Tucked blouse bridge closes the empty waist between torso and shorts.
    delete_named('CLOTH_WaistJoin'); delete_named('CLOTH_CrotchBridge')
    rounded_cube('CLOTH_WaistJoin',(0,-.002,.805),(.225,.155,.125),cream,.030)

    # Pull the belt into the body instead of leaving a visible floating halo.
    delete_named('ACC_Belt'); delete_named('ACC_Buckle')
    bpy.ops.mesh.primitive_torus_add(major_radius=.112,minor_radius=.013,major_segments=48,minor_segments=10,location=(0,-.002,.780))
    belt=bpy.context.object; belt.name='ACC_Belt'; belt.scale=(1.02,.78,1); apply_transform(belt); smooth(belt); belt.data.materials.append(leather_dark); ensure_uv(belt)
    rounded_cube('ACC_Buckle',(0,-.095,.780),(.030,.014,.026),brass,.005)

    # One small central cloth bridge removes the dark wedge between the two short legs
    # while preserving a split-leg silhouette for later deformation work.
    rounded_cube('CLOTH_CrotchBridge',(0,.002,.665),(.090,.135,.080),shorts,.026)

    # Lift the two shorts pieces slightly into the belt/waist bridge so no seam reads
    # as an air gap in front, side or three-quarter view.
    for name in ('CLOTH_L_Shorts','CLOTH_R_Shorts','CLOTH_Hips'):
        obj=bpy.data.objects.get(name)
        if obj: obj.location.z += .010

    blend=out/'source'/'ShinoReferenceV2.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)

    camera=render_setup(); render_views(camera,out/'review')
    build_path=out/'build.json'; build=json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement']={
        'version':10,
        'strategy':'clean-dedicated-stylized-primary-waist-final',
        'legacyVisibleMeshesRetained':False,
        'auditedArmatureRetained':True,
        'primaryGeometryBinding':'static-unbound',
        'deformationBinding':'pending-deformation-stage',
        'visualFixes':['tucked-waist-bridge','body-hugging-belt','closed-crotch-silhouette','shorts-belt-overlap'],
        'visualApproval':'pending',
    }
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__': main()
