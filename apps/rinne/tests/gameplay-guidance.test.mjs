import test from 'node:test';
import assert from 'node:assert/strict';
import {gameplayGuidance,gameplaySummary} from '../src/story/gameplay-guidance.js';

const frame=(ageYears=8,overrides={})=>({
  life:{ageYears,worldSeconds:ageYears*60},
  hero:{dead:false},
  enemies:[],
  ...overrides,
});
const state=(overrides={})=>({
  phase:'living',zone:'village',generation:1,front:0,rescued:0,downedSeconds:0,rescue:null,cleared:false,pendingDiscoveries:[],...overrides,
});
const guide=(s,f,canDepart=false,nextDeparture=20)=>gameplayGuidance({state:s,frame:f,canDepart,nextDeparture});

test('birth and childhood produce a single immediate next step',()=>{
  assert.equal(guide(state({phase:'birth'}),frame(0)).stage,'はじまり');
  assert.equal(guide(state(),frame(5)).target,'garden');
  assert.match(guide(state(),frame(5)).objective,/焚き火/);
});

test('a pending discovery takes priority over generic village progression',()=>{
  const result=guide(state({pendingDiscoveries:['attention']}),frame(10));
  assert.equal(result.stage,'新しい閃き');
  assert.match(result.objective,/受け取/);
});

test('departure window points the player to the port',()=>{
  const result=guide(state(),frame(15),true,15);
  assert.equal(result.target,'port');
  assert.equal(result.stage,'出航の年');
});

test('frontier guidance prioritizes rescue before advance even after enemies fall',()=>{
  const waiting=guide(state({zone:'frontier',front:2,cleared:true,rescue:{status:'waiting'}}),frame(20,{enemies:[{dead:true}]}));
  assert.match(waiting.objective,/救助/);
  const carried=guide(state({zone:'frontier',front:2,cleared:true,rescue:{status:'carried'}}),frame(20));
  assert.match(carried.objective,/救護所/);
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
