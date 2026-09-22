"""Visual correction pass 3 for Shino Reference v2.

Fixes donor-face placement by baking source face vertices into the Reference-v2 head
space before assigning them to the audited head bone. Also opens the fringe around
the eyes and strengthens the olive/cream outfit hierarchy so the model reads as the
reference character instead of a pale blockout.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def cli():
    p=argparse.ArgumentParser();p.add_argument('--source-vrm',required=True);p.add_argument('--out',required=True)
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def remove_prefix(*prefixes):
    for obj in list(bpy.context.scene.objects):
        if any(obj.name.startswith(p) for p in prefixes):bpy.data.objects.remove(obj,do_unlink=True)


def mat_name(obj,index):
    if index<0 or index>=len(obj.material_slots):return ''
    m=obj.material_slots[index].material;return m.name.lower() if m else ''


def wanted(name):
    return any(t in name for t in ('face','eye','iris','eyeline','eyelash','brow','mouth','teeth','tongue')) and not any(t in name for t in ('hair','cloth','outfit','body'))


def extract(meshes):
    donors=[];names=set()
    for src in meshes:
        allowed={i for i in range(len(src.material_slots)) if wanted(mat_name(src,i))}
        if not allowed:continue
        obj=src.copy();obj.data=src.data.copy();bpy.context.collection.objects.link(obj);obj.name='DCC_DonorFaceV3_'+src.name
        bm=bmesh.new();bm.from_mesh(obj.data);dead=[f for f in bm.faces if f.material_index not in allowed]
        if dead:bmesh.ops.delete(bm,geom=dead,context='FACES')
        bm.to_mesh(obj.data);bm.free();obj.data.update()
        if not obj.data.polygons:bpy.data.objects.remove(obj,do_unlink=True);continue
        for mod in list(obj.modifiers):obj.modifiers.remove(mod)
        obj.vertex_groups.clear();donors.append(obj)
        names.update(mat_name(src,i) for i in allowed)
    return donors,sorted(names)


def world_points(objects,only_eye=False):
    points=[]
    for obj in objects:
        has_eye=any('eye' in (slot.material.name.lower() if slot.material else '') for slot in obj.material_slots)
        if only_eye and not has_eye:continue
        points.extend(obj.matrix_world@v.co for v in obj.data.vertices)
    return points


def bbox(points):
    lo=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points)));hi=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
    return lo,hi,(lo+hi)*.5,hi-lo


def bind(obj,rig,bone):
    obj.parent=None;obj.matrix_world=Matrix.Identity(4)
    group=obj.vertex_groups.new(name=bone);group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
    mod=obj.modifiers.new('Shino Humanoid','ARMATURE');mod.object=rig;obj.parent=rig


def ensure_uv(obj):
    if obj.type=='MESH' and not obj.data.uv_layers:obj.data.uv_layers.new(name='UVMap')


def apply(obj):
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)


def curve_lock(name,points,radius,material,rig,bone):
    c=bpy.data.curves.new(name+'Curve','CURVE');c.dimensions='3D';c.resolution_u=5;c.bevel_depth=radius;c.bevel_resolution=4
    s=c.splines.new('BEZIER');s.bezier_points.add(len(points)-1)
    for bp,co in zip(s.bezier_points,points):bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(obj);c.materials.append(material)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    for p in obj.data.polygons:p.use_smooth=True
    ensure_uv(obj);bind(obj,rig,bone);return obj


def sphere(name,location,scale,material,rig,bone):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24,ring_count=16,location=location);obj=bpy.context.object;obj.name=name;obj.scale=scale;apply(obj)
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.materials.append(material);ensure_uv(obj);bind(obj,rig,bone);return obj


def cube(name,location,scale,material,rig,bone,bevel=.012):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location);obj=bpy.context.object;obj.name=name;obj.scale=scale;apply(obj)
    mod=obj.modifiers.new('DCC Bevel','BEVEL');mod.width=bevel;mod.segments=4;mod.limit_method='ANGLE';bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.modifier_apply(modifier=mod.name)
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.materials.append(material);ensure_uv(obj);bind(obj,rig,bone);return obj


def set_base(material_name,color,rough=.65):
    m=bpy.data.materials.get(material_name)
    if not m:return None
    if m.use_nodes:
        bsdf=m.node_tree.nodes.get('Principled BSDF')
        if bsdf:bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=rough
    return m


def studio():
    scene=bpy.context.scene;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.028,.035,.039)
    try:scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError):scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.82;scene.camera=cam
    for pos,energy,size,color in [((-2.5,-3.4,4.0),900,4,(1,.84,.68)),((3,-1.8,2.5),500,3.5,(.72,.84,1)),((.4,2.8,3.2),750,3,(.72,.84,1))]:
        bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.size=size;l.data.color=color;l.rotation_euler=(Vector((0,0,.84))-l.location).to_track_quat('-Z','Y').to_euler()
    ground_mat=bpy.data.materials.get('MAT_CLOTH_GREEN_DARK');bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005));g=bpy.context.object;g.name='ReviewGround';g.data.materials.append(ground_mat)
    return cam,g


def render(cam,out):
    out.mkdir(parents=True,exist_ok=True);target=Vector((0,0,.84))
    for name,pos in {'front':(0,-3.6,.92),'side':(3.6,0,.92),'back':(0,3.6,.92),'three-quarter':(2.55,-2.55,1.08)}.items():
        cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    a=cli();out=Path(a.out).resolve();rig=bpy.data.objects.get('ShinoReferenceV2Rig');
    if not rig:raise RuntimeError('Reference rig missing')
    remove_prefix('DCC_DonorFace','DCC_DonorFaceRoot')
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(Path(a.source_vrm).resolve()));imported=[o for o in bpy.context.scene.objects if o not in before];donors,names=extract([o for o in imported if o.type=='MESH'])
    if not donors:raise RuntimeError('Audited face donor extraction failed')
    pts=world_points(donors);lo,hi,center,size=bbox(pts);eye_pts=world_points(donors,True);eye_center=bbox(eye_pts)[2] if eye_pts else center
    target_center=Vector((0,-.004,1.372));target_size=Vector((.300,.255,.342));scale=min(target_size.x/max(size.x,1e-6),target_size.z/max(size.z,1e-6));flip_y=eye_center.y>center.y
    transform=Matrix.Translation(target_center)@Matrix.Scale(scale,4)@Matrix.Translation(-center)
    for obj in donors:
        world=obj.matrix_world.copy()
        for v in obj.data.vertices:
            p=world@v.co
            if flip_y:p.y=center.y-(p.y-center.y)
            v.co=transform@p
        obj.matrix_world=Matrix.Identity(4);ensure_uv(obj);bind(obj,rig,'J_Bip_C_Head')
    for obj in imported:
        if obj in donors:continue
        if obj.name in bpy.context.scene.objects:bpy.data.objects.remove(obj,do_unlink=True)

    # Open, darker bob. The eye line stays visible from front and 3/4 views.
    remove_prefix('HAIR_Bang_','HAIR_Refine_')
    hair=set_base('MAT_HAIR',(.24,.095,.045,1),.58);hair_hi=set_base('MAT_HAIR_HIGHLIGHT',(.39,.16,.075,1),.52)
    cap=bpy.data.objects.get('HAIR_Cap')
    if cap:cap.scale=(.93,.90,.92);apply(cap)
    for i,x in enumerate((-.070,-.047,-.024,0,.024,.047,.070)):
        end_z=1.418-(abs(i-3)%2)*.012
        curve_lock(f'HAIR_BangV3_{i}',[(x*.55,-.065,1.548),(x,-.125,1.487),(x+(.005 if i>3 else -.005 if i<3 else 0),-.142,end_z)],.0135,hair_hi if i in (1,5) else hair,rig,'J_Bip_C_Head')
    for side,x in (('L',.14),('R',-.14)):
        curve_lock(f'HAIR_SideV3_{side}',[(x*.62,-.025,1.535),(x,-.11,1.42),(x*.98,-.11,1.285)],.017,hair,rig,'J_Bip_C_Head')

    # Stronger reference palette and characteristic garment details.
    green=set_base('MAT_CLOTH_GREEN',(.105,.245,.075,1),.82);green_dark=set_base('MAT_CLOTH_GREEN_DARK',(.045,.115,.035,1),.86);cream=set_base('MAT_CLOTH_CREAM',(.78,.74,.62,1),.9);shorts=set_base('MAT_CLOTH_SHORTS',(.105,.09,.075,1),.88);leather=set_base('MAT_LEATHER',(.17,.085,.042,1),.72);brass=set_base('MAT_BRASS',(.48,.31,.10,1),.38)
    skin=set_base('MAT_SKIN',(.90,.64,.55,1),.82)
    remove_prefix('CLOTH_CapeFlap_','CLOTH_CapeFrontTrim','CLOTH_RefButton','CLOTH_RefPocket')
    for side,x in (('L',.122),('R',-.122)):
        panel=cube(f'CLOTH_CapeFlapV3_{side}',(x,-.126,1.015),(.073,.018,.145),green,rig,'J_Bip_C_Spine',.018);panel.rotation_euler[1]=math.radians(-3 if side=='L' else 3);apply(panel)
        cube(f'CLOTH_RefPocket_{side}',(x,-.149,.902),(.055,.010,.025),green_dark,rig,'J_Bip_C_Spine',.009)
    for i,z in enumerate((1.105,1.035,.965)):
        sphere(f'CLOTH_RefButton_{i}',(0,-.154,z),(.012,.006,.012),brass,rig,'J_Bip_C_Spine')
    cube('CLOTH_CapeFrontTrimV3',(0,-.143,.858),(.165,.012,.014),cream,rig,'J_Bip_C_Spine',.006)
    # Slight shoulder bulbs and wrist cuffs read closer to the reference blouse.
    for side,sign,bone in (('L',1,'J_Bip_L_UpperArm'),('R',-1,'J_Bip_R_UpperArm')):
        sphere(f'CLOTH_ShoulderPuff_{side}',(.165*sign,0,1.145),(.072,.065,.070),cream,rig,bone)
    # Refine mittens into palm+thumb shapes by scaling existing palms down.
    for name in ('SKIN_L_Hand','SKIN_R_Hand'):
        obj=bpy.data.objects.get(name)
        if obj:obj.scale=(.84,.72,1.02);apply(obj)

    blend=out/'source'/'ShinoReferenceV2.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.name!='ReviewGround':obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)
    cam,ground=studio();render(cam,out/'review')
    build_path=out/'build.json';build=json.loads(build_path.read_text(encoding='utf-8'));build['refinement']={'version':3,'auditedFaceDonor':True,'donorMaterials':names,'facePlacement':'vertex-baked-head-space','sourceHairReused':False,'sourceClothingReused':False,'sourceBodyReused':False,'visualApproval':'pending'};build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__':main()
