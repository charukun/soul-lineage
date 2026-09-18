import test from 'node:test';
import assert from 'node:assert/strict';
import {COMBAT_ENTER_SECONDS,COMBAT_EXIT_SECONDS,advanceCombatWeight,blendPoint,stepCombatPresentation} from '../src/combat-presentation.js';

test('combat stance enters over a bounded presentation window instead of snapping',()=>{
 let state={weight:0,pose:null};const pose={pitch:.5,twist:-.3,hand:[.7,.8,.2],left:[-.5,1,.1]};
 state=stepCombatPresentation(state,pose,1/60);
 assert.ok(state.weight>0&&state.weight<1);assert.notEqual(state.pose,pose);assert.deepEqual(state.pose.hand,pose.hand);
 const first=blendPoint([.4,1,.1],pose.hand,state.weight);assert.ok(first[0]>.4&&first[0]<pose.hand[0]);
 for(let t=1/60;t<COMBAT_ENTER_SECONDS+.08;t+=1/60)state=stepCombatPresentation(state,pose,1/60);
 assert.equal(state.weight,1);
});

test('combat stance fades out without retaining a stale pose forever',()=>{
 const pose={pitch:.4,hand:[.6,.9,.2]};let state={weight:1,pose};
 state=stepCombatPresentation(state,null,1/60);assert.ok(state.weight>0&&state.weight<1);assert.deepEqual(state.pose,pose);
 for(let t=1/60;t<COMBAT_EXIT_SECONDS+.08;t+=1/60)state=stepCombatPresentation(state,null,1/60);
 assert.equal(state.weight,0);assert.equal(state.pose,null);
});

test('combat blend clamps invalid and long frames',()=>{
 assert.equal(advanceCombatWeight(NaN,true,-1),0);
 const first=advanceCombatWeight(0,true,10);assert.ok(first>0&&first<1);
 assert.equal(advanceCombatWeight(1,false,10),Math.max(0,1-.08/COMBAT_EXIT_SECONDS));
});
