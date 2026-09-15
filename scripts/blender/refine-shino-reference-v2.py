"""Second DCC sculpt pass for Shino Reference v2.

Keeps the dedicated Reference-v2 body/hair/clothing authored by the primary builder,
but replaces the placeholder face with a high-density donor subset extracted from
the audited Sendagaya_Shino source. Source hair, clothes and body presentation are
not reused. The donor face is detached from the source armature and rigidly follows
the new character head bone, so the resulting asset remains a dedicated DCC model.
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


def cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-vrm', required=True)
    parser.add_argument('--out', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def bounds(objects):
    pts=[]
    for obj in objects:
        for corner in obj.bound_box:
            pts.append(obj.matrix_world @ Vector(corner))
    if not pts:
        raise RuntimeError('No donor bounds')
    low=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    high=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return low,high,(low+high)*.5,high-low


def material_name(obj,index):
    if index < 0 or index >= len(obj.material_slots): return ''
    material=obj.material_slots[index].material
    return material.name.lower() if material else ''


def face_material(name):
    include=('face','eye','iris','eyeline','eyelash','brow','mouth','teeth','tongue')
    exclude=('hair','cloth','outfit','body')
    return any(token in name for token in include) and not any(token in name for token in exclude)


def extract_face(imported_meshes):
    donors=[]; kept_materials=set()
    for source in imported_meshes:
        allowed={i for i in range(len(source.material_slots)) if face_material(material_name(source,i))}
        if not allowed: continue
        obj=source.copy(); obj.data=source.data.copy(); bpy.context.collection.objects.link(obj)
        obj.name='DCC_DonorFace_'+source.name
        bm=bmesh.new(); bm.from_mesh(obj.data)
        doomed=[face for face in bm.faces if face.material_index not in allowed]
        if doomed: bmesh.ops.delete(bm,geom=doomed,context='FACES')
        bm.to_mesh(obj.data); bm.free(); obj.data.update()
        if len(obj.data.polygons)==0:
            bpy.data.objects.remove(obj,do_unlink=True); continue
        for modifier in list(obj.modifiers): obj.modifiers.remove(modifier)
        obj.vertex_groups.clear()
        for i in allowed: kept_materials.add(material_name(source,i))
        donors.append(obj)
    return donors,sorted(kept_materials)


def remove_named(prefixes):
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH' and any(obj.name.startswith(prefix) for prefix in prefixes):
            bpy.data.objects.remove(obj,do_unlink=True)


def material(name):
    value=bpy.data.materials.get(name)
    if not value: raise RuntimeError(f'Material missing: {name}')
    return value


def apply(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)


def bevel(obj,width=.012,segments=4):
    mod=obj.modifiers.new('RefineBevel','BEVEL'); mod.width=width; mod.segments=segments; mod.limit_method='ANGLE'
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj
    bpy.ops.object.modifier_apply(modifier=mod.name)


def round_cube(name,location,scale,mat,bevel_width=.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=location); obj=bpy.context.object; obj.name=name; obj.scale=scale
    apply(obj); bevel(obj,bevel_width,4)
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.materials.append(mat)
    if len(obj.data.uv_layers)==0:obj.data.uv_layers.new(name='UVMap')
    return obj


def uv_sphere(name,location,scale,mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28,ring_count=18,location=location); obj=bpy.context.object; obj.name=name; obj.scale=scale
    apply(obj)
    for p in obj.data.polygons:p.use_smooth=True
    obj.data.materials.append(mat)
    if len(obj.data.uv_layers)==0:obj.data.uv_layers.new(name='UVMap')
    return obj


def bind(obj,rig,bone):
    group=obj.vertex_groups.new(name=bone); group.add(list(range(len(obj.data.vertices))),1.0,'REPLACE')
    mod=obj.modifiers.new('Shino Humanoid','ARMATURE'); mod.object=rig; obj.parent=rig


def curve_lock(name,points,radius,mat,rig,bone):
    curve=bpy.data.curves.new(name+'Curve','CURVE'); curve.dimensions='3D'; curve.resolution_u=5; curve.bevel_depth=radius; curve.bevel_resolution=4
    spline=curve.splines.new('BEZIER'); spline.bezier_points.add(len(points)-1)
    for bp,co in zip(spline.bezier_points,points):bp.co=co;bp.handle_left_type='AUTO';bp.handle_right_type='AUTO'
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);curve.materials.append(mat)
    bpy.ops.object.select_all(action='DESELECT');obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH')
    for p in obj.data.polygons:p.use_smooth=True
    if len(obj.data.uv_layers)==0:obj.data.uv_layers.new(name='UVMap')
    bind(obj,rig,bone);return obj


def setup_review():
    scene=bpy.context.scene;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.035,.045,.05)
    try:scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError):scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1));camera=bpy.context.object;camera.data.type='ORTHO';camera.data.ortho_scale=1.88;scene.camera=camera
    for location,energy,size,color in [((-2.6,-3.2,4.2),850,4,(1,.86,.72)),((3,-2,2.4),520,3.5,(.72,.84,1)),((.5,2.8,3.1),700,3,(.75,.88,1))]:
        bpy.ops.object.light_add(type='AREA',location=location);light=bpy.context.object;light.data.energy=energy;light.data.size=size;light.data.color=color
        light.rotation_euler=((Vector((0,0,.82))-light.location).to_track_quat('-Z','Y').to_euler())
    ground=round_cube('ReviewGround',(0,0,-.055),(3,3,.05),material('MAT_CLOTH_GREEN_DARK'),.01)
    return camera,ground


def render(camera,out):
    out.mkdir(parents=True,exist_ok=True);target=Vector((0,0,.82))
    for name,pos in {'front':(0,-3.6,.9),'side':(3.6,0,.9),'back':(0,3.6,.9),'three-quarter':(2.55,-2.55,1.04)}.items():
        camera.location=pos;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    args=cli();out=Path(args.out).resolve();rig=[o for o in bpy.context.scene.objects if o.type=='ARMATURE' and o.name=='ShinoReferenceV2Rig'][0]
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(Path(args.source_vrm).resolve()));imported=[o for o in bpy.context.scene.objects if o not in before];source_meshes=[o for o in imported if o.type=='MESH']
    donors,materials=extract_face(source_meshes)
    if not donors: raise RuntimeError('No audited donor face/eye materials could be extracted')
    donor_low,donor_high,donor_center,donor_size=bounds(donors)
    target_head=bpy.data.objects.get('SKIN_Head');
    if not target_head:raise RuntimeError('Primary placeholder head missing')
    target_low,target_high,target_center,target_size=bounds([target_head])
    root=bpy.data.objects.new('DCC_DonorFaceRoot',None);bpy.context.collection.objects.link(root);root.location=donor_center
    for obj in donors:
        world=obj.matrix_world.copy();obj.parent=root;obj.matrix_world=world
    scale=min((target_size.x*.98)/max(donor_size.x,1e-6),(target_size.z*.98)/max(donor_size.z,1e-6))
    root.scale=(scale,scale,scale);root.location=target_center+Vector((0,-.012,-.004))
    for obj in donors:
        for slot in obj.material_slots:
            mat=slot.material
            if mat and 'face' in mat.name.lower() and mat.use_nodes:
                bsdf=mat.node_tree.nodes.get('Principled BSDF')
                if bsdf and 'Roughness' in bsdf.inputs:bsdf.inputs['Roughness'].default_value=.72
    world=root.matrix_world.copy();root.parent=rig;root.parent_type='BONE';root.parent_bone='J_Bip_C_Head';root.matrix_world=world

    # Remove the placeholder face/head only after donor extraction succeeds.
    remove_named(('SKIN_Head','FACE_'))

    # Hair tone and silhouette pass: darker brown, smaller cap, more tapered side locks.
    hair=material('MAT_HAIR');hair_hi=material('MAT_HAIR_HIGHLIGHT')
    for mat,color in ((hair,(.37,.20,.12,1)),(hair_hi,(.55,.31,.19,1))):
        if mat.use_nodes:
            bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=color;bsdf.inputs['Roughness'].default_value=.56
    cap=bpy.data.objects.get('HAIR_Cap')
    if cap:cap.scale=(.94,.93,.96);apply(cap)
    head_bone='J_Bip_C_Head'
    for side,x in (('L',.135),('R',-.135)):
        curve_lock(f'HAIR_Refine_{side}_Outer',[(x*.55,-.035,1.53),(x,-.105,1.42),(x*1.05,-.095,1.29)],.016,hair,rig,head_bone)
        curve_lock(f'HAIR_Refine_{side}_Inner',[(x*.35,-.065,1.52),(x*.76,-.13,1.43),(x*.82,-.13,1.32)],.014,hair_hi,rig,head_bone)

    # Replace diaper-like pelvis with a unified dark tailored shorts silhouette.
    remove_named(('SKIN_Hips','CLOTH_L_Shorts','CLOTH_R_Shorts'))
    shorts=material('MAT_CLOTH_SHORTS');skin=material('MAT_SKIN');leather=material('MAT_LEATHER');brass=material('MAT_BRASS')
    hip_bone='J_Bip_C_Hips'
    pelvis=round_cube('CLOTH_ShortsBody',(0,0,.705),(.16,.115,.105),shorts,.03);bind(pelvis,rig,hip_bone)
    for side,x,bone in (('L',.075,'J_Bip_L_UpperLeg'),('R',-.075,'J_Bip_R_UpperLeg')):
        cuff=round_cube(f'CLOTH_{side}_ShortCuff',(x,0,.625),(.082,.108,.055),shorts,.022);bind(cuff,rig,bone)
        knee=uv_sphere(f'SKIN_{side}_Knee',(x,0,.405),(.058,.052,.060),skin);bind(knee,rig,bone)
        # Rounded boot top + toe reduces the stacked-box silhouette.
        boot=uv_sphere(f'CLOTH_{side}_BootTop',(x,0,.285),(.066,.060,.075),leather);bind(boot,rig,'J_Bip_L_LowerLeg' if side=='L' else 'J_Bip_R_LowerLeg')
        toe=round_cube(f'CLOTH_{side}_BootToe',(x,-.085,.070),(.073,.115,.055),leather,.026);bind(toe,rig,'J_Bip_L_Foot' if side=='L' else 'J_Bip_R_Foot')

    # Hands receive thumbs/palm volume so they stop reading as spheres.
    for side,sign,bone in (('L',1,'J_Bip_L_Hand'),('R',-1,'J_Bip_R_Hand')):
        thumb=uv_sphere(f'SKIN_{side}_Thumb',(.525*sign,-.022,.91),(.025,.020,.040),skin);thumb.rotation_euler[1]=math.radians(-28*sign);apply(thumb);bind(thumb,rig,bone)

    # Small cloth layering details for the characteristic green/cream reference outfit.
    green=material('MAT_CLOTH_GREEN');cream=material('MAT_CLOTH_CREAM')
    for side,x in (('L',.19),('R',-.19)):
        flap=round_cube(f'CLOTH_CapeFlap_{side}',(x,-.035,1.02),(.085,.022,.13),green,.018);flap.rotation_euler[1]=math.radians(7*side.count('R')-3.5);apply(flap);bind(flap,rig,'J_Bip_C_Spine')
    hem=round_cube('CLOTH_CapeFrontTrim',(0,-.132,1.00),(.165,.015,.015),cream,.007);bind(hem,rig,'J_Bip_C_Spine')

    # Remove the just-imported source donor armature and all source meshes not cloned.
    donor_ids={id(obj) for obj in donors}
    for obj in imported:
        if id(obj) in donor_ids:continue
        if obj.name in bpy.context.scene.objects:bpy.data.objects.remove(obj,do_unlink=True)

    # Save/export refined asset before review studio is added.
    blend=out/'source'/'ShinoReferenceV2.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and not obj.name.startswith('Review'):obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)

    camera,ground=setup_review();render(camera,out/'review')
    build_path=out/'build.json';build=json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement']={
        'version':2,'auditedFaceDonor':True,'donorMaterials':materials,
        'sourceHairReused':False,'sourceClothingReused':False,'sourceBodyReused':False,
        'visualApproval':'pending'
    }
    build['meshObjects']=len([o for o in bpy.context.scene.objects if o.type=='MESH' and o!=ground])
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__':main()
