"""Build a female protagonist variant from the audited protagonist villager DCC source."""
from __future__ import annotations
import argparse, hashlib, json, sys
from pathlib import Path
import bpy
from mathutils import Vector

CHARACTER_ID="protagonist.villager.female.v1"
REFERENCE_PATH="docs/characters/references/protagonist-villager-female-v1.svg"

def parse_args():
    p=argparse.ArgumentParser(); p.add_argument("--out",required=True)
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    return p.parse_args(argv)

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for c in iter(lambda:f.read(1024*1024),b""): h.update(c)
    return h.hexdigest()

def bounds(meshes):
    pts=[o.matrix_world@Vector(c) for o in meshes for c in o.bound_box]
    return min(p.z for p in pts),max(p.z for p in pts)

def profile(t):
    if t<.32:return .94
    if t<.46:return 1.075
    if t<.58:return .89
    if t<.77:return .91
    if t<.86:return .97
    return 1.0

def reshape(meshes):
    z0,z1=bounds(meshes); span=max(.001,z1-z0)
    for o in meshes:
        inv=o.matrix_world.inverted()
        for v in o.data.vertices:
            w=o.matrix_world@v.co; t=max(0,min(1,(w.z-z0)/span))
            w.x*=profile(t)
            if .33<t<.82:w.y*=.96
            v.co=inv@w

def find_bone(arm,names,contains):
    for n in names:
        if arm.data.bones.get(n):return n
    for b in arm.data.bones:
        if contains in b.name.lower():return b.name
    raise RuntimeError("required bone not found: "+contains)

def bone_world(arm,name,tail=False):
    b=arm.data.bones[name]; return arm.matrix_world@(b.tail_local if tail else b.head_local)

def bind(obj,arm,bone):
    if obj.type=="MESH" and len(obj.data.uv_layers)==0:obj.data.uv_layers.new(name="UVMap")
    g=obj.vertex_groups.new(name=bone); g.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
    m=obj.modifiers.new("FemaleProtagonistArmature","ARMATURE");m.object=arm;obj.parent=arm

def material(name,color,rough=.82):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name);m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    if b:b.inputs["Base Color"].default_value=color;b.inputs["Roughness"].default_value=rough;b.inputs["Metallic"].default_value=0
    return m

def hair_lock(name,start,end,radius,bend,mat,arm,bone):
    c=bpy.data.curves.new(name+"Curve","CURVE");c.dimensions="3D";c.resolution_u=2;c.bevel_depth=radius;c.bevel_resolution=1
    s=c.splines.new("BEZIER");s.bezier_points.add(2)
    mid=(start+end)*.5+Vector((bend,.035,.025))
    for p,co in zip(s.bezier_points,[start,mid,end]):p.co=co;p.handle_left_type="AUTO";p.handle_right_type="AUTO"
    o=bpy.data.objects.new(name,c);bpy.context.collection.objects.link(o);o.data.materials.append(mat)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target="MESH");o=bpy.context.object;bind(o,arm,bone);return o

def add_hair(arm):
    head=find_bone(arm,["Head","head","DEF-head","mixamorig:Head"],"head")
    a=bone_world(arm,head);b=bone_world(arm,head,True);h=max(.12,(b-a).length);c=a.lerp(b,.62)
    mat=material("PROTAGONIST_FEMALE_HAIR",(0.16,.085,.045,1),.78)
    rows=[
      ("FemaleHair_Left",c+Vector((-.10,-.015,.055)),c+Vector((-.115,.005,-h*.95)),.030,-.018),
      ("FemaleHair_Right",c+Vector((.10,-.015,.055)),c+Vector((.115,.005,-h*.95)),.030,.018),
      ("FemaleHair_BackL",c+Vector((-.055,.065,.045)),c+Vector((-.070,.080,-h*1.05)),.034,-.015),
      ("FemaleHair_BackR",c+Vector((.055,.065,.045)),c+Vector((.070,.080,-h*1.05)),.034,.015),
      ("FemaleHair_Braid",c+Vector((.085,.060,-.015)),c+Vector((.115,.075,-h*1.35)),.024,.010)]
    return [hair_lock(*r,mat,arm,head) for r in rows]

def recolor(meshes):
    palette=[(.73,.66,.52,1),(.23,.34,.27,1),(.20,.12,.08,1),(.50,.34,.19,1),(.67,.48,.34,1)]
    seen=[]
    for o in meshes:
        for m in o.data.materials:
            if m and m not in seen:seen.append(m)
    for i,m in enumerate(seen):
        if not m.use_nodes:continue
        b=m.node_tree.nodes.get("Principled BSDF")
        if b:b.inputs["Base Color"].default_value=palette[i%len(palette)];b.inputs["Roughness"].default_value=max(.65,b.inputs["Roughness"].default_value)

