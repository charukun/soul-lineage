"""Export actual Blender surfaces while preserving pinned KayKit motion streams.
Only edited mesh payloads/materials and additional skinned surfaces change.
"""
from pathlib import Path
import copy, hashlib, json, struct
import bpy
EXPECTED_SHA256='e825437cd4d2ee9c1960b517a74a69101e33eb409ae7fa8cedc7134a998fbb7d'
BODY_NAMES=('Rogue_ArmLeft','Rogue_ArmRight','Rogue_Body','Rogue_Head','Rogue_LegLeft','Rogue_LegRight')
def read_glb(path):
    data=Path(path).read_bytes();assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
    n=struct.unpack_from('<I',data,12)[0]
    return json.loads(data[20:20+n]),bytearray(data[28+n:]),data

def export_edited(source,destination,atlas,extras):
    doc,binary,original=read_glb(source);assert hashlib.sha256(original).hexdigest()==EXPECTED_SHA256
    upstream=copy.deepcopy(doc);source_binary=bytes(binary)
    joints={doc['nodes'][node]['name']:i for i,node in enumerate(doc['skins'][0]['joints'])};nodes={n['name']:i for i,n in enumerate(doc['nodes'])}
    def blob(data,target=None):
        while len(binary)%4:binary.append(0)
        v={'buffer':0,'byteOffset':len(binary),'byteLength':len(data)}
        if target:v['target']=target
        binary.extend(data);doc['bufferViews'].append(v);return len(doc['bufferViews'])-1
    def accessor(rows,width,kind=5126,target=34962,limits=False):
        rows=list(rows);flat=[x for r in rows for x in r];fmt={5126:'f',5123:'H',5125:'I'}[kind]
        index=blob(struct.pack('<'+fmt*len(flat),*flat),target)
        item={'bufferView':index,'componentType':kind,'count':len(rows),'type':{1:'SCALAR',2:'VEC2',3:'VEC3',4:'VEC4'}[width]}
        if limits:item.update(min=[min(r[k] for r in rows) for k in range(width)],max=[max(r[k] for r in rows) for k in range(width)])
        doc['accessors'].append(item);return len(doc['accessors'])-1
    doc['images'].append({'name':'HeroineDawnPalette','mimeType':'image/png','bufferView':blob(Path(atlas).read_bytes())})
    doc['textures'].append({'source':len(doc['images'])-1,'sampler':0})
    doc['materials'].append({'name':'HeroineDawn_SoftClothAndHair','doubleSided':True,'pbrMetallicRoughness':{'baseColorTexture':{'index':len(doc['textures'])-1},'metallicFactor':0,'roughnessFactor':.82}})
    material=len(doc['materials'])-1;rows_report=[]
    for name in list(BODY_NAMES)+list(extras):
        ob=bpy.data.objects[name];mesh=ob.data;mesh.calc_loop_triangles();uv=mesh.uv_layers.active.data
        positions=[];normals=[];uvs=[];weights=[];joint_ids=[];indices=[];lookup={}
        world=ob.matrix_world;normal_matrix=world.to_3x3().inverted().transposed();groups={g.index:joints[g.name] for g in ob.vertex_groups if g.name in joints}
        for tri in mesh.loop_triangles:
            for li in tri.loops:
                vi=mesh.loops[li].vertex_index;vert=mesh.vertices[vi];pos=world@vert.co
                norm=normal_matrix@(vert.normal if mesh.polygons[tri.polygon_index].use_smooth else tri.normal);norm.normalize()
                pairs=sorted([(groups[g.group],g.weight) for g in vert.groups if g.group in groups and g.weight>1e-7],key=lambda x:-x[1])[:4]
                assert pairs,f'{name}: unweighted vertex {vi}'
                total=sum(w for j,w in pairs);pairs=[(j,w/total) for j,w in pairs]+[(0,0)]*(4-len(pairs))
                p=(pos.x,pos.z,-pos.y);n=(norm.x,norm.z,-norm.y);t=(uv[li].uv.x,1-uv[li].uv.y);j=tuple(x[0] for x in pairs);w=tuple(x[1] for x in pairs)
                key=tuple(round(x,7) for x in p+n+t)+j+tuple(round(x,7) for x in w)
                if key not in lookup:
                    lookup[key]=len(positions);positions.append(p);normals.append(n);uvs.append(t);weights.append(w);joint_ids.append(j)
                indices.append((lookup[key],))
        primitive={'attributes':{'POSITION':accessor(positions,3,limits=True),'NORMAL':accessor(normals,3),'TEXCOORD_0':accessor(uvs,2),'JOINTS_0':accessor(joint_ids,4,kind=5123),'WEIGHTS_0':accessor(weights,4)},'indices':accessor(indices,1,kind=5125,target=34963),'material':material}
        payload={'name':name.replace('Rogue_','Heroine_'),'primitives':[primitive]}
        if name in nodes:doc['meshes'][doc['nodes'][nodes[name]]['mesh']]=payload
        else:
            doc['meshes'].append(payload);doc['nodes'].append({'name':name,'mesh':len(doc['meshes'])-1,'skin':0});doc['scenes'][doc.get('scene',0)]['nodes'].append(len(doc['nodes'])-1)
        rows_report.append({'name':name,'vertices':len(positions),'triangles':len(indices)//3})
    doc['nodes'][nodes['Rogue_Cape']].pop('mesh',None)
    doc['buffers']=[{'byteLength':len(binary)}];doc['asset']['generator']='RINNE Heroine Dawn / Blender mesh authoring + exact KayKit motion preservation'
    text=json.dumps(doc,separators=(',',':'),ensure_ascii=True).encode();text+=b' '*((-len(text))%4);binary.extend(b'\0'*((-len(binary))%4))
    output=struct.pack('<III',0x46546c67,2,12+8+len(text)+8+len(binary))+struct.pack('<II',len(text),0x4e4f534a)+text+struct.pack('<II',len(binary),0x004e4942)+binary
    Path(destination).write_bytes(output)
    assert doc['animations']==upstream['animations'];assert doc['skins']==upstream['skins']
    for node_index in doc['skins'][0]['joints']:assert doc['nodes'][node_index]==upstream['nodes'][node_index]
    for animation in doc['animations']:
        for sampler in animation['samplers']:
            for key in ['input','output']:
                ai=sampler[key];assert doc['accessors'][ai]==upstream['accessors'][ai]
                bi=doc['accessors'][ai]['bufferView'];v=doc['bufferViews'][bi];off=v.get('byteOffset',0);size=v['byteLength'];assert binary[off:off+size]==source_binary[off:off+size]
    return {'schema':'rinne-heroine-dcc-audit','sourceSha256':EXPECTED_SHA256,'bytes':len(output),'sha256':hashlib.sha256(output).hexdigest(),'gitBlobSha':hashlib.sha1(f'blob {len(output)}\0'.encode()+output).hexdigest(),'meshes':rows_report,'triangles':sum(r['triangles'] for r in rows_report),'motionClips':len(doc['animations']),'motionStreams':'byte-for-byte unchanged','jointCount':len(joints),'jointHierarchy':'unchanged','inverseBindMatrices':'unchanged','samplerResampling':False,'removedDisplaySurface':'Rogue_Cape','visualApproval':'pending','productionReady':False}
