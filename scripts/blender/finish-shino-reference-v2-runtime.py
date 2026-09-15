#!/usr/bin/env python3
"""Finish Shino Reference v2 DCC surfaces for deformation/runtime review.

This stage starts from the approved v10 PRIMARY .blend. It binds every authored
visible mesh to the audited humanoid armature, adds authored expression morphs,
exports a skinned GLB and renders required deformation + reaction evidence.
Automated output never grants final visual approval by itself.
"""
from __future__ import annotations
import argparse,json,math,struct,sys
from pathlib import Path
import bpy
from mathutils import Quaternion,Vector
JSON_CHUNK=0x4E4F534A

def cli():
 p=argparse.ArgumentParser();p.add_argument('--source-vrm',required=True);p.add_argument('--out',required=True);return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
def glb_json(path):
 data=Path(path).read_bytes();_,version,total=struct.unpack_from('<4sII',data,0)
 if data[:4]!=b'glTF' or version!=2 or total!=len(data):raise RuntimeError('invalid GLB/VRM')
 off=12
 while off+8<=len(data):
  length,kind=struct.unpack_from('<II',data,off);off+=8;payload=data[off:off+length];off+=length
  if kind==JSON_CHUNK:return json.loads(payload.decode('utf-8').rstrip(' \t\r\n\x00'))
 raise RuntimeError('GLB JSON missing')
def humanoid_names(path):
 doc=glb_json(path);nodes=doc.get('nodes',[]);rows=doc.get('extensions',{}).get('VRMC_vrm',{}).get('humanoid',{}).get('humanBones',{});out={}
 for human,row in rows.items():
  idx=row.get('node')
  if isinstance(idx,int) and 0<=idx<len(nodes) and nodes[idx].get('name'):out[human]=nodes[idx]['name']
 req=['hips','spine','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'];missing=[x for x in req if x not in out]
 if missing:raise RuntimeError('missing humanoid mapping: '+','.join(missing))
 return out
def choose(names,*humans):
 for human in humans:
  if human in names:return names[human]
 raise RuntimeError('missing bone '+('/'.join(humans)))
def mesh_bone(name,names):
 if name.startswith(('Review','Studio','RuntimeReview')):return ''
 if name.startswith(('PRIMARY_Head','FACE_','HAIR_')):return choose(names,'head')
 if name.startswith('PRIMARY_Neck'):return choose(names,'neck','head')
 if name.startswith(('BODY_Torso','CLOTH_Vest','CLOTH_Capelet','CLOTH_CapeTrim','CLOTH_Collar','CLOTH_Button','ACC_Brooch')):return choose(names,'upperChest','chest','spine')
 if name.startswith(('BODY_Waist','CLOTH_WaistJoin','CLOTH_CrotchBridge','CLOTH_Hips','ACC_Belt','ACC_Buckle','ACC_Satchel','ACC_SatchelFlap','ACC_SatchelClasp','ACC_SatchelStrap')):return choose(names,'hips')
 for side,prefix in [('L','left'),('R','right')]:
  if f'_{side}_' not in name:continue
  if any(t in name for t in ('Shoulder','Sleeve')):return choose(names,prefix+'UpperArm')
  if any(t in name for t in ('Cuff','Forearm')):return choose(names,prefix+'LowerArm')
  if any(t in name for t in ('Palm','Finger','Thumb')):return choose(names,prefix+'Hand')
  if 'Thigh' in name:return choose(names,prefix+'UpperLeg')
  if any(t in name for t in ('Knee','Calf','BootShaft','BootCuff','BootEyelet','BootLace')):return choose(names,prefix+'LowerLeg')
  if 'BootToe' in name:return choose(names,prefix+'Foot')
  if 'Shorts' in name:return choose(names,'hips')
 if name.startswith(('DETAIL_','ACC_','CLOTH_')):return choose(names,'hips')
 raise RuntimeError('no binding policy for '+name)
def bind_mesh(obj,armature,bone_name):
 for mod in list(obj.modifiers):
  if mod.type=='ARMATURE':obj.modifiers.remove(mod)
 obj.vertex_groups.clear();g=obj.vertex_groups.new(name=bone_name);g.add(list(range(len(obj.data.vertices))),1.0,'REPLACE');m=obj.modifiers.new('Shino Runtime Skin','ARMATURE');m.object=armature;m.use_deform_preserve_volume=True
 world=obj.matrix_world.copy();obj.parent=armature;obj.matrix_parent_inverse=armature.matrix_world.inverted();obj.matrix_world=world
def ensure_basis(obj):
 if obj.data.shape_keys is None:obj.shape_key_add(name='Basis',from_mix=False)
 return obj.data.shape_keys.key_blocks['Basis']
