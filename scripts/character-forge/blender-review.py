import argparse,json
from pathlib import Path
import bpy
from mathutils import Vector
argv=__import__('sys').argv
argv=argv[argv.index('--')+1:] if '--' in argv else []
parser=argparse.ArgumentParser();parser.add_argument('--package',required=True);args=parser.parse_args(argv)
package=Path(args.package).resolve();out=package/'review/blender';out.mkdir(parents=True,exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(package/'build/character.glb'))
meshes=[o for o in bpy.context.scene.objects if o.type=='MESH'];arms=[o for o in bpy.context.scene.objects if o.type=='ARMATURE']
for obj in meshes:
    for poly in obj.data.polygons:poly.use_smooth=True
sockets=[o.name for o in bpy.context.scene.objects if o.name.startswith('socket_')]
morphs=sorted({key.name for obj in meshes if obj.data.shape_keys for key in obj.data.shape_keys.key_blocks if key.name!='Basis'})
if not arms:raise RuntimeError('Golden Base import has no armature')
if not {'socket_head','socket_leftHand','socket_rightHand','socket_weapon'}.issubset(sockets):raise RuntimeError('Golden Base required sockets missing')
if not {'Blink','Smile','MouthOpen'}.issubset(morphs):raise RuntimeError('Golden Base required morphs missing')
scene=bpy.context.scene;scene.render.engine='BLENDER_EEVEE_NEXT';scene.render.resolution_x=512;scene.render.resolution_y=512;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.93,.95,.95)
data=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',data);scene.collection.objects.link(cam);scene.camera=cam;data.type='ORTHO';data.ortho_scale=1.9
for label,energy,loc in [('Key',900,(-3,4,5)),('Fill',500,(4,-3,3))]:
    light=bpy.data.lights.new(label,'AREA');light.energy=energy;light.size=4;obj=bpy.data.objects.new(label,light);scene.collection.objects.link(obj);obj.location=loc
target=Vector((0,.8,0));shots={'front':Vector((0,-6,.8)),'side':Vector((6,0,.8)),'back':Vector((0,6,.8))}
for name,pos in shots.items():
    cam.location=pos;cam.rotation_euler=(target-pos).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)
bpy.ops.wm.save_as_mainfile(filepath=str(package/'source/golden-base.blend'))
(out/'review.json').write_text(json.dumps({'armatures':[o.name for o in arms],'meshCount':len(meshes),'morphs':morphs,'sockets':sorted(sockets),'renders':{n:f'review/blender/{n}.png' for n in shots}},ensure_ascii=False,indent=2)+'\n')
