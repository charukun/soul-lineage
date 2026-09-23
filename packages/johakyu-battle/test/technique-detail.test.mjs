import test from 'node:test';
import assert from 'node:assert/strict';
import {generatedTechniqueCandidates} from '@soul/game-data';
import {techniqueDetail,techniqueStageText} from '../src/technique.js';

test('shared technique detail owns readable structure and semantic sigils',()=>{
  const basic=techniqueDetail('basic.sword',{weapon:'sword'});
  assert.equal(basic.title,'剣の型');
  assert.match(basic.summary,/^型:/);
  assert.match(basic.summary,/\n動き:/);
  assert.ok(['slash','thrust','receive','break','circle','return'].includes(basic.sigil));
  assert.doesNotMatch(basic.summary,/\b(?:slash|thrust|back|forward|chase|orbitR)\b/);

  const generated=generatedTechniqueCandidates({weapon:'sword'}).find(row=>row.steps.length>=2);
  assert.ok(generated);
  const detail=techniqueDetail(generated.id,{weapon:'sword'});
  assert.match(detail.summary,/^型:/);
  assert.match(detail.summary,/\n動き:/);
  assert.match(detail.summary,/\n弱点:/);
  assert.ok(['slash','thrust','receive','break','circle','return'].includes(detail.sigil));
  assert.doesNotMatch(detail.summary,/\b(?:slash|diagonal|crosscut|back|thrust|forward|sideL|sideR|retreat)\b/);

  assert.equal(techniqueStageText({kind:'unknown-internal',footwork:'unknown-step'}),'足運び・技動作');
});
