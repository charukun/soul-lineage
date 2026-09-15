"""Visual correction pass 4: keep donor face in baked model space for PRIMARY review.

PRIMARY is a shape/silhouette gate. The previous pass proved that reusing the old
skin weights against the newly retargeted chibi skeleton double-transformed the
face. This pass removes that premature deformation binding and keeps the audited
high-density face/eye subset as a static DCC surface. Formal face skinning and
expressions remain a DEFORMATION-stage task and are not falsely claimed here.
"""
from __future__ import annotations

import argparse
import bmesh
import json
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


def cli():
    p=argparse.ArgumentParser();p.add_argument('--source-vrm',required=True);p.add_argument('--out',required=True)
    return p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])


def remove_prefix(*prefixes):
    for obj in list(bpy.context.scene.objects):
        if any(obj.name.startswith(p) for p in prefixes):bpy.data.objects.remove(obj,do_unlink=True)


def name_at(obj,index):
    if index<0 or index>=len(obj.material_slots):return ''
    m=obj.material_slots[index].material;return m.name.lower() if m else ''


def wanted(name):
    return any(t in name for t in ('face','eye','iris','eyeline','eyelash','brow','mouth','teeth','tongue')) and not any(t in name for t in ('hair','cloth','outfit','body'))


def extract(meshes):
    donors=[];materials=set()
    for src in meshes:
        allowed={i for i in range(len(src.material_slots)) if wanted(name_at(src,i))}
        if not allowed:continue
        obj=src.copy();obj.data=src.data.copy();bpy.context.collection.objects.link(obj);obj.name='DCC_DonorFaceV4_'+src.name
        bm=bmesh.new();bm.from_mesh(obj.data);dead=[f for f in bm.faces if f.material_index not in allowed]
        if dead:bmesh.ops.delete(bm,geom=dead,context='FACES')
        bm.to_mesh(obj.data);bm.free();obj.data.update()
        if not obj.data.polygons:bpy.data.objects.remove(obj,do_unlink=True);continue
        for mod in list(obj.modifiers):obj.modifiers.remove(mod)
        obj.vertex_groups.clear();donors.append(obj);materials.update(name_at(src,i) for i in allowed)
    return donors,sorted(materials)


def points(objects,eyes=False):
    result=[]
    for obj in objects:
        eye=any('eye' in (slot.material.name.lower() if slot.material else '') for slot in obj.material_slots)
        if eyes and not eye:continue
        result.extend(obj.matrix_world@v.co for v in obj.data.vertices)
    return result


def bounds(values):
    lo=Vector((min(p.x for p in values),min(p.y for p in values),min(p.z for p in values)));hi=Vector((max(p.x for p in values),max(p.y for p in values),max(p.z for p in values)))
    return lo,hi,(lo+hi)*.5,hi-lo


def studio():
    scene=bpy.context.scene;scene.render.resolution_x=768;scene.render.resolution_y=1024;scene.render.resolution_percentage=100;scene.render.image_settings.file_format='PNG';scene.world.color=(.028,.035,.039)
    try:scene.render.engine='BLENDER_EEVEE_NEXT'
    except (TypeError,ValueError):scene.render.engine='BLENDER_EEVEE'
    bpy.ops.object.camera_add(location=(0,-4,1));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=1.82;scene.camera=cam
    for pos,energy,size,color in [((-2.5,-3.4,4),900,4,(1,.84,.68)),((3,-1.8,2.5),500,3.5,(.72,.84,1)),((.4,2.8,3.2),750,3,(.72,.84,1))]:
        bpy.ops.object.light_add(type='AREA',location=pos);l=bpy.context.object;l.data.energy=energy;l.data.size=size;l.data.color=color;l.rotation_euler=(Vector((0,0,.84))-l.location).to_track_quat('-Z','Y').to_euler()
    m=bpy.data.materials.get('MAT_CLOTH_GREEN_DARK');bpy.ops.mesh.primitive_plane_add(size=8,location=(0,0,-.005));ground=bpy.context.object;ground.name='ReviewGround';ground.data.materials.append(m)
    return cam,ground


def render(cam,out):
    out.mkdir(parents=True,exist_ok=True);target=Vector((0,0,.84))
    for name,pos in {'front':(0,-3.6,.92),'side':(3.6,0,.92),'back':(0,3.6,.92),'three-quarter':(2.55,-2.55,1.08)}.items():
        cam.location=pos;cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.render.filepath=str(out/f'{name}.png');bpy.ops.render.render(write_still=True)


def main():
    a=cli();out=Path(a.out).resolve();rig=bpy.data.objects.get('ShinoReferenceV2Rig')
    if not rig:raise RuntimeError('Reference rig missing')
    remove_prefix('DCC_DonorFaceV3_','DCC_DonorFaceV4_','DCC_DonorFaceRoot')
    before=set(bpy.context.scene.objects);bpy.ops.import_scene.gltf(filepath=str(Path(a.source_vrm).resolve()));imported=[o for o in bpy.context.scene.objects if o not in before];donors,materials=extract([o for o in imported if o.type=='MESH'])
    if not donors:raise RuntimeError('Donor face extraction failed')
    all_points=points(donors);lo,hi,center,size=bounds(all_points);eye_points=points(donors,True);eye_center=bounds(eye_points)[2] if eye_points else center
    target_center=Vector((0,-.010,1.370));target_size=Vector((.292,.245,.334));scale=min(target_size.x/max(size.x,1e-6),target_size.z/max(size.z,1e-6));flip=eye_center.y>center.y
    for obj in donors:
        world=obj.matrix_world.copy()
        for v in obj.data.vertices:
            p=world@v.co
            if flip:p.y=center.y-(p.y-center.y)
            rel=p-center;v.co=target_center+rel*scale
        obj.matrix_world=Matrix.Identity(4);obj.parent=None
        if not obj.data.uv_layers:obj.data.uv_layers.new(name='UVMap')
    for obj in imported:
        if obj in donors:continue
        if obj.name in bpy.context.scene.objects:bpy.data.objects.remove(obj,do_unlink=True)

    # Save/export static PRIMARY geometry. Face deformation is deliberately pending.
    blend=out/'source'/'ShinoReferenceV2.blend';bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.object.select_all(action='DESELECT');rig.select_set(True)
    for obj in bpy.context.scene.objects:
        if obj.type=='MESH' and obj.name!='ReviewGround':obj.select_set(True)
    bpy.context.view_layer.objects.active=rig
    bpy.ops.export_scene.gltf(filepath=str(out/'export'/'ShinoReferenceV2.glb'),export_format='GLB',use_selection=True,export_animations=False,export_cameras=False,export_lights=False,export_apply=False)
    cam,ground=studio();render(cam,out/'review')
    build_path=out/'build.json';build=json.loads(build_path.read_text(encoding='utf-8'));build['refinement']={'version':4,'auditedFaceDonor':True,'donorMaterials':materials,'facePlacement':'static-model-space-primary','faceSkinning':'pending-deformation-stage','sourceHairReused':False,'sourceClothingReused':False,'sourceBodyReused':False,'visualApproval':'pending'};build_path.write_text(json.dumps(build,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(build['refinement'],ensure_ascii=False,indent=2))


if __name__=='__main__':main()
