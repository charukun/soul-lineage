"""Visual refinement pass for protagonist.villager.female.v1.

Replaces the inherited Knight head silhouette with RINNE-authored low-poly head/hair
geometry while preserving the canonical Rig_Medium armature and existing body skinning.
The script is intentionally deterministic so fixed-view review can compare rounds.
"""
from __future__ import annotations
import argparse, hashlib, json, math, sys
from pathlib import Path
import bpy
from mathutils import Vector

CHARACTER_ID="protagonist.villager.female.v1"

def parse_args():
    p=argparse.ArgumentParser(); p.add_argument("--out",required=True)
    argv=sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else []
    return p.parse_args(argv)

def sha256(path):
    h=hashlib.sha256()
    with open(path,"rb") as f:
        for c in iter(lambda:f.read(1024*1024),b""): h.update(c)
    return h.hexdigest()

def object_bounds(obj):
    pts=[obj.matrix_world@Vector(c) for c in obj.bound_box]
    lo=Vector((min(p.x for p in pts),min(p.y for p in pts),min(p.z for p in pts)))
    hi=Vector((max(p.x for p in pts),max(p.y for p in pts),max(p.z for p in pts)))
    return lo,hi

def material(name,color,rough=.82):
    m=bpy.data.materials.get(name) or bpy.data.materials.new(name=name)
    m.use_nodes=True
    b=m.node_tree.nodes.get("Principled BSDF")
    if b:
        b.inputs["Base Color"].default_value=color
        b.inputs["Roughness"].default_value=rough
        b.inputs["Metallic"].default_value=0.0
    return m

def add_uv(mesh):
    if len(mesh.uv_layers)==0: mesh.uv_layers.new(name="UVMap")

def bind_rigid(obj,arm,bone):
    g=obj.vertex_groups.new(name=bone); g.add(list(range(len(obj.data.vertices))),1.0,"REPLACE")
    mod=obj.modifiers.new("FemaleProtagonistArmature","ARMATURE"); mod.object=arm
    obj.parent=arm

def mesh_object(name,verts,faces,mat,arm,bone,smooth=False):
    mesh=bpy.data.meshes.new(name+"Mesh"); mesh.from_pydata(verts,[],faces); mesh.update(); add_uv(mesh)
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); mesh.materials.append(mat)
    for p in mesh.polygons: p.use_smooth=smooth
    bind_rigid(obj,arm,bone)
    return obj

def closed_rings(name,center,rings,segments,mat,arm,bone,smooth=True):
    verts=[]; faces=[]
    for z,rx,ry,yoff in rings:
        for i in range(segments):
            t=2*math.pi*i/segments
            verts.append((center.x+rx*math.cos(t),center.y+yoff+ry*math.sin(t),center.z+z))
    for r in range(len(rings)-1):
        a=r*segments; b=(r+1)*segments
        for i in range(segments):
            j=(i+1)%segments
            faces.append((a+i,a+j,b+j,b+i))
    bottom=len(verts); verts.append((center.x,center.y+rings[0][3],center.z+rings[0][0]))
    top=len(verts); verts.append((center.x,center.y+rings[-1][3],center.z+rings[-1][0]))
    for i in range(segments):
        j=(i+1)%segments
        faces.append((bottom,j,i))
        a=(len(rings)-1)*segments
        faces.append((top,a+i,a+j))
    return mesh_object(name,verts,faces,mat,arm,bone,smooth)

def arc_shell(name,center,rings,segments,start,end,mat,arm,bone):
    verts=[]; faces=[]
    for z,rx,ry,yoff in rings:
        for i in range(segments+1):
            t=start+(end-start)*i/segments
            verts.append((center.x+rx*math.cos(t),center.y+yoff+ry*math.sin(t),center.z+z))
    row=segments+1
    for r in range(len(rings)-1):
        for i in range(segments):
            a=r*row+i; b=(r+1)*row+i
            faces.append((a,a+1,b+1,b))
    return mesh_object(name,verts,faces,mat,arm,bone,False)

def prism(name,front,back,mat,arm,bone,smooth=False):
    verts=front+back
    faces=[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)]
    return mesh_object(name,verts,faces,mat,arm,bone,smooth)

def tapered_panel(name,top_left,top_right,bottom_right,bottom_left,depth,mat,arm,bone):
    front=[top_left,top_right,bottom_right,bottom_left]
    back=[(x,y+depth,z) for x,y,z in front]
    return prism(name,front,back,mat,arm,bone)

def set_palette():
    colors={
      "PROTAGONIST_SKIN":((.88,.66,.52,1),.88),
      "PROTAGONIST_LINEN":((.78,.72,.60,1),.92),
      "PROTAGONIST_OLIVE":((.20,.31,.23,1),.90),
      "PROTAGONIST_LEATHER":((.19,.105,.06,1),.84),
    }
    for name,(color,rough) in colors.items():
        m=bpy.data.materials.get(name)
        if not m: continue
        m.use_nodes=True; b=m.node_tree.nodes.get("Principled BSDF")
        if b: b.inputs["Base Color"].default_value=color; b.inputs["Roughness"].default_value=rough

