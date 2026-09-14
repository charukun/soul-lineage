import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validate} from '../src/game/core.js';
import {markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,shouldRunFirstRunAutoplay} from '../src/game/first-run-onboarding.js';

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
