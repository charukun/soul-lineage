import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = `.tmp-character-dcc-carrier-${process.pid}`;
const sha256 = value => createHash('sha256').update(value).digest('hex');
const gitBlobSha = value => {
  const body = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return createHash('sha1').update(Buffer.from(`blob ${body.byteLength}\0`)).update(body).digest('hex');
};

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function fixture({ failedAudit = false, omitView = null } = {}) {
  const rigBytes = Buffer.from('pinned-kaykit-rig-bytes');
  const paths = {
    reference: `${ROOT}/assets/characters/test/reference.png`,
    rig: `${ROOT}/apps/rinne/public/simulator/assets/kaykit/Rogue.glb`,
    builder: `${ROOT}/assets/characters/test/build.py`,
    blend: `${ROOT}/assets/characters/test/model.blend`,
    model: `${ROOT}/apps/rinne/public/simulator/assets/TEST_DCC.glb`,
    qa: `${ROOT}/docs/characters/qa/test-dcc`,
    out: `${ROOT}/docs/characters/qa/test-dcc/integrity.json`,
    rigBytes,
    rigBlobSha: gitBlobSha(rigBytes)
  };
  write(paths.reference, 'reference-bytes');
  write(paths.rig, rigBytes);
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

function runFinalizer(paths, { rigBlobSha = paths.rigBlobSha } = {}) {
  return spawnSync('python3', [
    'scripts/finalize-character-dcc.py',
    '--slug', 'test',
    '--reference', paths.reference,
    '--rig', paths.rig,
    '--rig-id', 'Rig_Medium',
    '--rig-model-id', 'kaykit.rogue.v1',
    '--rig-license', 'CC0-1.0',
    '--rig-source-repository', 'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0',
    '--rig-source-revision', '672074b73ba276876a19e8816ecdc5241817ab47',
    '--rig-source-path', 'addons/kaykit_character_pack_adventures/Characters/gltf/Rogue.glb',
    '--rig-upstream-blob-sha', rigBlobSha,
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

test('finalizer writes pinned-source Blender integrity without promoting production stage', () => {
  const paths = fixture();
  const result = runFinalizer(paths);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const receipt = JSON.parse(readFileSync(paths.out, 'utf8'));
  assert.equal(receipt.schema, 'character-dcc-build');
  assert.equal(receipt.slug, 'test');
  assert.equal(receipt.characterId, 'test.character-dcc.v1');
  assert.equal(receipt.model.sha256, sha256(Buffer.from('glb-bytes')));
  assert.equal(receipt.source.blend.sha256, sha256(Buffer.from('blend-bytes')));
  assert.equal(receipt.source.reference.sha256, sha256(Buffer.from('reference-bytes')));
  assert.equal(receipt.source.rig.sha256, sha256(paths.rigBytes));
  assert.equal(receipt.source.rig.gitBlobSha, paths.rigBlobSha);
  assert.equal(receipt.source.rig.id, 'Rig_Medium');
  assert.equal(receipt.source.rig.modelId, 'kaykit.rogue.v1');
  assert.equal(receipt.source.rig.license, 'CC0-1.0');
  assert.equal(receipt.source.rig.upstream.revision, '672074b73ba276876a19e8816ecdc5241817ab47');
  assert.equal(receipt.source.rig.upstream.gitBlobSha, paths.rigBlobSha);
  assert.equal(receipt.review.visualApproval, 'pending');
  assert.equal(receipt.status.productionReady, false);
  assert.equal('productionStage' in receipt, false);
});

test('finalizer fails closed for missing fixed views, failed Blender audit, or mismatched pinned source', () => {
  let paths = fixture({ omitView: 'side' });
  let result = runFinalizer(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /review side missing or empty/);

  rmSync(ROOT, { recursive: true, force: true });
  paths = fixture({ failedAudit: true });
  result = runFinalizer(paths);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Blender audit contains a failed or missing objective check/);

  rmSync(ROOT, { recursive: true, force: true });
  paths = fixture();
  result = runFinalizer(paths, { rigBlobSha: '0'.repeat(40) });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /rig upstream blob mismatch/);
});

test('workflow exposes only two authored inputs and uses the pinned KayKit foundation', () => {
  const workflow = readFileSync('.github/workflows/character-dcc-carrier.yml', 'utf8');
  assert.match(workflow, /branches:\s*\n\s*- 'dcc\/\*\*'/);
  assert.match(workflow, /assets\/characters\/\*\*\/build\.py/);
  assert.match(workflow, /assets\/characters\/\*\*\/reference\.\*/);
  assert.match(workflow, /prepare-kaykit-foundation\.mjs/);
  assert.match(workflow, /KAYKIT_DEFAULT_MODEL_ID/);
  assert.match(workflow, /KAYKIT_SOURCE_REVISION/);
  assert.match(workflow, /character-production-audit\.py/);
  assert.match(workflow, /finalize-character-dcc\.py/);
  assert.match(workflow, /git push origin "HEAD:\$GITHUB_REF_NAME"/);
  assert.match(workflow, /DCC_CANONICAL_BLEND=\$DCC_DIR\/model\.blend/);
  assert.doesNotMatch(workflow, /SHINO_review\.vrm|LicenseRef-SHINO|--source-vrm/);
  assert.doesNotMatch(workflow, /character-dcc-request\.json|validate-character-dcc-bundle/);
  assert.doesNotMatch(workflow, /packages\/characters\/production|check-character-production/);
  assert.doesNotMatch(workflow, /DISPATCH_GITHUB_TOKEN|RESCUE_GITHUB_TOKEN/);
  assert.ok(workflow.indexOf('Discover two-file DCC input before installing Blender') < workflow.indexOf('Install headless Blender runtime'));
});

test('carrier documentation keeps future-session input to reference plus build.py and keeps publication gates separate', () => {
  const doc = readFileSync('docs/characters/CHARACTER_DCC_CARRIER.md', 'utf8');
  assert.match(doc, /Those are the only required authored inputs/);
  assert.match(doc, /assets\/characters\/<slug>\/reference\.<ext>/);
  assert.match(doc, /assets\/characters\/<slug>\/build\.py/);
  assert.match(doc, /No `\.dcc\/character-dcc-request\.json`/);
  assert.match(doc, /KayKit/);
  assert.match(doc, /visualApproval=pending/);
  assert.match(doc, /productionReady=false/);
});

test('legacy manifest and request validator are absent from the two-file carrier contract', () => {
  assert.equal(existsSync('docs/characters/character-dcc-request.example.json'), false);
  assert.equal(existsSync('scripts/validate-character-dcc-bundle.py'), false);
});
