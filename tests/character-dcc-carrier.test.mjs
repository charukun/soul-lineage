import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = `.tmp-character-dcc-carrier-${process.pid}`;
const sha = value => createHash('sha256').update(value).digest('hex');

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function fixture({ failedAudit = false, omitView = null } = {}) {
  const paths = {
    reference: `${ROOT}/assets/characters/test/reference.png`,
    rig: `${ROOT}/apps/rinne/public/simulator/assets/SHINO_review.vrm`,
    builder: `${ROOT}/assets/characters/test/build.py`,
    blend: `${ROOT}/assets/characters/test/model.blend`,
    model: `${ROOT}/apps/rinne/public/simulator/assets/TEST_DCC.glb`,
    qa: `${ROOT}/docs/characters/qa/test-dcc`,
    out: `${ROOT}/docs/characters/qa/test-dcc/integrity.json`
  };
  write(paths.reference, 'reference-bytes');
  write(paths.rig, 'rig-bytes');
  write(paths.builder, 'print("builder")\n');
  write(paths.blend, 'blend-bytes');
  write(paths.model, 'glb-bytes');
  write(join(paths.qa, 'build.json'), JSON.stringify({ characterId: 'test.character-dcc.v1' }));
  write(join(paths.qa, 'blender-audit.json'), JSON.stringify({
    characterId: 'test.character-dcc.v1',
    dcc: { tool: 'Blender', version: '4.0.2' },
    scene: { meshObjects: 4, armatures: 1, vertices: 100, triangles: 180, materials: 3, uvMeshCount: 4, bones: 20 },
    checks: {
      hasMesh: true,
      singleArmature: true,
      hasUVs: true,
      transformsApplied: true,
      noDegeneratePolygons: !failedAudit
    }
  }));
  for (const view of ['front', 'three-quarter', 'side', 'back']) {
    if (view !== omitView) write(join(paths.qa, `${view}.png`), `png-${view}`);
  }
  return paths;
}

function runFinalizer(paths) {
  return spawnSync('python3', [
    'scripts/finalize-character-dcc.py',
    '--slug', 'test',
    '--reference', paths.reference,
    '--rig', paths.rig,
    '--builder', paths.builder,
    '--blend', paths.blend,
    '--model', paths.model,
    '--audit', join(paths.qa, 'blender-audit.json'),
    '--build', join(paths.qa, 'build.json'),
    '--qa-dir', paths.qa,
    '--public-path', './simulator/assets/TEST_DCC.glb',
    '--out', paths.out
  ], { encoding: 'utf8' });
}

afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

test('finalizer writes exact Blender build integrity without promoting production stage', () => {
  const paths = fixture();
  const result = runFinalizer(paths);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(readFileSync(paths.out, 'utf8'));
  assert.equal(receipt.schema, 'character-dcc-build');
  assert.equal(receipt.slug, 'test');
  assert.equal(receipt.characterId, 'test.character-dcc.v1');
  assert.equal(receipt.model.sha256, sha(Buffer.from('glb-bytes')));
  assert.equal(receipt.source.blend.sha256, sha(Buffer.from('blend-bytes')));
  assert.equal(receipt.source.reference.sha256, sha(Buffer.from('reference-bytes')));
  assert.equal(receipt.source.rig.sha256, sha(Buffer.from('rig-bytes')));
  assert.equal(receipt.review.visualApproval, 'pending');
  assert.equal(receipt.status.productionReady, false);
  assert.equal('productionStage' in receipt, false);
});

test('finalizer fails closed for missing fixed views or failed Blender audit', () => {
  let paths = fixture({ omitView: 'side' });
  let result = runFinalizer(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review side missing or empty/);

  rmSync(ROOT, { recursive: true, force: true });
  paths = fixture({ failedAudit: true });
  result = runFinalizer(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Blender audit contains a failed or missing objective check/);
});

test('workflow exposes only the two authored character inputs', () => {
  const workflow = readFileSync('.github/workflows/character-dcc-carrier.yml', 'utf8');
  assert.match(workflow, /branches:\s*\n\s*- 'dcc\/\*\*'/);
  assert.match(workflow, /assets\/characters\/\*\*\/build\.py/);
  assert.match(workflow, /assets\/characters\/\*\*\/reference\.\*/);
  assert.match(workflow, /SHINO_review\.vrm/);
  assert.match(workflow, /character-production-audit\.py/);
  assert.match(workflow, /finalize-character-dcc\.py/);
  assert.match(workflow, /git push origin "HEAD:\$GITHUB_REF_NAME"/);
  assert.match(workflow, /DCC_CANONICAL_BLEND=\$DCC_DIR\/model\.blend/);
  assert.doesNotMatch(workflow, /character-dcc-request\.json|character-dcc-request\.mjs/);
  assert.doesNotMatch(workflow, /packages\/characters\/production|check-character-production/);
  assert.doesNotMatch(workflow, /DISPATCH_GITHUB_TOKEN|RESCUE_GITHUB_TOKEN/);
  assert.ok(workflow.indexOf('Discover two-file DCC input before installing Blender') < workflow.indexOf('Install headless Blender runtime'));
});

test('carrier documentation keeps future-session input to reference plus build.py', () => {
  const doc = readFileSync('docs/characters/CHARACTER_DCC_CARRIER.md', 'utf8');
  assert.match(doc, /Those are the only required authored inputs/);
  assert.match(doc, /assets\/characters\/<slug>\/reference\.<ext>/);
  assert.match(doc, /assets\/characters\/<slug>\/build\.py/);
  assert.match(doc, /no `\.dcc\/character-dcc-request\.json`/);
});