def reshape_tunic():
    body=bpy.data.objects.get("Protagonist_RogueTunic_Body")
    if not body: return
    lo,hi=object_bounds(body); cx=(lo.x+hi.x)*.5
    inv=body.matrix_world.inverted()
    for v in body.data.vertices:
        w=body.matrix_world@v.co
        t=(w.z-lo.z)/max(.001,hi.z-lo.z)
        if t>.72: sx=.92
        elif t>.42: sx=.86
        else: sx=1.035
        w.x=cx+(w.x-cx)*sx
        if .35<t<.82: w.y*=.965
        v.co=inv@w

def remove_old_head_parts():
    for obj in list(bpy.context.scene.objects):
        if obj.name=="Protagonist_KnightPart_Head" or obj.name.startswith("FemaleHair_") or obj.name.startswith("FemaleWaistCloth_") or obj.name.startswith("RINNE_Female"):
            bpy.data.objects.remove(obj,do_unlink=True)

def create_head(arm,old_lo,old_hi):
    head_bone=arm.data.bones.get("head")
    if not head_bone: raise RuntimeError("Rig_Medium head bone missing")
    center=(old_lo+old_hi)*.5
    # Keep chibi proportion but reduce the inherited square Knight skull.
    center.z-=.015
    skin=material("RINNE_Female_Skin",(.90,.68,.55,1),.86)
    hair=material("RINNE_Female_Hair",(.16,.075,.045,1),.78)
    eye=material("RINNE_Female_Eye",(.20,.10,.045,1),.55)
    eye_hi=material("RINNE_Female_EyeHighlight",(.72,.46,.19,1),.42)
    cloth=material("RINNE_Female_Cloth",(.19,.32,.24,1),.91)
    dark=material("RINNE_Female_Dark",(.11,.065,.045,1),.82)

    head=closed_rings("RINNE_FemaleHead",center,[
      (-.34,.12,.13,-.010),
      (-.28,.225,.21,-.018),
      (-.13,.315,.275,-.025),
      (.07,.335,.292,-.018),
      (.24,.305,.270,.000),
      (.34,.225,.205,.018),
    ],14,skin,arm,"head",True)

    # Bob cap: open frontal wedge keeps the face readable; lower back reaches the nape.
    gap=.92
    start=-math.pi/2+gap
    end=-math.pi/2-gap+2*math.pi
    cap=arc_shell("RINNE_FemaleBob",center,[
      (-.18,.35,.315,.035),
      (.03,.375,.335,.025),
      (.23,.345,.310,.012),
      (.37,.245,.225,.005),
    ],18,start,end,hair,arm,"head")

    # Five deliberately uneven wedge-shaped bangs, not repeated tubes.
    y0=center.y-.300
    bang_specs=[
      (-.27,-.15,.31,.07,.012),
      (-.16,-.045,.34,.025,-.010),
      (-.055,.055,.35,.08,.006),
      (.045,.16,.33,.035,.010),
      (.15,.27,.30,.09,-.008),
    ]
    for idx,(xl,xr,zt,zb,lean) in enumerate(bang_specs):
        mid=(xl+xr)*.5+lean
        front=[
          (center.x+xl,y0,center.z+zt),
          (center.x+xr,y0+.008,center.z+zt-.012),
          (center.x+mid+.038,y0-.010,center.z+zb),
          (center.x+mid-.038,y0-.012,center.z+zb-.018),
        ]
        back=[(x,y+.055,z+.012) for x,y,z in front]
        prism(f"RINNE_FemaleBang_{idx}",front,back,hair,arm,"head")

    # Side locks give an unmistakable female silhouette in front/profile.
    for side in (-1,1):
        x=center.x+side*.305
        front=[
          (x-side*.020,center.y-.205,center.z+.18),
          (x+side*.055,center.y-.165,center.z+.12),
          (x+side*.038,center.y-.125,center.z-.18),
          (x-side*.035,center.y-.160,center.z-.24),
        ]
        back=[(vx,vy+.085,vz+.018) for vx,vy,vz in front]
        prism("RINNE_FemaleSideLock_L" if side<0 else "RINNE_FemaleSideLock_R",front,back,hair,arm,"head")

    # Eyes are larger, lower and warmer than the inherited Knight face.
    for side in (-1,1):
        ec=Vector((center.x+side*.112,center.y-.285,center.z+.020))
        closed_rings("RINNE_FemaleEye_L" if side<0 else "RINNE_FemaleEye_R",ec,[
          (-.040,.052,.017,0),(.0,.064,.021,0),(.040,.050,.016,0)
        ],10,eye,arm,"head",True)
        hc=Vector((ec.x-side*.018,ec.y-.021,ec.z+.018))
        closed_rings("RINNE_FemaleEyeHi_L" if side<0 else "RINNE_FemaleEyeHi_R",hc,[
          (-.010,.014,.006,0),(.010,.014,.006,0)
        ],8,eye_hi,arm,"head",True)

    # Brows: soft outward taper and slight arch.
    for side in (-1,1):
        x=center.x+side*.112; z=center.z+.130
        front=[(x-side*.075,center.y-.294,z+.004),(x+side*.070,center.y-.294,z+.020),(x+side*.065,center.y-.292,z+.006),(x-side*.070,center.y-.292,z-.008)]
        back=[(vx,vy+.018,vz) for vx,vy,vz in front]
        prism("RINNE_FemaleBrow_L" if side<0 else "RINNE_FemaleBrow_R",front,back,hair,arm,"head")

    # Small nose wedge.
    nose_front=[
      (center.x-.028,center.y-.304,center.z+.015),
      (center.x+.028,center.y-.304,center.z+.015),
      (center.x+.018,center.y-.340,center.z-.065),
      (center.x-.018,center.y-.340,center.z-.065),
    ]
    nose_back=[(x,y+.045,z+.010) for x,y,z in nose_front]
    prism("RINNE_FemaleNose",nose_front,nose_back,skin,arm,"head",True)

    # Smile as a slim custom tapered panel.
    mouth_front=[
      (center.x-.082,center.y-.305,center.z-.135),
      (center.x+.082,center.y-.305,center.z-.135),
      (center.x+.060,center.y-.310,center.z-.153),
      (center.x-.060,center.y-.310,center.z-.153),
    ]
    mouth_back=[(x,y+.012,z) for x,y,z in mouth_front]
    prism("RINNE_FemaleMouth",mouth_front,mouth_back,dark,arm,"head")

    # Ears are small and partly covered by side locks.
    for side in (-1,1):
        ec=Vector((center.x+side*.333,center.y-.005,center.z-.010))
        closed_rings("RINNE_FemaleEar_L" if side<0 else "RINNE_FemaleEar_R",ec,[
          (-.060,.027,.024,0),(.0,.038,.030,0),(.060,.027,.024,0)
        ],8,skin,arm,"head",True)
    return [head,cap], cloth

