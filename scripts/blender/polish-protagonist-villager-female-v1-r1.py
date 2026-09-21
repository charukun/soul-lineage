import argparse,sys,hashlib,json,bpy
from pathlib import Path
from mathutils import Vector
p=argparse.ArgumentParser();p.add_argument("--out",required=True);a=p.parse_args(sys.argv[sys.argv.index("--")+1:])
def bb(o):
 q=[o.matrix_world@Vector(c) for c in o.bound_box];return Vector((min(v.x for v in q),min(v.y for v in q),min(v.z for v in q))),Vector((max(v.x for v in q),max(v.y for v in q),max(v.z for v in q)))
def edit(o,sx=1,sy=1,sz=1,dy=0,dz=0):
 lo,hi=bb(o);c=(lo+hi)*.5;inv=o.matrix_world.inverted()
 for v in o.data.vertices:
  w=o.matrix_world@v.co;v.co=inv@(c+Vector(((w.x-c.x)*sx,(w.y-c.y)*sy,(w.z-c.z)*sz))+Vector((0,dy,dz)))
arm=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"][0]
assert len(arm.data.bones)==41
for n,sx,sy in [("Protagonist_KnightPart_ArmLeft",.90,.86),("Protagonist_KnightPart_ArmRight",.90,.86),("Protagonist_KnightPart_LegLeft",.92,.91),("Protagonist_KnightPart_LegRight",.92,.91)]:
 o=bpy.data.objects.get(n)
 if o:edit(o,sx,sy)
body=bpy.data.objects.get("Protagonist_RogueTunic_Body")
if body:
 lo,hi=bb(body);cx=(lo.x+hi.x)/2;cy=(lo.y+hi.y)/2;inv=body.matrix_world.inverted()
 for v in body.data.vertices:
  w=body.matrix_world@v.co;t=(w.z-lo.z)/max(.001,hi.z-lo.z);sx=1.03 if t<.26 else (.93 if t<.58 else (.955 if t<.84 else .91));sy=.94 if .25<t<.78 else .97
  v.co=inv@Vector((cx+(w.x-cx)*sx,cy+(w.y-cy)*sy,w.z))
head=bpy.data.objects.get("RINNE_FemaleHead")
if head:edit(head,.91,.96,.99,0,-.012)
for n,sx,sy,sz,dy,dz in [
("RINNE_FemaleBob",.94,.92,1,0.006,-.005),("RINNE_FemaleFringeBase",.92,.70,.62,.028,.035),
("RINNE_FemaleSideLock_L",.90,.80,1.04,.012,-.012),("RINNE_FemaleSideLock_R",.90,.80,1.04,.012,-.012),
("RINNE_FemaleEye_L",.88,.45,.78,.020,0),("RINNE_FemaleEye_R",.88,.45,.78,.020,0),
("RINNE_FemaleEyeHi_L",.70,.55,.70,.020,0),("RINNE_FemaleEyeHi_R",.70,.55,.70,.020,0),
("RINNE_FemaleNose",.72,.58,.78,.020,-.006),("RINNE_FemaleMouth",.88,.58,.62,.017,.002)]:
 o=bpy.data.objects.get(n)
 if o:edit(o,sx,sy,sz,dy,dz)
for i in range(5):
 o=bpy.data.objects.get(f"RINNE_FemaleBang_{i}")
 if o:edit(o,.90,.72,.94,.018,.004)
out=Path(a.out);(out/"source").mkdir(parents=True,exist_ok=True);(out/"export").mkdir(parents=True,exist_ok=True)
blend=out/"source/ProtagonistVillagerFemaleV1.blend";bpy.ops.wm.save_as_mainfile(filepath=str(blend))
bpy.ops.object.select_all(action="DESELECT");arm.select_set(True)
for o in bpy.context.scene.objects:
 if o.type=="MESH" and o.name.lower() not in {"plane","ground"}:o.select_set(True)
bpy.context.view_layer.objects.active=arm
glb=out/"export/ProtagonistVillagerFemaleV1.glb";bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",use_selection=True,export_skins=True,export_animations=False,export_yup=True)
h=lambda f:hashlib.sha256(Path(f).read_bytes()).hexdigest()
(out/"build.json").write_text(json.dumps({"round":1,"boneCount":41,"blendSha256":h(blend),"glbSha256":h(glb),"visualApproval":"pending","productionStage":"PRIMARY"},indent=2)+"\n")
