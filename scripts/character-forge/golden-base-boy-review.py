"""Render the DELIVERED GLB in Blender, not a nicer authoring-only proxy."""
import bpy,json,hashlib,os
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];PKG=ROOT/'packages/assets/characters/forge/golden-base-boy-v1'
ROUND=int(os.environ.get('GOLDEN_DCC_ROUND','1'));OUT=PKG/('review/dcc-round-'+str(ROUND));OUT.mkdir(parents=True,exist_ok=True)
model=PKG/'build/character.glb';bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(model))
scene=bpy.context.scene
# Clear imported active clips before neutral shape comparisons.
for o in scene.objects:
    if o.animation_data:o.animation_data.action=None
    if o.type=='MESH' and o.data.shape_keys:
        for key in o.data.shape_keys.key_blocks:key.value=0
scene.frame_set(0);bpy.context.view_layer.update()
scene.render.engine='CYCLES';scene.cycles.samples=32;scene.cycles.use_denoising=True;scene.render.resolution_x=960;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Neutral studio');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.65
scene.view_settings.view_transform='Standard';scene.view_settings.exposure=-.35
for name,pos,energy,size in [('Key',(-3,-4,5),210,4),('Fill',(3,-2,3),110,3),('Rim',(0,3,4),180,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size;obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos;obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
cd=bpy.data.cameras.new('Actual GLB orthographic comparison');cd.type='ORTHO';cd.ortho_scale=1.7777778;cam=bpy.data.objects.new('ComparisonCamera',cd);scene.collection.objects.link(cam);scene.camera=cam
for name,pos in [('front',(0,-5,.8)),('side',(5,0,.8)),('back',(0,5,.8)),('three-quarter',(3,-5,1.1))]:
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)
cam.location=(0,-5,1.26);cam.rotation_euler=(Vector((0,0,1.26))-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=.83
for morph in ('neutral','Blink.L','Smile','MouthOpen'):
    for o in scene.objects:
        if o.type=='MESH' and o.data.shape_keys:
            for key in o.data.shape_keys.key_blocks:key.value=1. if key.name==morph else 0.
    bpy.context.view_layer.update();scene.render.filepath=str(OUT/('face-'+morph.replace('.','-')+'.png'));bpy.ops.render.render(write_still=True)
for o in scene.objects:
    if o.type=='MESH' and o.data.shape_keys:
        for key in o.data.shape_keys.key_blocks:key.value=0
cam.location=(0,-5,.8);cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler();cd.ortho_scale=1.7777778
scene['sourceModelSha256']=hashlib.sha256(model.read_bytes()).hexdigest();scene['approval']='pending actual visual review'
bpy.ops.wm.save_as_mainfile(filepath=str(PKG/'source/dcc/golden-base-boy-v1-runtime.blend'),compress=True)
(OUT/'receipt.json').write_text(json.dumps({'renderer':'Blender Cycles','version':bpy.app.version_string,'round':ROUND,'modelSha256':scene['sourceModelSha256'],'source':'build/character.glb','views':['front','side','back','three-quarter'],'morphRenders':['neutral','Blink.L','Smile','MouthOpen'],'status':'rendered, awaiting actual art review','productionReady':False},indent=2))
