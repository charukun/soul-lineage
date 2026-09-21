import argparse,sys,bpy
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument("--out",required=True);a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
def bb(o):
 q=[o.matrix_world@Vector(c) for c in o.bound_box];return Vector((min(v.x for v in q),min(v.y for v in q),min(v.z for v in q))),Vector((max(v.x for v in q),max(v.y for v in q),max(v.z for v in q)))
def edit(o,sx=1,sy=1,sz=1,dx=0,dy=0,dz=0):
 lo,hi=bb(o);c=(lo+hi)*.5;inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  w=o.matrix_world@v.co;v.co=inv@(c+Vector(((w.x-c.x)*sx,(w.y-c.y)*sy,(w.z-c.z)*sz))+Vector((dx,dy,dz))
 )
arm=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"][0];assert len(arm.data.bones)==41
head=bpy.data.objects.get("RINNE_FemaleHead")
if head:
 lo,hi=bb(head);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;inv=head.matrix_world.inverted()
 for v in head.data.vertices:
  w=head.matrix_world@v.co;t=(w.z-lo.z)/max(.001,hi.z-lo.z);lift=max(0,.46-t)*.10;sx=.90 if t<.32 else (.97 if t<.62 else 1)
  v.co=inv@Vector((cx+(w.x-cx)*sx,cy+(w.y-cy)*.99,w.z+lift))
bob=bpy.data.objects.get("RINNE_FemaleBob")
if bob:
 lo,hi=bb(bob);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;inv=bob.matrix_world.inverted()
 for v in bob.data.vertices:
  w=bob.matrix_world@v.co;t=(w.z-lo.z)/max(.001,hi.z-lo.z);s=.86 if t<.26 else (.94 if t<.58 else .99)
  v.co=inv@Vector((cx+(w.x-cx)*s,cy+(w.y-cy)*(.88 if t<.58 else .96),w.z))
crown=bpy.data.objects.get("RINNE_FemaleCrown")
if crown:edit(crown,1.055,1.04,.93,0,.004,-.055)
for i in range(5):
 o=bpy.data.objects.get(f"RINNE_FemaleBang_{i}")
 if o:edit(o,.98,.48,.98,0,.018,-.008)
for n in ("RINNE_FemaleEye_L","RINNE_FemaleEye_R"):
 o=bpy.data.objects.get(n)
 if o:edit(o,.82,.48,.94,0,.016,.006)
for n in ("Protagonist_KnightPart_ArmLeft","Protagonist_KnightPart_ArmRight"):
 o=bpy.data.objects.get(n)
 if o:edit(o,.90,.90,.98,.035 if "Left" in n else -.035,0,0)
mat=bpy.data.materials.get("RINNE_Female_Eye")
if mat and mat.use_nodes:
 b=mat.node_tree.nodes.get("Principled BSDF")
 if b:b.inputs["Base Color"].default_value=(.055,.025,.012,1);b.inputs["Roughness"].default_value=.66
out=Path(a.out);(out/"source").mkdir(parents=True,exist_ok=True);(out/"export").mkdir(parents=True,exist_ok=True)
blend=out/"source/ProtagonistVillagerFemaleV1.blend";bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action="DESELECT");arm.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=="MESH" and o.name.lower() not in {"plane","ground"}:o.select_set(True)
bpy.context.view_layer.objects.active=arm
bpy.ops.export_scene.gltf(filepath=str(out/"export/ProtagonistVillagerFemaleV1.glb"),export_format="GLB",use_selection=True,export_skins=True,export_animations=False,export_yup=True)
