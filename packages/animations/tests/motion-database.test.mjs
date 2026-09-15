import test from 'node:test';
import assert from 'node:assert/strict';
import {buildMotionDatabase,validateMotionDatabase,queryMotionDatabase,planMotionTransition,transitionBridgePose} from '../src/index.js';

const clips=[
 {id:'idle',state:'idle',duration:1,speed:0,yaw:0,transitions:['idle->move'],semanticEvents:[{name:'handoff',phase:.9}]},
 {id:'walk',state:'move',duration:1,speed:1.1,yaw:0,supportSide:'left',transitions:['idle->move','move->stop','move->pivot','recovery->move'],semanticEvents:[{name:'foot-plant',phase:.5}]},
 {id:'slash',state:'attack',duration:.66,speed:.6,yaw:0,transitions:['move->attack','idle->attack'],semanticEvents:[{name:'contact',phase:.5}]},
 {id:'slash-recovery',state:'recovery',duration:.34,speed:.2,yaw:0,transitions:['attack->recovery','hit->recovery'],semanticEvents:[{name:'handoff',phase:.75}]}
];

test('motion database builds deterministic feature buckets',()=>{
 const a=buildMotionDatabase({clips,revision:'r1'}),b=buildMotionDatabase({clips,revision:'r1'});
 assert.equal(validateMotionDatabase(a),true);assert.deepEqual(a,b);assert.ok(a.records.length>=clips.length*5);
 assert.ok(a.buckets['transition:idle->move'].length>0);assert.ok(a.buckets['event:contact'].length>0);
 assert.equal(a.gameplayAuthority,false);assert.equal(a.contactTimingAuthority,'gameplay-external');
});

test('database query honors transition state and support without gameplay authority',()=>{
 const database=buildMotionDatabase({clips,revision:'r2'}),result=queryMotionDatabase({database,state:'move',transition:'idle->move',speed:1.05,yaw:0,supportSide:'left',trajectory:[{x:0,z:.4}]});
 assert.equal(result.winnerRecord.clipId,'walk');assert.equal(result.gameplayAuthority,false);assert.ok(result.ranked.length>0);
});

test('locomotion transitions may phase-align while attack transitions remain additive bridges',()=>{
 const database=buildMotionDatabase({clips,revision:'r3'});
 const move=planMotionTransition({database,fromState:'idle',toState:'move',speed:1.1,supportSide:'left',trajectory:[{x:0,z:.3}]});
 assert.equal(move.application,'phase-align');assert.equal(move.phaseAlign,true);assert.equal(move.contactTimingLocked,false);
 const attack=planMotionTransition({database,fromState:'move',toState:'attack',speed:.7,supportSide:'left',trajectory:[{x:0,z:.2}]});
 assert.equal(attack.application,'additive-bridge');assert.equal(attack.phaseAlign,false);assert.equal(attack.contactTimingLocked,true);assert.equal(attack.selected.clipId,'slash');
 const bridge=transitionBridgePose(attack,{progress:.5});assert.ok(Math.abs(bridge.chestYaw)<=.1);assert.equal(bridge.contactTimingChanged,false);assert.equal(bridge.gameplayAuthority,false);
});

test('recovery handoff is indexed without changing authored action time',()=>{
 const database=buildMotionDatabase({clips,revision:'r4'}),plan=planMotionTransition({database,fromState:'attack',toState:'recovery',speed:.2,supportSide:'right'});
 assert.equal(plan.selected.clipId,'slash-recovery');assert.equal(plan.contactTimingLocked,true);assert.equal(plan.application,'additive-bridge');
});