def create_overskirt(arm,cloth):
    hips=arm.data.bones.get("hips")
    if not hips: raise RuntimeError("Rig_Medium hips bone missing")
    body=bpy.data.objects.get("Protagonist_RogueTunic_Body")
    lo,hi=object_bounds(body)
    cx=(lo.x+hi.x)*.5
    ztop=lo.z+(hi.z-lo.z)*.38; zbottom=max(lo.z-.015,ztop-.22)
    yfront=lo.y-.018; yback=hi.y+.018
    tapered_panel("RINNE_FemaleSkirtFront",
      (cx-.255,yfront,ztop),(cx+.255,yfront,ztop),(cx+.315,yfront,zbottom),(cx-.315,yfront,zbottom),
      .030,cloth,arm,"hips")
    # Back panel with opposite thickness direction.
    front=[(cx-.245,yback,ztop),(cx+.245,yback,ztop),(cx+.300,yback,zbottom),(cx-.300,yback,zbottom)]
    back=[(x,y-.030,z) for x,y,z in front]
    prism("RINNE_FemaleSkirtBack",front,back,cloth,arm,"hips")

def export_result(out):
    src=out/"source"; exp=out/"export"; src.mkdir(parents=True,exist_ok=True); exp.mkdir(parents=True,exist_ok=True)
    blend=src/"ProtagonistVillagerFemaleV1.blend"; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    arm=next(o for o in bpy.context.scene.objects if o.type=="ARMATURE")
    bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True)
    meshes=[]
    for o in bpy.context.scene.objects:
        if o.type=="MESH" and o.name.lower() not in {"plane","ground"}:
            o.select_set(True); meshes.append(o)
    bpy.context.view_layer.objects.active=arm
    glb=exp/"ProtagonistVillagerFemaleV1.glb"
    bpy.ops.export_scene.gltf(filepath=str(glb),export_format="GLB",use_selection=True,export_skins=True,export_animations=False,export_yup=True)
    tri=sum(max(0,len(p.vertices)-2) for o in meshes for p in o.data.polygons)
    meta={"characterId":CHARACTER_ID,"blenderVersion":bpy.app.version_string,"meshObjects":len(meshes),"trianglesApprox":tri,
      "materials":len({m.name for o in meshes for m in o.data.materials if m}),"blendSha256":sha256(blend),"glbSha256":sha256(glb),
      "productionStage":"PRIMARY","productionReady":False,"visualApproval":"pending"}
    (out/"build.json").write_text(json.dumps(meta,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    return meta

def main():
    args=parse_args(); out=Path(args.out).resolve()
    armatures=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
    if len(armatures)!=1: raise RuntimeError(f"Expected one Rig_Medium armature, got {len(armatures)}")
    arm=armatures[0]
    old=bpy.data.objects.get("Protagonist_KnightPart_Head")
    if not old: raise RuntimeError("canonical inherited head mesh missing")
    old_lo,old_hi=object_bounds(old)
    set_palette(); reshape_tunic(); remove_old_head_parts()
    _,cloth=create_head(arm,old_lo,old_hi); create_overskirt(arm,cloth)
    meta=export_result(out); print(json.dumps(meta,ensure_ascii=False,indent=2))

if __name__=="__main__": main()
