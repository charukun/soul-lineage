import json
import struct
from common import VERSION

def export_glb(spec,meshes,bones,clips,texture,out):
    binary=bytearray();views=[];accessors=[]
    def raw(data):
        while len(binary)%4:binary.append(0)
        start=len(binary);binary.extend(data);views.append({'buffer':0,'byteOffset':start,'byteLength':len(data)});return len(views)-1
    def accessor(rows,kind='VEC3',component=5126,limits=False):
        flatten=[x for row in rows for x in (row if isinstance(row,(list,tuple)) else [row])]
        code={5126:'f',5123:'H',5125:'I'}[component]
        a={'bufferView':raw(struct.pack('<'+code*len(flatten),*flatten)),'componentType':component,'count':len(rows),'type':kind}
        if limits:
            tuples=[r if isinstance(r,(list,tuple)) else [r] for r in rows]
            a['min']=[min(v) for v in zip(*tuples)];a['max']=[max(v) for v in zip(*tuples)]
        accessors.append(a);return len(accessors)-1
    nodes=[];by_name={b['name']:i for i,b in enumerate(bones)}
    for b in bones:
        p=bones[by_name[b['parent']]]['position'] if b['parent'] else [0,0,0]
        nodes.append({'name':b['name'].replace('.','_'),'extras':{'forgeBone':b['name']},'translation':[(a-c)*1.6 for a,c in zip(b['position'],p)],'children':[]})
    for i,b in enumerate(bones):
        if b['parent']:nodes[by_name[b['parent']]]['children'].append(i)
    for name,s in spec['sockets']['definitions'].items():
        idx=len(nodes);nodes.append({'name':'socket_'+name,'translation':[v*1.6 for v in s['offset']],'extras':{'socket':name}});nodes[by_name[s['bone']]]['children'].append(idx)
    inverse=[]
    for b in bones:
        x,y,z=[a*1.6 for a in b['position']];inverse.append([1,0,0,0,0,1,0,0,0,0,1,0,-x,-y,-z,1])
    skin={'name':spec['rig']['id'],'joints':list(range(len(bones))),'skeleton':0,'inverseBindMatrices':accessor(inverse,'MAT4')}
    gl_meshes=[];scene_nodes=[0]
    for mesh in meshes:
        pos=[[v*1.6 for v in p] for p in mesh['positions']]
        attrs={'POSITION':accessor(pos,limits=True),'NORMAL':accessor(mesh['normals']),'TEXCOORD_0':accessor(mesh['uv'],'VEC2'),'JOINTS_0':accessor(mesh['joints'],'VEC4',5123),'WEIGHTS_0':accessor(mesh['weights'],'VEC4')}
        primitive={'attributes':attrs,'indices':accessor(mesh['indices'],'SCALAR',5123),'material':0}
        gl_mesh={'name':mesh['id'],'primitives':[primitive]}
        morphs=mesh.get('morphTargets',[])
        if morphs:
            primitive['targets']=[{'POSITION':accessor([[v*1.6 for v in delta] for delta in target['deltas']])} for target in morphs]
            gl_mesh['weights']=[0]*len(morphs);gl_mesh['extras']={'targetNames':[target['name'] for target in morphs]}
        gl_meshes.append(gl_mesh)
        scene_nodes.append(len(nodes));nodes.append({'name':mesh['id']+'Mesh','mesh':len(gl_meshes)-1,'skin':0,'extras':{'component':mesh['id'],'status':mesh['component']['status']}})
    anims=[]
    for clip in clips:
        samplers=[];channels=[]
        for track in clip['tracks']:
            values=track['values']
            if track['path']=='translation':values=[[v*1.6 for v in p] for p in values]
            samplers.append({'input':accessor(track['times'],'SCALAR',limits=True),'output':accessor(values,'VEC4' if track['path']=='rotation' else 'VEC3'),'interpolation':'LINEAR'})
            channels.append({'sampler':len(samplers)-1,'target':{'node':track['bone'],'path':track['path']}})
        anims.append({'name':clip['name'],'samplers':samplers,'channels':channels,'extras':{'loop':clip['loop'],'status':'generated'}})
    image_view=raw(texture.read_bytes())
    for node in nodes:
        if not node.get('children'):node.pop('children',None)
    doc={'asset':{'version':'2.0','generator':'RINNE Character Create Forge '+VERSION},'scene':0,'scenes':[{'nodes':scene_nodes}],
      'nodes':nodes,'skins':[skin],'meshes':gl_meshes,'animations':anims,'bufferViews':views,'accessors':accessors,'buffers':[{'byteLength':len(binary)}],
      'images':[{'bufferView':image_view,'mimeType':'image/png'}],'samplers':[{'magFilter':9729,'minFilter':9987,'wrapS':33071,'wrapT':33071}],'textures':[{'source':0,'sampler':0}],
      'materials':[{'name':'MultiViewAlbedo','pbrMetallicRoughness':{'baseColorTexture':{'index':0},'metallicFactor':0,'roughnessFactor':.85}}],
      'extras':{'characterId':spec['id'],'reviewStatus':'review-candidate','productionReady':False,'reconstructionMode':spec['reconstructionMode']}}
    js=json.dumps(doc,separators=(',',':'),allow_nan=False).encode();js+=b' '*((-len(js))%4);binary+=b'\0'*((-len(binary))%4)
    data=struct.pack('<III',0x46546c67,2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary
    out.parent.mkdir(parents=True,exist_ok=True);out.write_bytes(data)
    return doc
