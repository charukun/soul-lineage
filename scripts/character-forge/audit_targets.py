"""Read-only evidence for resolving the requested Golden adapter targets.

Does not define a rig, approve a model, or replace repository contracts. Keep the
exact source coordinate so an absent contract is not silently invented later.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import subprocess

ROOT = Path(__file__).resolve().parents[2]


def inspect_glb(path):
    data = path.read_bytes()
    magic, version, length = struct.unpack_from('<III', data)
    if magic != 0x46546C67 or version != 2 or length != len(data):
        raise ValueError(f'Invalid GLB: {path}')
    offset = 12
    document = None
    while offset < length:
        size, kind = struct.unpack_from('<II', data, offset)
        chunk = data[offset + 8:offset + 8 + size]
        if kind == 0x4E4F534A:
            document = json.loads(chunk)
        offset += 8 + size
    if document is None:
        raise ValueError('No GLB JSON chunk')
    return {
        'sha256': hashlib.sha256(data).hexdigest(),
        'meshCount': len(document.get('meshes', [])),
        'skinCount': len(document.get('skins', [])),
        'morphPrimitiveCount': sum(bool(p.get('targets')) for m in document.get('meshes', [])
                                   for p in m.get('primitives', [])),
        'morphTargetNames': [m['extras']['targetNames'] for m in document.get('meshes', [])
                             if m.get('extras', {}).get('targetNames')],
        'skinJointNames': [[document['nodes'][i].get('name') for i in s['joints']]
                          for s in document.get('skins', [])],
        'animationNames': [a.get('name') for a in document.get('animations', [])],
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    def git(*parts):
        return subprocess.check_output(['git', *parts], cwd=ROOT).decode().strip()
    files = git('ls-files', '-z').split('\0')
    matches = []
    scanned = 0
    pattern = re.compile(r'golden[\s_.-]*(?:rig|morph|socket)', re.I)
    for name in files:
        path = ROOT / name
        if path.suffix not in {'.md', '.json', '.js', '.mjs', '.ts', '.tsx', '.py', '.yml', '.yaml'}:
            continue
        if name.startswith('scripts/character-forge/') or name == 'docs/characters/CHARACTER_FORGE_UPSTREAM_HANDOFF.md':
            continue
        scanned += 1
        for number, line in enumerate(path.read_text(encoding='utf-8').splitlines(), 1):
            if pattern.search(line):
                matches.append({'path': name, 'line': number, 'text': line[:500]})
    model_dir = ROOT / 'packages/assets/characters/forge/golden-base-boy-v1'
    manifest = json.loads((model_dir / 'manifest.json').read_text())
    payload = {
        'schemaVersion': 'rinne.forge-target-discovery/v1',
        'sourceSha': git('rev-parse', 'HEAD'),
        'scan': {'trackedTextFileCount': scanned, 'requestedNameMatches': matches,
                 'limitation': 'Name search cannot establish an undocumented alias or authorize a target.'},
        'existingNamedCandidate': {
            'manifest': 'packages/assets/characters/forge/golden-base-boy-v1/manifest.json',
            'rigId': manifest['skeleton']['id'],
            'reviewStatus': manifest['reviewStatus'],
            'visualApproval': manifest['visualApproval'],
            'productionReady': manifest['productionReady'],
            'socketDefinitions': manifest['sockets']['definitions'],
            'model': inspect_glb(model_dir / 'build/character.glb'),
        },
        'goldenBaselineFiles': [name for name in files if name.startswith('packages/characters/golden/')
                                and name.endswith('.golden.json')],
        'activeFoundationContract': 'docs/characters/KAYKIT_FOUNDATION.md',
        'activeFoundationRig': 'Rig_Medium',
        'resolution': 'unresolved: requested Golden rig/morph/socket contract identifiers and authoritative paths',
        'reconstructionValidated': False,
        'visualApprovalGranted': False,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps({'sourceSha': payload['sourceSha'], 'scanned': scanned,
                      'requestedNameMatches': len(matches),
                      'existingRigId': manifest['skeleton']['id'],
                      'existingMorphPrimitiveCount': payload['existingNamedCandidate']['model']['morphPrimitiveCount'],
                      'resolution': payload['resolution']}))


if __name__ == '__main__':
    main()
