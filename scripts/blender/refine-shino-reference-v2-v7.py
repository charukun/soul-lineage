"""Visual correction pass 7 for Shino Reference v2.

The high-density full-body retarget experiments (v5/v6) proved structurally valid
but visually unsafe for PRIMARY because the source body's adult proportions and
secondary weighting do not survive an aggressive chibi rest-pose rewrite cleanly.

This pass keeps the audited high-density FACE donor only, removes the retargeted
body donor, and authors a coherent stylized body for the visible skin regions.
It also opens the hair cap at the face, shortens the bangs so the audited eyes are
readable, and adds a blouse waist + clean shorts silhouette. Deformation blending
remains a later gate; PRIMARY must first be visually coherent from all review views.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def cli():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-vrm', required=True)
    parser.add_argument('--out', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def glb_json(path: Path) -> dict:
    data = path.read_bytes()
    if len(data) < 20 or data[:4] != b'glTF':
        raise RuntimeError(f'Not a GLB/VRM: {path}')
    _, version, total = struct.unpack_from('<4sII', data, 0)
    if version != 2 or total != len(data):
        raise RuntimeError('Unsupported GLB header')
    offset = 12
    while offset + 8 <= len(data):
        length, chunk_type = struct.unpack_from('<II', data, offset)
        offset += 8
        payload = data[offset:offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            return json.loads(payload.decode('utf-8').rstrip(' \t\r\n\x00'))
    raise RuntimeError('GLB JSON chunk missing')


def humanoid_names(path: Path) -> dict[str, str]:
    doc = glb_json(path)
    nodes = doc.get('nodes', [])
    rows = doc.get('extensions', {}).get('VRMC_vrm', {}).get('humanoid', {}).get('humanBones', {})
    result = {}
    for human, row in rows.items():
        index = row.get('node')
        if isinstance(index, int) and 0 <= index < len(nodes):
            name = nodes[index].get('name')
            if name:
                result[human] = name
    return result


def select_only(obj):
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def apply_transform(obj):
    select_only(obj)
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)


def ensure_uv(obj):
    if obj.type == 'MESH' and not obj.data.uv_layers:
        obj.data.uv_layers.new(name='UVMap')


def smooth(obj):
    if obj.type == 'MESH':
        for poly in obj.data.polygons:
            poly.use_smooth = True


def add_bevel(obj, width, segments=3):
    mod = obj.modifiers.new('PRIMARY Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=mod.name)


def sphere(name, location, scale, mat, segments=28, rings=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    obj.data.materials.append(mat)
    ensure_uv(obj)
    return obj


def round_cube(name, location, scale, mat, bevel=.018):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    add_bevel(obj, bevel, 4)
    smooth(obj)
    obj.data.materials.append(mat)
    ensure_uv(obj)
    return obj


def tapered(name, a, b, r1, r2, mat, vertices=24):
    a = Vector(a); b = Vector(b); delta = b - a
    if delta.length < 1e-5:
        raise RuntimeError(f'Zero-length segment {name}')
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=delta.length, location=(a+b)*.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0,0,1)).rotation_difference(delta.normalized())
    apply_transform(obj)
    add_bevel(obj, min(r1, r2)*.20, 3)
    smooth(obj)
    obj.data.materials.append(mat)
    ensure_uv(obj)
    return obj


def curve_lock(name, points, radius, mat):
    curve = bpy.data.curves.new(name + 'Curve', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 4
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for bp, co in zip(spline.bezier_points, points):
        bp.co = co
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(mat)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    smooth(obj); ensure_uv(obj)
    return obj


def bind_rigid(obj, armature, bone_name):
    if not bone_name or armature.data.bones.get(bone_name) is None:
        raise RuntimeError(f'Cannot bind {obj.name}: bone {bone_name!r} missing')
    group = obj.vertex_groups.new(name=bone_name)
    group.add(list(range(len(obj.data.vertices))), 1.0, 'REPLACE')
    mod = obj.modifiers.new('Shino PRIMARY Humanoid', 'ARMATURE')
    mod.object = armature
    obj.parent = armature


def delete_prefix(*prefixes):
    for obj in list(bpy.context.scene.objects):
        if obj.name.startswith(prefixes):
            bpy.data.objects.remove(obj, do_unlink=True)


def open_hair_cap(mat):
    old = bpy.data.objects.get('HAIR_Cap')
    if old:
        bpy.data.objects.remove(old, do_unlink=True)
    obj = sphere('HAIR_PRIMARY_Cap', (0,.025,1.415), (.174,.153,.184), mat, 40, 26)
    bm = bmesh.new(); bm.from_mesh(obj.data)
    # Remove the front/lower face area. Keep crown, sides and back so the audited
    # facial donor and eyes remain visible from front and three-quarter review.
    dead = []
    for face in bm.faces:
        c = face.calc_center_median()
        if c.y < -0.045 and c.z < .105:
            dead.append(face)
        elif c.y < -0.085 and c.z < .04:
            dead.append(face)
    if dead:
        bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(obj.data); bm.free(); obj.data.update(); ensure_uv(obj)
    return obj


def setup_studio():
    scene = bpy.context.scene
    scene.render.resolution_x = 768
    scene.render.resolution_y = 1024
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = 'PNG'
    scene.world.color = (.028,.035,.039)
    try: scene.render.engine = 'BLENDER_EEVEE_NEXT'
    except (TypeError, ValueError): scene.render.engine = 'BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1))
    camera = bpy.context.object; camera.data.type='ORTHO'; camera.data.ortho_scale=1.82; scene.camera=camera
    for position, energy, size, color in [
        ((-2.5,-3.4,4),900,4,(1,.84,.68)), ((3,-1.8,2.5),500,3.5,(.72,.84,1)), ((.4,2.8,3.2),750,3,(.72,.84,1)),
    ]:
        bpy.ops.object.light_add(type='AREA', location=position)
        light=bpy.context.object; light.data.energy=energy; light.data.size=size; light.data.color=color
        light.rotation_euler=(Vector((0,0,.84))-light.location).to_track_quat('-Z','Y').to_euler()
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0,0,-.005))
    ground=bpy.context.object; ground.name='ReviewGround'; ground.data.materials.append(bpy.data.materials['MAT_CLOTH_GREEN_DARK'])
    return camera


def render_views(camera, out):
    out.mkdir(parents=True, exist_ok=True)
    target=Vector((0,0,.84))
    for name,position in {'front':(0,-3.6,.92),'side':(3.6,0,.92),'back':(0,3.6,.92),'three-quarter':(2.55,-2.55,1.08)}.items():
        camera.location=position; camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        bpy.context.scene.render.filepath=str(out/f'{name}.png'); bpy.ops.render.render(write_still=True)


def main():
    args=cli(); out=Path(args.out).resolve(); rig=bpy.data.objects.get('ShinoReferenceV2Rig')
    if not rig: raise RuntimeError('ShinoReferenceV2Rig missing')
    human=humanoid_names(Path(args.source_vrm))
    skin=bpy.data.materials.get('MAT_SKIN'); hair=bpy.data.materials.get('MAT_HAIR'); hair_hi=bpy.data.materials.get('MAT_HAIR_HIGHLIGHT') or hair
    cream=bpy.data.materials.get('MAT_CLOTH_CREAM'); shorts_mat=bpy.data.materials.get('MAT_CLOTH_SHORTS')
    if not all((skin,hair,cream,shorts_mat)): raise RuntimeError('Reference materials missing')

    # Retargeted adult body donor is intentionally removed from PRIMARY.
    delete_prefix('SKIN_DCC_BodyBasemesh', 'SKIN_PRIMARY_', 'CLOTH_PRIMARY_', 'HAIR_PRIMARY_')
    # Replace the curtain-like bangs from earlier experiments.
    delete_prefix('HAIR_BangV3_', 'HAIR_Bang_')
    # Replace experimental short shapes with a clean readable pair.
    delete_prefix('CLOTH_ShortsBody', 'CLOTH_L_Short', 'CLOTH_R_Short', 'CLOTH_L_Shorts', 'CLOTH_R_Shorts')

    authored=[]
    def add(obj,h): bind_rigid(obj,rig,human.get(h)); authored.append(obj); return obj

    # A small head shell sits behind the audited facial donor. It never occludes the
    # donor because its front depth is deliberately shallower than the face surface.
    add(sphere('SKIN_PRIMARY_HeadShell',(0,.018,1.372),(.145,.108,.166),skin,36,24),'head')
    add(sphere('SKIN_PRIMARY_Neck',(0,0,1.205),(.048,.044,.072),skin,24,16),'neck')

    # Visible forearms and mitten-like hands. The blouse sleeve already covers the
    # upper arm; keeping the skin geometry only where visible removes seam clutter.
    for side,sign in [('L',1),('R',-1)]:
        lower='leftLowerArm' if sign>0 else 'rightLowerArm'; hand='leftHand' if sign>0 else 'rightHand'
        add(tapered(f'SKIN_PRIMARY_{side}_Forearm',(.35*sign,-.002,1.035),(.495*sign,-.004,.938),.040,.032,skin),lower)
        add(sphere(f'SKIN_PRIMARY_{side}_Hand',(.535*sign,-.012,.918),(.052,.034,.056),skin,24,16),hand)
        add(sphere(f'SKIN_PRIMARY_{side}_Thumb',(.515*sign,-.038,.925),(.020,.014,.030),skin,18,12),hand)

    # Bare thigh/knee bridge between shorts and boots. Boots hide the lower segment.
    for side,sign in [('L',1),('R',-1)]:
        upper='leftUpperLeg' if sign>0 else 'rightUpperLeg'; lower='leftLowerLeg' if sign>0 else 'rightLowerLeg'
        add(tapered(f'SKIN_PRIMARY_{side}_Thigh',(.078*sign,0,.665),(.093*sign,0,.43),.061,.050,skin),upper)
        add(sphere(f'SKIN_PRIMARY_{side}_Knee',(.094*sign,-.003,.405),(.052,.047,.056),skin,22,14),lower)
        add(tapered(f'SKIN_PRIMARY_{side}_Shin',(.094*sign,0,.39),(.095*sign,0,.28),.047,.041,skin),lower)

    # Fill the waist with blouse fabric and rebuild shorts as two rounded pieces.
    add(round_cube('CLOTH_PRIMARY_BlouseWaist',(0,.005,.855),(.145,.104,.115),cream,.030),'spine')
    for side,sign in [('L',1),('R',-1)]:
        add(round_cube(f'CLOTH_PRIMARY_{side}_Shorts',(.068*sign,.002,.688),(.078,.102,.105),shorts_mat,.030),'hips')

    cap=open_hair_cap(hair); bind_rigid(cap,rig,human.get('head')); authored.append(cap)
    # Short, separated bangs stop above the eyes instead of becoming a curtain.
    xs=(-.074,-.049,-.024,0,.024,.049,.074)
    for i,x in enumerate(xs):
        end_z=1.424 + abs(x)*.10
        obj=curve_lock(f'HAIR_PRIMARY_Bang_{i:02}',[(x*.48,-.045,1.548),(x,-.112,1.493),(x*.98,-.137,end_z)],.014 if i!=3 else .013,hair_hi if i in (1,5) else hair)
        bind_rigid(obj,rig,human.get('head')); authored.append(obj)

    # Save only production source objects; review lights are added afterwards.
    blend=out/'source'/'ShinoReferenceV2.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.name!='ReviewGround': obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)

    camera=setup_studio(); render_views(camera,out/'review')
    build_path=out/'build.json'; build=json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement']={
        'version':7,
        'auditedFaceDonor':True,
        'auditedBodyBasemesh':False,
        'bodyStrategy':'dedicated-stylized-primary-visible-skin',
        'bodyDonorRetargetRejected':'v5-v6 visual review: adult-proportion donor produced disconnected or stretched limbs',
        'hairStrategy':'open-cap-short-bangs',
        'faceSkinning':'pending-deformation-stage',
        'bodyBlendSkinning':'pending-deformation-stage',
        'authoredPrimaryObjects':len(authored),
        'sourceHairReused':False,
        'sourceClothingReused':False,
        'visualApproval':'pending',
    }
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__': main()
