#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument('--model', required=True)
    p.add_argument('--blend', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--stage', default='DEFORMATION')
    p.add_argument('--visual-approval', default='pending')
    args = p.parse_args()
    model = Path(args.model); blend = Path(args.blend)
    result = {
        'schema':'character-asset-integrity','version':1,'id':'shino.reference.v2',
        'assetId':'character.shino-reference-v2.dcc.v1','format':'vrm',
        'path':'./simulator/assets/SHINO_REFERENCE_V2.vrm','sha256':sha256(model),'bytes':model.stat().st_size,
        'productionStage':args.stage,'modelingMode':'dcc-blender','sourceBlendSha256':sha256(blend),
        'humanoidRig':'humanoid.shino-vrm1.v2','referencePath':'docs/characters/references/shino/shino-character-reference-sheet-v2.png',
        'visualApproval':args.visual_approval,
        'license':{
            'rigProvenance':'Sendagaya_Shino audited source / VRM Public License 1.0 metadata',
            'surfaceAuthorship':'RINNE Character Production Pipeline original DCC surfaces'
        }
    }
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'sha256':result['sha256'],'bytes':result['bytes'],'stage':args.stage},indent=2))

if __name__ == '__main__': main()
