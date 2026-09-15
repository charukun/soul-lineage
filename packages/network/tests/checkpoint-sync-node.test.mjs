import test from 'node:test';
import assert from 'node:assert/strict';
import {createCheckpointSyncedWorldNode} from '../src/checkpoint-sync-node.js';

const checkpoint=(time,hp=10)=>({schemaVersion:1,worldTimeMs:time,world:{value:time,buildings:[{id:'home',hp}]},characters:[{id:'hero',position:[0,0,0],hp}],npcs:[{id:'n1',position:[1,0,1],mood:time}],randomState:null,session:null});

function network(ids,{leaseMs=90,migrationTimeoutMs=220}={}){
 let time=0;const queue=[],applied={},nodes={};
 for(const id of ids)nodes[id]=createCheckpointSyncedWorldNode({selfId:id,worldId:'world-sync',mayorId:'a',hostEligible:true,now:()=>time,timings:{hostLeaseMs:leaseMs,migrationTimeoutMs},emit:event=>queue.push({from:id,...event}),applyCheckpoint:value=>{applied[id]=value.world.value;}});
 const deliver=(drop=()=>false)=>{let guard=0;while(queue.length&&guard++<2000){const e=queue.shift();if(drop(e))continue;if(e.to)nodes[e.to]?.receive(e.from,e.message);else for(const id of ids)if(id!==e.from)nodes[id].receive(e.from,e.message);}if(guard>=2000)throw new Error('delivery loop did not settle');};
 return{nodes,queue,applied,deliver,advance(ms){time+=ms;for(const node of Object.values(nodes))node.tick();}};
}

test('after the initial full checkpoint, normal publishes travel as deltas',()=>{
 const net=network(['a','b']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();
 net.nodes.a.publishCheckpoint(checkpoint(2,9));
 assert.equal(net.queue.some(e=>e.message.type==='world-checkpoint-delta'),true);
 assert.equal(net.queue.some(e=>e.message.type==='world-checkpoint'&&e.message.revision===2),false);
 net.deliver();
 const snap=net.nodes.b.snapshot();assert.equal(snap.checkpointRevision,2);assert.equal(snap.checkpointSync.latestRevision,2);assert.equal(snap.checkpointSync.appliedDeltas,1);
});

test('a missed delta triggers revision catch-up instead of guessing state',()=>{
 const net=network(['a','b']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();
 net.nodes.a.publishCheckpoint(checkpoint(2));net.deliver(e=>e.from==='a'&&e.to===null&&e.message.type==='world-checkpoint-delta');
 assert.equal(net.nodes.b.snapshot().checkpointSync.latestRevision,1);
 net.nodes.a.publishCheckpoint(checkpoint(3,8));
 net.deliver();
 const snap=net.nodes.b.snapshot();assert.equal(snap.checkpointSync.latestRevision,3);assert.equal(snap.checkpointRevision,3);
 assert.ok(net.nodes.a.snapshot().checkpointSync.catchupRequests>=1);
 assert.equal(snap.checkpointSync.digestFailures,0);
});

test('catch-up from a retained known revision uses delta payload',()=>{
 const net=network(['a','b']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();
 net.nodes.a.publishCheckpoint(checkpoint(2));net.deliver();net.nodes.a.publishCheckpoint(checkpoint(3));net.deliver();
 const payload=net.nodes.a.catchupPayload(1);assert.equal(payload.kind,'delta');assert.equal(payload.revision,3);assert.equal(payload.entries.length,2);
});

test('three peers still migrate safely after a delta checkpoint history',()=>{
 const net=network(['a','b','c']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.hostAdmit('c',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();net.nodes.a.publishCheckpoint(checkpoint(2));net.deliver();net.nodes.a.publishCheckpoint(checkpoint(3,6));net.deliver();
 for(let i=0;i<3;i++){net.advance(30);net.deliver();}
 const isolate=e=>e.from==='a'||e.to==='a';for(let i=0;i<5;i++){net.advance(30);net.deliver(isolate);}
 assert.equal(net.nodes.b.snapshot().phase,'open');assert.equal(net.nodes.b.snapshot().hostId,'b');assert.equal(net.nodes.c.snapshot().hostId,'b');assert.equal(net.applied.b,3);
 assert.equal(net.nodes.b.snapshot().checkpointSync.latestRevision,3);
});


test('checkpoint catch-up rejects outsiders, wrong worlds and closed nodes',()=>{
 const net=network(['a','b']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();
 const message={type:'world-sync-request',worldId:'world-sync',knownRevision:0};
 assert.equal(net.nodes.a.receive('outsider',message),false);
 assert.equal(net.nodes.a.receive('b',{...message,worldId:'other-world'}),false);
 assert.equal(net.nodes.a.syncPeer('outsider'),false);
 assert.equal(net.queue.length,0);
 net.nodes.a.close();
 assert.equal(net.nodes.a.receive('b',message),false);
 assert.equal(net.nodes.a.syncPeer('b'),false);
 assert.equal(net.queue.length,0);
});

test('mismatched checkpoint epochs cannot change the retained journal',()=>{
 const net=network(['a','b']);net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(1));net.deliver();
 net.nodes.a.publishCheckpoint(checkpoint(2));
 const delta=net.queue.find(event=>event.message.type==='world-checkpoint-delta').message;
 const before=net.nodes.b.snapshot().checkpointSync;
 assert.equal(net.nodes.b.receive('a',{...delta,epoch:delta.epoch+1}),false);
 const payload=net.nodes.a.catchupPayload(0);
 assert.equal(net.nodes.b.receive('a',{type:'world-checkpoint-catchup',worldId:'world-sync',hostId:'a',epoch:1,payload:{...payload,epoch:2}}),false);
 assert.deepEqual(net.nodes.b.snapshot().checkpointSync,before);
 net.deliver();assert.equal(net.nodes.b.snapshot().checkpointRevision,2);
});
