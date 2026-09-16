import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validate} from '../src/game/core.js';
import {consumeFirstRunAutoplayAfterReset,markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,requestFirstRunAutoplayAfterReset,shouldRecoverFirstRunAutoplay,shouldRunFirstRunAutoplay} from '../src/game/first-run-onboarding.js';

function memoryStorage(){
 const values=new Map();
 return{
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key),
 };
}

test('existing unmarked villages never receive the first-run autoplay',()=>{
 const state=initial();
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:false}),false);
});

test('a genuinely fresh village starts the autoplay once',()=>{
 const state=initial();
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),true);
 markFirstRunAutoplaySeen(state);
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),false);
});

test('an interrupted autoplay survives validation and resumes safely',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.onboarding.firstRunAutoplay.started,true);
 assert.equal(restored.onboarding.firstRunAutoplay.seen,false);
 assert.equal(shouldRunFirstRunAutoplay(restored,{freshLoad:false}),true);
});

test('completion is persisted as a one-way first-run handoff',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 markFirstRunAutoplaySeen(state);
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.onboarding.firstRunAutoplay,{version:1,started:false,seen:true});
 assert.equal(shouldRunFirstRunAutoplay(restored,{freshLoad:false}),false);
});

test('title reset replay request survives one reload and is environment scoped',()=>{
 const storage=memoryStorage();
 assert.equal(requestFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('prod',storage),false);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),false);
});

test('title reset replay never takes the interrupted placement recovery shortcut',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),true);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:true,guidePlaced:true}),false);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:false}),false);
 markFirstRunAutoplaySeen(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),false);
});
