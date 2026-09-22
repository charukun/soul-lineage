"""Real Blender inspection/correction with lossless preservation of GLB contracts.

Run with blender --background --python this-file -- --model ... --spec ... --out ...
Only POSITION/NORMAL buffers and their bounds change. Rig, UV, morph deltas,
material images, sockets and animation streams are retained from the delivered GLB.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import struct
import sys

sys.path.insert(0,str(Path(__file__).resolve().parent))
from validation import read_export
from common import digest,save_json
from side_profiles import interpolate,finite

VIEWS=('front','side','back','three-quarter')

def check_recipe(recipe,component_names):
    if recipe.get('schemaVersion')!='rinne.forge-dcc-corrections/v1':
        raise ValueError('Unknown DCC correction recipe')
    if not isinstance(recipe.get('edits'),list) or not recipe['edits']:
        raise ValueError('At least one scoped correction required')
    for edit in recipe['edits']:
        if set(edit)-{'component','band','frontDelta','backDelta','centerDelta','findingId'}:
            raise ValueError('Unknown correction field')
        if edit.get('component') not in component_names or not edit.get('findingId'):
            raise ValueError('Correction needs a known component and findingId')
        band=edit.get('band')
        if not isinstance(band,list) or len(band)!=2:
            raise ValueError('Correction band must be [bottom,top]')
        lo,hi=[finite(v,'band') for v in band]
        if not 0<=lo<hi<=1:raise ValueError('Invalid correction band')
        for key in ('frontDelta','backDelta','centerDelta'):
            if abs(finite(edit.get(key,0),key))>.06:
                raise ValueError('Local DCC correction exceeds 6% of body height')
    return recipe

def correction(position,component,edits):
    """Normalized canonical coordinates; positive front/backDelta adds depth."""
    x,y,z=position
    section=interpolate(component['sectionProfiles'],y,lambda r:[r['centerOffset'],r['frontDepth'],r['backDepth']])
    center,front,back=section
    for edit in edits:
        if edit['component']!=component['id']:continue
        lo,hi=edit['band']
        if not lo<=y<=hi:continue
        fade=min(.02,(hi-lo)/4)
        edge=min(1,(y-lo)/fade if lo>0 else 1,(hi-y)/fade if hi<1 else 1)
        weight=edge*edge*(3-2*edge)
        radial=max(-1,min(1,(z-center)/(front if z>=center else back)))
        delta=edit.get('centerDelta',0)
        delta+=edit.get('frontDelta',0)*max(0,radial)-edit.get('backDelta',0)*max(0,-radial)
        z+=weight*delta
    return [x,y,z]

def write_geometry(original,doc,positions_by_mesh,out):
    """DCC exporter: update real edited positions; never rebuild rig/UV/animation."""
    n=struct.unpack_from('<I',original,12)[0];binary=bytearray(original[28+n:])
    changed_ranges=[]
    def write(index,rows):
        a=doc['accessors'][index];v=doc['bufferViews'][a['bufferView']]
        if a['type']!='VEC3' or a['componentType']!=5126 or a['count']!=len(rows) or a.get('sparse'):
            raise ValueError('Unsupported DCC position/normal layout')
        start=v.get('byteOffset',0)+a.get('byteOffset',0);stride=v.get('byteStride',12)
        for i,row in enumerate(rows):
            offset=start+i*stride;struct.pack_into('<fff',binary,offset,*row);changed_ranges.append((offset,offset+12))
        if 'min' in a:a['min']=[min(r[i] for r in rows) for i in range(3)]
        if 'max' in a:a['max']=[max(r[i] for r in rows) for i in range(3)]
    _,_,get=read_export(out.parent/'input.glb')
    for mesh in doc['meshes']:
        if mesh['name'] not in positions_by_mesh:continue
        p=mesh['primitives'][0];pos=positions_by_mesh[mesh['name']];idx=[i[0] for i in get(p['indices'])]
        sums=[[0.,0.,0.] for _ in pos]
        for j in range(0,len(idx),3):
            a,b,c=[pos[idx[j+k]] for k in range(3)]
            u=[b[k]-a[k] for k in range(3)];v=[c[k]-a[k] for k in range(3)]
            normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            for vertex in idx[j:j+3]:
                for k in range(3):sums[vertex][k]+=normal[k]
        normals=[]
        for value in sums:
            length=math.sqrt(sum(x*x for x in value))
            normals.append([x/length for x in value] if length>1e-12 else [0,1,0])
        write(p['attributes']['POSITION'],pos);write(p['attributes']['NORMAL'],normals)
    # Compare every byte outside POSITION/NORMAL accessors, not a self-assigned flag.
    mask=bytearray(len(binary))
    for a,b in changed_ranges:mask[a:b]=b'\1'*(b-a)
    before=original[28+n:]
    if any(a!=b and not mask[i] for i,(a,b) in enumerate(zip(before,binary))):
        raise ValueError('DCC export changed a protected binary stream')
    js=json.dumps(doc,separators=(',',':'),allow_nan=False).encode();js+=b' '*((-len(js))%4)
    data=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    out.write_bytes(data)
    return digest(bytes(b for i,b in enumerate(binary) if not mask[i]))

def main(args):
    import bpy
    from mathutils import Vector
    model=Path(args.model).resolve();out=Path(args.out).resolve();out.mkdir(parents=True,exist_ok=False)
    spec=json.loads(Path(args.spec).read_text());original,doc,get=read_export(model)
    (out/'input.glb').write_bytes(original)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(model),merge_vertices=False)
    # Inspect the actual imported scene before edits. Only named package components qualify.
    components={c['id']:c for c in spec['components']}
    objects={}
    for node in doc['nodes']:
        if 'mesh' not in node:continue
        mesh=doc['meshes'][node['mesh']]
        obj=bpy.data.objects.get(node['name'])
        if obj is None or obj.type!='MESH':raise ValueError('Missing imported DCC mesh '+node['name'])
        objects[mesh['name']]=obj
    if set(objects)!=set(components):raise ValueError('DCC scene does not match package components')
    preflight={'modelSha256':digest(original),'meshNames':sorted(objects),
               'meshVertices':{k:len(v.data.vertices) for k,v in objects.items()},
               'armatures':[o.name for o in bpy.data.objects if o.type=='ARMATURE']}
    if not preflight['armatures']:raise ValueError('DCC import lost armature')
    def neutral():
        for obj in bpy.data.objects:
            if obj.type=='ARMATURE':obj.data.pose_position='REST'
            if obj.type=='MESH' and obj.data.shape_keys:
                for key in obj.data.shape_keys.key_blocks:key.value=0
        bpy.context.view_layer.update()
    neutral()
    output_model=model;changed=0;changed_meshes=[];protected_hash=None
    if args.recipe:
        recipe=check_recipe(json.loads(Path(args.recipe).read_text()),set(components))
        if recipe.get('inputModelSha256') and recipe['inputModelSha256']!=digest(original):
            raise ValueError('Stale correction recipe')
        updated={}
        for mesh in doc['meshes']:
            name=mesh['name'];edits=[e for e in recipe['edits'] if e['component']==name]
            if not edits:continue
            obj=objects[name];p=mesh['primitives'][0];source=get(p['attributes']['POSITION'])
            key=lambda p:tuple(round(float(v),5) for v in p)
            lookup={};mapped=set();positions=list(source);inverse=obj.matrix_world.inverted()
            for i,p0 in enumerate(source):lookup.setdefault(key(p0),[]).append(i)
            for vertex in obj.data.vertices:
                world=obj.matrix_world@vertex.co
                canonical=[world.x,world.z,-world.y]
                indices=lookup.get(key(canonical))
                if not indices:raise ValueError('DCC vertex correspondence changed; use a topology-aware authoring route')
                corrected=[v*1.6 for v in correction([v/1.6 for v in canonical],components[name],edits)]
                displacement=Vector((corrected[0],-corrected[2],corrected[1]))-world
                local_delta=inverse.to_3x3()@displacement
                if displacement.length>1e-8:
                    changed+=1
                    if obj.data.shape_keys:
                        for shape in obj.data.shape_keys.key_blocks:shape.data[vertex.index].co+=local_delta
                    else:vertex.co+=local_delta
                for i in indices:positions[i]=corrected;mapped.add(i)
            if len(mapped)!=len(source):raise ValueError('DCC export would drop source vertices')
            obj.data.update();updated[name]=positions;changed_meshes.append(name)
        if not changed:raise ValueError('Correction made no real mesh change')
        output_model=out/'character.glb'
        protected_hash=write_geometry(original,doc,updated,output_model)
        # Capture the actual re-export, not a prettier unexported DCC scene.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(output_model),merge_vertices=False)
        neutral()
    scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.device='CPU';scene.cycles.samples=12
    scene.render.resolution_x=320;scene.render.resolution_y=320;scene.render.resolution_percentage=100
    scene.render.image_settings.file_format='PNG';scene.render.image_settings.color_mode='RGBA';scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.world=bpy.data.worlds.new('Forge neutral world');scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.8,.8,.8,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.7
    light=bpy.data.lights.new('Fixed neutral area','AREA');light.energy=180;light.size=4
    obj=bpy.data.objects.new('Fixed neutral area',light);scene.collection.objects.link(obj);obj.location=(-3,-4,5)
    obj.rotation_euler=(Vector((0,0,.8))-obj.location).to_track_quat('-Z','Y').to_euler()
    camdata=bpy.data.cameras.new('Forge fixed orthographic');camdata.type='ORTHO';camdata.ortho_scale=1.6*320/288
    camera=bpy.data.objects.new('Forge fixed orthographic',camdata);scene.collection.objects.link(camera);scene.camera=camera
    target=Vector((0,0,.8));coordinates={'front':(0,-8,.8),'side':(8,0,.8),'back':(0,8,.8),'three-quarter':(6,-8,.8)}
    captures={}
    for name in VIEWS:
        camera.location=coordinates[name];camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
        captures[name]={'path':name+'.png','sha256':digest((out/(name+'.png')).read_bytes()),
                        'camera':{'position':list(coordinates[name]),'target':list(target),'orthoScale':camdata.ortho_scale}}
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'model.blend'))
    receipt={'schemaVersion':'rinne.forge-dcc-capture/v1','sourceSha':args.source_sha,
      'inputModelSha256':digest(original),'modelSha256':digest(output_model.read_bytes()),
      'blenderVersion':bpy.app.version_string,'preflight':preflight,'captures':captures,
      'blend':{'path':'model.blend','sha256':digest((out/'model.blend').read_bytes())},
      'recipeSha256':digest(Path(args.recipe).read_bytes()) if args.recipe else None,
      'changedVertices':changed,'changedComponents':changed_meshes,'protectedBinarySha256':protected_hash,
      'renderer':'Blender Cycles CPU; fixed orthographic, neutral lighting; not runtime or device evidence',
      'visualApproval':'pending','productionReady':False}
    save_json(out/'dcc-receipt.json',receipt)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--model',required=True);p.add_argument('--spec',required=True)
    p.add_argument('--out',required=True);p.add_argument('--recipe');p.add_argument('--source-sha',required=True)
    main(p.parse_args(sys.argv[sys.argv.index('--')+1:]))