def add_waist(arm):
    hips=find_bone(arm,["Hips","hips","DEF-pelvis","mixamorig:Hips"],"hip");p=bone_world(arm,hips)
    mat=material("PROTAGONIST_FEMALE_CLOTH",(.24,.36,.28,1),.9);out=[]
    for name,x,rot in [("FemaleWaistCloth_L",-.105,-.10),("FemaleWaistCloth_R",.105,.10)]:
        bpy.ops.mesh.primitive_cube_add(size=1,location=p+Vector((x,-.055,-.095)),rotation=(.03,rot,0));o=bpy.context.object;o.name=name;o.scale=(.092,.026,.155)
        bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
        mod=o.modifiers.new("SoftClothEdge","BEVEL");mod.width=.010;mod.segments=1;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
        o.data.materials.append(mat);bind(o,arm,hips);out.append(o)
    return out

def look(obj,target):obj.rotation_euler=(target-obj.location).to_track_quat("-Z","Y").to_euler()

def render(outdir):
    scene=bpy.context.scene
    try:scene.render.engine="BLENDER_EEVEE_NEXT"
    except:scene.render.engine="BLENDER_EEVEE"
    scene.render.resolution_x=640;scene.render.resolution_y=800;scene.render.resolution_percentage=100;scene.render.image_settings.file_format="PNG"
    for o in list(scene.objects):
        if o.type in {"CAMERA","LIGHT"}:bpy.data.objects.remove(o,do_unlink=True)
    meshes=[o for o in scene.objects if o.type=="MESH" and o.name.lower() not in {"plane","ground"}]
    z0,z1=bounds(meshes);target=Vector((0,0,(z0+z1)*.5));height=z1-z0;dist=max(3,height*2.7)
    bpy.ops.object.camera_add(location=(0,-dist,target.z));cam=bpy.context.object;cam.data.type="ORTHO";cam.data.ortho_scale=height*1.22;scene.camera=cam
    for loc,e,size in [((-2.5,-3,z1+1.2),850,3.5),((2.4,-1,target.z+.6),430,3),((0,2.8,z1+.8),520,2.8)]:
        bpy.ops.object.light_add(type="AREA",location=loc);l=bpy.context.object;l.data.energy=e;l.data.size=size;look(l,target)
    outdir.mkdir(parents=True,exist_ok=True)
    views={"front":Vector((0,-dist,target.z)),"side":Vector((dist,0,target.z)),"back":Vector((0,dist,target.z)),"three-quarter":Vector((dist*.70,-dist*.70,target.z+height*.03))}
    for name,loc in views.items():cam.location=loc;look(cam,target);scene.render.filepath=str(outdir/f"{name}.png");bpy.ops.render.render(write_still=True)

def main():
    args=parse_args();out=Path(args.out).resolve();src=out/"source";exp=out/"export";rev=out/"review";src.mkdir(parents=True,exist_ok=True);exp.mkdir(parents=True,exist_ok=True)
    arms=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"];meshes=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.lower() not in {"plane","ground"}]
    if len(arms)!=1:raise RuntimeError(f"Expected one armature, got {len(arms)}")
    if not meshes:raise RuntimeError("No protagonist meshes")
    arm=arms[0];reshape(meshes);recolor(meshes);add_hair(arm);add_waist(arm)
    blend=src/"ProtagonistVillagerFemaleV1.blend";bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    glb=exp/"ProtagonistVillagerFemaleV1.glb";bpy.ops.object.select_all(action="DESELECT");arm.select_set(True)
    for o in bpy.context.scene.objects:
        if o.type=="MESH" and o.name.lower() not in {"plane","ground"}:o.select_set(True)
    bpy.context.view_layer.objects.active=arm
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",use_selection=True,export_skins=True,export_animations=False,export_yup=True)
    render(rev)
    export_meshes=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.name.lower() not in {"plane","ground"}]
    tri=sum(max(0,len(p.vertices)-2) for o in export_meshes for p in o.data.polygons)
    mats={m.name for o in export_meshes for m in o.data.materials if m}
    build={"schema":"protagonist-female-dcc-build","version":1,"characterId":CHARACTER_ID,"referencePath":REFERENCE_PATH,"blenderVersion":bpy.app.version_string,"meshObjects":len(export_meshes),"trianglesApprox":tri,"materials":len(mats),"rigFamily":"Rig_Medium","sourceVariant":"protagonist.villager.v1","styleFamily":"rinne-kaykit-compatible-low-poly","role":"protagonist","presentation":"female","wardrobe":"humble-village-start","armor":False,"blendSha256":sha256(blend),"glbSha256":sha256(glb),"productionStage":"PRIMARY","productionReady":False,"visualApproval":"pending"}
    (out/"build.json").write_text(json.dumps(build,ensure_ascii=False,indent=2)+"\n",encoding="utf-8");print(json.dumps(build,ensure_ascii=False,indent=2))
if __name__=="__main__":main()
