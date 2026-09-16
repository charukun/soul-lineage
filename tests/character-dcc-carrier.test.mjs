import test, { after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadCharacterDccRequest } from '../scripts/character-dcc-request.mjs';
import { evaluateCharacterProduction } from '../packages/characters/src/production-pipeline.js';

const ROOT = `.tmp-character-dcc-carrier-${process.pid}`;
const requestPath = `${ROOT}/request.json`;
const sha = value => createHash('sha256').update(value).digest('hex');

function write(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}

function request(overrides = {}) {
  const referenceBytes = Buffer.from('reference-sheet');
  const rigBytes = Buffer.from('audited-rig');
  const value = {
    schema: 'character-dcc-request',
    version: 1,
    id: 'test.character-dcc.v1',
    assetId: 'character.test-dcc.v1',
    reference: { path: `${ROOT}/reference.png`, sha256: sha(referenceBytes), views: ['front', 'side', 'back'] },
    rig: { path: `${ROOT}/rig.vrm`, sha256: sha(rigBytes), id: 'humanoid.test.v1' },
    builder: `${ROOT}/builder.py`,
    generatedDir: 'generated/test-character-dcc',
    blendName: 'TestCharacter.blend',
    modelName: 'TestCharacter.glb',
    format: 'glb',
    publicPath: './simulator/assets/TEST_CHARACTER_DCC.glb',
    canonical: {
      blend: `${ROOT}/canonical/TestCharacter.blend`,
      model: `${ROOT}/canonical/TEST_CHARACTER_DCC.glb`,
      integrity: `${ROOT}/canonical/TEST_CHARACTER_DCC.asset.json`,
      production: `${ROOT}/canonical/test-character.production.json`,
      qaDir: `${ROOT}/qa`
    },
    license: { rigProvenance: 'audited test rig', surfaceAuthorship: 'test authored surfaces' },
    primary: { separateSurfaces: ['skin', 'hair', 'clothing', 'accessories'], minMeshObjects: 3, minMaterials: 2 },
    production: { stage: 'REFERENCE', productionReady: false, visualApproval: 'pending' },
    review: { intentLocked: true, proportionsReviewed: false, silhouetteReviewed: false, topologyReviewed: false },
    ...overrides
  };
  write(value.reference.path, referenceBytes);
  write(value.rig.path, rigBytes);
  write(value.builder, 'print("builder fixture")\n');
  write(requestPath, JSON.stringify(value, null, 2));
  return value;
}

function clean() { rmSync(ROOT, { recursive: true, force: true }); }

afterEach(clean);
after(clean);

test('request validation pins reference/rig hashes and safe repository paths', () => {
  const value = request();
  const parsed = loadCharacterDccRequest(requestPath, { verifyFiles: true });
  assert.equal(parsed.id, value.id);
  assert.equal(parsed.production.stage, 'REFERENCE');
  assert.deepEqual(parsed.reference.views, ['front', 'side', 'back']);
});

test('request validation rejects traversal, hash drift and production overclaim', () => {
  request({ canonical: {
    blend: `${ROOT}/canonical/TestCharacter.blend`, model: '../escape.glb',
    integrity: `${ROOT}/canonical/a.json`, production: `${ROOT}/canonical/a.production.json`, qaDir: `${ROOT}/qa`
  }});
  assert.throws(() => loadCharacterDccRequest(requestPath), /escapes the repository/);

  const value = request();
  write(value.reference.path, 'mutated-reference');
  assert.throws(() => loadCharacterDccRequest(requestPath, { verifyFiles: true }), /reference SHA-256 mismatch/);

  request({ production: { stage: 'PRIMARY', productionReady: false, visualApproval: 'pending' } });
  assert.throws(() => loadCharacterDccRequest(requestPath), /PRIMARY requires review\.proportionsReviewed=true/);

  request({ production: { stage: 'REFERENCE', productionReady: true, visualApproval: 'pending' } });
  assert.throws(() => loadCharacterDccRequest(requestPath), /productionReady must remain false/);
});

