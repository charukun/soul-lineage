import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

test('repository character production manifests and catalog classifications pass', () => {
  const text = execFileSync(process.execPath, ['scripts/check-character-production.mjs'], { encoding: 'utf8' });
  const result = JSON.parse(text);
  assert.equal(result.schema, 'character-production-check');
  assert.equal(result.version, 2);
  assert.equal(result.ok, true, result.failures?.join('\n'));
  const byId = Object.fromEntries(result.manifests.map(row => [row.id, row]));
  assert.equal(byId['shino.reference.v2'].licenseStatus, 'retired');
  assert.equal(byId['shino.reference.v2'].distributionEligible, false);
  assert.equal(byId['protagonist.villager.v1'].licenseStatus, 'blocked-rerig');
  assert.equal(byId['protagonist.villager.v1'].distributionEligible, false);
  assert.equal(byId['arcanist.atlas-dcc.v1'].licenseStatus, 'blocked-rerig');
  assert.equal(byId['arcanist.atlas-dcc.v1'].distributionEligible, false);
  for (const row of Object.values(byId)) assert.equal(row.productionReady, false);
});
