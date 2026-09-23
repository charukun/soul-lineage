"""Complete Golden Base reconstruction's attachment boundary after actual approval.

This command is deliberately fail-closed: the pinned upstream eight-pass state,
raw-likeness review and identical GLB/mesh bytes precede freeze and rig binding.
It never generates generic geometry or lets a test failure certify a character.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image, ImageChops, ImageStat

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import install_boundary, checked_run, sha256, write_json

VIEWS = ('front', 'side', 'back', 'front34', 'rear34', 'oppositeSide')


def run(program: str, *args: str) -> None:
    subprocess.run([program, *args], cwd=ROOT, check=True)


def assert_readiness(w: Path) -> None:
    job = json.loads((w / 'forge-job.json').read_text())
    if job['id'] != 'golden-base-v1':
        raise ValueError('Selected workspace is not the supplied Golden Base turnaround')
    state = json.loads((w / '.img2threejs/state.json').read_text())
    if state['profile'] != 'animated-character' or state['status'] == 'stopped':
        raise ValueError('Pinned animated-character state is stopped or belongs to another profile')
    if not (w / 'object-sculpt-spec.json').is_file():
        raise ValueError('Pinned upstream state still requests '+str(state['currentStep'])+
                         '; no accepted sculpt spec exists yet')
    spec = json.loads((w / 'object-sculpt-spec.json').read_text())
    if spec['sculptPipeline']['completedPasses'] != spec['sculptPipeline']['passOrder']:
        raise ValueError('The pinned eight-pass reconstruction has not passed all its stages')
    review = json.loads((w / 'review/optimization-pass/agent-review.json').read_text())
    if review.get('action') != 'continue' or review.get('qualityFloorPassed') is not True:
        raise ValueError('Raw Golden Base likeness needs an actual positive human/agent visual review')
    receipt = json.loads((w / 'review/optimization-pass/render-receipt.json').read_text())
    if review.get('factorySha256') != receipt.get('factorySha256'):
        raise ValueError('Raw visual approval does not belong to the optimization factory')
    for view, expected in review.get('captureSha256', {}).items():
        if view not in VIEWS or sha256(w/f'review/optimization-pass/{view}.png') != expected:
            raise ValueError('Raw visual approval does not match the actual capture: '+view)
    if set(review.get('captureSha256', {})) != set(VIEWS):
        raise ValueError('Raw approval needs six hash-bound actual captures')
    for view in ('front', 'side', 'back'):
        row = json.loads((w / f'review/optimization-pass/{view}-diagnostics.json').read_text())
        if row.get('passed') is not True:
            raise ValueError('Required source-versus-render diagnostic failed: '+view)
        for rel in (f'source/{view}.png', f'review/optimization-pass/{view}.png',
                    f'review/optimization-pass/{view}-comparison.png'):
            if not (w / rel).is_file():
                raise ValueError('Missing actual reference/capture/side-by-side evidence: '+rel)


def neutral_parity(w: Path) -> dict:
    pre = w / 'review/pre-rig'
    post = w / 'review/rig'
    rows = []
    for view in VIEWS:
        before = Image.open(pre / f'{view}-after.png').convert('RGB')
        after = Image.open(post / f'{view}.png').convert('RGB')
        if before.size != after.size:
            raise ValueError('Rig changed capture size: '+view)
        delta = ImageChops.difference(before, after)
        ch = delta.split()
        maximum = ImageChops.lighter(ImageChops.lighter(ch[0], ch[1]), ch[2])
        measured = {'view': view, 'meanChannelDelta': sum(ImageStat.Stat(delta).mean)/3,
                    'fractionPixelsOver8': sum(maximum.histogram()[9:])/(before.width*before.height),
                    'beforeSha256': sha256(pre/f'{view}-after.png'), 'afterSha256': sha256(post/f'{view}.png')}
        rows.append(measured)
        if measured['meanChannelDelta'] > .05 or measured['fractionPixelsOver8'] > .0002:
            raise ValueError('Actual rig/morph neutral appearance differs: '+view)
    result = {'passed': True, 'scope': 'Actual neutral images before versus after computed Golden Rig and Morph',
              'views': rows, 'status': 'Neutral parity only; motion/expression and native Lab still require gates'}
    write_json(post/'neutral-parity.json', result)
    return result


def finish(w: Path, cache: Path) -> dict:
    w = w.resolve()
    assert_readiness(w)
    install = install_boundary(cache.resolve(), cache.resolve()/'host')
    run('node', 'scripts/character-forge/prepare_rig_browser.mjs', str(w))
    run(sys.executable, 'scripts/character-forge/verify_attach_preparation.py', '--workspace', str(w))
    run(sys.executable, 'scripts/character-forge/author_golden_base_rig.py', '--workspace', str(w))
    if checked_run(install, w, 'tools/rig_mesh_parity.py',
                   ['freeze', 'build/rig/meshes-before.json', '--out', 'build/rig/mesh-manifest.json'],
                   key='animatedCharacter'):
        raise ValueError('Pinned plugin refused frozen source geometry')
    run(sys.executable, 'packages/assets/forge/upstream_rig.py', '--workspace', str(w), '--cache', str(cache))
    run(sys.executable, 'scripts/character-forge/author_golden_base_morph.py',
        '--workspace', str(w), '--cache', str(cache))
    run(sys.executable, 'packages/assets/forge/upstream_morph.py', '--workspace', str(w), '--cache', str(cache))
    legacy = ROOT/'packages/assets/characters/forge/golden-base-boy-v1/build/character.glb'
    if not legacy.is_file():
        raise ValueError('Existing Golden Base motion donor is absent; cannot fabricate animation clips')
    if checked_run(install, w, 'tools/rig_glb_reference.py',
                   [str(legacy), '--out', 'build/rig/golden-motion-reference.json'],
                   key='animatedCharacter'):
        raise ValueError('Pinned plugin rejected the actual Golden Base GLB as a motion source')
    donor = json.loads((w/'build/rig/golden-motion-reference.json').read_text())
    from_reference = {row['name'] for row in donor['clips']}
    required = {'Idle','Walk','Talk','Attack','Hit','Rest'}
    if not donor['ok'] or donor['skinCount'] != 1 or not required.issubset(from_reference):
        raise ValueError('Golden Base donor requires exactly one valid skin and all six real clips')
    shutil.copyfile(legacy, w/'build/rig/golden-motion-source.glb')
    write_json(w/'build/rig/golden-motion-provenance.json',
               {'source': str(legacy.relative_to(ROOT)), 'sha256': sha256(legacy),
                'use': 'Rotation clip donor only; no legacy reconstruction geometry, weights or materials are used',
                'reference': 'build/rig/golden-motion-reference.json'})
    run('node', 'scripts/character-forge/bind_rig_browser.mjs', str(w))
    manifest = w/'build/rig/mesh-manifest.json'
    for payload in ('build/rig/meshes-before.json', 'build/rig/meshes-after.json'):
        if checked_run(install, w, 'tools/rig_mesh_parity.py',
                       ['verify', str(manifest.relative_to(w)), payload], key='animatedCharacter'):
            raise ValueError('Pinned plugin found changed geometry after rig attachment: '+payload)
    result = neutral_parity(w)
    report = {'reference': 'golden-base-v1', 'modelSha256': sha256(w/'build/rig/golden-neutral.glb'),
              'authority': 'pinned plugin freeze/geodesic bind/conditioning/parity and pinned img2threejs morph builder',
              'neutralParity': result['passed'],
              'motionDonorSha256': sha256(legacy),
              'notYetProven': ['eleven remaining plugin rig gates',
                               'facial expression semantics', 'socket motion', 'native Lab registration'],
              'validationStatus': 'partial, not releasable'}
    write_json(w/'review/rig/stage-r-checkpoint.json', report)
    return report


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace', type=Path, required=True)
    p.add_argument('--cache', type=Path, default=ROOT/'.cache/character-forge-upstream')
    a = p.parse_args()
    print(json.dumps(finish(a.workspace, a.cache)))