def add_blink(obj):
 if obj.data.shape_keys and 'Blink' in obj.data.shape_keys.key_blocks:return
 ensure_basis(obj);key=obj.shape_key_add(name='Blink',from_mix=False);zs=[v.co.z for v in key.data];center=sum(zs)/max(1,len(zs))
 for v in key.data:v.co.z=center+(v.co.z-center)*.10
def add_mouth_shapes(obj):
 ensure_basis(obj);coords=[v.co.copy() for v in obj.data.vertices];cx=sum(v.x for v in coords)/len(coords);cz=sum(v.z for v in coords)/len(coords)
 if 'Smile' not in obj.data.shape_keys.key_blocks:
  key=obj.shape_key_add(name='Smile',from_mix=False);span=max((abs(v.x-cx) for v in coords),default=1) or 1
  for basis,v in zip(coords,key.data):
   t=min(1,abs(basis.x-cx)/span);v.co.z=basis.z+.014*t-.002*(1-t)
 if 'MouthOpen' not in obj.data.shape_keys.key_blocks:
  key=obj.shape_key_add(name='MouthOpen',from_mix=False);span=max((abs(v.z-cz) for v in coords),default=1) or 1
  for basis,v in zip(coords,key.data):v.co.z=basis.z+(-1 if basis.z<cz else 1)*.010*max(.25,abs(basis.z-cz)/span)
def reset_pose(rig):
 for bone in rig.pose.bones:bone.rotation_mode='QUATERNION';bone.rotation_quaternion.identity();bone.location=(0,0,0);bone.scale=(1,1,1)
 bpy.context.view_layer.update()
def rotate_global(rig,bone_name,axis,degrees):
 pb=rig.pose.bones.get(bone_name)
 if pb is None:raise RuntimeError('pose bone missing '+bone_name)
 rest=pb.bone.matrix_local.to_quaternion();delta=Quaternion(Vector(axis).normalized(),math.radians(degrees));pb.rotation_mode='QUATERNION';pb.rotation_quaternion=rest.inverted()@delta@rest
def apply_pose(rig,names,pose):
 reset_pose(rig)
 if pose=='neutral':return
 if pose=='head-turn':rotate_global(rig,choose(names,'head'),(0,0,1),34)
 elif pose=='arm-raise':rotate_global(rig,choose(names,'leftUpperArm'),(0,1,0),-64);rotate_global(rig,choose(names,'rightUpperArm'),(0,1,0),64)
 elif pose=='elbow-bend':
  rotate_global(rig,choose(names,'leftUpperArm'),(0,1,0),-28);rotate_global(rig,choose(names,'leftLowerArm'),(0,1,0),-72);rotate_global(rig,choose(names,'rightUpperArm'),(0,1,0),28);rotate_global(rig,choose(names,'rightLowerArm'),(0,1,0),72)
 elif pose=='knee-bend':rotate_global(rig,choose(names,'leftUpperLeg'),(1,0,0),-18);rotate_global(rig,choose(names,'leftLowerLeg'),(1,0,0),55)
 elif pose=='crouch':
  rig.pose.bones.get(choose(names,'hips')).location.z=-.11
  for side in ('left','right'):rotate_global(rig,choose(names,side+'UpperLeg'),(1,0,0),-28);rotate_global(rig,choose(names,side+'LowerLeg'),(1,0,0),62);rotate_global(rig,choose(names,side+'Foot'),(1,0,0),-24)
 elif pose=='hit-small':rotate_global(rig,choose(names,'spine'),(0,0,1),10);rotate_global(rig,choose(names,'head'),(0,0,1),-9);rotate_global(rig,choose(names,'leftUpperArm'),(0,1,0),-18);rotate_global(rig,choose(names,'rightUpperArm'),(0,1,0),30)
 elif pose=='hit-large':
  rig.pose.bones.get(choose(names,'hips')).location.z=-.055;rotate_global(rig,choose(names,'spine'),(1,0,0),18);rotate_global(rig,choose(names,'spine'),(0,0,1),-16);rotate_global(rig,choose(names,'head'),(1,0,0),-12);rotate_global(rig,choose(names,'leftUpperArm'),(0,1,0),-48);rotate_global(rig,choose(names,'rightUpperArm'),(0,1,0),58)
 else:raise RuntimeError('unknown pose '+pose)
 bpy.context.view_layer.update()
