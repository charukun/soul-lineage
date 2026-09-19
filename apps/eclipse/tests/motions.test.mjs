import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveMotion} from '../src/adapters/motions.js';
test('native motion names resolve across ground and flying monster rigs',()=>{
 const ground=new Map(['Idle','Walk','Jump','Bite_Front','Bite_InPlace','Death'].map(n=>[n,{}]));
 const flying=new Map(['Flying','Bite_Front','Death'].map(n=>[n,{}]));
 for(const clips of [ground,flying]) for(const state of ['Idle_Combat','Running_A','Spawn_Ground_Skeletons','1H_Melee_Attack_Chop','Death_A']) assert.ok(clips.has(resolveMotion(false,clips,state)));
});
test('missing animation fails loudly instead of silently leaving a static pose',()=>{
 assert.throws(()=>resolveMotion(true,new Map(),'Idle'),/Missing artist animation/);
 assert.equal(resolveMotion(true,new Map([['Sword_Regular_C',{}]]),'1H_Melee_Attack_Chop'),'Sword_Regular_C');
});
