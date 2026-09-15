import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { CHARACTER_REFERENCE_MODELS } from '../packages/characters/src/reference-models.js';

const retired = [
  '.github/workflows/shino-reference-dcc.yml',
  'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.vrm',
  'apps/rinne/public/simulator/assets/SHINO_REFERENCE_V2.asset.json',
  'assets/characters/shino/reference-v2/source/ShinoReferenceV2.blend',
  'packages/characters/production/shino-reference.production.json',
  'docs/characters/SHINO_REFERENCE_V2_DCC.md',
  'docs/characters/qa/shino-reference-v2/front.png',
  'docs/characters/qa/shino-reference-v2/side.png',
  'docs/characters/qa/shino-reference-v2/back.png',
  'docs/characters/qa/shino-reference-v2/three-quarter.png',
  'docs/characters/qa/shino-reference-v2/blender-audit.json',
  'docs/characters/qa/shino-reference-v2/build.json',
  'scripts/blender/build-shino-reference-v2.py',
  'scripts/blender/normalize-shino-reference-v2-transforms.py',
  'scripts/blender/refine-shino-reference-v2.py',
  'scripts/blender/refine-shino-reference-v2-v3.py',
  'scripts/blender/refine-shino-reference-v2-v4.py',
  'scripts/blender/refine-shino-reference-v2-v5.py',
  'scripts/blender/refine-shino-reference-v2-v6.py',
  'scripts/blender/refine-shino-reference-v2-v7.py',
  'scripts/blender/refine-shino-reference-v2-v8.py',
  'scripts/blender/refine-shino-reference-v2-v9.py',
  'scripts/blender/refine-shino-reference-v2-v10.py',
  'scripts/blender/run-shino-reference-v2.py',
  'scripts/finalize-shino-reference-v2.py'
];

test('retired Shino DCC prototype family stays out of the active tree', () => {
  for (const path of retired) assert.equal(existsSync(resolve(path)), false, `${path} must remain retired`);
  assert.equal(CHARACTER_REFERENCE_MODELS['shino.reference.v2'], undefined);
});

test('audited MasterCharacter source and Shino design reference remain available', () => {
  assert.equal(existsSync(resolve('apps/rinne/public/simulator/assets/SHINO_review.vrm')), true);
  assert.equal(existsSync(resolve('docs/characters/references/shino/shino-character-reference-sheet-v2.png')), true);
});
