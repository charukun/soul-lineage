"""Real Blender diagnostic renders of the shipped Forge GLB. Never generated-image evidence."""
import bpy
import json
import math
from mathutils import Vector
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
PKG = ROOT/'packages/assets/characters/forge/golden-base-boy-v1'
OUT = PKG/'review/dcc-round-0'
OUT.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(PKG/'build/character.glb'))
objects = [{'name':o.name,'type':o.type,'vertices':len(o.data.vertices) if o.type=='MESH' else None} for o in bpy.context.scene.objects]
(OUT/'scene-inspection.json').write_text(json.dumps({'blender':bpy.app.version_string,'importedModel':'build/character.glb','objects':objects,'role':'read-only initial GLB inspection before DCC correction'},indent=2))
scene=bpy.context.scene
scene.render.engine='CYCLES'; scene.cycles.samples=20; scene.cycles.use_denoising=True
scene.render.resolution_x=768; scene.render.resolution_y=768; scene.render.resolution_percentage=100
scene.render.film_transparent=True
scene.world=bpy.data.worlds.new('Neutral review world');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(1,1,1,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.45
scene.view_settings.view_transform='Standard'
for name,pos,energy,size in [('Key',(-3,-4,5),450,4),('Fill',(3,-1,3),250,3),('Rim',(0,3,4),350,3)]:
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj);obj.location=pos
    obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
camdata=bpy.data.cameras.new('ComparisonCamera');camdata.type='ORTHO';camdata.ortho_scale=1.86
cam=bpy.data.objects.new('ComparisonCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam
for view,pos in [('front',(0,-5,.8)),('side',(5,0,.8)),('back',(0,5,.8))]:
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(OUT/(view+'.png'));bpy.ops.render.render(write_still=True)
(PKG/'source/dcc').mkdir(parents=True,exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(PKG/'source/dcc/pipeline-import.blend'),compress=True)
(OUT/'receipt.json').write_text(json.dumps({'renderer':'Blender Cycles','blenderVersion':bpy.app.version_string,'model':'build/character.glb','views':['front','side','back'],'status':'initial actual render; not visually approved','productionReady':False},indent=2))
