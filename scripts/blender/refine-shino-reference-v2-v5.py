"""Visual correction pass 5 for Shino Reference v2.

Replaces procedural skin cylinders/hands with the audited VRoid body skin as a
high-density basemesh, deformed onto the new Reference-v2 humanoid rest skeleton.
Old source hair and old source clothing are never retained. Also opens the hair cap
so the face is visible and adds boot/cape details visible in the reference sheet.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def cli():
    p=argparse.ArgumentParser();p.add_argument('--source-vrm',required=True);p.add_argument('--out',required=True)
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def mat_name(obj,index):
    if index<0 or index>=len(obj.material_slots):return ''
    m=obj.material_slots[index].material;return m.name.lower() if m else ''


def body_material(name):
    return 'body' in name and 'skin' in name and 'face' not in name


def copy_body_surface(source):
    allowed={i for i in range(len(source.material_slots)) if body_material(mat_name(source,i))}
    if not allowed:return None
    obj=source.copy();obj.data=source.data.copy();bpy.context.collection.objects.link(obj);obj.name='DCC_BodyBasemesh'
    bm=bmesh.new();bm.from_mesh(obj.data);dead=[f for f in bm.faces if f.material_index not in allowed]
    if dead:bmesh.ops.delete(bm,geom=dead,context='FACES')
    bm.to_mesh(obj.data);bm.free();obj.data.update()
    if not obj.data.polygons:bpy.data.objects.remove(obj,do_unlink=True);return None
    return obj


def select(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj


def copy_main_rest(main,donor):
    target={b.name:(b.head_local.copy(),b.tail_local.copy(),b.roll) for b in main.data.bones}
    select(donor);bpy.ops.object.mode_set(mode='EDIT')
    for b in donor.data.edit_bones:
        row=target.get(b.name)
        if row:b.head,b.tail,b.roll=row
    bpy.ops.object.mode_set(mode='OBJECT')


def remove_shape_keys(obj):
    if not obj.data.shape_keys:return
    select(obj)
    while obj.data.shape_keys and obj.data.shape_keys.key_blocks:
        obj.shape_key_remove(obj.data.shape_keys.key_blocks[-1])


def bake_body_to_main(obj,donor,main):
    remove_shape_keys(obj)
    arm=[m for m in obj.modifiers if m.type=='ARMATURE']
    for mod in arm:
        mod.object=donor
        select(obj);bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.parent=None
    main_mod=obj.modifiers.new('Shino Reference Humanoid','ARMATURE');main_mod.object=main
    obj.parent=main
    if not obj.data.uv_layers:obj.data.uv_layers.new(name='UVMap')
    for p in obj.data.polygons:p.use_smooth=True


def delete_objects(prefixes):
    for obj in list(bpy.context.scene.objects):
        if any(obj.name.startswith(p) for p in prefixes):bpy.data.objects.remove(obj,do_unlink=True)


def open_hair_cap():
    cap=bpy.data.objects.get('HAIR_Cap')
    if not cap:return
    bm=bmesh.new();bm.from_mesh(cap.data)
    # Front is negative Y. Keep crown/back/sides, remove lower face-covering polygons.
    dead=[]
    for face in bm.faces:
        c=face.calc_center_median()
        if c.y < -.025 and c.z < .055:dead.append(face)
    if dead:bmesh.ops.delete(bm,geom=dead,context='FACES')
    bm.to_mesh(cap.data);bm.free();cap.data.update()


def material(name):return bpy.data.materials.get(name)


def apply(obj):
    select(obj);bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)


def bind(obj,rig,bone):
    group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1,'REPLACE');mod=obj.modifiers.new('Shino Humanoid','ARMATURE');mod.object=rig;obj.parent=rig


def cube(name,location,scale,mat,rig,bone,bevel=.006,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location,rotation=rotation);obj=bpy.context.object;obj.name=name;obj.scale=scale;apply(obj)
    mod=obj.modifiers.new('DetailBevel','BEVEL');mod.width=bevel;mod.segments=3;mod.limit_method='ANGLE';select(obj);bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.data.materials.append(mat);obj.data.uv_layers.new(name='UVMap');bind(obj,rig,bone);return obj


def cylinder(name,location,radius,depth,mat,rig,bone,rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=radius,depth=depth,location=location,rotation=rotation);obj=bpy.context.object;obj.name=name
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.materials.append(mat);obj.data.uv_layers.new(name='UVMap');bind(obj,rig,bone);return obj


def studio():
    scene=bpy.context.scene;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.028,.035,.039)
    try:scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError):scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.82;scene.camera=cam
    for pos,energy,size,color in [((-2.5,-3.4,4),900,4,(1,.84,.68)),((3,-1.8,2.5),500,3.5,(.72,.84,1)),((.4,2.8,3.2),750,3,(.72,.84,1))]:
        bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.size=size;l.data.color=color;l.rotation_euler=(Vector((0,0,.84))-l.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005));g=bpy.context.object;g.name='ReviewGround';g.data.materials.append(material('MAT_CLOTH_GREEN_DARK'));return cam,g


def render(cam,out):
    out.mkdir(parents=True,exist_ok=True);target=Vector((0,0,.84))
    for name,pos in {'front':(0,-3.6,.92),'side':(3.6,0,.92),'back':(0,3.6,.92),'three-quarter':(2.55,-2.55,1.08)}.items():
        cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    a=cli();out=Path(a.out).resolve();main_rig=bpy.data.objects.get('ShinoReferenceV2Rig')
    if not main_rig:raise RuntimeError('Main Reference rig missing')
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(Path(a.source_vrm).resolve()));imported=[o for o in bpy.context.scene.objects if o not in before];donor_rigs=[o for o in imported if o.type=='ARMATURE']
    if len(donor_rigs)!=1:raise RuntimeError(f'Expected one donor armature, found {len(donor_rigs)}')
    donor=donor_rigs[0];body=None
    for source in [o for o in imported if o.type=='MESH']:
        body=copy_body_surface(source) or body
    if body is None:raise RuntimeError('Audited source has no Body SKIN material subset')
    copy_main_rest(main_rig,donor);bpy.context.view_layer.update();bake_body_to_main(body,donor,main_rig)
    for obj in imported:
        if obj==body:continue
        if obj.name in bpy.context.scene.objects:bpy.data.objects.remove(obj,do_unlink=True)
    # Remove primitive skin, retaining static high-density DCC face donor.
    delete_objects(('SKIN_','FACE_'))
    body.name='SKIN_DCC_BodyBasemesh'

    open_hair_cap()
    # Remove any isolated old scalp placeholder if it is now empty; curve locks remain.
    cap=bpy.data.objects.get('HAIR_Cap')
    if cap and len(cap.data.polygons)<10:bpy.data.objects.remove(cap,do_unlink=True)

    leather=material('MAT_LEATHER');cream=material('MAT_CLOTH_CREAM');green_dark=material('MAT_CLOTH_GREEN_DARK');brass=material('MAT_BRASS')
    # Laces and eyelets on boots, strongly visible in the reference sheet.
    delete_objects(('DETAIL_Boot','DETAIL_CapeEmblem'))
    for side,sign,lower,foot in (('L',1,'J_Bip_L_LowerLeg','J_Bip_L_Foot'),('R',-1,'J_Bip_R_LowerLeg','J_Bip_R_Foot')):
        x=.095*sign
        for i,z in enumerate((.13,.17,.21,.25,.29)):
            cylinder(f'DETAIL_BootEyelet_{side}_{i}',(x-.050*sign,-.058,z),.006,.010,brass,main_rig,lower,rotation=(math.pi/2,0,0))
            cylinder(f'DETAIL_BootEyelet2_{side}_{i}',(x+.050*sign,-.058,z),.006,.010,brass,main_rig,lower,rotation=(math.pi/2,0,0))
            cube(f'DETAIL_BootLace_{side}_{i}',(x,-.066,z),(.052,.004,.005),cream,main_rig,lower,.003,rotation=(0,math.radians(8*(-1 if i%2 else 1)),0))
        cube(f'DETAIL_BootCuff_{side}',(x,-.003,.335),(.073,.065,.032),green_dark,main_rig,lower,.012)
    # Simple botanical cape embroidery made from small gold/cream leaf tiles.
    for side,sign in (('L',1),('R',-1)):
        base_x=.175*sign
        for i,(dx,dz,angle) in enumerate(((0,0,0),(.018,.020,28),(-.018,.020,-28),(0,.042,0))):
            cube(f'DETAIL_CapeEmblem_{side}_{i}',(base_x+dx*sign,-.155,1.02+dz),(.010,.004,.020),brass,main_rig,'J_Bip_C_Spine',.003,rotation=(0,0,math.radians(angle*sign)))

    blend=out/'source'/'ShinoReferenceV2.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT');main_rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.name!='ReviewGround':obj.select_set(True)
    bpy.context.view_layer.objects.active=main_rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)
    cam,ground=studio();render(cam,out/'review')
    build_path=out/'build.json';build=json.loads(build_path.read_text(encoding='utf-8'));build['refinement']={'version':5,'auditedFaceDonor':True,'auditedBodyBasemesh':True,'faceSkinning':'pending-deformation-stage','sourceHairReused':False,'sourceClothingReused':False,'sourceBodySkinTopologyReused':True,'visualApproval':'pending'};build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__':main()
