import test from 'node:test';
import assert from 'node:assert/strict';
import {generatedTechniqueCandidates} from '@soul/game-data';
import {techniqueDetail,techniqueStageText} from '../src/technique.js';

test('shared technique detail owns readable movement and caution text',()=>{
  const basic=techniqueDetail('basic.sword',{weapon:'sword'});
  assert.equal(basic.title,'剣の型');
  assert.match(basic.summary,/基本動作をつなぐ型/);
  assert.match(basic.summary,/動き:/);
  assert.doesNotMatch(basic.summary,/\b(?:slash|thrust|back|forward|chase|orbitR)\b/);

  const generated=generatedTechniqueCandidates({weapon:'sword'}).find(row=>row.steps.length>=2);
  assert.ok(generated);
  const detail=techniqueDetail(generated.id,{weapon:'sword'});
  assert.match(detail.summary,/動き:/);
  assert.match(detail.summary,/注意:/);
  assert.doesNotMatch(detail.summary,/\b(?:slash|diagonal|crosscut|back|thrust|forward|sideL|sideR|retreat)\b/);

  assert.equal(techniqueStageText({kind:'unknown-internal',footwork:'unknown-step'}),'足運び・技動作');
});
