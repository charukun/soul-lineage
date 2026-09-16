import test from 'node:test';
import assert from 'node:assert/strict';
import {rinneCombatCameraFrame} from '../src/rebuild/combat-camera.js';

test('Rinne combat camera ignores inactive combat and frames the active target',()=>{
  const enemies=[{id:'a',x:2,z:0,dead:false},{id:'b',x:12,z:0,dead:false}];
  assert.equal(rinneCombatCameraFrame({player:{x:0,z:0},enemies,targetId:'a',active:false}),null);
  const frame=rinneCombatCameraFrame({player:{x:0,z:0},enemies,targetId:'a',active:true});
  assert.equal(frame.count,1);assert.equal(frame.look.x,1);assert.ok(frame.offset.y<11.5);
});

test('Rinne multi-combat widens around nearby living enemies and excludes dead/far actors',()=>{
  const single=rinneCombatCameraFrame({player:{x:0,z:0},enemies:[{id:'a',x:2,z:0,dead:false}],targetId:'a',active:true});
  const multi=rinneCombatCameraFrame({player:{x:0,z:0},enemies:[{id:'a',x:2,z:0,dead:false},{id:'b',x:-3,z:2,dead:false},{id:'dead',x:1,z:1,dead:true},{id:'far',x:20,z:0,dead:false}],targetId:'a',active:true});
  assert.equal(multi.count,2);assert.ok(multi.spread>single.spread);assert.ok(multi.offset.z>single.offset.z);
});
