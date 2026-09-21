import argparse,sys,bpy
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument("--out",required=True);a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
def bb(o):
 q=[o.matrix_world@Vector(c) for c in o.bound_box];return Vector((min(v.x for v in q),min(v.y for v in q),min(v.z for v in q))),Vector((max(v.x for v in q),max(v.y for v in q),max(v.z for v in q)))
def edit(o,sx=1,sy=1,sz=1,dx=0,dy=0,dz=0):
 lo,hi=bb(o);c=(lo+hi)*.5;inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  w=o.matrix_world@v.co;v.co=inv@(c+Vector(((w.x-c.x)*sx,(w.y-c.y)*sy,(w.z-c.z)*sz))+Vector((dx,dy,dz)))
arm=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"][0];assert len(arm.data.bones)==41
head=bpy.data.objects.get("RINNE_FemaleHead")
if head:
 lo,hi=bb(head);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;inv=head.matrix_world.inverted()
 for v in head.data.vertices:
  w=head.matrix_world@v.co;t=(w.z-lo.z)/max(.001,hi.z-lo.z);sx=.84 if t<.38 else (.93 if t<.70 else .97);sy=.95 if t<.65 else .98
  v.co=inv@Vector((cx+(w.x-cx)*sx,cy+(w.y-cy)*sy,w.z))
for n,sx,sy,sz,dx,dy,dz in [
("RINNE_FemaleBob",.93,.82,.90,0,.010,-.025),
("RINNE_FemaleSideLock_L",.94,.88,1.08,-.006,.010,-.020),
("RINNE_FemaleSideLock_R",.94,.88,1.08,.006,.010,-.020),
("RINNE_FemaleEye_L",.90,.55,.84,0,.024,.012),("RINNE_FemaleEye_R",.90,.55,.84,0,.024,.012),
("RINNE_FemaleEyeHi_L",.82,.60,.82,0,.024,.012),("RINNE_FemaleEyeHi_R",.82,.60,.82,0,.024,.012),
("RINNE_FemaleNose",.82,.70,.86,0,.018,-.006),("RINNE_FemaleMouth",.92,.72,.72,0,.012,.012)]:
 o=bpy.data.objects.get(n)
 if o:edit(o,sx,sy,sz,dx,dy,dz)
for n in ("Protagonist_KnightPart_ArmLeft","Protagonist_KnightPart_ArmRight"):
 o=bpy.data.objects.get(n)
 if o:
  edit(o,.94,.92,.99,.045 if "Left" in n else -.045,0,0)
fr=bpy.data.objects.get("RINNE_FemaleFringeBase")
if fr:bpy.data.objects.remove(fr,do_unlink=True)
for i in range(5):
 o=bpy.data.objects.get(f"RINNE_FemaleBang_{i}")
 if o:edit(o,.96,.78,1.02,0,.012,-.012 if i in (0,4) else 0)
if not bpy.data.objects.get("RINNE_FemaleCrown"):
 lo,hi=bb(head);c=(lo+hi)*.5
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2,radius=1,location=(c.x,c.y+.035,hi.z-.060))
 o=bpy.context.object;o.name="RINNE_FemaleCrown";o.scale=(.315,.265,.205);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 mat=bpy.data.materials.get("RINNE_Female_Hair");o.data.materials.append(mat)
 g=o.vertex_groups.new(name="head");g.add(list(range(len(o.data.vertices))),1.0,"REPLACE");m=o.modifiers.new("FemaleProtagonistArmature","ARMATURE");m.object=arm;o.parent=arm
out=Path(a.out);(out/"source").mkdir(parents=True,exist_ok=True);(out/"export").mkdir(parents=True,exist_ok=True)
blend=out/"source/ProtagonistVillagerFemaleV1.blend";bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action="DESELECT");arm.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=="MESH" and o.name.lower() not in {"plane","ground"}:o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/"export/ProtagonistVillagerFemaleV1.glb"),export_format="GLB",use_selection=True,export_skins=True,export_animations=False,export_yup=True)
