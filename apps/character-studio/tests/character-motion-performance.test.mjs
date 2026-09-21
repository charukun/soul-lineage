import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {THIRTY_SECOND_ENBU_SEGMENTS,THIRTY_SECOND_SLASH_BEATS,thirtySecondEnbuState,thirtySecondSlashBeat} from '../src/review/motion/performance.js';

test('30-second review plan remains continuous and deterministic',()=>{
  assert.deepEqual(THIRTY_SECOND_SLASH_BEATS,[.28,1.48,2.40,3.32,4.30]);
  assert.equal(THIRTY_SECOND_ENBU_SEGMENTS[0].start,0);
  assert.equal(THIRTY_SECOND_ENBU_SEGMENTS.at(-1).end,6);
  for(let i=0;i<THIRTY_SECOND_ENBU_SEGMENTS.length-1;i++)assert.ok(Math.abs(THIRTY_SECOND_ENBU_SEGMENTS[i].end-THIRTY_SECOND_ENBU_SEGMENTS[i+1].start)<1e-9);
  for(let frame=0;frame<6*120;frame++)assert.ok(thirtySecondEnbuState(frame/120,.66),`uncovered frame ${frame}`);
  const cuts=THIRTY_SECOND_ENBU_SEGMENTS.filter(row=>row.mode==='slash');
  assert.equal(cuts.length,5);
  for(const [index,start] of THIRTY_SECOND_SLASH_BEATS.entries()){
    assert.equal(thirtySecondSlashBeat(start,.66).index,index);
    assert.equal(thirtySecondSlashBeat(start+.659,.66).index,index);
  }
  assert.equal(thirtySecondEnbuState(6,.66),null);
  assert.throws(()=>thirtySecondEnbuState(NaN,.66));
  assert.throws(()=>thirtySecondEnbuState(0,0));
});

test('retired conditional-model motion source fails closed in the independent Character Studio',async()=>{
  const source=await readFile(new URL('../src/review/motion/source.js',import.meta.url),'utf8');
  assert.match(source,/WORKSHOP_MOTION_SOURCE_STATE='retired-conditional-model'/);
  assert.match(source,/Motion QA source retired/);
  assert.match(source,/throw new Error/);
  assert.doesNotMatch(source,/presentationVariant|authored-slash-variants/);
});
