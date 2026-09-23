"""Replay an inspected, hash-bound Golden Base rejection through pinned review/state."""
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'packages/assets/forge'))
from upstream_workspace import checked_run, install_boundary, write_json
from mark_golden_base_render import mark as mark_capture

REVIEW = ROOT / 'scripts/character-forge/fixtures/golden-base-v1/blockout-r0-review.json'


def resume(w: Path, cache: Path) -> dict:
    record = json.loads(REVIEW.read_text())
    receipt = json.loads((w / 'review/blockout/render-receipt.json').read_text())
    digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
    if receipt['sourceHead'] != record['sourceHead'] or receipt['factorySha256'] != record['factorySha256']:
        raise ValueError('Cannot replay a review from a different checkout/factory')
    if digest(w / 'build/blockout.ts') != record['factorySha256']:
        raise ValueError('Original upstream factory bytes changed')
    for view, expected in record['diagnostics'].items():
        review = w / 'review/blockout'
        if digest(review / f'{view}.png') != expected['renderSha256']:
            raise ValueError('The reviewed browser image changed: ' + view)
        if digest(review / f'{view}-comparison.png') != expected['comparisonSha256']:
            raise ValueError('The source comparison changed: ' + view)
        diag = json.loads((review / f'{view}-diagnostics.json').read_text())
        if diag['passed'] or diag['checks']['silhouetteIoU'] != expected['silhouetteIoU']:
            raise ValueError('An upstream hard gate no longer matches the rejection')
    mark_capture(w, cache, record['sourceHead'])
    installation = install_boundary(cache, cache / 'host')
    evidence = 'img2threejs/evidence/blockout-r0-review.json'
    write_json(w / evidence, record)
    history = w / 'review/blockout-r0'
    if history.exists():
        if digest(history / 'front.png') != record['diagnostics']['front']['renderSha256']:
            raise ValueError('Historical review directory belongs to another capture')
    else:
        shutil.copytree(w / 'review/blockout', history)
    spec = json.loads((w / 'object-sculpt-spec.json').read_text())
    if not any(evidence in item.get('evidence', []) for item in spec.get('reviewHistory', [])):
        args = ['object-sculpt-spec.json', '--pass-id', 'blockout', '--action', 'refine-spec',
                '--fidelity', str(record['fidelity']), '--summary', record['reason'],
                '--mismatches', 'Front, Side and Back silhouette below 0.85; Side arm pose differs',
                '--spec-fixes', 'smooth head masses; expand leg volumes; preserve pose conflict',
                '--evidence', evidence, '--reference-screenshot', 'source/front.png',
                '--render-screenshot', 'review/blockout-r0/front.png',
                '--comparison-image', 'review/blockout-r0/front-comparison.png',
                '--map-stripped-render', 'review/blockout-r0/front.png',
                '--require-screenshot-files', '--in-place']
        if checked_run(installation, w, 'forge/stage4_review/append_review.py', args):
            raise ValueError('Pinned upstream rejected the actual failed visual review')
    if checked_run(installation, w, 'forge/next.py', ['--state', '.img2threejs/state.json']):
        raise ValueError('Upstream correction limit is a hard stop')
    state = json.loads((w / '.img2threejs/state.json').read_text())
    if state['currentPass'] != 'blockout' or state['currentStep'] != 'build-current-pass':
        raise ValueError('Pinned state did not reach the correction build')
    if state['loops']['perPass'].get('blockout') != 1 or state['loops']['total'] != 1:
        raise ValueError('Actual rejected review must count as exactly one correction')
    return {'sourceHead': record['sourceHead'], 'currentPass': state['currentPass'],
            'currentStep': state['currentStep'], 'correction': 1}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--cache', type=Path, default=ROOT / '.cache/character-forge-upstream')
    args = parser.parse_args()
    print(json.dumps(resume(args.workspace.resolve(), args.cache.resolve())))
