"""Convert corresponded expression poses with the pinned upstream morph tool.

Pose authoring (or DCC refinement) supplies target vertices in frozen order.
This adapter only maps the shared RINNE expression names, checks neutral parity,
and rejects missing/no-op/nonfinite targets. Visual expression review is separate.
"""
import argparse,json,math,sys
from pathlib import Path
from upstream_workspace import install_boundary,checked_run,write_json,sha256

EXPRESSIONS=('blink','smile','mouth-open')

def prepare(w,cache):
    install=install_boundary(cache,cache/'host')
    payload=json.loads((w/'build/rig/meshes-before.json').read_text())
    contract=json.loads((w/'build/morph/target-contract.json').read_text())
    if contract.get('schema')!='rinne.character-expressions/v1':raise ValueError('Use the common expression contract')
    if contract.get('meshPayloadSha256')!=sha256(w/'build/rig/meshes-before.json'):raise ValueError('Targets belong to different neutral geometry')
    meshes={m['name']:m for m in payload['meshes']};counts={name:0 for name in EXPRESSIONS};outputs={}
    for name,targets in contract['meshes'].items():
        if name not in meshes:raise ValueError('Morph refers to a missing frozen mesh')
        positions=meshes[name]['attributes']['position'];base={'name':name,'vertices':[positions[i:i+3] for i in range(0,len(positions),3)]}
        directory=w/'build/morph'/('mesh-'+str(len(outputs)));directory.mkdir(parents=True,exist_ok=True)
        write_json(directory/'base.json',base);args=[str((directory/'base.json').relative_to(w))]
        for expression in EXPRESSIONS:
            path=(w/targets[expression]).resolve()
            if not path.is_relative_to(w):raise ValueError('Target path escapes workspace')
            target=json.loads(path.read_text())
            if target.get('name')!=expression:raise ValueError('Expression target name mismatch')
            if len(target['vertices'])!=len(base['vertices']):raise ValueError('Target vertex order/count mismatch')
            if any(len(p)!=3 or any(not isinstance(v,(int,float)) or not math.isfinite(v) for v in p) for p in target['vertices']):raise ValueError('Nonfinite/malformed target')
            args.extend(['--target',str(path.relative_to(w))])
        output=directory/'deltas.json';args.extend(['--out',str(output.relative_to(w))])
        code=checked_run(install,w,'forge/stage3_build/morph_targets.py',args)
        if code:raise ValueError('Pinned morph-target builder rejected the authored poses')
        built=json.loads(output.read_text())
        if built['noOpTargets']:raise ValueError('Empty targets cannot implement expression semantics')
        for target in built['targets']:counts[target['name']]+=target['movedVertexCount']
        outputs[name]={'path':str(output.relative_to(w)),'sha256':sha256(output),'targetHashes':{n:sha256(w/targets[n]) for n in EXPRESSIONS}}
    if not all(counts.values()):raise ValueError('Every required expression needs a geometric deformation')
    report={'schema':'rinne.character-expressions/v1','neutral':'all-target-weights-zero','builder':'pinned img2threejs forge/stage3_build/morph_targets.py','meshes':outputs,'movedVertexCounts':counts,'status':'deltas-ready; visual semantics and parity pending'}
    write_json(w/'build/morph/manifest.json',report)
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--workspace',type=Path,required=True);p.add_argument('--cache',type=Path,required=True);a=p.parse_args();print(json.dumps(prepare(a.workspace.resolve(),a.cache.resolve())))
