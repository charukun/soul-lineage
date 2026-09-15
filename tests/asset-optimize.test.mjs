import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  ASSET_ROLES,
  buildAssetOptimizationPlan,
  evaluateAssetOptimization,
  roleBudget,
  runAssetOptimization,
} from '../scripts/asset-optimize.mjs';

test('role budgets reuse the canonical stylized art profiles', () => {
  assert.deepEqual(ASSET_ROLES, ['hero', 'npc', 'enemy', 'environment', 'prop', 'distant']);
  assert.equal(roleBudget('hero').softTriangleBudget, 120000);
  assert.deepEqual(roleBudget('npc').lodRatios, [1, .58, .30]);
  assert.equal(roleBudget('distant').softDrawCallBudget, 4);
  assert.throws(() => roleBudget('unknown'), /Unknown asset role/);
});

test('character plan uses authored profile ratios and existing wrappers', () => {
  const plan = buildAssetOptimizationPlan({ input: 'art/shino.blend', role: 'hero', outputDir: 'generated/test-shino' });
  assert.equal(plan.mode, 'character');
  assert.match(plan.stages.lod.args[0], /scripts\/generate-lods\.mjs$/);
  assert.equal(plan.stages.lod.args.at(-4), '--lod1');
  assert.equal(plan.stages.lod.args.at(-3), '0.72');
  assert.equal(plan.stages.lod.args.at(-2), '--lod2');
  assert.equal(plan.stages.lod.args.at(-1), '0.42');
  assert.match(plan.stages.compress.args[0], /scripts\/compress-gltf\.mjs$/);
  assert.equal(plan.outputs.final, plan.outputs.optimized);
});

test('static roles use static Blender mode and support compression-only GLB plans', () => {
  const plan = buildAssetOptimizationPlan({ input: 'assets/tree.glb', role: 'environment', skipLod: true });
  assert.equal(plan.mode, 'static');
  assert.equal(plan.stages.lod, null);
  assert.equal(plan.stages.compress.args.at(-4), '--input');
  assert.match(plan.stages.compress.args.at(-3), /tree\.glb$/);
  assert.throws(() => buildAssetOptimizationPlan({ input: 'art/shino.blend', role: 'hero', skipLod: true }), /requires LOD\/export/);
  assert.throws(() => buildAssetOptimizationPlan({ input: 'assets/tree.glb', role: 'prop', skipLod: true, skipCompress: true }), /At least one optimization stage/);
});

test('evaluation applies triangle, material and draw-call budgets as review gates', () => {
  const plan = buildAssetOptimizationPlan({ input: 'assets/npc.glb', role: 'npc', outputDir: 'generated/test-npc' });
  const audit = {
    errors: [],
    summary: { materialCount: 17, estimatedDrawCalls: 24 },
    objects: [{
      source: 'npc_LOD0',
      triangles: 60000,
      materialSlots: 17,
      uvLayers: 1,
      vertexGroups: 42,
      silhouette: { front: 1, side: .5, diag: .8 },
      lods: [
        { level: 1, ratio: .58, triangles: 30000, materialSlots: 17, uvLayers: 1, vertexGroups: 42, silhouette: { front: .96 } },
        { level: 2, ratio: .30, triangles: 15000, materialSlots: 17, uvLayers: 1, vertexGroups: 42, silhouette: { front: .90 } },
      ],
    }],
  };
  const review = evaluateAssetOptimization({ plan, audit, sourceBytes: 10, lodBytes: 8, optimizedBytes: 4 });
  assert.equal(review.gate, 'review');
  assert.equal(review.triangles.lod0, 60000);
  assert.equal(review.materials, 17);
  assert.equal(review.estimatedDrawCalls, 24);
  assert.equal(review.bytes.compressionRatio, .5);
  assert.equal(review.lodQuality.silhouetteGuard, true);
  assert.ok(review.warnings.some(message => message.includes('LOD0 triangles')));
  assert.ok(review.warnings.some(message => message.includes('materials')));
  assert.ok(review.warnings.some(message => message.includes('draw calls')));
  const failed = evaluateAssetOptimization({ plan, audit: { ...audit, errors: ['shape keys require authored LOD'] } });
  assert.equal(failed.gate, 'fail');
  assert.equal(failed.lodQuality.silhouetteGuard, false);
  assert.ok(failed.errors[0].includes('shape keys'));
});

test('runner emits a single machine-readable report and verifies stage artifacts', () => {
  const root = mkdtempSync(join(tmpdir(), 'soul-asset-'));
  const input = join(root, 'tree.glb');
  writeFileSync(input, 'source');
  const plan = buildAssetOptimizationPlan({ input, role: 'prop', outputDir: join(root, 'out') });
  const exec = (_command, args) => {
    if (args[0].endsWith('generate-lods.mjs')) {
      writeFileSync(plan.outputs.lod, 'lod');
      writeFileSync(plan.outputs.audit, JSON.stringify({
        errors: [],
        summary: { materialCount: 3, estimatedDrawCalls: 4 },
        objects: [{ source: 'tree_LOD0', triangles: 5000, materialSlots: 3, lods: [{ level: 1, triangles: 2400 }, { level: 2, triangles: 1000 }] }],
      }));
    } else if (args[0].endsWith('compress-gltf.mjs')) {
      writeFileSync(plan.outputs.optimized, 'optimized');
    }
  };
  const result = runAssetOptimization(plan, { exec });
  assert.equal(result.evaluation.gate, 'pass');
  assert.deepEqual(result.executed, ['lod', 'compress']);
  const report = JSON.parse(readFileSync(plan.outputs.report, 'utf8'));
  assert.equal(report.schema, 'soul-asset-optimization');
  assert.equal(report.plan.role, 'prop');
  assert.equal(report.evaluation.triangles.lod2, 1000);
  assert.equal(report.evaluation.materials, 3);
});
