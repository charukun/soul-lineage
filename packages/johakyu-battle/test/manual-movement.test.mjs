import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuBattleRuntime} from '../src/index.js';

const actor=(id,side,z)=>({id,side,self:side==='party',hp:125,maxHp:125,stamina:100,staminaCap:100,position:{x:0,z},equipment:{weapon:'sword',armor:'cloth',shield:false},loadout:{jo:'basic.sword',ha:'basic.sword',kyu:'basic.sword'},readyDelay:10});

test('manual input moves the canonical hero, respects bounds, and releases to automatic footwork',()=>{
  const make=()=>createJohakyuBattleRuntime({battleId:'movement',actors:[actor('hero','party',0),actor('enemy','enemy',3)],bounds:{minX:-1,maxX:1,minZ:-1,maxZ:4}});
  const controlled=make(),automatic=make();
  assert.equal(controlled.setMovement('hero',{x:1,z:0}),true);
  for(let i=0;i<20;i++){controlled.step(1/60);automatic.step(1/60);}
  assert.ok(controlled.actor('hero').position.x>.3);
  assert.ok(automatic.actor('hero').position.x<.01);
  const beforeRelease=controlled.actor('hero').position.x;
  assert.equal(controlled.setMovement('hero',null),true);
  controlled.step(1/60);
  assert.ok(controlled.actor('hero').position.x<=beforeRelease+.002);
  controlled.setMovement('hero',{x:1,z:0});
  for(let i=0;i<90;i++)controlled.step(1/60);
  assert.ok(controlled.actor('hero').position.x<=1);
});

test('manual walk uses the shared Bloodline speed and combat-ready range has hysteresis',()=>{
  const runtime=createJohakyuBattleRuntime({battleId:'movement-contract',actors:[actor('hero','party',0),actor('enemy','enemy',8)],bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}});
  runtime.setMovement('hero',{x:1,z:0});runtime.step(1/60);
  assert.ok(Math.abs(runtime.actor('hero').position.x-3.8/60)<1e-6);
  runtime.setMovement('hero',null);const enemy=runtime.actor('enemy');
  enemy.position={x:0,z:2.05};runtime.step(1/240);assert.equal(runtime.snapshot().actors.find(a=>a.id==='hero').combatReady,true);
  enemy.position={x:0,z:2.55};runtime.step(1/240);assert.equal(runtime.snapshot().actors.find(a=>a.id==='hero').combatReady,true);
  enemy.position={x:0,z:2.75};runtime.step(1/240);assert.equal(runtime.snapshot().actors.find(a=>a.id==='hero').combatReady,false);
});
