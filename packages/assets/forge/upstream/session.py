"""Durable RINNE intake/package boundary around upstream's own staged workflow."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import shutil
import sys
import tempfile

from .engine import Engine, EngineError, load_json, save_json, sha256

SCHEMA = 'rinne.img2threejs-session/v1'
STATE = '.img2threejs/state.json'
SPEC = 'img2threejs/object-sculpt-spec.json'
SAFE_ID = re.compile(r'^[a-z0-9][a-z0-9-]{0,63}$')
REQUIRED_VIEWS = ('front', 'side', 'back')


def confined(workspace: Path, value: str) -> Path:
    path = (workspace / value).resolve()
    if not path.is_relative_to(workspace.resolve()):
        raise EngineError(f'Artifact leaves its workspace: {value}')
    return path


def required_file(workspace: Path, value: str) -> Path:
    path = confined(workspace, value)
    if not path.is_file() or path.is_symlink() or path.stat().st_size == 0:
        raise EngineError(f'Required evidence is absent/empty: {value}')
    return path


def initialize(options: argparse.Namespace, engine: Engine) -> dict:
    # Existing modules are used only for image decoding/crop intake, not for geometry.
    from intake import intake
    from detection import detect_views
    if not SAFE_ID.fullmatch(options.id or ''):
        raise EngineError('Invalid character id')
    provenance = load_json(Path(options.provenance))
    if provenance.get('license') not in {'RINNE-OWNED', 'CC0-1.0'} or not all(provenance.get(k) for k in ('author', 'source')):
        raise EngineError('Source provenance must establish eligible RINNE-OWNED or CC0-1.0 art; software licenses do not grant image rights')
    workspace = Path(options.workspace or Path(options.root) / '.artifacts/character-forge' / options.id).resolve()
    if (workspace / 'session.json').exists():
        raise EngineError(f'Session already exists at {workspace}. Resume it with next; do not reset review history')
    sources = intake(options)
    views, detection = detect_views(sources, getattr(options, 'sheet_order', None))
    workspace.mkdir(parents=True, exist_ok=True)
    try:
        stored = {}
        for view, source in views.items():
            path = workspace / 'source' / (view + '.png')
            path.parent.mkdir(parents=True, exist_ok=True)
            source['image'].save(path)
            original = workspace / 'source' / ('original-' + view + Path(source['filename']).suffix.lower())
            original.write_bytes(source['raw'])
            stored[view] = {'source': path.relative_to(workspace).as_posix(),
                            'sha256': sha256(path.read_bytes()), 'originalSha256': source['sha256'],
                            'original': original.relative_to(workspace).as_posix(),
                            'width': source['image'].width, 'height': source['image'].height,
                            'sheetRect': source.get('sheetRect'), 'status': 'observed'}
        session = {'schemaVersion': SCHEMA, 'id': options.id, 'displayName': options.name or options.id,
                   'status': 'awaiting-agent-analysis', 'sourceViews': stored,
                   'reconstructionMode': 'single-view' if len(views) == 1 else 'multi-view' if len(views) == 3 else 'enhanced-multi-view',
                   'provenance': provenance, 'detection': detection,
                   'generator': engine.lock, 'state': STATE, 'spec': SPEC,
                   'reviewStatus': 'generated', 'visualApproval': 'pending', 'productionReady': False,
                   'observationNote': 'Intake does not infer landmarks or anatomy. The upstream guide is a scaffold until agent evidence is recorded.'}
        save_json(workspace / 'session.json', session)
        engine.run('forge/state.py', ['init', '--state', STATE, '--reference', stored['front']['source'],
                                     '--profile', 'animated-character', '--spec', SPEC], workspace)
        result = engine.run('forge/next.py', ['--state', STATE], workspace, check=False)
        return {'status': 'awaiting-agent-analysis', 'workspace': str(workspace), 'id': options.id,
                'registered': False, 'next': result.stdout, 'upstreamCommit': engine.lock['engine']['commit']}
    except Exception:
        # Keep inputs and any failed command receipt for resuming/diagnosis. Never publish here.
        raise


def read_session(workspace: Path, engine: Engine) -> dict:
    session = load_json(required_file(workspace, 'session.json'))
    if session.get('schemaVersion') != SCHEMA:
        raise EngineError('Unsupported upstream session schema')
    if session.get('generator') != engine.lock:
        raise EngineError('Session pin differs from the execution engine. An explicit migration and re-review are required')
    for view in session.get('sourceViews', {}).values():
        if sha256(required_file(workspace, view['source']).read_bytes()) != view['sha256']:
            raise EngineError('Source image changed after intake; create a new input revision rather than reusing stale evidence')
    engine.verify()
    return session


def next_step(workspace: Path, engine: Engine) -> dict:
    read_session(workspace, engine)
    result = engine.run('forge/next.py', ['--state', STATE], workspace, check=False)
    if result.returncode:
        raise EngineError(result.stdout + result.stderr)
    status = engine.run('forge/state.py', ['status', '--state', STATE, '--json'], workspace)
    return json.loads(status.stdout)


def mark_step(workspace: Path, engine: Engine, step: str, evidence: list[str], reason: str = '', skip: bool = False) -> dict:
    current = next_step(workspace, engine)
    if current['currentStep'] != step:
        raise EngineError(f"Upstream requires {current['currentStep']}, not {step}. Ordered steps may not be bypassed")
    if skip and not reason.strip():
        raise EngineError('A non-applicable step needs an explicit reason')
    if not skip and not evidence:
        raise EngineError('Completing a step needs real evidence')
    for name in evidence:
        required_file(workspace, name)
    args = ['mark', step, '--state', STATE, '--status', 'skipped' if skip else 'done']
    if evidence:
        args += [item for path in evidence for item in ('--evidence', path)]
    if reason:
        args += ['--reason', reason]
    engine.run('forge/state.py', args, workspace)
    return next_step(workspace, engine)


def build_pass(workspace: Path, engine: Engine) -> dict:
    status = next_step(workspace, engine)
    if status['currentStep'] != 'build-current-pass':
        raise EngineError(f"Build is locked; upstream requires {status['currentStep']}")
    pass_id = status['currentPass']
    engine.run('forge/stage2_spec/validate_sculpt_spec.py', [SPEC, '--strict-quality'], workspace)
    relative = f'img2threejs/passes/{pass_id}/factory.ts'
    args = [SPEC, '--out', relative, '--pass-id', pass_id]
    # A reviewed correction is a new revision, not a silent overwrite of accepted geometry.
    output = confined(workspace, relative)
    if output.exists():
        backup = output.with_name('factory-' + sha256(output.read_bytes())[:16] + '.ts')
        shutil.copy2(output, backup)
        args += ['--force']
    engine.run('forge/stage3_build/generate_threejs_factory.py', args, workspace)
    snapshot = confined(workspace, f'img2threejs/passes/{pass_id}/spec.json')
    shutil.copy2(workspace / SPEC, snapshot)
    receipt = {'passId': pass_id, 'factory': relative, 'factorySha256': sha256(output.read_bytes()),
               'specSnapshot': snapshot.relative_to(workspace).as_posix(),
               'specSha256': sha256(snapshot.read_bytes()), 'upstreamCommit': engine.lock['engine']['commit'],
               'generationMode': 'upstream-strict-cli', 'visualApproved': False}
    receipt_path = f'img2threejs/passes/{pass_id}/build-receipt.json'
    save_json(workspace / receipt_path, receipt)
    mark_step(workspace, engine, 'build-current-pass', [receipt_path, relative])
    return receipt


def record_review(workspace: Path, engine: Engine, review_path: str) -> dict:
    """Bridge a real agent review to the original gate, with immutable capture binding."""
    status = next_step(workspace, engine)
    if status['currentStep'] != 'ai-review-recorded':
        raise EngineError(f"Upstream requires {status['currentStep']} before review")
    review = load_json(required_file(workspace, review_path))
    pass_id = status['currentPass']
    if review.get('passId') != pass_id or review.get('reviewer') != 'astra-vision':
        raise EngineError('Review must name the current pass and actual visual reviewer')
    build = load_json(required_file(workspace, f'img2threejs/passes/{pass_id}/build-receipt.json'))
    if review.get('factorySha256') != build['factorySha256'] or sha256(required_file(workspace, build['factory']).read_bytes()) != build['factorySha256']:
        raise EngineError('Review references another generated factory')
    captures = review.get('captures', [])
    session = read_session(workspace, engine)
    needed = set(session['sourceViews']) | {'front', 'right', 'back', 'left', 'three-quarter', 'rear-three-quarter'}
    if not needed <= {row.get('view') for row in captures}:
        raise EngineError('Review is missing source-camera/off-axis captures')
    for capture in captures:
        path = required_file(workspace, capture['path'])
        if sha256(path.read_bytes()) != capture['sha256']:
            raise EngineError('Capture bytes changed after review')
    for field in ('renderScreenshot', 'comparisonImage', 'featureReviews'):
        required_file(workspace, review[field])
    if review.get('action') not in {'continue', 'refine-spec', 'refine-code', 'request-input', 'stop'}:
        raise EngineError('Unsupported upstream review action')
    if not review.get('summary') or not review.get('limitations'):
        raise EngineError('Review must describe findings and remaining limitations')
    args = [SPEC, '--pass-id', pass_id, '--fidelity', str(review['fidelity']),
            '--action', review['action'], '--summary', review['summary'],
            '--render-screenshot', review['renderScreenshot'], '--comparison-image', review['comparisonImage'],
            '--ai-vision-score', str(review['fidelity']), '--feature-reviews-json', review['featureReviews'],
            '--layer-scores-json', json.dumps(review['layerScores']),
            '--review-viewpoints-json', json.dumps(review.get('reviewViewpoints', [])), '--in-place']
    if pass_id == 'blockout':
        required_file(workspace, review['mapStrippedRender'])
        args += ['--map-stripped-render', review['mapStrippedRender']]
    # No generated scores and no lowering thresholds. Upstream is the acceptance authority.
    engine.run('forge/stage4_review/append_review.py', args, workspace)
    save_json(workspace / f'img2threejs/passes/{pass_id}/review-binding.json', review)
    # next.py synchronizes reviewHistory; mark first so the current iteration retains evidence.
    engine.run('forge/state.py', ['mark', 'ai-review-recorded', '--state', STATE, '--evidence', review_path], workspace)
    return next_step(workspace, engine)
