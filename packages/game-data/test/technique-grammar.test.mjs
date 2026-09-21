import test from 'node:test';
import assert from 'node:assert/strict';
import {
  generatedTechniqueById,
  generatedTechniqueCandidates,
  generatedTechniqueCount,
  isGeneratedTechniqueId,
  TECHNIQUE_GRAMMAR_WEAPON_ARTS,
  techniqueGrammarRevision,
} from '../src/index.js';

test('technique grammar v2 expands executable footwork into a large deterministic structural space', () => {
  assert.equal(techniqueGrammarRevision,'technique-grammar-2');
  const weapons=Object.keys(TECHNIQUE_GRAMMAR_WEAPON_ARTS);
  assert.ok(generatedTechniqueCount()>10000);
  for(const weapon of weapons){
    const rows=generatedTechniqueCandidates({weapon});
    assert.ok(rows.length>100, weapon);
    assert.equal(new Set(rows.map(row=>row.id)).size,rows.length);
    assert.ok(rows.every(row=>row.id.startsWith('gen2.')));
    assert.ok(rows.every(row=>row.steps.length>=1&&row.steps.length<=3));
    assert.ok(rows.every(row=>row.name.length>=2&&row.name.length<=7&&!/[・･]/.test(row.name)));
    assert.ok(rows.every(row=>Array.isArray(row.entryBands)&&row.entryBands.length>0));
    assert.ok(rows.every(row=>['neutral','guarded'].includes(row.entryPosture)));
    assert.ok(rows.every(row=>['neutral','guarded','open','committed'].includes(row.exitPosture)));
  }
});

test('footwork variants are real structural alternatives, not cosmetic duplicates', () => {
  const rows=generatedTechniqueCandidates({weapon:'spear'});
  const thrust=rows.filter(row=>row.steps.length===1&&row.steps[0].kind==='thrust');
  assert.ok(thrust.some(row=>row.steps[0].footwork==='forward'));
  assert.ok(thrust.some(row=>row.steps[0].footwork==='chase'));
  assert.equal(new Set(thrust.map(row=>row.id)).size,thrust.length);
  assert.ok(thrust.some(row=>row.name==='突き'));
  assert.ok(thrust.some(row=>row.name==='追突き'));
});

test('guard and ready are executable grammar parts for setup and recovery', () => {
  const rows=generatedTechniqueCandidates({weapon:'sword'});
  assert.ok(rows.some(row=>row.steps.some(step=>step.kind==='guard')));
  assert.ok(rows.some(row=>row.steps.some(step=>step.kind==='ready')));
  assert.ok(rows.some(row=>row.entryPosture==='guarded'||row.exitPosture==='guarded'));
});

test('generated ids reconstruct the identical v2 technique after save/load', () => {
  const row=generatedTechniqueCandidates({weapon:'spear',phase:'ha'})[37];
  assert.ok(row);
  assert.ok(isGeneratedTechniqueId(row.id));
  const restored=generatedTechniqueById(row.id);
  assert.ok(restored);
  assert.equal(restored.id,row.id);
  assert.equal(restored.name,row.name);
  assert.deepEqual(restored.steps,row.steps);
  assert.deepEqual(restored.phases,row.phases);
  assert.deepEqual(restored.entryBands,row.entryBands);
  assert.equal(restored.rangeDelta,row.rangeDelta);
});

test('legacy gen1 ids still reconstruct after grammar v2 migration', () => {
  const legacy=generatedTechniqueById('gen1.spear.thrust-sky');
  assert.ok(legacy);
  assert.equal(legacy.id,'gen1.spear.thrust-sky');
  assert.deepEqual(legacy.steps.map(step=>[step.kind,step.footwork]),[['thrust','forward'],['sky','forward']]);
  assert.ok(isGeneratedTechniqueId(legacy.id));
});

test('phase filtering selects affinities without minting a different identity', () => {
  const all=generatedTechniqueCandidates({weapon:'sword'});
  const ids=new Set(all.map(row=>row.id));
  for(const phase of ['jo','ha','kyu']){
    const rows=generatedTechniqueCandidates({weapon:'sword',phase});
    assert.ok(rows.length>0);
    assert.ok(rows.every(row=>row.phases.includes(phase)&&ids.has(row.id)));
  }
});
