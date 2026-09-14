import test from 'node:test';
import assert from 'node:assert/strict';
import {createPeerHostedWorldNode} from '../src/peer-hosted-world.js';

const checkpoint=worldTimeMs=>({schemaVersion:1,worldTimeMs,world:{value:worldTimeMs},characters:[],npcs:[],randomState:null,session:null});

function network(ids,{leaseMs=90,migrationTimeoutMs=180}={}){
  let time=0;
  const queue=[];
  const applied={};
  const nodes={};
  for(const id of ids){
    nodes[id]=createPeerHostedWorldNode({
      selfId:id,
      worldId:'world-1',
      mayorId:'a',
      hostEligible:true,
      now:()=>time,
      timings:{hostLeaseMs:leaseMs,migrationTimeoutMs},
      emit:event=>queue.push({from:id,...event}),
      applyCheckpoint:value=>{applied[id]=value.world.value;},
    });
  }
  const deliver=(drop=()=>false)=>{
    let guard=0;
    while(queue.length&&guard++<1000){
      const event=queue.shift();
      if(drop(event))continue;
      if(event.to)nodes[event.to]?.receive(event.from,event.message);
      else for(const id of ids)if(id!==event.from)nodes[id].receive(event.from,event.message);
    }
    if(guard>=1000)throw new Error('Network delivery loop did not settle');
  };
  return{
    nodes,
    applied,
    deliver,
    advance(ms){time+=ms;for(const node of Object.values(nodes))node.tick();},
  };
}

test('three peers fail over after host loss with a majority quorum',()=>{
  const net=network(['a','b','c']);
  net.nodes.a.seedHost();
  net.nodes.a.hostAdmit('b',{eligible:true});
  net.nodes.a.hostAdmit('c',{eligible:true});
  net.nodes.a.publishCheckpoint(checkpoint(10));
  net.deliver();
  for(let i=0;i<3;i++){net.advance(30);net.deliver();}
  const isolateHost=event=>event.from==='a'||event.to==='a';
  for(let i=0;i<5;i++){net.advance(30);net.deliver(isolateHost);}
  assert.equal(net.nodes.b.snapshot().phase,'open');
  assert.equal(net.nodes.b.snapshot().hostId,'b');
  assert.equal(net.nodes.c.snapshot().hostId,'b');
  assert.equal(net.nodes.b.snapshot().epoch,2);
  assert.equal(net.applied.b,10);
});

test('two-peer sudden partition fails closed instead of creating split brain',()=>{
  const net=network(['a','b']);
  net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(2));net.deliver();
  for(let i=0;i<3;i++){net.advance(30);net.deliver();}
  const isolate=event=>event.from==='a'||event.to==='a';
  for(let i=0;i<5;i++){net.advance(30);net.deliver(isolate);}
  assert.notEqual(net.nodes.a.snapshot().phase,'open');
  assert.notEqual(net.nodes.b.snapshot().phase,'open');
});

test('two peers can transfer host authority through an explicit graceful grant',()=>{
  const net=network(['a','b']);
  net.nodes.a.seedHost();net.nodes.a.hostAdmit('b',{eligible:true});net.nodes.a.publishCheckpoint(checkpoint(7));net.deliver();
  assert.equal(net.nodes.a.gracefulHandoff(),true);net.deliver();
  assert.equal(net.nodes.b.snapshot().phase,'open');
  assert.equal(net.nodes.b.snapshot().hostId,'b');
  assert.equal(net.applied.b,7);
});

test('non-host-eligible peer votes but is never elected',()=>{
  let time=0;const queue=[];const nodes={};
  for(const [id,eligible] of [['a',true],['b',false],['c',true]])nodes[id]=createPeerHostedWorldNode({selfId:id,worldId:'w',mayorId:'a',hostEligible:eligible,now:()=>time,timings:{hostLeaseMs:60,migrationTimeoutMs:180},emit:event=>queue.push({from:id,...event})});
  nodes.a.seedHost();nodes.a.hostAdmit('b',{eligible:false});nodes.a.hostAdmit('c',{eligible:true});
  const deliver=(drop=()=>false)=>{while(queue.length){const e=queue.shift();if(drop(e))continue;if(e.to)nodes[e.to]?.receive(e.from,e.message);else for(const id of Object.keys(nodes))if(id!==e.from)nodes[id].receive(e.from,e.message);}};
  deliver();for(let i=0;i<3;i++){time+=20;for(const n of Object.values(nodes))n.tick();deliver();}
  const isolate=e=>e.from==='a'||e.to==='a';for(let i=0;i<5;i++){time+=20;for(const n of Object.values(nodes))n.tick();deliver(isolate);}
  assert.equal(nodes.c.snapshot().hostId,'c');
  assert.notEqual(nodes.b.snapshot().hostId,'b');
});
