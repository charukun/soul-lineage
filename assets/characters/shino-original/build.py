"""Build Shino as a RINNE-authored stylized character on the pinned CC0 Rig_Medium skeleton.

Visible geometry is authored in this script. The imported KayKit character meshes and
materials are discarded; only the armature and animation actions are retained.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

CHARACTER_ID = "npc.shino.original.v1"
MODEL_NAME = "ShinoOriginal"
REFERENCE_PATH = "assets/characters/shino-original/reference.svg"

PALETTE = {
    "skin": (0.94, 0.82, 0.78, 1.0),
    "hair": (0.78, 0.79, 0.82, 1.0),
    "hair_shadow": (0.62, 0.64, 0.69, 1.0),
    "eye": (0.48, 0.16, 0.14, 1.0),
    "eye_dark": (0.18, 0.055, 0.05, 1.0),
    "ivory": (0.88, 0.86, 0.82, 1.0),
    "ivory_shadow": (0.69, 0.69, 0.72, 1.0),
    "charcoal": (0.18, 0.17, 0.18, 1.0),
    "ribbon": (0.27, 0.23, 0.23, 1.0),
    "bronze": (0.42, 0.31, 0.22, 1.0),
    "boot": (0.25, 0.22, 0.21, 1.0),
    "mouth": (0.55, 0.25, 0.25, 1.0),
}

def cli() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--rig-source", "--source", dest="rig_source", required=True)
    parser.add_argument("--out", required=True)
    args = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    return parser.parse_args(args)

def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()

def select_only(obj) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj

def apply_mesh_transform(obj) -> None:
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)

def smooth(obj) -> None:
    if obj.type == "MESH":
        for poly in obj.data.polygons:
            poly.use_smooth = True

def material(name: str, rgba, roughness=0.76, metallic=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Metallic"].default_value = metallic
    alpha = bsdf.inputs.get("Alpha")
    if alpha:
        alpha.default_value = 1.0
    return mat

def smart_uv(obj) -> None:
    if obj.type != "MESH" or not obj.data.polygons:
        return
    select_only(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    try:
        bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.018)
    finally:
        bpy.ops.object.mode_set(mode="OBJECT")
    if len(obj.data.uv_layers) == 0:
        obj.data.uv_layers.new(name="UVMap")

def bind_rigid(obj, armature, bone_name: str) -> None:
    if obj.type != "MESH":
        return
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, "REPLACE")
    mod = obj.modifiers.new("ShinoRig", "ARMATURE")
    mod.object = armature
    obj.parent = armature
    smart_uv(obj)

def bind_vertical(obj, armature, upper_bone: str, lower_bone: str, pivot_z: float, blend=0.18) -> None:
    a = obj.vertex_groups.new(name=upper_bone)
    b = obj.vertex_groups.new(name=lower_bone)
    for v in obj.data.vertices:
        world_z = (obj.matrix_world @ v.co).z
        t = max(0.0, min(1.0, 0.5 + (world_z - pivot_z) / max(blend, 1e-4)))
        a.add([v.index], t, "REPLACE")
        b.add([v.index], 1.0 - t, "REPLACE")
    mod = obj.modifiers.new("ShinoRig", "ARMATURE")
    mod.object = armature
    obj.parent = armature
    smart_uv(obj)

def normalized(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())

def find_bone(armature, *aliases: str):
    rows = list(armature.data.bones)
    normalized_rows = [(bone, normalized(bone.name)) for bone in rows]
    for alias in aliases:
        target = normalized(alias)
        for bone, value in normalized_rows:
            if value == target:
                return bone
    for alias in aliases:
        target = normalized(alias)
        matches = [(len(value), bone) for bone, value in normalized_rows if target in value]
        if matches:
            return sorted(matches, key=lambda row: row[0])[0][1]
    raise RuntimeError(f"Unable to resolve bone from aliases: {aliases}; available={[b.name for b in rows]}")

def resolve_bones(armature) -> dict[str, str]:
    aliases = {
        "hips": ("hips", "pelvis", "hip"),
        "spine": ("spine", "spine1", "chest"),
        "head": ("head",),
        "neck": ("neck",),
        "leftUpperArm": ("leftupperarm", "upperarml", "armleft", "leftarm"),
        "leftLowerArm": ("leftlowerarm", "lowerarml", "forearml", "forearmleft"),
        "leftHand": ("lefthand", "handl", "handleft"),
        "rightUpperArm": ("rightupperarm", "upperarmr", "armright", "rightarm"),
        "rightLowerArm": ("rightlowerarm", "lowerarmr", "forearmr", "forearmright"),
        "rightHand": ("righthand", "handr", "handright"),
        "leftUpperLeg": ("leftupperleg", "upperlegl", "thighl", "thighleft"),
        "leftLowerLeg": ("leftlowerleg", "lowerlegl", "calfl", "shinl"),
        "leftFoot": ("leftfoot", "footl", "footleft"),
        "rightUpperLeg": ("rightupperleg", "upperlegr", "thighr", "thighright"),
        "rightLowerLeg": ("rightlowerleg", "lowerlegr", "calfr", "shinr"),
        "rightFoot": ("rightfoot", "footr", "footright"),
    }
    return {key: find_bone(armature, *rows).name for key, rows in aliases.items()}

def bone_head(armature, names, key: str) -> Vector:
    bone = armature.data.bones[names[key]]
    return armature.matrix_world @ bone.head_local

def bone_tail(armature, names, key: str) -> Vector:
    bone = armature.data.bones[names[key]]
    return armature.matrix_world @ bone.tail_local

def remove_imported_surfaces(armature) -> list[str]:
    removed = []
    for obj in list(bpy.context.scene.objects):
        if obj == armature:
            continue
        if obj.type == "MESH":
            removed.append(obj.name)
            bpy.data.objects.remove(obj, do_unlink=True)
    for image in list(bpy.data.images):
        if image.users == 0:
            bpy.data.images.remove(image)
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)
    return removed

def make_mesh(name, verts, faces, mat, armature, bone=None, bind=None):
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update(calc_edges=True)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    mesh.materials.append(mat)
    smooth(obj)
    if bind:
        bind(obj)
    elif bone:
        bind_rigid(obj, armature, bone)
    else:
        smart_uv(obj)
    return obj

def ellipsoid(name, center, radii, mat, armature, bone, segments=28, rings=18, flatten_back=0.0):
    verts=[]; faces=[]
    for j in range(rings+1):
        phi=math.pi*j/rings
        z=math.cos(phi); sr=math.sin(phi)
        for i in range(segments):
            th=2*math.pi*i/segments
            x=math.cos(th)*sr; y=math.sin(th)*sr
            if flatten_back and y>0:
                y*=1.0-flatten_back
            verts.append((center.x+x*radii[0], center.y+y*radii[1], center.z+z*radii[2]))
    for j in range(rings):
        for i in range(segments):
            a=j*segments+i; b=j*segments+(i+1)%segments; c=(j+1)*segments+(i+1)%segments; d=(j+1)*segments+i
            faces.append((a,b,c,d))
    return make_mesh(name,verts,faces,mat,armature,bone)

def tube(name, points, radii, mat, armature, bone, sides=12):
    pts=[Vector(p) for p in points]
    verts=[]; faces=[]
    for k,p in enumerate(pts):
        if k==0: tangent=(pts[1]-pts[0]).normalized()
        elif k==len(pts)-1: tangent=(pts[-1]-pts[-2]).normalized()
        else: tangent=(pts[k+1]-pts[k-1]).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<0.85 else Vector((0,1,0))
        u=tangent.cross(ref).normalized(); v=tangent.cross(u).normalized()
        for i in range(sides):
            a=2*math.pi*i/sides
            q=p+(u*math.cos(a)+v*math.sin(a))*radii[k]
            verts.append(tuple(q))
    for k in range(len(pts)-1):
        for i in range(sides):
            a=k*sides+i; b=k*sides+(i+1)%sides; c=(k+1)*sides+(i+1)%sides; d=(k+1)*sides+i
            faces.append((a,b,c,d))
    faces.append(tuple(range(sides-1,-1,-1)))
    start=(len(pts)-1)*sides; faces.append(tuple(start+i for i in range(sides)))
    return make_mesh(name,verts,faces,mat,armature,bone)

def loft(name, rings, mat, armature, bind, sides=24, phase=0.0):
    verts=[]; faces=[]
    for z,rx,ry,cx,cy in rings:
        for i in range(sides):
            a=2*math.pi*i/sides+phase
            verts.append((cx+math.cos(a)*rx,cy+math.sin(a)*ry,z))
    for r in range(len(rings)-1):
        for i in range(sides):
            a=r*sides+i;b=r*sides+(i+1)%sides;c=(r+1)*sides+(i+1)%sides;d=(r+1)*sides+i
            faces.append((a,b,c,d))
    faces.append(tuple(range(sides-1,-1,-1)))
    last=(len(rings)-1)*sides;faces.append(tuple(last+i for i in range(sides)))
    return make_mesh(name,verts,faces,mat,armature,bind=bind)

def cape_panel(name, shoulder, hem, width_top, width_bottom, forward, mat, armature, bone):
    s=Vector(shoulder); h=Vector(hem)
    verts=[
        tuple(s+Vector((-width_top,forward,0))), tuple(s+Vector((width_top,forward,0))),
        tuple(h+Vector((width_bottom,forward*0.7,0))), tuple(h+Vector((-width_bottom,forward*0.7,0))),
    ]
    obj=make_mesh(name,verts,[(0,1,2,3)],mat,armature,bone)
    sol=obj.modifiers.new("CapeThickness","SOLIDIFY");sol.thickness=0.018;sol.offset=0
    bev=obj.modifiers.new("CapeEdge","BEVEL");bev.width=0.009;bev.segments=2
    select_only(obj);bpy.ops.object.modifier_apply(modifier=sol.name);bpy.ops.object.modifier_apply(modifier=bev.name)
    smart_uv(obj)
    return obj

def disc(name, center, size, mat, armature, bone, rotation=(math.pi/2,0,0), vertices=24):
    bpy.ops.mesh.primitive_circle_add(vertices=vertices,radius=1.0,fill_type="NGON",location=center,rotation=rotation)
    obj=bpy.context.object;obj.name=name;obj.scale=(size[0],size[1],1);apply_mesh_transform(obj);obj.data.materials.append(mat)
    bind_rigid(obj,armature,bone);return obj

def rounded_box(name, center, scale, mat, armature, bone, bevel=0.018):
    bpy.ops.mesh.primitive_cube_add(size=1,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;apply_mesh_transform(obj)
    mod=obj.modifiers.new("SoftEdges","BEVEL");mod.width=bevel;mod.segments=3
    select_only(obj);bpy.ops.object.modifier_apply(modifier=mod.name);smooth(obj);obj.data.materials.append(mat);bind_rigid(obj,armature,bone)
    return obj

def create_materials():
    return {key:material("SHINO_"+key.upper(),value,0.82 if key not in {"eye","eye_dark","bronze"} else 0.48,0.24 if key=="bronze" else 0.0) for key,value in PALETTE.items()}

def build_character(armature,names,mats):
    head=bone_head(armature,names,"head"); head_tail=bone_tail(armature,names,"head")
    head_center=head.lerp(head_tail,0.58)
    spine=bone_head(armature,names,"spine"); hips=bone_head(armature,names,"hips")
    shoulder_l=bone_head(armature,names,"leftUpperArm"); shoulder_r=bone_head(armature,names,"rightUpperArm")
    body_width=max(0.24,abs(shoulder_l.x-shoulder_r.x)*0.64)
    head_scale=max(0.16,abs(head_tail.z-head.z)*1.28)

    ellipsoid("Shino_Face",head_center+Vector((0,-0.012,0.012)),(head_scale*0.84,head_scale*0.73,head_scale*0.92),mats["skin"],armature,names["head"],32,22,0.12)
    for side,x in (("L",-head_scale*0.30),("R",head_scale*0.30)):
        eye_center=head_center+Vector((x,-head_scale*0.705,head_scale*0.10))
        ellipsoid(f"Shino_Eye_{side}",eye_center,(head_scale*0.14,head_scale*0.026,head_scale*0.18),mats["eye"],armature,names["head"],20,12)
        ellipsoid(f"Shino_Pupil_{side}",eye_center+Vector((0,-head_scale*0.025,0)),(head_scale*0.065,head_scale*0.015,head_scale*0.105),mats["eye_dark"],armature,names["head"],16,10)
        ellipsoid(f"Shino_EyeGlow_{side}",eye_center+Vector((-head_scale*0.035,-head_scale*0.043,head_scale*0.055)),(head_scale*0.024,head_scale*0.008,head_scale*0.035),mats["ivory"],armature,names["head"],12,8)
    tube("Shino_Mouth",[head_center+Vector((-head_scale*.08,-head_scale*.735,-head_scale*.22)),head_center+Vector((0,-head_scale*.75,-head_scale*.24)),head_center+Vector((head_scale*.08,-head_scale*.735,-head_scale*.22))],[.008,.006,.008],mats["mouth"],armature,names["head"],8)

    ellipsoid("Shino_HairCap",head_center+Vector((0,head_scale*.05,head_scale*.15)),(head_scale*.92,head_scale*.80,head_scale*.86),mats["hair"],armature,names["head"],30,20,0.05)
    hair_points=[
        (-.62,-.42,.42,-.50),(-.42,-.62,.52,-.40),(-.20,-.70,.58,-.34),(0,-.73,.62,-.31),(.20,-.70,.58,-.34),(.42,-.62,.52,-.40),(.62,-.42,.42,-.50)
    ]
    for i,(sx,sy,sz,ez) in enumerate(hair_points):
        p0=head_center+Vector((sx*head_scale,sy*head_scale,sz*head_scale))
        p1=head_center+Vector((sx*.92*head_scale,(sy-.08)*head_scale,.05*head_scale))
        p2=head_center+Vector((sx*.84*head_scale,-.15*head_scale,ez*head_scale))
        tube(f"Shino_HairLock_{i:02d}",[p0,p1,p2],[head_scale*.11,head_scale*.095,head_scale*.035],mats["hair_shadow" if i in {0,6} else "hair"],armature,names["head"],10)
    for side,sign in (("L",-1),("R",1)):
        tube(f"Shino_SideLock_{side}",[
            head_center+Vector((sign*head_scale*.75,-head_scale*.18,head_scale*.20)),
            head_center+Vector((sign*head_scale*.84,-head_scale*.04,-head_scale*.15)),
            head_center+Vector((sign*head_scale*.70,head_scale*.02,-head_scale*.58)),
        ],[head_scale*.11,head_scale*.09,head_scale*.04],mats["hair"],armature,names["head"],10)

    hood_verts=[];hood_faces=[];u_steps=30;v_steps=10
    for v in range(v_steps+1):
        pv=v/v_steps; polar=math.radians(28+118*pv)
        for u in range(u_steps+1):
            pu=u/u_steps; az=math.radians(-142+284*pu)
            radius=head_scale*(1.12+0.10*math.sin(math.pi*pv))
            x=math.sin(polar)*math.sin(az)*radius
            y=math.sin(polar)*math.cos(az)*radius*0.88 + head_scale*.08
            z=math.cos(polar)*radius + head_scale*.16
            hood_verts.append(tuple(head_center+Vector((x,y,z))))
    for v in range(v_steps):
        for u in range(u_steps):
            a=v*(u_steps+1)+u;b=a+1;c=(v+1)*(u_steps+1)+u+1;d=c-1;hood_faces.append((a,b,c,d))
    hood=make_mesh("Shino_Hood",hood_verts,hood_faces,mats["ivory"],armature,names["head"])
    sol=hood.modifiers.new("HoodThickness","SOLIDIFY");sol.thickness=head_scale*.055;sol.offset=-.20
    bev=hood.modifiers.new("HoodSoftEdge","BEVEL");bev.width=head_scale*.018;bev.segments=2
    select_only(hood);bpy.ops.object.modifier_apply(modifier=sol.name);bpy.ops.object.modifier_apply(modifier=bev.name);smart_uv(hood)
    for side,sign in (("L",-1),("R",1)):
        disc(f"Shino_HoodEye_{side}",head_center+Vector((sign*head_scale*.31,-head_scale*.86,head_scale*.77)),(head_scale*.10,head_scale*.16),mats["charcoal"],armature,names["head"])
    tube("Shino_HoodMouth",[
        head_center+Vector((-head_scale*.07,-head_scale*.88,head_scale*.61)),
        head_center+Vector((0,-head_scale*.89,head_scale*.57)),
        head_center+Vector((head_scale*.07,-head_scale*.88,head_scale*.61)),
    ],[.006,.006,.006],mats["charcoal"],armature,names["head"],7)

    shoulder_z=(shoulder_l.z+shoulder_r.z)*.5
    waist_z=hips.z+abs(shoulder_z-hips.z)*.25
    hem_z=min(bone_head(armature,names,"leftLowerLeg").z,bone_head(armature,names,"rightLowerLeg").z)+abs(hips.z-bone_head(armature,names,"leftLowerLeg").z)*.44
    torso_bind=lambda obj: bind_vertical(obj,armature,names["spine"],names["hips"],waist_z,max(.15,abs(shoulder_z-hips.z)*.45))
    loft("Shino_Tunic",[
        (shoulder_z-.04,body_width*.70,body_width*.46,0,-.006),
        (spine.z,body_width*.67,body_width*.43,0,-.005),
        (waist_z,body_width*.57,body_width*.38,0,-.003),
        (hips.z-.02,body_width*.62,body_width*.43,0,0),
    ],mats["charcoal"],armature,torso_bind,26)
    loft("Shino_Skirt",[
        (hips.z+.02,body_width*.62,body_width*.44,0,0),
        ((hips.z+hem_z)*.55,body_width*.78,body_width*.52,0,.018),
        (hem_z,body_width*1.02,body_width*.60,0,.025),
    ],mats["ivory"],armature,lambda obj:bind_rigid(obj,armature,names["hips"]),28,math.pi/28)
    for i,x in enumerate((-0.30,-0.15,0,0.15,0.30)):
        center=Vector((x*body_width*2.15,-body_width*.47,hem_z-.025-abs(x)*.025))
        ellipsoid(f"Shino_HemPearl_{i}",center,(.025,.018,.032),mats["ivory_shadow"],armature,names["hips"],12,8)

    cape_top=Vector((0,0,shoulder_z+.03));cape_bottom_z=hem_z+.08
    cape_panel("Shino_Cape_Back",cape_top+Vector((0,body_width*.31,0)),Vector((0,body_width*.40,cape_bottom_z)),body_width*.80,body_width*1.18,.018,mats["ivory_shadow"],armature,names["spine"])
    cape_panel("Shino_Cape_Front",cape_top+Vector((0,-body_width*.31,0)),Vector((0,-body_width*.43,cape_bottom_z+.08)),body_width*.68,body_width*.96,-.018,mats["ivory"],armature,names["spine"])
    cape_panel("Shino_Cape_Left",cape_top+Vector((-body_width*.38,0,0)),Vector((-body_width*.70,0,cape_bottom_z)),body_width*.48,body_width*.78,0,mats["ivory"],armature,names["spine"])
    cape_panel("Shino_Cape_Right",cape_top+Vector((body_width*.38,0,0)),Vector((body_width*.70,0,cape_bottom_z)),body_width*.48,body_width*.78,0,mats["ivory"],armature,names["spine"])
    tube("Shino_Ribbon_L",[Vector((-.03,-body_width*.54,shoulder_z-.08)),Vector((-.12,-body_width*.58,shoulder_z-.22)),Vector((-.10,-body_width*.56,shoulder_z-.34))],[.028,.022,.012],mats["ribbon"],armature,names["spine"],8)
    tube("Shino_Ribbon_R",[Vector((.03,-body_width*.54,shoulder_z-.08)),Vector((.12,-body_width*.58,shoulder_z-.22)),Vector((.10,-body_width*.56,shoulder_z-.34))],[.028,.022,.012],mats["ribbon"],armature,names["spine"],8)
    ellipsoid("Shino_Clasp",Vector((0,-body_width*.57,shoulder_z-.07)),(.040,.018,.050),mats["bronze"],armature,names["spine"],16,10)

    for side in ("left","right"):
        ua=f"{side}UpperArm";la=f"{side}LowerArm";hand=f"{side}Hand";ul=f"{side}UpperLeg";ll=f"{side}LowerLeg";foot=f"{side}Foot"
        a=bone_head(armature,names,ua);b=bone_head(armature,names,la);c=bone_head(armature,names,hand)
        tube(f"Shino_{side}_Sleeve",[a,a.lerp(b,.56),b],[.075,.068,.055],mats["ivory"],armature,names[ua],14)
        tube(f"Shino_{side}_Forearm",[b,b.lerp(c,.68),c],[.050,.043,.036],mats["skin"],armature,names[la],12)
        ellipsoid(f"Shino_{side}_Palm",c,(.052,.040,.060),mats["skin"],armature,names[hand],16,10)
        sign=-1 if side=="left" else 1
        finger_offsets=[(-.030,.0,-.010),(-.015,-.006,-.020),(0,-.008,-.022),(.015,-.005,-.019),(.030,.002,-.014)]
        for fi,(ox,oy,oz) in enumerate(finger_offsets):
            length=.052 if fi in {1,2,3} else .044
            start=c+Vector((sign*ox,oy-.030,oz-.040))
            end=start+Vector((sign*(.012 if fi==0 else .002),-.008,-length))
            tube(f"Shino_{side}_Finger_{fi+1}",[start,start.lerp(end,.55),end],[.009,.008,.0055],mats["skin"],armature,names[hand],8)
        p=bone_head(armature,names,ul);k=bone_head(armature,names,ll);ankle=bone_head(armature,names,foot)
        tube(f"Shino_{side}_Thigh",[p,p.lerp(k,.55),k],[.070,.064,.053],mats["charcoal"],armature,names[ul],14)
        tube(f"Shino_{side}_Calf",[k,k.lerp(ankle,.55),ankle],[.052,.047,.038],mats["ivory_shadow"],armature,names[ll],12)
        rounded_box(f"Shino_{side}_Boot",ankle+Vector((0,-.045,-.018)),(.070,.105,.065),mats["boot"],armature,names[foot],.020)
        rounded_box(f"Shino_{side}_BootCuff",ankle+Vector((0,.0,.045)),(.075,.070,.035),mats["ribbon"],armature,names[foot],.014)

    bow_z=hips.z+.12
    for sign in (-1,1):
        ellipsoid(f"Shino_BackBow_{'L' if sign<0 else 'R'}",Vector((sign*.07,body_width*.52,bow_z)),(.075,.022,.050),mats["ribbon"],armature,names["hips"],16,10)
    tube("Shino_BackBowTail_L",[Vector((-.025,body_width*.52,bow_z-.02)),Vector((-.085,body_width*.53,bow_z-.18))],[.024,.012],mats["ribbon"],armature,names["hips"],8)
    tube("Shino_BackBowTail_R",[Vector((.025,body_width*.52,bow_z-.02)),Vector((.085,body_width*.53,bow_z-.18))],[.024,.012],mats["ribbon"],armature,names["hips"],8)

def setup_render():
    scene=bpy.context.scene
    scene.unit_settings.system="METRIC";scene.unit_settings.scale_length=1.0
    scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG"
    scene.render.film_transparent=False
    for engine in ("BLENDER_EEVEE_NEXT","BLENDER_EEVEE","BLENDER_WORKBENCH"):
        try: scene.render.engine=engine;break
        except TypeError: continue
    scene.world.color=(0.055,0.058,0.065)

def look_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

def add_studio():
    mats=material("SHINO_STUDIO",(0.16,0.17,0.19,1),.98)
    bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.01));ground=bpy.context.object;ground.name="ShinoReviewGround";ground.data.materials.append(mats)
    for name,loc,energy,size,color in [
        ("Key",(-2.6,-3.0,4.2),950,4.2,(1.0,.90,.80)),
        ("Fill",(3.2,-1.5,2.7),520,3.5,(.78,.86,1.0)),
        ("Rim",(.2,3.0,3.2),760,3.0,(.78,.86,1.0)),
    ]:
        bpy.ops.object.light_add(type="AREA",location=loc);light=bpy.context.object;light.name=name;light.data.energy=energy;light.data.size=size;light.data.color=color;look_at(light,(0,0,1.0))
    bpy.ops.object.camera_add(location=(0,-4,1.2));cam=bpy.context.object;cam.name="ShinoReviewCamera";cam.data.type="ORTHO";bpy.context.scene.camera=cam
    return cam,ground

def bounds_of_character(armature):
    points=[]
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.parent==armature:
            points.extend(obj.matrix_world @ Vector(corner) for corner in obj.bound_box)
    lo=Vector((min(p.x for p in points),min(p.y for p in points),min(p.z for p in points)))
    hi=Vector((max(p.x for p in points),max(p.y for p in points),max(p.z for p in points)))
    return lo,hi

def render_views(review_dir,armature):
    review_dir.mkdir(parents=True,exist_ok=True)
    lo,hi=bounds_of_character(armature);center=(lo+hi)*.5;height=hi.z-lo.z;radius=max(hi.x-lo.x,hi.y-lo.y,height)
    cam,ground=add_studio();cam.data.ortho_scale=max(height*1.14,1.55)
    target=Vector((center.x,center.y,lo.z+height*.52));distance=max(3.2,radius*2.2)
    views={"front":(0,-distance,target.z),"three-quarter":(distance*.72,-distance*.72,target.z+.03),"side":(distance,0,target.z),"back":(0,distance,target.z)}
    for name,loc in views.items():
        cam.location=loc;look_at(cam,target);bpy.context.scene.render.filepath=str(review_dir/f"{name}.png");bpy.ops.render.render(write_still=True)
    actions=[a for a in bpy.data.actions if getattr(a,"fcurves",None)]
    if actions:
        armature.animation_data_create();armature.animation_data.action=actions[0]
        start,end=actions[0].frame_range;bpy.context.scene.frame_set(int(start+(end-start)*.45))
        cam.location=(distance*.72,-distance*.72,target.z+.04);look_at(cam,target)
        bpy.context.scene.render.filepath=str(review_dir/"deformation.png");bpy.ops.render.render(write_still=True)
        armature.animation_data.action=None;bpy.context.scene.frame_set(0)
    bpy.data.objects.remove(ground,do_unlink=True)
    bpy.data.objects.remove(cam,do_unlink=True)
    for obj in list(bpy.context.scene.objects):
        if obj.type=="LIGHT" and obj.name in {"Key","Fill","Rim"}:bpy.data.objects.remove(obj,do_unlink=True)

def export_glb(path,armature):
    bpy.ops.object.select_all(action="DESELECT");armature.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=="MESH" and obj.parent==armature:obj.select_set(True)
    bpy.context.view_layer.objects.active=armature
    kwargs=dict(filepath=str(path),export_format="GLB",use_selection=True,export_skins=True,export_animations=True,export_yup=True)
    try:
        bpy.ops.export_scene.gltf(**kwargs,export_animation_mode="ACTIONS")
    except TypeError:
        bpy.ops.export_scene.gltf(**kwargs)

def main():
    args=cli();source=Path(args.rig_source).resolve();out=Path(args.out).resolve();source_dir=out/"source";export_dir=out/"export";review_dir=out/"review"
    source_dir.mkdir(parents=True,exist_ok=True);export_dir.mkdir(parents=True,exist_ok=True);review_dir.mkdir(parents=True,exist_ok=True)
    setup_render();bpy.ops.import_scene.gltf(filepath=str(source))
    armatures=[o for o in bpy.context.scene.objects if o.type=="ARMATURE"]
    if len(armatures)!=1:raise RuntimeError(f"Expected exactly one armature, got {len(armatures)}")
    armature=armatures[0];armature.name="Shino_Rig_Medium";names=resolve_bones(armature);removed=remove_imported_surfaces(armature);mats=create_materials();build_character(armature,names,mats)
    for obj in [o for o in bpy.context.scene.objects if o.type=="MESH" and o.parent==armature]:
        apply_mesh_transform(obj)
        if len(obj.data.uv_layers)==0:smart_uv(obj)
    blend_path=source_dir/f"{MODEL_NAME}.blend";bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_path=export_dir/f"{MODEL_NAME}.glb";export_glb(export_path,armature)
    render_views(review_dir,armature)
    meshes=[o for o in bpy.context.scene.objects if o.type=="MESH" and o.parent==armature]
    tri=sum(max(0,len(poly.vertices)-2) for o in meshes for poly in o.data.polygons)
    fingers=[o.name for o in meshes if "Finger_" in o.name]
    actions=[a.name for a in bpy.data.actions if getattr(a,"fcurves",None)]
    payload={
        "schema":"rinne-shino-original-dcc-build","version":1,"characterId":CHARACTER_ID,"referencePath":REFERENCE_PATH,
        "sourceRigSha256":sha256(source),"blenderVersion":bpy.app.version_string,"meshObjects":len(meshes),"trianglesApprox":tri,
        "materials":len({m.name for o in meshes for m in o.data.materials if m}),"uvMeshCount":sum(1 for o in meshes if o.data.uv_layers),
        "fingerMeshes":len(fingers),"expectedFingerMeshes":10,"sourceMeshesRemoved":removed,"animationClips":actions,"animationClipCount":len(actions),
        "blendSha256":sha256(blend_path),"glbSha256":sha256(export_path),"productionReady":False,"visualApproval":"pending"
    }
    (out/"build.json").write_text(json.dumps(payload,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(payload,ensure_ascii=False,indent=2))
    if len(fingers)!=10:raise RuntimeError(f"Expected ten finger meshes, got {len(fingers)}")
    if not actions:raise RuntimeError("No imported animation clips were retained")

if __name__=="__main__":main()
