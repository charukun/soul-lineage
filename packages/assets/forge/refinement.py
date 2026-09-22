"""Package-owned, bounded DCC refinement. Worker review never grants art approval."""
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
from PIL import Image, ImageDraw
from common import digest, save_json

SCHEMA = 'rinne.forge-quality-refinement/v1'
VIEWS = ('front', 'side', 'back', 'three-quarter')
CHECKS = ('silhouette-proportion', 'side-profile', 'face-identity', 'joints-hands',
          'material-continuity', 'rig-sockets', 'exported-runtime')
STATE_PATH = 'review/refinement.json'
MAX_REPAIRS = 3

def read(path):
    return json.loads(Path(path).read_text())

def inside(root, relative):
    if not isinstance(relative, str) or not relative or Path(relative).is_absolute():
        raise ValueError('Package/repository relative path required')
    target = (root / relative).resolve()
    if not target.is_relative_to(root.resolve()):
        raise ValueError('Path escapes authorized root')
    return target

def initialize(directory, model_hash):
    state = {'schemaVersion': SCHEMA, 'modelSha256': model_hash,
             'status': 'awaiting-capture', 'repairRounds': 0, 'maxRepairRounds': MAX_REPAIRS,
             'requiredViews': list(VIEWS), 'rounds': [], 'qualityReferences': [],
             'visualApproval': 'pending', 'productionReady': False,
             'limitations': ['Numerical validation and worker review are not human art approval',
                            'DCC captures are separate from delivered-asset runtime evidence']}
    save_json(directory / STATE_PATH, state)
    return state

@contextmanager
def package(root, identifier):
    if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', identifier):
        raise ValueError('Invalid package id')
    root = Path(root).resolve()
    directory = root / 'packages/assets/characters/forge' / identifier
    manifest = read(directory / 'manifest.json')
    if manifest.get('reviewStatus') != 'review-candidate' or manifest.get('visualApproval') == 'approved':
        raise ValueError('Only unapproved review candidates can be refined')
    model = inside(directory, manifest['model']['path'])
    if digest(model.read_bytes()) != manifest['model']['sha256']:
        raise ValueError('Current model hash mismatch')
    lock = directory / '.refinement.lock'
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(fd)
        state = read(directory / STATE_PATH) if (directory / STATE_PATH).exists() else initialize(directory, manifest['model']['sha256'])
        if state['schemaVersion'] != SCHEMA or state['modelSha256'] != manifest['model']['sha256']:
            raise ValueError('Stale refinement state')
        yield root, directory, manifest, state, model
    finally:
        lock.unlink(missing_ok=True)

def publish(root, directory, manifest, state, report=None):
    """Commit small metadata together; failed discovery restores its previous bytes."""
    from registration import register_review
    state['visualApproval'] = 'pending'; state['productionReady'] = False
    manifest['qualityRefinement'] = {'path': STATE_PATH, 'status': state['status'],
                                    'repairRounds': state['repairRounds'], 'modelSha256': state['modelSha256']}
    manifest['qualityReferences'] = state['qualityReferences']
    manifest['reviewStatus'] = 'review-candidate'; manifest['visualApproval'] = 'pending'; manifest['productionReady'] = False
    values = {STATE_PATH: state, 'manifest.json': manifest}
    if report is not None:
        values[manifest['validationReport']] = report
    if (directory / 'pipeline-state.json').exists():
        pipeline = read(directory / 'pipeline-state.json')
        pipeline['qualityRefinement'] = {**manifest['qualityRefinement'], 'required': True}
        values['pipeline-state.json'] = pipeline
    previous = {key: inside(directory, key).read_bytes() if inside(directory, key).exists() else None for key in values}
    try:
        for key, value in values.items():
            target = inside(directory, key); temp = target.with_suffix(target.suffix + '.next')
            save_json(temp, value); temp.replace(target)
        register_review(root)
    except Exception:
        for key, data in previous.items():
            path = inside(directory, key)
            if data is None: path.unlink(missing_ok=True)
            else: path.write_bytes(data)
        raise

