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
  for(let i=0;i<90;i++)controlled.step(1/60);
  assert.ok(controlled.actor('hero').position.x<=1);
  const before=controlled.actor('hero').position.z;
  controlled.setMovement('hero',null);
  for(let i=0;i<30;i++)controlled.step(1/60);
  assert.ok(controlled.actor('hero').position.z>before);
});
