import test from 'node:test';
import assert from 'node:assert/strict';
import {abilityNudge,firstHuntDirectorState} from '../src/web/first-hunt-director.js';

const snapshot=(overrides={})=>({
 mode:'hunt',finished:false,eaten:0,devouring:false,combat:null,
 player:{x:0,z:20},
 profile:{visits:{},unlocked:[]},
 npcs:[
  {id:'a',role:'traveller',x:1,z:15,dead:false,eaten:false},
  {id:'b',role:'bellkeeper',x:-3,z:8,dead:false,eaten:false},
  {id:'c',role:'smith',x:3,z:7,dead:false,eaten:false}
 ],
 ...overrides
});

test('first hunt points straight at the nearest prey',()=>{
 const state=firstHuntDirectorState(snapshot());
 assert.equal(state.active,true);
 assert.equal(state.stage,'approach');
 assert.equal(state.preyId,'a');
 assert.match(state.objective,/旅人/);
 assert.match(state.objective,/命の余熱/);
});

test('combat and devour suppress choice clutter',()=>{
 assert.equal(firstHuntDirectorState(snapshot({combat:{}})).stage,'combat');
 assert.deepEqual(firstHuntDirectorState(snapshot({combat:{}})).choices,[]);
 assert.equal(firstHuntDirectorState(snapshot({devouring:true})).stage,'devour');
});

test('after first devour the player gets two distinct meaningful prey choices',()=>{
 const s=snapshot({
  eaten:1,
  player:{x:1,z:15},
  profile:{visits:{},unlocked:['traveller']},
  npcs:[
   {id:'a',role:'traveller',x:1,z:15,dead:true,eaten:true},
   {id:'b',role:'bellkeeper',x:-3,z:8,dead:false,eaten:false},
   {id:'c',role:'smith',x:3,z:7,dead:false,eaten:false},
   {id:'d',role:'bellkeeper',x:4,z:6,dead:false,eaten:false}
  ]
 });
 const state=firstHuntDirectorState(s);
 assert.equal(state.stage,'choice');
 assert.equal(state.choices.length,2);
 assert.notEqual(state.choices[0].role,state.choices[1].role);
 assert.ok(state.choices.every(row=>row.power&&row.distance>0&&row.direction));
 assert.match(state.guide,/次の捕食/);
});

test('retry guidance follows the prey eaten in this hunt, not old unlock order',()=>{
 const s=snapshot({
  eaten:1,
  profile:{visits:{old:{status:'defeated',eaten:2}},unlocked:['traveller','smith']},
  npcs:[
   {id:'a',role:'traveller',x:1,z:15,dead:true,eaten:true},
   {id:'b',role:'bellkeeper',x:-3,z:8,dead:false,eaten:false},
   {id:'c',role:'smith',x:3,z:7,dead:false,eaten:false}
  ]
 });
 assert.match(firstHuntDirectorState(s).guide,/次の捕食/);
});

test('ability nudges point at an immediate gameplay use',()=>{
 assert.match(abilityNudge('traveller'),/次の捕食/);
 assert.match(abilityNudge('smith'),/木柵/);
 assert.match(abilityNudge('arcanist'),/素早く弾/);
});

test('director stops after a successful hunt',()=>{
 const state=firstHuntDirectorState(snapshot({profile:{visits:{one:{status:'escaped',eaten:1}},unlocked:['traveller']}}));
 assert.equal(state.active,false);
});

test('two devours hand control back to the player instead of forcing menus',()=>{
 const state=firstHuntDirectorState(snapshot({eaten:2,profile:{visits:{},unlocked:['traveller','smith']}}));
 assert.equal(state.stage,'free');
 assert.match(state.guide,/追うか|持ち帰る/);
});
