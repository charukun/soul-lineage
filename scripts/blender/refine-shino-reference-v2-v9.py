"""PRIMARY polish pass 9 for the clean Shino Reference v2 rebuild.

Targets only issues observed in the v8 four-view render:
- horizontal belt instead of a vertical hip loop,
- continuous shorts/hip silhouette,
- boot toes physically joined to the shafts,
- cleaner bob back without spiky radial locks,
- flatter anime eyes that do not read as goggles.
"""
from __future__ import annotations

import argparse
import json
import math
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


def bevel(obj,width,segments=3):
    modifier=obj.modifiers.new('PRIMARY Polish Bevel','BEVEL'); modifier.width=width; modifier.segments=segments; modifier.limit_method='ANGLE'
    select_only(obj); bpy.ops.object.modifier_apply(modifier=modifier.name)


def rounded_cube(name,location,dimensions,material,radius=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location); obj=bpy.context.object; obj.name=name
    obj.dimensions=dimensions; apply_transform(obj); bevel(obj,radius,4); smooth(obj); obj.data.materials.append(material); ensure_uv(obj); return obj


def sphere(name,location,scale,material,segments=28,rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=location); obj=bpy.context.object; obj.name=name; obj.scale=scale
    apply_transform(obj); smooth(obj); obj.data.materials.append(material); ensure_uv(obj); return obj


def delete_named(name):
    obj=bpy.data.objects.get(name)
    if obj: bpy.data.objects.remove(obj,do_unlink=True)


def delete_prefix(prefix):
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(prefix): bpy.data.objects.remove(obj,do_unlink=True)


def scale_mesh(name,factors):
    obj=bpy.data.objects.get(name)
    if not obj: return False
    obj.scale=factors; apply_transform(obj); return True


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
    skin=bpy.data.materials['MAT_SKIN']; shorts=bpy.data.materials['MAT_CLOTH_SHORTS']; leather=bpy.data.materials['MAT_LEATHER']; leather_dark=bpy.data.materials['MAT_LEATHER_DARK']

    # Simplify the bob: the cap already carries the back silhouette. Radial back
    # locks made the nape look serrated, so keep only face-framing side locks/bangs.
    delete_prefix('HAIR_BackLock_')

    # Flatten all eye layers in depth while preserving the large anime-eye read.
    for side in ('L','R'):
        for suffix in ('White','Iris','Pupil','Highlight'):
            scale_mesh(f'FACE_{side}_{suffix}',(.94,.62,.94))
        scale_mesh(f'FACE_{side}_Brow',(.96,.75,.96)); scale_mesh(f'FACE_{side}_Lash',(.96,.70,.96))

    # The v8 belt torus was intentionally re-authored: default Blender torus is
    # already horizontal around Z, so do not rotate it into a vertical loop.
    delete_named('ACC_Belt')
    bpy.ops.mesh.primitive_torus_add(major_radius=.137,minor_radius=.010,major_segments=44,minor_segments=8,location=(0,0,.790))
    belt=bpy.context.object; belt.name='ACC_Belt'; belt.scale=(1,.78,1); apply_transform(belt); belt.data.materials.append(leather_dark); ensure_uv(belt)

    # Build one dark hip under-volume plus larger overlapping shorts so front/back
    # read as clothing instead of two floating thigh plugs.
    delete_named('CLOTH_Hips')
    sphere('CLOTH_Hips',(0,.006,.704),(.132,.096,.100),shorts,30,18)
    for side,sign in [('L',1),('R',-1)]:
        delete_named(f'CLOTH_{side}_Shorts')
        rounded_cube(f'CLOTH_{side}_Shorts',(.060*sign,-.004,.704),(.145,.180,.150),shorts,.035)

    # Join toe boxes to boot shafts and give the foot a forward silhouette instead
    # of a detached oval at ground level.
    for side,sign in [('L',1),('R',-1)]:
        delete_named(f'CLOTH_{side}_BootToe')
        rounded_cube(f'CLOTH_{side}_BootToe',(.095*sign,-.045,.090),(.140,.185,.105),leather,.025)

    # Slightly deepen leather so boots/satchel stay distinct from skin under warm key.
    leather.diffuse_color=(.26,.135,.065,1)
    bsdf=leather.node_tree.nodes.get('Principled BSDF') if leather.use_nodes else None
    if bsdf: bsdf.inputs['Base Color'].default_value=leather.diffuse_color

    blend=out/'source'/'ShinoReferenceV2.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH': obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)

    camera=render_setup(); render_views(camera,out/'review')
    build_path=out/'build.json'; build=json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement']={
        'version':9,
        'strategy':'clean-dedicated-stylized-primary-polish',
        'legacyVisibleMeshesRetained':False,
        'auditedArmatureRetained':True,
        'primaryGeometryBinding':'static-unbound',
        'deformationBinding':'pending-deformation-stage',
        'visualFixes':['horizontal-belt','continuous-shorts','joined-boot-toe','clean-bob-back','flatter-anime-eyes'],
        'visualApproval':'pending',
    }
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__': main()
