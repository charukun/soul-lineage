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
    mat.diffuse_color = rgba
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
    head_center=head.lerp(head_tail,0.56)
    spine=bone_head(armature,names,"spine"); hips=bone_head(armature,names,"hips")
    shoulder_l=bone_head(armature,names,"leftUpperArm"); shoulder_r=bone_head(armature,names,"rightUpperArm")
    body_width=max(0.32,abs(shoulder_l.x-shoulder_r.x)*0.74)
    head_scale=max(0.138,abs(head_tail.z-head.z)*1.06)

    ellipsoid("Shino_Face",head_center+Vector((0,-head_scale*.025,0)),(head_scale*.79,head_scale*.67,head_scale*.88),mats["skin"],armature,names["head"],36,24,0.08)
    for side,x in (("L",-head_scale*.29),("R",head_scale*.29)):
        eye_center=head_center+Vector((x,-head_scale*.665,head_scale*.08))
        ellipsoid(f"Shino_Eye_{side}",eye_center,(head_scale*.14,head_scale*.026,head_scale*.18),mats["eye"],armature,names["head"],20,12)
        ellipsoid(f"Shino_Pupil_{side}",eye_center+Vector((0,-head_scale*.028,0)),(head_scale*.060,head_scale*.012,head_scale*.098),mats["eye_dark"],armature,names["head"],14,9)
        ellipsoid(f"Shino_EyeGlow_{side}",eye_center+Vector((-head_scale*.034,-head_scale*.043,head_scale*.052)),(head_scale*.020,head_scale*.007,head_scale*.030),mats["ivory"],armature,names["head"],10,7)
    tube("Shino_Mouth",[head_center+Vector((-head_scale*.07,-head_scale*.68,-head_scale*.23)),head_center+Vector((0,-head_scale*.69,-head_scale*.25)),head_center+Vector((head_scale*.07,-head_scale*.68,-head_scale*.23))],[.006,.005,.006],mats["mouth"],armature,names["head"],8)

    ellipsoid("Shino_HairCap",head_center+Vector((0,head_scale*.10,head_scale*.16)),(head_scale*.88,head_scale*.75,head_scale*.82),mats["hair"],armature,names["head"],34,22,0.0)
    bangs=[(-.46,.56,.35),(-.23,.60,.31),(0,.63,.37),(.23,.60,.31),(.46,.56,.35)]
    for i,(sx,sz,ez) in enumerate(bangs):
        p0=head_center+Vector((sx*head_scale,-head_scale*.46,sz*head_scale))
        p1=head_center+Vector((sx*.82*head_scale,-head_scale*.62,(sz-.05)*head_scale))
        p2=head_center+Vector((sx*.68*head_scale,-head_scale*.66,ez*head_scale))
        tube(f"Shino_Bang_{i}",[p0,p1,p2],[head_scale*.060,head_scale*.044,head_scale*.014],mats["hair"],armature,names["head"],10)
    for side,sign in (("L",-1),("R",1)):
        tube(f"Shino_SideLock_{side}",[
            head_center+Vector((sign*head_scale*.68,-head_scale*.28,head_scale*.18)),
            head_center+Vector((sign*head_scale*.78,-head_scale*.20,-head_scale*.10)),
            head_center+Vector((sign*head_scale*.68,-head_scale*.06,-head_scale*.42)),
        ],[head_scale*.10,head_scale*.075,head_scale*.026],mats["hair_shadow"],armature,names["head"],11)

    # Hood uses a padded face rim plus a shallow back cowl so the head does not read as a sphere.
    rim_points=[]
    for deg in range(-145,146,24):
        a=math.radians(deg)
        rim_y=-head_scale*(.60-.18*abs(math.sin(a)))
        rim_points.append(head_center+Vector((math.sin(a)*head_scale*.90,rim_y,math.cos(a)*head_scale*.93+head_scale*.10)))
    tube("Shino_HoodRim",rim_points,[head_scale*.055 for _ in rim_points],mats["ivory"],armature,names["head"],14)
    ellipsoid("Shino_HoodBack",head_center+Vector((0,head_scale*.24,head_scale*.08)),(head_scale*.92,head_scale*.48,head_scale*.88),mats["ivory_shadow"],armature,names["head"],30,20,0.0)

    shoulder_z=(shoulder_l.z+shoulder_r.z)*.5
    waist_z=hips.z+abs(shoulder_z-hips.z)*.28
    knee_z=min(bone_head(armature,names,"leftLowerLeg").z,bone_head(armature,names,"rightLowerLeg").z)
    hem_z=knee_z+abs(hips.z-knee_z)*.46
    poncho_hem_z=hips.z+.04
    torso_bind=lambda obj: bind_vertical(obj,armature,names["spine"],names["hips"],waist_z,max(.15,abs(shoulder_z-hips.z)*.45))
    loft("Shino_Tunic",[(shoulder_z-.02,body_width*.63,body_width*.42,0,0),(waist_z,body_width*.55,body_width*.37,0,0),(hips.z-.02,body_width*.60,body_width*.41,0,0)],mats["charcoal"],armature,torso_bind,28)
    loft("Shino_Poncho",[
        (shoulder_z+.045,body_width*.76,body_width*.40,0,.00),
        (spine.z+.03,body_width*.90,body_width*.46,0,.01),
        (waist_z-.02,body_width*1.03,body_width*.52,0,.015),
        (poncho_hem_z,body_width*1.17,body_width*.57,0,.02),
    ],mats["ivory"],armature,torso_bind,40,math.pi/40)
    loft("Shino_Skirt",[(hips.z+.01,body_width*.57,body_width*.39,0,0),((hips.z+hem_z)*.50,body_width*.66,body_width*.43,0,.01),(hem_z,body_width*.78,body_width*.47,0,.015)],mats["charcoal"],armature,lambda obj:bind_rigid(obj,armature,names["hips"]),30,math.pi/30)
    tube("Shino_Trim_L",[Vector((-.035,-body_width*.48,shoulder_z-.02)),Vector((-.10,-body_width*.55,waist_z+.03)),Vector((-.045,-body_width*.59,poncho_hem_z+.08))],[.020,.017,.009],mats["ribbon"],armature,names["spine"],9)
    tube("Shino_Trim_R",[Vector((.035,-body_width*.48,shoulder_z-.02)),Vector((.10,-body_width*.55,waist_z+.03)),Vector((.045,-body_width*.59,poncho_hem_z+.08))],[.020,.017,.009],mats["ribbon"],armature,names["spine"],9)
    ellipsoid("Shino_Clasp",Vector((0,-body_width*.50,shoulder_z-.02)),(.033,.016,.042),mats["bronze"],armature,names["spine"],14,9)
    ghost_center=Vector((0,-body_width*.54,shoulder_z-.105))
    ellipsoid("Shino_GhostCharm",ghost_center,(.045,.014,.050),mats["ivory_shadow"],armature,names["spine"],14,9)
    for side,sign in (("L",-1),("R",1)):
        ellipsoid(f"Shino_GhostCharmEye_{side}",ghost_center+Vector((sign*.014,-.014,.010)),(.005,.003,.008),mats["charcoal"],armature,names["spine"],8,6)

    for side in ("left","right"):
        ua=f"{side}UpperArm";la=f"{side}LowerArm";hand=f"{side}Hand";ul=f"{side}UpperLeg";ll=f"{side}LowerLeg";foot=f"{side}Foot"
        a=bone_head(armature,names,ua);b=bone_head(armature,names,la);c=bone_head(armature,names,hand);hand_tail=bone_tail(armature,names,hand)
        tube(f"Shino_{side}_Sleeve",[a,a.lerp(b,.58),b],[.080,.070,.055],mats["ivory"],armature,names[ua],14)
        tube(f"Shino_{side}_Forearm",[b,b.lerp(c,.72),c],[.048,.041,.034],mats["skin"],armature,names[la],12)
        palm_center=c.lerp(hand_tail,.45)
        ellipsoid(f"Shino_{side}_Palm",palm_center,(.050,.037,.050),mats["skin"],armature,names[hand],16,10)
        tangent=(hand_tail-c).normalized()
        ref=Vector((0,0,1)) if abs(tangent.z)<.85 else Vector((0,1,0))
        spread=tangent.cross(ref).normalized(); lift=tangent.cross(spread).normalized()
        offsets=[-.030,-.015,0,.015,.030]
        for fi,off in enumerate(offsets):
            start=hand_tail + spread*off + lift*(-.006 if fi in {0,4} else 0)
            length=.050 if fi in {1,2,3} else .042
            direction=(tangent + spread*((fi-2)*.07) + lift*(-.06 if fi==0 else 0)).normalized()
            end=start+direction*length
            tube(f"Shino_{side}_Finger_{fi+1}",[start,start.lerp(end,.55),end],[.008,.007,.0048],mats["skin"],armature,names[hand],8)
        p=bone_head(armature,names,ul);k=bone_head(armature,names,ll);ankle=bone_head(armature,names,foot);foot_tail=bone_tail(armature,names,foot)
        tube(f"Shino_{side}_Thigh",[p,p.lerp(k,.55),k],[.068,.060,.050],mats["charcoal"],armature,names[ul],14)
        tube(f"Shino_{side}_Calf",[k,k.lerp(ankle,.55),ankle],[.050,.044,.035],mats["ivory_shadow"],armature,names[ll],12)
        foot_vec=(foot_tail-ankle);toe=foot_tail+foot_vec.normalized()*.055
        tube(f"Shino_{side}_Boot",[ankle,foot_tail,toe],[.060,.066,.042],mats["boot"],armature,names[foot],14)
        ellipsoid(f"Shino_{side}_BootCuff",ankle+Vector((0,0,.035)),(.070,.060,.035),mats["ribbon"],armature,names[foot],14,8)

    bow_z=hips.z+.13
    for sign in (-1,1):
        ellipsoid(f"Shino_BackBow_{'L' if sign<0 else 'R'}",Vector((sign*.060,body_width*.82,bow_z)),(.066,.020,.043),mats["ribbon"],armature,names["hips"],14,9)
    tube("Shino_BackBowTail_L",[Vector((-.025,body_width*.82,bow_z-.015)),Vector((-.072,body_width*.83,bow_z-.14))],[.018,.009],mats["ribbon"],armature,names["hips"],8)
    tube("Shino_BackBowTail_R",[Vector((.025,body_width*.82,bow_z-.015)),Vector((.072,body_width*.83,bow_z-.14))],[.018,.009],mats["ribbon"],armature,names["hips"],8)

def setup_render():
    scene=bpy.context.scene
    scene.unit_settings.system="METRIC";scene.unit_settings.scale_length=1.0
    scene.render.resolution_x=512;scene.render.resolution_y=640;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format="PNG";scene.render.film_transparent=False
    scene.render.engine="BLENDER_WORKBENCH"
    scene.display.shading.light="STUDIO";scene.display.shading.color_type="MATERIAL"
    scene.display.shading.show_shadows=True;scene.display.shading.show_cavity=True
    scene.world.color=(0.055,0.058,0.065)

def look_at(obj,target):
    obj.rotation_euler=(Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()

def add_studio():
    mats=material("SHINO_STUDIO",(0.16,0.17,0.19,1),.98)
    bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.01));ground=bpy.context.object;ground.name="ShinoReviewGround";ground.data.materials.append(mats)
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