def studio():
 scene=bpy.context.scene;scene.render.resolution_x=640;scene.render.resolution_y=820;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.030,.034,.036)
 try:scene.render.engine='BLENDER_EEVEE_NEXT'
 except (TypeError,ValueError):scene.render.engine='BLENDER_EEVEE'
 bpy.ops.object.camera_add(location=(0,-4,1));camera=bpy.context.object;camera.name='RuntimeReviewCamera';camera.data.type='ORTHO';camera.data.ortho_scale=1.78;scene.camera=camera
 for name,pos,energy,size,color in [('RuntimeKey',(-2.5,-3.4,4),850,4,(1,.88,.75)),('RuntimeFill',(2.8,-1.7,2.5),450,3.5,(.78,.88,1)),('RuntimeRim',(.5,2.8,3.2),650,3,(.75,.88,1))]:
  bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.size=size;light.data.color=color;light.rotation_euler=(Vector((0,0,.83))-light.location).to_track_quat('-Z','Y').to_euler()
 mat=bpy.data.materials.get('MAT_STUDIO_GROUND') or bpy.data.materials.new('MAT_STUDIO_GROUND');mat.diffuse_color=(.13,.16,.14,1);bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005));ground=bpy.context.object;ground.name='RuntimeReviewGround';ground.data.materials.append(mat);return camera
def render_pose_set(rig,names,camera,out,poses,views):
 out.mkdir(parents=True,exist_ok=True);target=Vector((0,0,.82));rows=[]
 for pose in poses:
  apply_pose(rig,names,pose);images=[]
  for view,pos in views:
   camera.location=pos;camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler();path=out/f'{pose}-{view}.png';bpy.context.scene.render.filepath=str(path);bpy.ops.render.render(write_still=True);images.append(path.name)
  rows.append({'pose':pose,'images':images})
 reset_pose(rig);return rows
def export_runtime(rig,out):
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);meshes=[]
 for obj in bpy.context.scene.objects:
  if obj.type=='MESH' and not obj.name.startswith(('RuntimeReview','Review','Studio')):obj.select_set(True);meshes.append(obj)
 bpy.context.view_layer.objects.active=rig;path=out/'export'/'ShinoReferenceV2Runtime.glb';path.parent.mkdir(parents=True,exist_ok=True);bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False,export_morph=True,export_skins=True);return path,meshes
def main():
 args=cli();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=True);rig=bpy.data.objects.get('ShinoReferenceV2Rig')
 if not rig or rig.type!='ARMATURE':raise RuntimeError('ShinoReferenceV2Rig missing')
 names=humanoid_names(args.source_vrm);bound=[]
 for obj in list(bpy.context.scene.objects):
  if obj.type!='MESH' or obj.name.startswith(('Review','Studio','RuntimeReview')):continue
  bone=mesh_bone(obj.name,names);bind_mesh(obj,rig,bone);bound.append({'mesh':obj.name,'bone':bone,'vertices':len(obj.data.vertices)})
 for side in ('L','R'):
  for suffix in ('White','Iris','Pupil','Highlight','Lash'):
   obj=bpy.data.objects.get(f'FACE_{side}_{suffix}')
   if obj:add_blink(obj)
 mouth=bpy.data.objects.get('FACE_Mouth')
 if not mouth:raise RuntimeError('FACE_Mouth missing')
 add_mouth_shapes(mouth);source=out/'source'/'ShinoReferenceV2Runtime.blend';source.parent.mkdir(parents=True,exist_ok=True);reset_pose(rig);bpy.ops.wm.save_as_mainfile(filepath=str(source));glb,meshes=export_runtime(rig,out)
 camera=studio();deformation=render_pose_set(rig,names,camera,out/'deformation',['neutral','head-turn','arm-raise','elbow-bend','knee-bend','crouch'],[('front',(0,-3.6,.9)),('side',(3.6,0,.9))]);reactions=render_pose_set(rig,names,camera,out/'reactions',['hit-small','hit-large'],[('front-left',(2.55,-2.55,1.05)),('side',(3.6,0,.9))])
 evidence={'schema':'shino-reference-v2-runtime-dcc-evidence','version':1,'binding':{'strategy':'rigid-segment-overlap-v1','meshCount':len(bound),'unbound':[],'bindings':bound},'secondary':{'hairFormsReviewed':'pending','clothingFormsReviewed':'pending','accessoriesReviewed':'pending'},'deformation':{'poses':[r['pose'] for r in deformation],'poseEvidence':deformation,'weightsReviewed':'pending','selfIntersectionReviewed':'pending','clothingHairCollisionReviewed':'pending'},'motion':{'clips':['hit-small','hit-large'],'reactionEvidence':reactions,'returnsToStablePoseEvidence':['neutral-after-hit-small','neutral-after-hit-large']},'expressions':{'authored':['neutral','blink','smile','mouth-open'],'morphMeshes':[o.name for o in meshes if o.data.shape_keys]},'sourceBlend':source.name,'exportGlb':glb.name,'visualApproval':'pending'}
 (out/'runtime-dcc-evidence.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'boundMeshes':len(bound),'morphMeshes':evidence['expressions']['morphMeshes'],'poses':evidence['deformation']['poses'],'reactions':evidence['motion']['clips']},ensure_ascii=False,indent=2))
if __name__=='__main__':main()
