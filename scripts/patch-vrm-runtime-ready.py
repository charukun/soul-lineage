#!/usr/bin/env python3
"""Patch the skinned Shino GLB into a self-contained VRM1 review/runtime asset.

Transfers only audited humanoid/meta provenance from SHINO_review.vrm, then binds
new DCC-authored morph targets for blink/smile/mouth-open. Source expression/spring
indices are intentionally not copied because the DCC surfaces own different meshes.
"""
from __future__ import annotations

import argparse
import json
import struct
from pathlib import Path

JSON_CHUNK=0x4E4F534A


def read_glb(path:Path):
    data=path.read_bytes()
    if len(data)<20 or data[:4]!=b'glTF': raise SystemExit(f'Not GLB/VRM: {path}')
    _,version,total=struct.unpack_from('<4sII',data,0)
    if version!=2 or total!=len(data): raise SystemExit('Corrupt GLB')
    off=12; doc=None; chunks=[]
    while off+8<=len(data):
        length,kind=struct.unpack_from('<II',data,off);off+=8
        payload=data[off:off+length];off+=length
        if kind==JSON_CHUNK: doc=json.loads(payload.decode('utf-8').rstrip(' \t\r\n\x00'))
        else: chunks.append((kind,payload))
    if doc is None: raise SystemExit('JSON chunk missing')
    return doc,chunks


def write_glb(path:Path,doc,chunks):
    raw=json.dumps(doc,ensure_ascii=False,separators=(',',':')).encode('utf-8');raw+=b' '*((4-len(raw)%4)%4)
    encoded=[struct.pack('<II',len(raw),JSON_CHUNK)+raw]
    for kind,payload in chunks:
        padded=payload+b'\x00'*((4-len(payload)%4)%4);encoded.append(struct.pack('<II',len(padded),kind)+padded)
    body=b''.join(encoded);path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(struct.pack('<4sII',b'glTF',2,12+len(body))+body)


def source_humanoid(source):
    nodes=source.get('nodes',[]);rows=source.get('extensions',{}).get('VRMC_vrm',{}).get('humanoid',{}).get('humanBones',{})
    result={}
    for human,row in rows.items():
        idx=row.get('node')
        if isinstance(idx,int) and 0<=idx<len(nodes) and nodes[idx].get('name'): result[human]=nodes[idx]['name']
    return result


def node_index(doc,name):
    for i,node in enumerate(doc.get('nodes',[])):
        if node.get('name')==name:return i
    raise SystemExit(f'Node not found for expression: {name}')


def target_index(doc,node_idx,target_name):
    node=doc['nodes'][node_idx];mesh_idx=node.get('mesh')
    if not isinstance(mesh_idx,int): raise SystemExit(f'Expression node has no mesh: {node.get("name")}')
    mesh=doc.get('meshes',[])[mesh_idx]
    names=mesh.get('extras',{}).get('targetNames') or mesh.get('extras',{}).get('target_names') or []
    if target_name in names:return names.index(target_name)
    # Blender can omit targetNames when a single morph exists. Refuse ambiguity except
    # for the exact single-target Blink eye surfaces.
    targets=mesh.get('primitives',[{}])[0].get('targets',[])
    if len(targets)==1 and target_name=='Blink':return 0
    raise SystemExit(f'Morph target {target_name} not found on {node.get("name")}: {names}')


def bind(doc,node_name,target,weight=1.0):
    idx=node_index(doc,node_name)
    return {'node':idx,'index':target_index(doc,idx,target),'weight':weight}


def main():
    p=argparse.ArgumentParser();p.add_argument('--source-vrm',required=True);p.add_argument('--input',required=True);p.add_argument('--output',required=True);p.add_argument('--stage',default='DEFORMATION');p.add_argument('--visual-approval',default='pending')
    args=p.parse_args()
    source,_=read_glb(Path(args.source_vrm));target,chunks=read_glb(Path(args.input))
    names=source_humanoid(source);by_name={n.get('name'):i for i,n in enumerate(target.get('nodes',[])) if n.get('name')}
    human={};missing=[]
    required={'hips','spine','head','leftUpperArm','leftLowerArm','leftHand','rightUpperArm','rightLowerArm','rightHand','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot'}
    for key,name in names.items():
        if name in by_name:human[key]={'node':by_name[name]}
        elif key in required:missing.append(f'{key}:{name}')
    if missing:raise SystemExit('Required humanoid nodes lost: '+', '.join(missing))

    blink=[]
    for side in ('L','R'):
        for suffix in ('White','Iris','Pupil','Highlight','Lash'):
            name=f'FACE_{side}_{suffix}'
            if name in by_name:blink.append(bind(target,name,'Blink'))
    if not blink:raise SystemExit('No Blink morph bindings found')
    smile=[bind(target,'FACE_Mouth','Smile')]
    mouth_open=[bind(target,'FACE_Mouth','MouthOpen')]

    meta=dict(source.get('extensions',{}).get('VRMC_vrm',{}).get('meta',{}));meta.pop('thumbnailImage',None)
    meta.update({'name':'Shino Reference v2','version':'runtime-review-v1','authors':['RINNE Character Production Pipeline','VRoid Project / pixiv Inc. (rig provenance)'],'copyrightInformation':'Original DCC surfaces for Shino Reference v2; audited Sendagaya_Shino humanoid rig provenance','licenseUrl':meta.get('licenseUrl','https://vrm.dev/licenses/1.0/')})
    target.setdefault('extensions',{})['VRMC_vrm']={
        'specVersion':'1.0','meta':meta,'humanoid':{'humanBones':human},'firstPerson':{},'lookAt':{'type':'bone'},
        'expressions':{
            'preset':{'blink':{'isBinary':False,'overrideBlink':'none','overrideLookAt':'none','overrideMouth':'none','morphTargetBinds':blink}},
            'custom':{
                'smile':{'isBinary':False,'overrideBlink':'none','overrideLookAt':'none','overrideMouth':'none','morphTargetBinds':smile},
                'mouth-open':{'isBinary':False,'overrideBlink':'none','overrideLookAt':'none','overrideMouth':'none','morphTargetBinds':mouth_open}
            }
        }
    }
    target['extensions'].pop('VRMC_springBone',None)
    used=list(target.get('extensionsUsed',[]))
    if 'VRMC_vrm' not in used:used.append('VRMC_vrm')
    target['extensionsUsed']=used
    target.setdefault('asset',{}).setdefault('extras',{})['rinneCharacter']={'id':'shino.reference.v2','productionStage':args.stage,'modelingMode':'dcc-blender','visualApproval':args.visual_approval,'deformationBinding':'rigid-segment-overlap-v1'}
    write_glb(Path(args.output),target,chunks)
    print(json.dumps({'output':args.output,'humanoidBones':len(human),'blinkBinds':len(blink),'expressions':['blink','smile','mouth-open'],'stage':args.stage},indent=2))


if __name__=='__main__':main()