def attach_quality(root, directory, state, plan_path):
    if state['rounds']:
        if plan_path: raise ValueError('References are fixed for a refinement sequence')
        return
    if not plan_path: return
    plan = read(plan_path)
    if plan.get('schemaVersion') != 'rinne.forge-quality-reference/v1':
        raise ValueError('Unknown quality reference plan')
    refs = []; ids = set()
    for source in plan.get('references', []):
        identifier = source.get('id', '')
        if not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', identifier) or identifier in ids:
            raise ValueError('Unique quality reference id required')
        ids.add(identifier)
        if not source.get('rationale') or not source.get('sourceContract'):
            raise ValueError('Quality reference needs rationale and canonical source contract')
        if not inside(root, source['sourceContract']).is_file():
            raise ValueError('Quality reference contract is missing')
        views = {}
        for view, path in source.get('views', {}).items():
            if view not in VIEWS: raise ValueError('Unknown quality reference view')
            original = inside(root, path); data = original.read_bytes()
            with Image.open(original) as image:
                image.verify()
            relative = f'review/quality-references/{identifier}/{view}{original.suffix.lower()}'
            output = inside(directory, relative); output.parent.mkdir(parents=True, exist_ok=True); output.write_bytes(data)
            views[view] = {'path': relative, 'sha256': digest(data), 'sourcePath': path}
        if set(views) != set(VIEWS): raise ValueError('Quality reference requires four fixed views')
        refs.append({'id': identifier, 'role': 'quality-not-identity', 'rationale': source['rationale'],
                     'sourceContract': source['sourceContract'], 'views': views})
    if not refs: raise ValueError('Empty quality reference plan')
    state['qualityReferences'] = refs

def verify_capture(directory, state, manifest):
    if not state['rounds']: raise ValueError('Real DCC capture is required')
    current = state['rounds'][-1]
    if current['modelSha256'] != manifest['model']['sha256']:
        raise ValueError('Capture is for a stale model')
    for record in [current['blend'], current['dcc'], *current['captures'].values(), *current['identityReferences'].values(),
                   *current.get('comparisons', {}).values()]:
        if digest(inside(directory, record['path']).read_bytes()) != record['sha256']:
            raise ValueError('Capture/reference integrity mismatch')
    for quality in state['qualityReferences']:
        for record in quality['views'].values():
            if digest(inside(directory, record['path']).read_bytes()) != record['sha256']:
                raise ValueError('Quality reference changed during refinement')
    if digest(inside(directory, manifest['reconstructionSpec']).read_bytes()) != current['specSha256']:
        raise ValueError('Reconstruction spec changed after capture')
    payload = {k: v for k, v in current.items() if k not in ('captureSetSha256', 'assessment')}
    if digest(json.dumps(payload, sort_keys=True).encode()) != current['captureSetSha256']:
        raise ValueError('Capture-set metadata integrity mismatch')
    return current

