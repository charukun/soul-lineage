"""Advance only proven Golden Base setup steps in the pinned upstream state."""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import checked_run, install_boundary, write_json


def mark(w: Path, cache: Path) -> dict:
    job = json.loads((w / 'forge-job.json').read_text())
    if job['id'] != 'golden-base-v1':
        raise ValueError('Golden Base evidence does not belong to this workspace')
    installation = install_boundary(cache, cache / 'host')
    state_path = w / '.img2threejs/state.json'
    spec = json.loads((w / 'object-sculpt-spec.json').read_text())
    if spec['targetName'] != 'Golden Base v1':
        raise ValueError('The authored spec targets a different reference')
    maps = json.loads((w / 'img2threejs/evidence/projection/maps.json').read_text())
    if set(maps) != {'front', 'side', 'back'}:
        raise ValueError('Projection plan must retain every observed view')
    materials = json.loads((w / 'img2threejs/evidence/material-summary.json').read_text())
    if set(materials) != {'skin', 'suit'} or not all(row['pbrPassed'] for row in materials.values()):
        raise ValueError('Pinned upstream material extraction did not pass')
    if checked_run(installation, w, 'forge/stage2_spec/validate_sculpt_spec.py',
                   ['object-sculpt-spec.json', '--strict-quality', '--json']):
        raise ValueError('Strict upstream spec quality is blocked')
    receipt = {'authority': 'pinned img2threejs strict-quality validator',
               'result': 'exit 0', 'scope': 'specification only; no visual approval'}
    write_json(w / 'img2threejs/evidence/strict-spec-validation.json', receipt)
    evidence = [
        ('pre-spec-assessment', 'assessment.json'),
        ('detail-inventory', 'assessment.json'),
        ('projection-route', 'img2threejs/evidence/projection/maps.json'),
        ('spec-authoring', 'object-sculpt-spec.json'),
        ('material-evidence', 'img2threejs/evidence/material-summary.json'),
        ('material-spec-wiring', 'object-sculpt-spec.json'),
        ('strict-validation', 'img2threejs/evidence/strict-spec-validation.json'),
    ]
    for step, path in evidence:
        state = json.loads(state_path.read_text())
        item = next(row for row in state['checklist'] if row['id'] == step)
        if item['status'] == 'done':
            continue
        if state['currentStep'] != step or not (w / path).is_file():
            raise ValueError(f'Upstream state/evidence mismatch at {step}')
        if checked_run(installation, w, 'forge/state.py',
                       ['mark', step, '--state', '.img2threejs/state.json', '--evidence', path]):
            raise ValueError('Pinned state refused the evidence for ' + step)
    if checked_run(installation, w, 'forge/next.py', ['--state', '.img2threejs/state.json']):
        raise ValueError('Pinned workflow refused the first build')
    state = json.loads(state_path.read_text())
    if state['currentStep'] != 'build-current-pass' or state['currentPass'] != 'blockout':
        raise ValueError('Unexpected first pass after validated setup')
    return {'currentStep': state['currentStep'], 'currentPass': state['currentPass']}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/character-forge-upstream')
    args = parser.parse_args()
    print(json.dumps(mark(args.workspace.resolve(), args.cache.resolve())))
