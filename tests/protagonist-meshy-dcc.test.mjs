import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const requestPath = '.dcc/character-dcc-request.json';
const builderPath = 'scripts/blender/build-protagonist-meshy-shino-v1.py';

test('Meshy protagonist DCC request stays at REFERENCE and pins the clean KayKit rig donor', () => {
  const request = JSON.parse(readFileSync(requestPath, 'utf8'));
  assert.equal(request.id, 'protagonist.meshy-shino.v1');
  assert.equal(request.production.stage, 'REFERENCE');
  assert.equal(request.production.productionReady, false);
  assert.equal(request.production.visualApproval, 'pending');
  assert.equal(request.rig.id, 'kaykit.Rig_Medium.v1');
  assert.equal(request.rig.sha256, 'ab3e2e71b768843a756abaa79f47859d1cd3c77a45b0c8b7a582f8d0b158fab6');
  assert.match(request.license.surfaceAuthorship, /0196ad16-605f-735d-9d1c-ec04032a2e02/);
  assert.match(request.license.surfaceAuthorship, /CC0/);
});

test('Meshy builder fails closed instead of substituting another visible character source', () => {
  const builder = readFileSync(builderPath, 'utf8');
  assert.match(builder, /MESHY_MODEL_ID = "0196ad16-605f-735d-9d1c-ec04032a2e02"/);
  assert.match(builder, /page did not expose CC0 license token/);
  assert.match(builder, /Unable to materialize the exact public Meshy model without authenticated\/mutable substitution/);
  assert.match(builder, /visibleSurfaceConstruction/);
  assert.match(builder, /load_clean_rig/);
  assert.match(builder, /if obj is not armature:\n\s+remove_object\(obj\)/);
});
