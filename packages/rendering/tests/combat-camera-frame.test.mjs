import test from 'node:test';
import assert from 'node:assert/strict';
import {combatCameraFrame,combatCameraPosition} from '../src/combat-camera-frame.js';

test('shared combat camera frames duel and group threats for both game styles',()=>{
  const player={x:0,z:0},single=[{id:'a',x:2,z:0}],group=[{id:'a',x:2,z:0},{id:'b',x:-3,z:2},{id:'dead',x:1,z:1,dead:true}];
  const rinneSingle=combatCameraFrame({player,threats:single,style:'rinne'});
  const rinneGroup=combatCameraFrame({player,threats:group,style:'rinne'});
  assert.equal(rinneSingle.count,1);assert.equal(rinneGroup.count,2);assert.ok(rinneGroup.spread>rinneSingle.spread);
  assert.deepEqual(combatCameraPosition(rinneSingle),{x:rinneSingle.look.x+rinneSingle.offset.x,y:rinneSingle.look.y+rinneSingle.offset.y,z:rinneSingle.look.z+rinneSingle.offset.z});
  const demon=combatCameraFrame({player,threats:group,style:'demon',wide:false});
  assert.equal(demon.count,2);assert.ok(demon.camera.y>0);assert.deepEqual(combatCameraPosition(demon),demon.camera);assert.notDeepEqual(combatCameraPosition(rinneGroup),combatCameraPosition(demon));
});

test('shared combat camera ignores unusable threats',()=>{
  assert.equal(combatCameraFrame({player:{x:0,z:0},threats:[],style:'rinne'}),null);
  assert.equal(combatCameraFrame({player:{x:0,z:0},threats:[{x:NaN,z:0}],style:'demon'}),null);
});
