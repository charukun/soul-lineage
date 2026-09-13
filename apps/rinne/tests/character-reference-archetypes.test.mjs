import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { CHARACTER_REFERENCE_ARCHETYPES } from '../../../packages/characters/src/index.js';
import { createReviewCohort, reviewSettings } from '../src/character-review-state.js';
import { qualityIdentity, qualityReport, qualitySettings } from '../src/character-quality-state.js';

test('targeted quality mode generates the selected reference archetype without a Shino baseline slot', () => {
  const quality = qualitySettings({ archetype: 'npc.guard.v1', reference: true });
  assert.equal(quality.reference, false);
  const records = createReviewCohort(reviewSettings({ seed: 1300, count: 6, ages: 'fixed', age: 23 }));
  const identity = qualityIdentity(records[0], 0, quality);
  assert.equal(identity.referenceArchetypeId, 'npc.guard.v1');
  assert.equal(identity.role, 'guard');
  assert.equal(identity.parts.body, 'sturdy');
  assert.equal(identity.gear, 'armor');
  const report = qualityReport(records.slice(0, 6), quality);
  assert.equal(report.count, 6);
  assert.equal(report.referenceCount, 0);
  assert.equal(report.target.id, 'npc.guard.v1');
  assert.ok(report.target.coverage.implementedModularParts.includes('role-gear:armor'));
});

test('all ten concept previews are published as Rinne-local review assets', async () => {
  const rows = Object.values(CHARACTER_REFERENCE_ARCHETYPES);
  assert.equal(rows.length, 10);
  await Promise.all(rows.map(row => access(new URL(`../public/reference/npc-role-set/${row.assetFile}`, import.meta.url))));
});

test('Workshop reference module keeps implementation/proposal/equipment boundaries visible', async () => {
  const source = await readFile(new URL('../src/character-reference-workshop.js', import.meta.url), 'utf8');
  for (const marker of ['IMPLEMENTED MODULAR PARTS', 'PROPOSED PARTS', 'GAME EQUIPMENT', 'selectArchetype']) assert.match(source, new RegExp(marker));
  assert.match(source, /CONCEPT TARGET \/ NOT IMPLEMENTED/);
});
