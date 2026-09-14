import test from 'node:test';
import assert from 'node:assert/strict';
import {createPresenceScheduler,encodePresenceState,observerPresenceSnapshot,presencePolicy} from '../src/presence-lod.js';

test('presence LOD strips fields and rate with distance',()=>{
 const near=presencePolicy(5),far=presencePolicy(110);assert.equal(near.hz,20);assert.equal(far.hz,.5);
 const state={x:1.234,z:5.678,yaw:.123,state:'walk',hp:90,action:'slash',secret:'x'};
 assert.deepEqual(Object.keys(encodePresenceState(state,far)).sort(),['x','z']);
 assert.ok(!('secret' in encodePresenceState(state,near)));
});

test('presence scheduler enforces per-policy cadence',()=>{
 let t=0;const scheduler=createPresenceScheduler({now:()=>t}),policy=presencePolicy(40);
 assert.equal(scheduler.due('p',policy),true);t+=20;assert.equal(scheduler.due('p',policy),false);t+=200;assert.equal(scheduler.due('p',policy),true);
});

test('observer snapshot removes dormant peers and preserves observer detail',()=>{
 const players={me:{x:0,z:0,state:'idle',hp:100},near:{x:10,z:0,state:'walk',hp:90},gone:{x:400,z:0,state:'idle',hp:90}};
 const snapshot=observerPresenceSnapshot({id:'me',x:0,z:0},players);
 assert.ok(snapshot.me);assert.ok(snapshot.near);assert.equal(snapshot.gone,undefined);assert.equal(snapshot.me._presence.tier,'near');
});
