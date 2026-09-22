"""Read-only identification of the real KayKit source before DCC adaptation."""
import argparse, hashlib, json, math, shutil, sys
from pathlib import Path
import bpy
from mathutils import Vector

p = argparse.ArgumentParser()
p.add_argument('--source', required=True)
p.add_argument('--out', required=True)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
source, out = Path(a.source).resolve(), Path(a.out).resolve()
out.mkdir(parents=True, exist_ok=True)
data = source.read_bytes()
assert len(data) == 3616284
assert hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest() == 'c8827661105eef7b2bfbef3bc676d41a47625733'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=str(source))
report = {'sourceSha256': hashlib.sha256(data).hexdigest(), 'sourceBytes': len(data), 'objects': [], 'actions': []}
for ob in bpy.data.objects:
    row = {'name': ob.name, 'type': ob.type, 'parent': ob.parent.name if ob.parent else None, 'location': list(ob.location), 'scale': list(ob.scale)}
    if ob.type == 'MESH':
        points = [ob.matrix_world @ v.co for v in ob.data.vertices]
        row.update(vertices=len(points), faces=len(ob.data.polygons), bounds=[[min(v[i] for v in points), max(v[i] for v in points)] for i in range(3)], materials=[s.name for s in ob.data.materials], groups=[g.name for g in ob.vertex_groups])
    if ob.type == 'ARMATURE':
        row['bones'] = [{'name':b.name,'head':list(b.head_local),'tail':list(b.tail_local),'parent':b.parent.name if b.parent else None} for b in ob.data.bones]
        ob.data.pose_position = 'REST'
    if ob.animation_data:
        ob.animation_data.action = None
        for tr in ob.animation_data.nla_tracks: tr.mute = True
    report['objects'].append(row)
for action in bpy.data.actions:
    report['actions'].append({'name':action.name,'frames':list(action.frame_range)})
for image in bpy.data.images:
    if image.size[0] > 0:
        image.filepath_raw = str(out / (image.name.replace('/', '_') + '.png'))
        image.file_format = 'PNG'
        image.save()
for ob in bpy.data.objects:
    if ob.name in ['Knife_Offhand','1H_Crossbow','2H_Crossbow','Knife','Throwable']:
        ob.hide_render = True
        ob.hide_set(True)
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH' and not o.hide_render]
points = [o.matrix_world @ Vector(v) for o in meshes for v in o.bound_box]
mins = Vector(tuple(min(v[i] for v in points) for i in range(3)))
maxs = Vector(tuple(max(v[i] for v in points) for i in range(3)))
center=(mins+maxs)*.5
height=maxs.z-mins.z
report['visibleBounds']=[list(mins),list(maxs)]
(out/'inspection.json').write_text(json.dumps(report,indent=2))
shutil.copyfile(source,out/'Rogue-source.glb')
scene=bpy.context.scene
scene.render.engine='CYCLES'
scene.cycles.device='CPU'
scene.cycles.samples=16
scene.cycles.use_denoising=True
scene.render.resolution_x=768
scene.render.resolution_y=960
scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.world=bpy.data.worlds.new('Neutral World')
scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.33,.38,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
scene.view_settings.view_transform='Standard'
scene.view_settings.look='Medium High Contrast' if 'Medium High Contrast' in [i.identifier for i in scene.view_settings.bl_rna.properties['look'].enum_items] else 'None'
def light(name, location, power, size):
    d=bpy.data.lights.new(name,'AREA');d.energy=power;d.shape='DISK';d.size=size
    o=bpy.data.objects.new(name,d);scene.collection.objects.link(o);o.location=location
    o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
light('Key',center+Vector((height*2,-height*3,height*3)),1000,height*2)
light('Fill',center+Vector((-height*2,-height,height)),500,height*2)
light('Back',center+Vector((height,height*2,height*2)),700,height*2)
camdata=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdata);scene.collection.objects.link(cam);scene.camera=cam
camdata.type='ORTHO';camdata.ortho_scale=height*1.3
for name,deg in [('front',0),('three-quarter',35),('side',90),('back',180)]:
    ang=math.radians(deg)
    cam.location=center+Vector((math.sin(ang)*height*3,-math.cos(ang)*height*3,height*.06))
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('HEROINE_BASELINE_IDENTIFIED', json.dumps({'objects':len(report['objects']),'height':height,'output':str(out)}))