def comparison_boards(directory, output, receipt, state, manifest):
    """Juxtapose actual renders and unchanged references; no generated illustration."""
    result = {}
    for view in VIEWS:
        identity = 'front34' if view == 'three-quarter' else view
        files = [('Delivered GLB / Blender', output / receipt['captures'][view]['path'])]
        if identity in manifest['sourceViews']:
            files.append(('Identity reference', directory / f'review/references/{identity}.png'))
        for ref in state['qualityReferences']:
            files.append(('Quality only: ' + ref['id'], inside(directory, ref['views'][view]['path'])))
        board = Image.new('RGB', (320*len(files), 350), 'white'); draw = ImageDraw.Draw(board)
        for i, (title, path) in enumerate(files):
            image = Image.open(path).convert('RGBA'); image.thumbnail((320, 320))
            board.paste(image, (i*320+(320-image.width)//2, 30+(320-image.height)//2), image)
            draw.text((i*320+6, 8), title, fill='black')
        path = output / (view + '-comparison.png'); board.save(path)
        result[view] = {'path': str(path.relative_to(directory)), 'sha256': digest(path.read_bytes())}
    return result

def capture(root, identifier, source_sha, blender='blender', quality_plan=None, recipe_path=None):
    if not re.fullmatch(r'[0-9a-f]{40}', source_sha): raise ValueError('Exact checkout SHA required')
    with package(root, identifier) as (root, directory, manifest, state, model):
        attach_quality(root, directory, state, quality_plan)
        recipe = None
        if recipe_path:
            current = verify_capture(directory, state, manifest)
            assessment = current.get('assessment', {})
            if state['status'] != 'needs-dcc-correction' or assessment.get('decision') != 'revise':
                raise ValueError('Record an actual comparison and findings before DCC repair')
            if state['repairRounds'] >= MAX_REPAIRS: raise ValueError('Three-round limit reached; remaining defects stay explicit')
            recipe = read(recipe_path)
            if recipe.get('inputModelSha256') != manifest['model']['sha256']:
                raise ValueError('Correction must name the exact input model hash')
            findings = {f['id'] for f in assessment['findings']}
            if any(e.get('findingId') not in findings for e in recipe.get('edits', [])):
                raise ValueError('Every DCC edit must address a recorded finding')
        elif state['rounds']:
            raise ValueError('Use the existing capture or a finding-bound repair; do not overwrite rounds')
        number = state['repairRounds'] + (1 if recipe else 0)
        output = directory / f'review/refinement/r{number:02d}'
        if output.exists(): raise ValueError('Round already exists; inspect incomplete evidence rather than overwrite it')
        command = [blender, '--background', '--python', str(Path(__file__).with_name('blender_refinement.py')), '--',
                   '--model', str(model), '--spec', str(inside(directory, manifest['reconstructionSpec'])),
                   '--out', str(output), '--source-sha', source_sha]
        if recipe_path: command += ['--recipe', str(Path(recipe_path).resolve())]
        subprocess.run(command, check=True, timeout=600)
        receipt = read(output / 'dcc-receipt.json')
        if receipt['sourceSha'] != source_sha or receipt['inputModelSha256'] != manifest['model']['sha256'] or set(receipt['captures']) != set(VIEWS):
            raise ValueError('DCC capture input/view mismatch')
        report = None
        if recipe:
            if not receipt['changedVertices'] or not receipt['protectedBinarySha256']:
                raise ValueError('Real geometry correction with protected-stream proof is required')
            from validation import validate_export
            spec = read(inside(directory, manifest['reconstructionSpec']))
            views = {}
            for view in manifest['sourceViews']:
                image = Image.open(directory / f'review/references/{view}.png').convert('RGBA')
                views[view] = {'mask': image.getchannel('A').point(lambda a: 255 if a > 96 else 0)}
            report = validate_export(spec, views, output / 'character.glb', spec['textureProjection'], output / 'diagnostics')
            if report['errors']: raise ValueError('; '.join(report['errors']))
            manifest['model'] = {'path': str((output / 'character.glb').relative_to(directory)), 'sha256': report['modelSha256']}
            manifest['comparisons'] = {v: str((output / 'diagnostics' / (v+'-silhouette-overlay.png')).relative_to(directory)) for v in report['comparisons']}
            from validation import read_export
            _, doc, get = read_export(output / 'character.glb')
            points = [p for m in doc['meshes'] for p in get(m['primitives'][0]['attributes']['POSITION'])]
            manifest['bounds'] = {'min': [min(p[i] for p in points) for i in range(3)], 'max': [max(p[i] for p in points) for i in range(3)]}
            manifest['presentation']['bodyCenter'] = [(a+b)/2 for a, b in zip(manifest['bounds']['min'], manifest['bounds']['max'])]
            (output / 'correction.json').write_bytes(Path(recipe_path).read_bytes())
        if receipt['modelSha256'] != manifest['model']['sha256']:
            raise ValueError('DCC receipt does not identify the delivered model')
        relative = lambda r: {**r, 'path': str((output / r['path']).relative_to(directory))}
        record = {'round': number, 'sourceSha': source_sha, 'modelSha256': receipt['modelSha256'],
                  'specSha256': digest(inside(directory, manifest['reconstructionSpec']).read_bytes()),
                  'captures': {v: relative(r) for v, r in receipt['captures'].items()}, 'blend': relative(receipt['blend']),
                  'dcc': {'path': str((output / 'dcc-receipt.json').relative_to(directory)), 'sha256': digest((output / 'dcc-receipt.json').read_bytes())},
                  'identityReferences': {v: {'path': f'review/references/{v}.png', 'sha256': digest((directory / f'review/references/{v}.png').read_bytes())} for v in manifest['sourceViews']},
                  'qualityReferences': state['qualityReferences'],
                  'comparisons': comparison_boards(directory, output, receipt, state, manifest),
                  'changedVertices': receipt['changedVertices'], 'renderer': receipt['renderer']}
        record['captureSetSha256'] = digest(json.dumps(record, sort_keys=True).encode())
        state['rounds'].append(record); state['repairRounds'] = number; state['modelSha256'] = receipt['modelSha256']
        state['status'] = 'awaiting-review'
        verify_capture(directory, state, manifest)
        publish(root, directory, manifest, state, report)
        return {'id': identifier, 'status': state['status'], 'round': number, 'modelSha256': state['modelSha256'], 'captureSetSha256': record['captureSetSha256']}

def assess(root, identifier, assessment_path):
    with package(root, identifier) as (root, directory, manifest, state, model):
        current = verify_capture(directory, state, manifest)
        assessment = read(assessment_path)
        if state['status'] != 'awaiting-review': raise ValueError('This capture already has an assessment')
        if assessment.get('schemaVersion') != 'rinne.forge-quality-assessment/v1': raise ValueError('Unknown assessment schema')
        if assessment.get('modelSha256') != state['modelSha256'] or assessment.get('captureSetSha256') != current['captureSetSha256']:
            raise ValueError('Assessment is for stale model/captures')
        if not isinstance(assessment.get('reviewer'), str) or not assessment['reviewer'].strip(): raise ValueError('Explicit worker reviewer required')
        if set(assessment.get('reviewedViews', [])) != set(VIEWS): raise ValueError('Inspect all four real model views')
        decision = assessment.get('decision')
        if decision not in ('revise', 'ready-for-human-review'): raise ValueError('Worker cannot approve or complete an asset')
        checklist = assessment.get('checklist', {})
        if set(checklist) != set(CHECKS): raise ValueError('Complete structural/runtime checklist required')
        for value in checklist.values():
            if not isinstance(value, dict) or value.get('result') not in ('pass', 'fail', 'unverified', 'not-applicable') or not value.get('notes'):
                raise ValueError('Every checklist item needs an honest result and notes')
        findings = assessment.get('findings')
        if not isinstance(findings, list): raise ValueError('Explicit findings array required')
        ids = set()
        for finding in findings:
            if any(not isinstance(finding.get(k), str) or not finding[k].strip() for k in ('id', 'target', 'observed', 'expected', 'preserve')):
                raise ValueError('Finding requires id/target/observed/expected/preserve')
            if finding['id'] in ids or not set(finding.get('views', [])) or not set(finding['views']).issubset(VIEWS):
                raise ValueError('Finding needs unique id and relevant fixed views')
            ids.add(finding['id'])
        if decision == 'revise' and not findings: raise ValueError('Repair requires observed findings')
        if decision == 'ready-for-human-review':
            if findings or any(v['result'] not in ('pass', 'not-applicable') for v in checklist.values()):
                raise ValueError('Open or unverified checks cannot become review-ready')
            expected = {r['id'] for r in state['qualityReferences']}
            if not expected or set(assessment.get('comparedQualityReferences', [])) != expected:
                raise ValueError('Compare existing quality references, separately from identity')
            runtime = assessment.get('runtimeEvidence', {})
            if runtime.get('modelSha256') != state['modelSha256'] or not runtime.get('receiptPath'):
                raise ValueError('Delivered-asset runtime evidence is required')
            receipt_path = inside(root, runtime['receiptPath']); raw = receipt_path.read_bytes()
            runtime_receipt = json.loads(raw)
            if digest(raw) != runtime.get('sha256') or runtime_receipt.get('modelSha256') != state['modelSha256'] or runtime_receipt.get('status') != 'passed' or runtime_receipt.get('errors') != [] or not set(VIEWS).issubset(runtime_receipt.get('views', {})) or not re.fullmatch(r'[0-9a-f]{40}', runtime_receipt.get('head', '')):
                raise ValueError('Runtime receipt integrity/model mismatch')
            previous = state['rounds'][-2].get('assessment', {}).get('findings', []) if len(state['rounds']) > 1 else []
            if set(assessment.get('resolvedFindingIds', [])) != {f['id'] for f in previous}:
                raise ValueError('Recheck every previous finding after DCC correction')
        current['assessment'] = assessment
        state['status'] = 'needs-dcc-correction' if decision == 'revise' else 'ready-for-human-review'
        publish(root, directory, manifest, state)
        return {'id': identifier, 'status': state['status'], 'visualApproval': 'pending', 'productionReady': False}

def main():
    p = argparse.ArgumentParser(description='Forge: capture -> compare/findings -> DCC repair -> recapture')
    p.add_argument('command', choices=['capture', 'assess', 'repair'])
    p.add_argument('--root', default=str(Path(__file__).resolve().parents[3])); p.add_argument('--id', required=True)
    p.add_argument('--source-sha'); p.add_argument('--blender', default='blender'); p.add_argument('--quality-reference')
    p.add_argument('--assessment'); p.add_argument('--recipe')
    args = p.parse_args()
    if args.command == 'assess':
        if not args.assessment: p.error('--assessment is required')
        result = assess(args.root, args.id, args.assessment)
    else:
        if not args.source_sha: p.error('--source-sha is required')
        if args.command == 'repair' and not args.recipe: p.error('--recipe is required for repair')
        if args.command == 'capture' and args.recipe: p.error('Use repair for corrections')
        result = capture(args.root, args.id, args.source_sha, args.blender, args.quality_reference, args.recipe)
    print(json.dumps(result))

if __name__ == '__main__': main()
