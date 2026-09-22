import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayGuidance,gameplaySummary} from '../src/story/gameplay-guidance.js';

const frame=(ageYears=8,overrides={})=>({life:{ageYears,worldSeconds:ageYears*60},hero:{dead:false},enemies:[],...overrides});
const state=(overrides={})=>({phase:'living',zone:'village',generation:1,front:0,rescued:0,downedSeconds:0,rescue:null,cleared:false,pendingDiscoveries:[],...overrides});
const guide=(s,f,options={})=>gameplayGuidance({state:s,frame:f,canDepart:false,nextDeparture:20,practice:null,learnedCount:0,equipped:false,...options});

test('birth and childhood keep a single immediate next step',()=>{
  assert.equal(guide(state({phase:'birth'}),frame(0)).stage,'はじまり');
  assert.equal(guide(state(),frame(5)).target,'garden');
});

test('newer Journey practice remains ahead of generic age guidance',()=>{
  const result=guide(state(),frame(5),{practice:{label:'観察',discoveryName:'見切り',placeId:'watch'}});
  assert.equal(result.target,'watch');
  assert.match(result.objective,/見切り/);
});

test('pending discovery and unequipped learned skill keep Journey priorities',()=>{
  assert.equal(guide(state({pendingDiscoveries:['attention']}),frame(10)).stage,'新しい閃き');
  const equip=guide(state(),frame(10),{learnedCount:1,equipped:false});
  assert.equal(equip.stage,'旅支度');
  assert.match(equip.objective,/装備/);
});

test('departure window points to the port after Journey preparation',()=>{
  const result=guide(state(),frame(15),{canDepart:true,learnedCount:1,equipped:true,nextDeparture:15});
  assert.equal(result.target,'port');
  assert.equal(result.stage,'出航の年');
});

test('frontier guidance prioritizes rescue and preserves return-after-clear loop',()=>{
  const waiting=guide(state({zone:'frontier',front:2,cleared:true,rescue:{status:'waiting'}}),frame(20,{enemies:[{dead:true}]}));
  assert.match(waiting.objective,/救助/);
  const carried=guide(state({zone:'frontier',front:2,cleared:true,rescue:{status:'carried'}}),frame(20));
  assert.equal(carried.target,'return');
  const cleared=guide(state({zone:'frontier',front:2,cleared:true,rescue:{status:'safe'}}),frame(20));
  assert.match(cleared.objective,/帰還/);
});

test('frontier combat reports remaining threats and summary exposes run progress',()=>{
  const s=state({zone:'frontier',front:3,rescued:2,rescue:{status:'safe'}});
  const f=frame(20,{enemies:[{dead:false},{dead:true},{dead:false}]});
  assert.match(guide(s,f).objective,/残り2体/);
  assert.equal(gameplaySummary({state:s,frame:f}),'第1生 · 前線 4/6 · 救助 2人');
});

test('downed state wins over every other objective',()=>{
  const result=guide(state({zone:'frontier',downedSeconds:17,rescue:{status:'waiting'}}),frame(20,{hero:{dead:true}}));
  assert.equal(result.stage,'救助待ち');
  assert.match(result.objective,/あと23秒/);
});
