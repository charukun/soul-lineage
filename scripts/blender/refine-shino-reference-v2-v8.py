"""Clean stylized PRIMARY rebuild for Shino Reference v2.

Previous passes demonstrated that carrying progressively modified donor surfaces can
leave visually invalid remnants even when objective Blender audits pass. PRIMARY is
therefore rebuilt here from a clean scene: keep only the audited humanoid armature
and approved material vocabulary, delete every visible mesh, then author one
coherent stylized character specifically for the reference sheet.

Meshes remain static at PRIMARY. Formal skin binding, facial deformation and motion
are deliberately deferred to DEFORMATION/MOTION gates instead of being faked here.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def cli():
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', required=True)
    return parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


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
        for polygon in obj.data.polygons:
            polygon.use_smooth = True


def bevel(obj, width, segments=3):
    modifier = obj.modifiers.new('PRIMARY Bevel', 'BEVEL')
    modifier.width = width
    modifier.segments = segments
    modifier.limit_method = 'ANGLE'
    select_only(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def sphere(name, location, scale, material, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def rounded_cube(name, location, scale, material, radius=.018, rotation=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_transform(obj)
    bevel(obj, radius, 4)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def tapered(name, a, b, r1, r2, material, vertices=28):
    a = Vector(a); b = Vector(b); delta = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=r1, radius2=r2, depth=delta.length, location=(a+b)*.5)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = Vector((0,0,1)).rotation_difference(delta.normalized())
    apply_transform(obj)
    bevel(obj, min(r1,r2)*.18, 3)
    smooth(obj)
    obj.data.materials.append(material)
    ensure_uv(obj)
    return obj


def curve_mesh(name, points, radius, material):
    curve = bpy.data.curves.new(name + 'Curve', 'CURVE')
    curve.dimensions = '3D'
    curve.resolution_u = 5
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points)-1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = 'AUTO'
        point.handle_right_type = 'AUTO'
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    curve.materials.append(material)
    select_only(obj)
    bpy.ops.object.convert(target='MESH')
    smooth(obj)
    ensure_uv(obj)
    return obj


def ring_shell(name, top_z, bottom_z, top_xy, bottom_xy, material, open_front=.0, segments=44):
    start = open_front
    arc = math.tau - open_front*2 if open_front else math.tau
    columns = segments + 1 if open_front else segments
    vertices=[]; faces=[]
    for z,(rx,ry) in ((top_z,top_xy),(bottom_z,bottom_xy)):
        for i in range(columns):
            t=i/segments
            angle=start+arc*t
            vertices.append((math.sin(angle)*rx,-math.cos(angle)*ry,z))
    limit=columns-1 if open_front else columns
    for i in range(limit):
        j=(i+1)%columns
        faces.append((i,j,columns+j,columns+i))
    mesh=bpy.data.meshes.new(name+'Mesh'); mesh.from_pydata(vertices,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh); bpy.context.collection.objects.link(obj); obj.data.materials.append(material)
    solid=obj.modifiers.new('ClothThickness','SOLIDIFY'); solid.thickness=.012; solid.offset=0
    select_only(obj); bpy.ops.object.modifier_apply(modifier=solid.name)
    bevel(obj,.006,3); smooth(obj); ensure_uv(obj)
    return obj


def make_material(name, rgba, roughness=.7, metallic=0.0):
    mat=bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.diffuse_color=rgba
    mat.use_nodes=True
    bsdf=mat.node_tree.nodes.get('Principled BSDF')
    if bsdf:
        bsdf.inputs['Base Color'].default_value=rgba
        bsdf.inputs['Roughness'].default_value=roughness
        bsdf.inputs['Metallic'].default_value=metallic
    return mat


def open_cap(name, location, scale, material):
    obj=sphere(name,location,scale,material,44,30)
    bm=bmesh.new(); bm.from_mesh(obj.data); dead=[]
    for face in bm.faces:
        center=face.calc_center_median()
        # Mesh-local front is -Y. Remove a generous face window while keeping crown,
        # side volume and the back of the bob.
        if center.y < -0.045 and center.z < .095:
            dead.append(face)
    if dead:
        bmesh.ops.delete(bm,geom=dead,context='FACES')
    bm.to_mesh(obj.data); bm.free(); obj.data.update(); ensure_uv(obj)
    return obj


def render_setup():
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'; scene.unit_settings.scale_length=1.0
    scene.render.resolution_x=768; scene.render.resolution_y=1024; scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG'; scene.world.color=(.030,.034,.036)
    try: scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError): scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1)); camera=bpy.context.object; camera.name='ReviewCamera'; camera.data.type='ORTHO'; camera.data.ortho_scale=1.78; scene.camera=camera
    for name,pos,energy,size,color in [
        ('Key',(-2.5,-3.4,4.0),850,4.0,(1.0,.88,.75)),
        ('Fill',(2.8,-1.7,2.5),450,3.5,(.78,.88,1.0)),
        ('Rim',(.5,2.8,3.2),650,3.0,(.75,.88,1.0)),
    ]:
        bpy.ops.object.light_add(type='AREA',location=pos)
        light=bpy.context.object; light.name=name; light.data.energy=energy; light.data.size=size; light.data.color=color
        light.rotation_euler=(Vector((0,0,.83))-light.location).to_track_quat('-Z','Y').to_euler()
    ground_mat=make_material('MAT_STUDIO_GROUND',(.13,.16,.14,1),.95)
    bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005)); ground=bpy.context.object; ground.name='ReviewGround'; ground.data.materials.append(ground_mat)
    return camera


def render_views(camera,out):
    out.mkdir(parents=True,exist_ok=True); target=Vector((0,0,.82))
    for name,pos in {'front':(0,-3.6,.9),'side':(3.6,0,.9),'back':(0,3.6,.9),'three-quarter':(2.55,-2.55,1.05)}.items():
        camera.location=pos; camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler(); bpy.context.scene.render.filepath=str(out/f'{name}.png'); bpy.ops.render.render(write_still=True)


def main():
    args=cli(); out=Path(args.out).resolve(); rig=bpy.data.objects.get('ShinoReferenceV2Rig')
    if not rig: raise RuntimeError('ShinoReferenceV2Rig missing')

    # Reset every visible surface. Only the audited armature/provenance survives.
    for obj in list(bpy.context.scene.objects):
        if obj.type=='MESH': bpy.data.objects.remove(obj,do_unlink=True)

    skin=make_material('MAT_SKIN',(0.94,.72,.64,1),.78)
    skin_shadow=make_material('MAT_SKIN_SHADOW',(.78,.50,.43,1),.82)
    hair=make_material('MAT_HAIR',(.34,.18,.11,1),.58)
    hair_hi=make_material('MAT_HAIR_HIGHLIGHT',(.49,.29,.19,1),.54)
    eye_white=make_material('MAT_EYE_WHITE',(.99,.99,.97,1),.35)
    iris=make_material('MAT_EYE_IRIS',(.26,.12,.07,1),.30)
    pupil=make_material('MAT_EYE_PUPIL',(.045,.028,.020,1),.24)
    white=make_material('MAT_EYE_HIGHLIGHT',(1,.98,.91,1),.20)
    brow=make_material('MAT_BROW',(.27,.13,.08,1),.60)
    mouth=make_material('MAT_MOUTH',(.52,.20,.20,1),.68)
    cream=make_material('MAT_CLOTH_CREAM',(.88,.84,.73,1),.88)
    green=make_material('MAT_CLOTH_GREEN',(.32,.48,.25,1),.86)
    green_dark=make_material('MAT_CLOTH_GREEN_DARK',(.15,.29,.12,1),.90)
    shorts=make_material('MAT_CLOTH_SHORTS',(.15,.12,.11,1),.90)
    leather=make_material('MAT_LEATHER',(.34,.20,.12,1),.76)
    leather_dark=make_material('MAT_LEATHER_DARK',(.20,.11,.07,1),.82)
    brass=make_material('MAT_BRASS',(.66,.49,.22,1),.40,.42)

    authored=[]
    def add(obj): authored.append(obj); return obj

    # Head and readable anime face.
    head=add(sphere('PRIMARY_Head',(0,.008,1.385),(.158,.132,.176),skin,44,30))
    for vertex in head.data.vertices:
        local_z=vertex.co.z
        if local_z < -.035:
            vertex.co.x *= .86 + .14*max(0,min(1,(local_z+.17)/.135))
    head.data.update()
    add(sphere('PRIMARY_Neck',(0,.018,1.215),(.045,.042,.062),skin,24,16))
    for side,x in [('L',.056),('R',-.056)]:
        add(sphere(f'FACE_{side}_White',(x,-.128,1.405),(.048,.012,.051),eye_white,28,18))
        add(sphere(f'FACE_{side}_Iris',(x,-.140,1.403),(.028,.006,.034),iris,24,16))
        add(sphere(f'FACE_{side}_Pupil',(x,-.146,1.402),(.013,.003,.020),pupil,20,14))
        add(sphere(f'FACE_{side}_Highlight',(x-.009,-.150,1.417),(.007,.0025,.009),white,16,10))
        sign=1 if side=='L' else -1
        add(rounded_cube(f'FACE_{side}_Brow',(x,-.137,1.463),(.038,.004,.006),brow,.004,rotation=(0,0,math.radians(8*sign))))
        add(rounded_cube(f'FACE_{side}_Lash',(x,-.143,1.430),(.041,.003,.004),brow,.003,rotation=(0,0,math.radians(-5*sign))))
    add(sphere('FACE_Nose',(0,-.132,1.360),(.012,.008,.014),skin_shadow,16,10))
    add(curve_mesh('FACE_Mouth',[(-.025,-.141,1.326),(0,-.146,1.320),(.025,-.141,1.326)],.004,mouth))

    # Bob hair. Back/sides are one clean cap plus selected locks. Face window stays open.
    add(open_cap('HAIR_Cap',(0,.025,1.425),(.178,.154,.185),hair))
    back_angles=[-78,-55,-32,-12,12,32,55,78]
    for i,deg in enumerate(back_angles):
        rad=math.radians(deg); x=math.sin(rad)*.145; y=.055+math.cos(rad)*.075
        add(curve_mesh(f'HAIR_BackLock_{i:02}',[(x*.55,y*.45,1.55),(x,y,1.43),(x*1.02,y*.98,1.27)],.020 if abs(deg)<60 else .018,hair_hi if i in (2,5) else hair))
    for side,sign in [('L',1),('R',-1)]:
        add(curve_mesh(f'HAIR_{side}_SideLock',[(.095*sign,-.020,1.53),(.148*sign,-.075,1.42),(.145*sign,-.070,1.29)],.020,hair))
    for i,(x,end_z) in enumerate([(-.070,1.438),(-.036,1.425),(0,1.432),(.036,1.425),(.070,1.438)]):
        add(curve_mesh(f'HAIR_Bang_{i:02}',[(x*.45,-.058,1.555),(x,-.118,1.493),(x*.92,-.139,end_z)],.014 if i!=2 else .013,hair_hi if i in (1,3) else hair))

    # Torso and reference clothing.
    add(sphere('BODY_Torso',(0,.010,1.000),(.135,.098,.205),cream,32,20))
    add(rounded_cube('BODY_Waist',(0,.005,.835),(.120,.090,.090),cream,.032))
    add(ring_shell('CLOTH_Vest',1.145,.835,(.150,.108),(.168,.118),green,open_front=.34,segments=42))
    add(ring_shell('CLOTH_Capelet',1.185,1.015,(.175,.122),(.270,.172),green,open_front=.45,segments=46))
    add(ring_shell('CLOTH_CapeTrim',1.035,1.005,(.266,.169),(.276,.178),cream,open_front=.45,segments=46))
    add(rounded_cube('CLOTH_Collar',(0,-.106,1.168),(.078,.026,.026),cream,.010))
    for z in (1.08,1.00,.92):
        add(sphere(f'CLOTH_Button_{z:.2f}',(0,-.120,z),(.011,.007,.011),brass,16,10))

    # Arms with overlap, avoiding disconnected mannequin joints.
    for side,sign in [('L',1),('R',-1)]:
        add(sphere(f'CLOTH_{side}_Shoulder',(.155*sign,.005,1.145),(.070,.075,.073),cream,24,16))
        add(tapered(f'CLOTH_{side}_Sleeve',(.155*sign,0,1.145),(.320*sign,0,1.045),.062,.050,cream))
        add(tapered(f'CLOTH_{side}_Cuff',(.305*sign,0,1.055),(.365*sign,0,1.015),.052,.046,green_dark))
        add(tapered(f'SKIN_{side}_Forearm',(.350*sign,0,1.025),(.495*sign,-.004,.935),.044,.034,skin))
        add(sphere(f'SKIN_{side}_Palm',(.525*sign,-.005,.918),(.050,.034,.054),skin,24,16))
        # Four subtle finger lobes and a thumb give the hand a character silhouette.
        for j,offset in enumerate((-.024,-.008,.008,.024)):
            add(sphere(f'SKIN_{side}_Finger_{j}',(.555*sign,offset,.904+j*.002),(.018,.011,.026),skin,16,10))
        add(sphere(f'SKIN_{side}_Thumb',(.515*sign,-.034,.930),(.020,.014,.030),skin,16,10))

    # Belt, shorts and continuous legs.
    bpy.ops.mesh.primitive_torus_add(major_radius=.132,minor_radius=.011,major_segments=40,minor_segments=8,location=(0,0,.785),rotation=(math.pi/2,0,0))
    belt=bpy.context.object; belt.name='ACC_Belt'; belt.scale=(1,.80,1); apply_transform(belt); belt.data.materials.append(leather_dark); ensure_uv(belt); add(belt)
    add(rounded_cube('ACC_Buckle',(0,-.105,.785),(.028,.012,.024),brass,.005))
    for side,sign in [('L',1),('R',-1)]:
        add(rounded_cube(f'CLOTH_{side}_Shorts',(.070*sign,.004,.700),(.080,.102,.108),shorts,.030))
        add(tapered(f'SKIN_{side}_Thigh',(.078*sign,.002,.675),(.094*sign,.002,.430),.064,.052,skin))
        add(sphere(f'SKIN_{side}_Knee',(.094*sign,0,.415),(.053,.049,.056),skin,22,14))
        add(tapered(f'SKIN_{side}_Calf',(.094*sign,0,.405),(.095*sign,0,.315),.050,.045,skin))
        add(tapered(f'CLOTH_{side}_BootShaft',(.095*sign,0,.330),(.095*sign,-.002,.105),.066,.057,leather,28))
        add(rounded_cube(f'CLOTH_{side}_BootToe',(.095*sign,-.070,.070),(.068,.120,.058),leather,.022))
        add(rounded_cube(f'CLOTH_{side}_BootCuff',(.095*sign,0,.335),(.073,.064,.030),green_dark,.012))
        for i,z in enumerate((.145,.180,.215,.250,.285)):
            for eye_sign in (-1,1):
                add(sphere(f'DETAIL_BootEyelet_{side}_{i}_{eye_sign}',((.095+.050*eye_sign)*sign,-.061,z),(.006,.005,.006),brass,12,8))
            add(rounded_cube(f'DETAIL_BootLace_{side}_{i}',(.095*sign,-.068,z),(.051,.004,.004),cream,.002,rotation=(0,0,math.radians((6 if i%2==0 else -6)*sign))))

    # Satchel and botanical brooch.
    add(rounded_cube('ACC_Satchel',(-.185,.035,.720),(.092,.050,.112),leather,.018))
    add(rounded_cube('ACC_SatchelFlap',(-.185,-.010,.762),(.088,.013,.045),green_dark,.010))
    add(sphere('ACC_SatchelClasp',(-.185,-.026,.752),(.012,.006,.014),brass,14,8))
    add(curve_mesh('ACC_SatchelStrap',[(.105,-.112,1.135),(-.015,-.120,.98),(-.175,-.070,.79)],.009,leather_dark))
    add(sphere('ACC_Brooch',(0,-.138,1.137),(.021,.009,.021),brass,16,10))
    for sign in (-1,1):
        add(rounded_cube(f'ACC_BroochLeaf_{sign}',(.021*sign,-.141,1.148),(.022,.005,.010),green_dark,.004,rotation=(0,0,math.radians(28*sign))))

    # Production source is saved before review-only studio objects are introduced.
    blend=out/'source'/'ShinoReferenceV2.blend'; bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT'); rig.select_set(True)
    for obj in authored: obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)

    camera=render_setup(); render_views(camera,out/'review')
    build_path=out/'build.json'; build=json.loads(build_path.read_text(encoding='utf-8'))
    build['refinement']={
        'version':8,
        'strategy':'clean-dedicated-stylized-primary',
        'legacyVisibleMeshesRetained':False,
        'auditedArmatureRetained':True,
        'auditedFaceDonorRetained':False,
        'primaryGeometryBinding':'static-unbound',
        'deformationBinding':'pending-deformation-stage',
        'authoredPrimaryObjects':len(authored),
        'visualApproval':'pending',
    }
    build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__': main()
