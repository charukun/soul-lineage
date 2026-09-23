import test from 'node:test';
import assert from 'node:assert/strict';
import {generatedTechniqueCandidates} from '@soul/game-data';
import {battle2TechniqueCatalog,battle2LearnedTechniqueRows,battle2TechniqueDescription} from '../src/nocturne/battle2-technique-catalog.js';

test('battle2 technique detail uses readable Japanese rather than raw motion ids',()=>{
  const generated=generatedTechniqueCandidates({weapon:'sword'}).find(row=>row.steps.length>=2);
  assert.ok(generated);
  const detail=battle2TechniqueDescription(generated.id,{weapon:'sword'});
  assert.match(detail,/動き:/);
  assert.match(detail,/注意:/);
  assert.doesNotMatch(detail,/\b(?:slash|diagonal|crosscut|back|thrust|forward|sideL|sideR|retreat)\b/);

  const learned=battle2LearnedTechniqueRows([generated.id],{weapon:'sword'});
  assert.equal(learned.length,1);
  assert.equal(learned[0].meta,detail);

  const basic=battle2TechniqueCatalog({weapon:'sword'})[0];
  assert.ok(basic);
  assert.match(basic.meta,/基本動作をつなぐ型/);
  assert.match(basic.meta,/動き:/);
  assert.doesNotMatch(basic.meta,/\b(?:slash|thrust|back|forward|chase|orbitR)\b/);
});
