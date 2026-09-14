import test from 'node:test';
import assert from 'node:assert/strict';
import {createSpatialIndex} from '../src/spatial-index.js';
import {createFlowFieldRouter} from '../src/flow-field.js';
import {createFixedStepScheduler,createEntityCadenceScheduler,simulationTierForDistance} from '../src/simulation-scheduler.js';
import {createIncrementalPatch,applyIncrementalPatch,appendJournalEntry,replayJournal,shouldCompactJournal} from '../src/incremental-journal.js';

test('spatial index finds nearby entities without scanning unrelated cells',()=>{
 const index=createSpatialIndex({cellSize:10});index.beginFrame();index.upsert('a',0,0,{tag:'npc'});index.upsert('b',12,0,{tag:'npc'});index.upsert('c',80,0,{tag:'npc'});index.endFrame();const out=[];index.queryRadiusInto(out,0,0,15,{tag:'npc'});assert.deepEqual(out.map(x=>x.id).sort(),['a','b']);assert.equal(index.nearest(11,0,{radius:20,tag:'npc'}).id,'b');
});

test('spatial frame sweep drops stale records and reuses caller output array',()=>{
 const index=createSpatialIndex({cellSize:8}),out=[];index.beginFrame();index.upsert('a',0,0);index.upsert('b',2,0);index.endFrame();index.queryRadiusInto(out,0,0,10);assert.equal(out.length,2);index.beginFrame();index.upsert('a',1,0);index.endFrame();index.queryRadiusInto(out,0,0,10);assert.deepEqual(out.map(x=>x.id),['a']);
});

test('flow field shares one destination build across multiple routes',()=>{
 const router=createFlowFieldRouter({worldStep:1,maxFields:4,maxCells:400,radiusCells:20}),blocked=(x,z)=>x===2&&z!==3;const a=router.route({from:{x:0,z:0},to:{x:5,z:0},revision:1,isBlocked:blocked}),b=router.route({from:{x:0,z:1},to:{x:5,z:0},revision:1,isBlocked:blocked});assert.ok(a?.length);assert.ok(b?.length);assert.equal(router.snapshot().builds,1);assert.equal(router.snapshot().hits,1);
});

test('flow field fails open with null when goal is blocked',()=>{
 const router=createFlowFieldRouter({worldStep:1});assert.equal(router.route({from:{x:0,z:0},to:{x:2,z:0},revision:1,isBlocked:(x,z)=>x===2&&z===0}),null);assert.equal(router.snapshot().fallbacks,1);
});

test('fixed simulation catches up in bounded 30 Hz steps and distance cadence accumulates time',()=>{
 const fixed=createFixedStepScheduler({step:1/30,maxCatchUpSteps:4}),steps=[];assert.equal(fixed.advance(.2,dt=>steps.push(dt)),4);assert.equal(steps.length,4);assert.ok(fixed.snapshot().droppedSeconds>0);
 const cadence=createEntityCadenceScheduler();let decision;for(let i=0;i<30;i++)decision=cadence.consume('far',1/30,80);assert.equal(simulationTierForDistance(80),'far');assert.equal(decision.due,true);assert.ok(decision.delta>.2);assert.equal(simulationTierForDistance(500,{important:true}),'near');
});

test('incremental journal patches id arrays without replacing unrelated entities',()=>{
 const before={clock:1,people:[{id:'a',hp:10,x:0},{id:'b',hp:20,x:2}],objects:[{id:'h',level:1}]};const after={clock:2,people:[{id:'a',hp:7,x:0},{id:'b',hp:20,x:2},{id:'c',hp:30,x:4}],objects:[{id:'h',level:2}]};const ops=createIncrementalPatch(before,after),applied=applyIncrementalPatch(before,ops);assert.deepEqual(applied,after);assert.ok(ops.some(op=>op.op==='entity-patch'));assert.ok(ops.some(op=>op.op==='entity-set'));
 const journal=appendJournalEntry({version:1,baseRevision:4,entries:[]},{revision:5,updatedAt:1,ops});const replayed=replayJournal(before,journal,{baseRevision:4});assert.equal(replayed.revision,5);assert.deepEqual(replayed.payload,after);
});

test('journal rejects revision gaps and requests compaction at bounded entry count',()=>{
 assert.throws(()=>replayJournal({}, {version:1,baseRevision:1,entries:[{revision:3,ops:[]}]},{baseRevision:1}),/revision gap/);const journal={version:1,baseRevision:0,entries:Array.from({length:24},(_,i)=>({revision:i+1,ops:[]}))};assert.equal(shouldCompactJournal(journal),true);
});
