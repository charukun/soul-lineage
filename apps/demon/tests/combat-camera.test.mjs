import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demonCombatCameraFrame,demonCombatCameraThreats} from '../src/web/combat-camera-frame.js';

const installer=await readFile(new URL('../src/combat-camera.js',import.meta.url),'utf8');
const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');

test('Demon combat camera follows only actual active combatants',()=>{
  const player={x:0,z:0},primary={id:'a',x:2,z:0,dead:false},secondary={id:'b',x:-3,z:2,dead:false};
  const game={player,fight:{npc:primary},combatants:[{npc:secondary},{npc:{id:'dead',x:1,z:1,dead:true}}]};
  assert.deepEqual(demonCombatCameraThreats(game).map(n=>n.id),['a','b']);
  const frame=demonCombatCameraFrame(game,{wide:false});assert.equal(frame.count,2);assert.ok(frame.spread>1);assert.equal(frame.look.x,(0+2-3)/3);
});

test('Demon combat camera is inactive outside stance and widens for group combat',()=>{
  assert.equal(demonCombatCameraFrame({player:{x:0,z:0},fight:null}),null);
  const single=demonCombatCameraFrame({player:{x:0,z:0},fight:{npc:{id:'a',x:2,z:0,dead:false}},combatants:[]});
  const multi=demonCombatCameraFrame({player:{x:0,z:0},fight:{npc:{id:'a',x:2,z:0,dead:false}},combatants:[{npc:{id:'b',x:-4,z:3,dead:false}}]});
  assert.ok(multi.spread>single.spread);assert.ok(multi.camera.y>single.camera.y);
});

test('Demon boot installs dedicated combat framing without changing RaidSession combat timing',()=>{
  assert.match(main,/installCombatCamera/);assert.match(main,/disposeCombatCamera=installCombatCamera\(\)/);
  assert.match(installer,/NightView\.prototype\.update/);assert.match(installer,/demonCombatCameraFrame/);assert.match(installer,/dataset\.combatCamera/);
  assert.doesNotMatch(installer,/tick\(|step\(|damage|attack/);
});
