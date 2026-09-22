import argparse,sys,bpy
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument("--out",required=True);a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
arm=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"][0];assert len(arm.data.bones)==41
for n,r in {"upperarm.l":(.15,0,-.75),"lowerarm.l":(0,0,-.65),"upperarm.r":(.15,0,.75),"lowerarm.r":(0,0,.65),"upperleg.l":(.34,0,-.08),"lowerleg.l":(-.55,0,0),"head":(0,.18,0)}.items():
 b=arm.pose.bones.get(n)
 if b:b.rotation_mode="XYZ";b.rotation_euler=r
bpy.context.view_layer.update()
meshes=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.lower() not in {"plane","ground"}]
pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box];lo=Vector((min(v.x for v in pts),min(v.y for v in pts),min(v.z for v in pts)));hi=Vector((max(v.x for v in pts),max(v.y for v in pts),max(v.z for v in pts)));center=(lo+hi)*.5;height=hi.z-lo.z
for o in list(bpy.context.scene.objects):
 if o.type in {"CAMERA","LIGHT"}:bpy.data.objects.remove(o,do_unlink=True)
scene=bpy.context.scene;scene.render.resolution_x=720;scene.render.resolution_y=900;scene.render.resolution_percentage=100;scene.render.image_settings.file_format="PNG";scene.world.color=(.045,.048,.052)
try:scene.render.engine="BLENDER_EEVEE_NEXT"
except:scene.render.engine="BLENDER_EEVEE"
def look(o,t):o.rotation_euler=(t-o.location).to_track_quat("-Z","Y").to_euler()
dist=max(2.4,height*2.5);target=Vector((center.x,center.y,lo.z+height*.52))
bpy.ops.object.camera_add(location=(center.x,center.y-dist,target.z));cam=bpy.context.object;cam.data.type="ORTHO";cam.data.ortho_scale=height*1.18;scene.camera=cam;look(cam,target)
for loc,e,size in [((center.x-2.4,center.y-2.8,hi.z+1),720,3.3),((center.x+2.6,center.y-1.4,target.z+.4),360,3),((center.x,center.y+2.7,hi.z+.6),500,2.6)]:
 bpy.ops.object.light_add(type="AREA",location=loc);l=bpy.context.object;l.data.energy=e;l.data.size=size;look(l,target)
out=Path(a.out);out.mkdir(parents=True,exist_ok=True)
for name,loc in {"pose-front":Vector((center.x,center.y-dist,target.z)),"pose-side":Vector((center.x+dist,center.y,target.z))}.items():
 cam.location=loc;look(cam,target);scene.render.filepath=str(out/f"{name}.png");bpy.ops.render.render(write_still=True)
