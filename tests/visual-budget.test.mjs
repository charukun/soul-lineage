import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { inspectVisualFile, VISUAL_BUDGETS } from '../scripts/visual-budget.mjs';

test('visual budget blocks newly changed oversized raster assets', () => {
  const root = mkdtempSync(path.join(tmpdir(),'visual-budget-'));
  const file = 'huge.png'; writeFileSync(path.join(root,file), Buffer.alloc(VISUAL_BUDGETS.rasterHardBytes + 1));
  const row = inspectVisualFile(file,{root});
  assert.equal(row.gate,'fail'); assert.ok(row.errors.length);
});

test('visual budget warns about material-heavy glTF without rejecting valid JSON', () => {
  const root = mkdtempSync(path.join(tmpdir(),'visual-budget-'));
  const file = 'crowd.gltf'; writeFileSync(path.join(root,file), JSON.stringify({materials:Array.from({length:60},()=>({})),meshes:[],images:[]}));
  const row = inspectVisualFile(file,{root});
  assert.equal(row.gate,'review'); assert.match(row.warnings.join(' '),/materials/);
});
