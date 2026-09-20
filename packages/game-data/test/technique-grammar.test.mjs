import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatedTechniqueById,
  generatedTechniqueCandidates,
  generatedTechniqueCount,
  isGeneratedTechniqueId,
  TECHNIQUE_GRAMMAR_WEAPON_ARTS,
} from '../src/index.js';

test('technique grammar expands authored motion parts into a large deterministic structural space', () => {
  const weapons=Object.keys(TECHNIQUE_GRAMMAR_WEAPON_ARTS);
  assert.ok(weapons.includes('spear'));
  assert.ok(weapons.includes('dagger'));
  assert.ok(weapons.includes('staff'));
  assert.ok(generatedTechniqueCount()>1000);
  for(const weapon of weapons){
    const rows=generatedTechniqueCandidates({weapon});
    assert.ok(rows.length>40, weapon);
    assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
    assert.ok(rows.every(row=>row.weapons[0]===weapon));
    assert.ok(rows.every(row=>row.steps.length>=1&&row.steps.length<=3));
    assert.ok(rows.every(row=>row.name.length>=2&&row.name.length<=7&&!/[・･]/.test(row.name)));
  }
});

test('generated ids reconstruct the identical technique after save/load', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'})[17];
  assert.ok(row);
  assert.ok(isGeneratedTechniqueId(row.id));
  const restored=generatedTechniqueById(row.id);
  assert.ok(restored);
  assert.equal(restored.id,row.id);
  assert.equal(restored.name,row.name);
  assert.deepEqual(restored.steps,row.steps);
  assert.deepEqual(restored.phases,row.phases);
  assert.deepEqual(restored.questions,row.questions);
});

test('phase filtering selects affinities without minting a different identity', () => {
  for(const phase of ['jo','ha','kyu']){
    const rows=generatedTechniqueCandidates({weapon:'sword',phase});
    assert.ok(rows.length>0);
    assert.ok(rows.every(row=>row.phases.includes(phase)));
  }
  const all=generatedTechniqueCandidates({weapon:'sword'});
  const ids=new Set(all.map(row=>row.id));
  for(const phase of ['jo','ha','kyu'])for(const row of generatedTechniqueCandidates({weapon:'sword',phase}))assert.ok(ids.has(row.id));
});
