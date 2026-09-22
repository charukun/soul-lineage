"""Continue the inspected first-pass .blend, not a screenshot or lookalike.
Reproduce: run build.py on pinned Rogue; open its .blend with this script.
"""
import argparse,hashlib,json,math,sys
from pathlib import Path
import bpy
from mathutils import Vector
sys.path.insert(0,str(Path(__file__).resolve().parent))
from dcc_glb import BODY_NAMES,EXPECTED_SHA256,export_edited
from refine import refine
p=argparse.ArgumentParser();p.add_argument('--source',required=True);p.add_argument('--out',required=True)
a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);source=Path(a.source).resolve();out=Path(a.out).resolve();out.mkdir(parents=True,exist_ok=True)
assert hashlib.sha256(source.read_bytes()).hexdigest()==EXPECTED_SHA256
rig=bpy.data.objects['Rig'];rig.data.pose_position='REST';mat=bpy.data.materials['HeroineDawn_SoftClothAndHair'];extras=[o.name for o in bpy.context.scene.objects if o.type=='MESH' and o.name.startswith('Heroine_')]
def surface(name,vertices,faces,col,weights):
    me=bpy.data.meshes.new(name);me.from_pydata(vertices,[],faces);me.update();ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);me.materials.append(mat);uv=me.uv_layers.new(name='UVMap')
    for poly in me.polygons:
        poly.use_smooth=True
        for li in poly.loop_indices:uv.data[li].uv=((col+.5)/8,.15)
    for name_ in set(k for row in weights for k in row):ob.vertex_groups.new(name=name_)
    for i,row in enumerate(weights):
        for k,w in row.items():ob.vertex_groups[k].add([i],w,'REPLACE')
    mod=ob.modifiers.new('Preserved KayKit skin','ARMATURE');mod.object=rig;extras.append(name);return ob
refine(source,surface,extras)
image=bpy.data.images['HeroineDawnPalette'];image.filepath_raw=str(out/'HeroineDawnPalette.png');image.file_format='PNG';image.save();image.pack()
for ob in bpy.data.objects:
    if ob.type=='MESH':
        ob.hide_render=ob.name not in list(BODY_NAMES)+extras
        if ob.name in bpy.context.view_layer.objects:ob.hide_set(ob.hide_render)
bpy.context.view_layer.update()
audit=export_edited(source,out/'HeroineDawn.glb',out/'HeroineDawnPalette.png',extras)
audit.update(authoringTool=bpy.app.version_string,round=2,sourceRig='Rig_Medium',design='rounded chin bob / side-swept fringe / ivory collar and puff sleeves / continuous blue pinafore / rose sash and bows',round1Rejected=['garment gaps exposed by removing source accessories','angular fringe corners','facial custom normals lost on separation'],round2Repairs=['continuous retopologized garment with transferred original body weights','rounded hair edge flow and curved fringe','smooth face and limb normals'])
(out/'inspection.json').write_text(json.dumps(audit,indent=2));bpy.ops.wm.save_as_mainfile(filepath=str(out/'HeroineDawn.blend'),compress=True)
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=48;scene.cycles.use_denoising=False;scene.render.resolution_x=768;scene.render.resolution_y=960;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Neutral World');scene.world.use_nodes=True;scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.24,.27,.31,1);scene.world.node_tree.nodes['Background'].inputs[1].default_value=.8;scene.view_settings.view_transform='Standard';scene.view_settings.look='None';height=2.187;center=Vector((.0079,.01155,height/2))
def light(name,location,power,size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size;o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=location;o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',center+Vector((height*1.5,-height*2,height*2)),750,height*1.5);light('Fill',center+Vector((-height*2,-height,height)),400,height*2);light('Back',center+Vector((height,height*2,height*2)),600,height*2)
camdata=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam;camdata.type='ORTHO'
for name,deg in [('front',0),('three-quarter',35),('side',90),('back',180),('face',0)]:
    ang=math.radians(deg);target=center.copy();camdata.ortho_scale=height*1.3
    if name=='face':target.z=1.72;camdata.ortho_scale=1.18
    cam.location=target+Vector((math.sin(ang)*height*3,-math.cos(ang)*height*3,height*.04));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('HEROINE_DCC_ROUND2',json.dumps(audit))