test('BLOCKOUT and PRIMARY require explicit review evidence instead of export-only promotion', () => {
  request({ production: { stage: 'BLOCKOUT', productionReady: false, visualApproval: 'pending' } });
  assert.throws(() => loadCharacterDccRequest(requestPath), /BLOCKOUT requires review\.proportionsReviewed=true/);

  request({
    production: { stage: 'PRIMARY', productionReady: false, visualApproval: 'pending' },
    review: { intentLocked: true, proportionsReviewed: true, silhouetteReviewed: true, topologyReviewed: true }
  });
  assert.equal(loadCharacterDccRequest(requestPath).production.stage, 'PRIMARY');
});

test('generic finalizer produces exact integrity and an eligible PRIMARY manifest when review evidence is explicit', () => {
  const value = request({
    production: { stage: 'PRIMARY', productionReady: false, visualApproval: 'pending' },
    review: { intentLocked: true, proportionsReviewed: true, silhouetteReviewed: true, topologyReviewed: true }
  });
  write(value.canonical.blend, 'blend-bytes');
  write(value.canonical.model, 'glb-bytes');
  const audit = {
    characterId: value.id,
    dcc: { tool: 'Blender', version: '4.0.2' },
    scene: { meshObjects: 4, armatures: 1, vertices: 100, triangles: 180, materials: 3, uvMeshCount: 4, shapeKeys: [], bones: 20 },
    checks: { hasMesh: true, singleArmature: true, hasUVs: true, transformsApplied: true, noDegeneratePolygons: true }
  };
  write(join(value.canonical.qaDir, 'blender-audit.json'), JSON.stringify(audit));
  write(join(value.canonical.qaDir, 'build.json'), JSON.stringify({ characterId: value.id }));
  for (const view of ['front', 'three-quarter', 'side', 'back']) write(join(value.canonical.qaDir, `${view}.png`), `png-${view}`);

  const result = spawnSync('python3', ['scripts/finalize-character-dcc.py', '--request', requestPath], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const integrity = JSON.parse(readFileSync(value.canonical.integrity, 'utf8'));
  const production = JSON.parse(readFileSync(value.canonical.production, 'utf8'));
  assert.equal(integrity.sha256, sha(Buffer.from('glb-bytes')));
  assert.equal(integrity.sourceBlendSha256, sha(Buffer.from('blend-bytes')));
  assert.equal(integrity.productionStage, 'PRIMARY');
  assert.equal(production.status.productionReady, false);
  assert.equal(production.status.visualApproval, 'pending');
  const evaluated = evaluateCharacterProduction(production, 'PRIMARY');
  assert.equal(evaluated.ok, true, evaluated.missing.join('; '));
});

test('workflow is isolated to dcc branches and does not depend on Dispatch/Rescue credentials', () => {
  const workflow = readFileSync('.github/workflows/character-dcc-carrier.yml', 'utf8');
  assert.match(workflow, /branches:\s*\n\s*- 'dcc\/\*\*'/);
  assert.match(workflow, /character-dcc\/build/);
  assert.match(workflow, /scripts\/character-dcc-request\.mjs validate/);
  assert.match(workflow, /scripts\/blender\/character-production-audit\.py/);
  assert.match(workflow, /scripts\/finalize-character-dcc\.py/);
  assert.match(workflow, /git push origin "HEAD:\$GITHUB_REF_NAME"/);
  assert.match(workflow, /name: character-dcc-\$\{\{ github\.run_id \}\}-\$\{\{ github\.run_attempt \}\}/);
  assert.doesNotMatch(workflow, /name: character-dcc-\$\{\{ github\.ref_name \}\}/);
  assert.doesNotMatch(workflow, /DISPATCH_GITHUB_TOKEN|RESCUE_GITHUB_TOKEN/);
  assert.doesNotMatch(workflow, /refs\/heads\/main|work\/visual-review-lab-v2/);
  assert.ok(workflow.indexOf('Validate request before installing Blender') < workflow.indexOf('Install headless Blender runtime'));
});
