"""Account for one real upstream build/render without approving visual quality."""
from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import checked_run, install_boundary


def mark(w: Path, cache: Path, expected_head: str) -> dict:
    if json.loads((w / 'forge-job.json').read_text())['id'] != 'golden-base-v1':
        raise ValueError('Golden Base only')
    installation = install_boundary(cache, cache / 'host')
    state_path = w / '.img2threejs/state.json'
    state = json.loads(state_path.read_text())
    pass_id = state['currentPass']
    if pass_id != 'blockout' or state['currentStep'] not in ('build-current-pass', 'render-capture'):
        raise ValueError('Render accounting may not skip an upstream step or another pass')
    factory = w / f'build/{pass_id}.ts'
    receipt = json.loads((w / f'review/{pass_id}/render-receipt.json').read_text())
    sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    if receipt['sourceHead'] != expected_head or receipt['factorySha256'] != sha(factory):
        raise ValueError('Hosted capture does not belong to this exact factory/head')
    if receipt['errors'] or receipt['visualApproval'] != 'pending':
        raise ValueError('Browser errors or unsound approval marker')
    for view in ('front', 'side', 'back', 'front34', 'rear34', 'oppositeSide'):
        if not (w / f'review/{pass_id}/{view}.png').is_file():
            raise ValueError('Missing actual browser capture ' + view)
    for view in ('front', 'side', 'back'):
        if not (w / f'review/{pass_id}/{view}-comparison.png').is_file():
            raise ValueError('Missing pinned source/render comparison ' + view)
    for step, evidence in [('build-current-pass', f'build/{pass_id}.ts'),
                           ('render-capture', f'review/{pass_id}/render-receipt.json')]:
        state = json.loads(state_path.read_text())
        item = next(row for row in state['checklist'] if row['id'] == step)
        if item['status'] == 'done':
            continue
        if state['currentStep'] != step:
            raise ValueError('Upstream step order changed at ' + step)
        if checked_run(installation, w, 'forge/state.py',
                       ['mark', step, '--state', '.img2threejs/state.json', '--evidence', evidence]):
            raise ValueError('Pinned state rejected the actual capture')
    if checked_run(installation, w, 'forge/next.py', ['--state', '.img2threejs/state.json']):
        raise ValueError('Pinned upstream refused to continue to review')
    state = json.loads(state_path.read_text())
    if state['currentStep'] != 'review-contract-read':
        raise ValueError('Cannot skip upstream visual review')
    return {'currentPass': pass_id, 'currentStep': state['currentStep'],
            'visualApproval': 'pending'}


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--workspace', type=Path, required=True)
    p.add_argument('--cache', type=Path, default=ROOT / '.cache/character-forge-upstream')
    p.add_argument('--source-head', required=True)
    a = p.parse_args()
    print(json.dumps(mark(a.workspace.resolve(), a.cache.resolve(), a.source_head)))
