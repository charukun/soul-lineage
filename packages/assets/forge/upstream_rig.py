"""Attach-space preparation using the pinned character plugin's actual binder.

This boundary translates frozen mesh buffers and an evidence-authored RINNE rig
contract. It does not generate geometry, infer human proportions, or approve a
character. Rendering, attachment, animation measurements and gates follow this
step; a weights file alone is never rig acceptance.
"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path
from upstream_workspace import install_boundary, checked_run, write_json, sha256


def prepare(workspace: Path, cache: Path) -> dict:
    w=workspace
    spec=json.loads((w/'object-sculpt-spec.json').read_text())
    pipeline=spec['sculptPipeline']
    if pipeline.get('completedPasses')!=pipeline.get('passOrder'):
        raise ValueError('All upstream reconstruction passes must be accepted before rigging')
    acceptance=json.loads((w/'review/reconstruction-acceptance.json').read_text())
    mesh_path=w/'build/rig/meshes-before.json'
    raw_path=w/'build/optimization-pass.glb'
    if acceptance.get('qualityFloorPassed') is not True:
        raise ValueError('Raw reference likeness has not passed the Quality Floor')
    if acceptance.get('modelSha256')!=sha256(raw_path) or acceptance.get('meshPayloadSha256')!=sha256(mesh_path):
        raise ValueError('Reconstruction acceptance belongs to different model bytes')
    contract=json.loads((w/'build/rig/rig-contract.json').read_text())
    payload=json.loads(mesh_path.read_text())
    if contract.get('schema')!='rinne.reference-rig-adaptation/v1':raise ValueError('Missing authored rig adaptation contract')
    if contract.get('rigFamily')!='Rig_Medium':raise ValueError('Use the existing RINNE common rig family')
    install=install_boundary(cache,cache/'host')
    sys.path.insert(0,str(install['animatedCharacter']/'tools'))
    from rig_geodesic_skinning import bind, partition_for_binding
    from rig_skin_conditioning import SkinBinding, blend_weights, validate_binding
    from rig_mesh_parity import Manifest, verify
    manifest=Manifest.from_dict(json.loads((w/'build/rig/mesh-manifest.json').read_text()))
    parity=verify(manifest,payload)
    if not parity.ok:raise ValueError('The pre-bind payload differs from its immutable upstream freeze')
    bones=contract['bones']; names=[b['id'] for b in bones]
    if len(set(names))!=len(names):raise ValueError('Repeated joint names')
    required={'hips','spine','head'}|{f'{part}.{side}' for part in ('upperArm','lowerArm','hand','upperLeg','lowerLeg','foot') for side in ('L','R')}
    if not required.issubset(names):raise ValueError('Common humanoid mapping is incomplete')
    if not all(b.get('observationClass') in ('inferred','interpolated') and b.get('evidenceRefs') for b in bones):
        raise ValueError('Joint centres must carry their evidence and inferred/interpolated status')
    parts=contract['meshes']
    if set(parts)!={m['name'] for m in payload['meshes']}:raise ValueError('Authored ownership must cover every frozen mesh exactly')
    # This is a solver-only deduplication of identical chart vertices. Original
    # buffers are never edited or resampled; weights are expanded back to them.
    vertices=[];owners=[];indices=[];unique={};mesh_maps={}
    for mesh in payload['meshes']:
        pos=mesh['attributes']['position'];owner=parts[mesh['name']]['componentId'];mapping=[]
        if len(pos)%3:raise ValueError('Malformed position buffer')
        for i in range(0,len(pos),3):
            point=tuple(pos[i:i+3]);key=(owner,point)
            if key not in unique:
                unique[key]=len(vertices);vertices.append(list(point));owners.append(owner)
            mapping.append(unique[key])
        source_indices=mesh.get('index')
        if source_indices is None:source_indices=list(range(len(mapping)))
        indices.extend(mapping[i] for i in source_indices);mesh_maps[mesh['name']]=mapping
    components=contract['bindingComponents']
    partition=partition_for_binding(components)
    if partition['warnings']:raise ValueError('; '.join(partition['warnings']))
    rigid={p['id'] for p in partition['rigidlyParented']}
    if not set(owners).issubset(set(partition['skinned'])|rigid):raise ValueError('Unclassified mesh ownership')
    result=bind({'vertices':vertices,'indices':indices,'vertexComponents':owners},bones,resolution=contract['voxelResolution'],components=components)
    if result['unreachableVertexCount'] or result['unreachableBones']:
        write_json(w/'build/rig/geodesic-failure.json',{k:v for k,v in result.items() if k not in ('skinIndices','skinWeights')})
        raise ValueError('Upstream geodesic binding has unreachable geometry/joints; repair before freeze, never substitute Euclidean weights')
    expected_rigid=sum(owner in rigid for owner in owners)
    if result['rigidPinnedVertexCount']!=expected_rigid:raise ValueError('Upstream rigid-role exclusion was not applied')
    raw_i=[i for row in result['skinIndices'] for i in row];raw_w=[v for row in result['skinWeights'] for v in row]
    # The plugin requires hair to stay rigid on the skull. Proximity smoothing
    # is applied only to skin/cloth body partitions, preserving that exclusion.
    body=[i for i,owner in enumerate(owners) if owner not in rigid]
    binding=SkinBinding([vertices[i] for i in body],[owners[i] for i in body],[v for i in body for v in raw_i[i*4:i*4+4]],[v for i in body for v in raw_w[i*4:i*4+4]],len(bones))
    conditioned,report=blend_weights(binding,contract['figureHeight'])
    errors=validate_binding(conditioned)
    if errors:raise ValueError('Upstream conditioned binding rejected: '+'; '.join(errors))
    final_i=raw_i.copy();final_w=raw_w.copy()
    for row,index in enumerate(body):
        final_i[index*4:index*4+4]=conditioned.skin_indices[row*4:row*4+4]
        final_w[index*4:index*4+4]=conditioned.skin_weights[row*4:row*4+4]
    output={}
    for name,mapping in mesh_maps.items():
        output[name]={'skinIndex':[v for i in mapping for v in final_i[i*4:i*4+4]],'skinWeight':[v for i in mapping for v in final_w[i*4:i*4+4]],'baselineSkinIndex':[v for i in mapping for v in raw_i[i*4:i*4+4]],'baselineSkinWeight':[v for i in mapping for v in raw_w[i*4:i*4+4]]}
    write_json(w/'build/rig/weights.json',{'boneOrder':names,'meshes':output,'authority':'pinned plugin rig_geodesic_skinning.bind + rig_skin_conditioning.blend_weights','status':'computed, not attached or accepted','meshPayloadSha256':sha256(mesh_path)})
    write_json(w/'build/rig/binding-report.json',{'geodesic':{k:v for k,v in result.items() if k not in ('skinIndices','skinWeights')},'conditioning':report.to_dict(),'solverUniqueVertexCount':len(vertices),'exportVertexCount':sum(len(v) for v in mesh_maps.values()),'frozenBuffersChanged':False})
    parents=[None if b['parent'] is None else names.index(b['parent']) for b in bones]
    matrices=[]
    for i,bone in enumerate(bones):
        p=bone['jointPos'];parent=[0,0,0] if parents[i] is None else bones[parents[i]]['jointPos'];x,y,z=[p[a]-parent[a] for a in range(3)]
        # Validator declares row-major matrices; Three's column-major transport
        # is separate and must not silently transpose translations here.
        matrices.append([1,0,0,x,0,1,0,y,0,0,1,z,0,0,0,1])
    flat_i=[v for row in output.values() for v in row['skinIndex']];flat_w=[v for row in output.values() for v in row['skinWeight']]
    rig_payload={'schemaVersion':1,'coordinateSystem':{'up':'Y','handedness':'right','unit':'metre'},'joints':[b['jointPos'] for b in bones],'parents':parents,'names':names,'matrix_local':matrices,'skinIndex':[flat_i[i:i+4] for i in range(0,len(flat_i),4)],'skinWeight':[flat_w[i:i+4] for i in range(0,len(flat_w),4)]}
    write_json(w/'build/rig/rig-payload.json',rig_payload)
    code=checked_run(install,w,'tools/rig_validate_payload.py',['--payload','build/rig/rig-payload.json'],key='animatedCharacter')
    if code:raise ValueError('Pinned structural rig payload validation failed')
    return {'status':'weights-ready; actual binding and all rig gates pending','meshCount':len(output),'boneCount':len(bones)}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--workspace',type=Path,required=True);parser.add_argument('--cache',type=Path,required=True);args=parser.parse_args()
    print(json.dumps(prepare(args.workspace.resolve(),args.cache.resolve())))
