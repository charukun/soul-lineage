import test from 'node:test';
import assert from 'node:assert/strict';
import {appendCheckpoint,applyCatchupPayload,applyCheckpointDelta,checkpointDigest,createCatchupPayload,createCheckpointDelta,createCheckpointJournal} from '../src/checkpoint-sync.js';

const cp=(time,hp=10)=>({schemaVersion:1,worldTimeMs:time,world:{weather:'clear',buildings:[{id:'home',hp}]},characters:[{id:'p1',position:[1,0,2],hp}],npcs:[{id:'n1',position:[3,0,4],mood:time}],randomState:{seed:7},session:null});

test('checkpoint delta round-trips entity and nested changes',()=>{
 const a=cp(10,10),b=cp(20,7);b.npcs.push({id:'n2',position:[5,0,6],mood:2});
 const delta=createCheckpointDelta(a,b,{epoch:1,fromRevision:1,toRevision:2});
 assert.ok(delta.ops.length>0);
 assert.deepEqual(applyCheckpointDelta(a,delta,{epoch:1,revision:1}),b);
 assert.equal(delta.baseDigest,checkpointDigest(a));
 assert.equal(delta.resultDigest,checkpointDigest(b));
});

test('tampered delta fails digest verification',()=>{
 const a=cp(1),b=cp(2),delta=createCheckpointDelta(a,b,{epoch:1,fromRevision:1,toRevision:2});
 delta.resultDigest='00000000';
 assert.throws(()=>applyCheckpointDelta(a,delta,{epoch:1,revision:1}),/result mismatch/);
});

test('known revision inside retained journal receives only contiguous deltas',()=>{
 const a=cp(1),b=cp(2),c=cp(3);
 let journal=createCheckpointJournal({epoch:1,revision:1,checkpoint:a,maxEntries:8,maxBytes:100000});
 journal=appendCheckpoint(journal,{epoch:1,revision:2,checkpoint:b}).journal;
 journal=appendCheckpoint(journal,{epoch:1,revision:3,checkpoint:c}).journal;
 const payload=createCatchupPayload(journal,1,checkpointDigest(a));
 assert.equal(payload.kind,'delta');assert.equal(payload.entries.length,2);
 assert.deepEqual(applyCatchupPayload(a,{revision:1},payload),{checkpoint:c,revision:3});
});

test('same revision with a wrong digest receives full state instead of a no-op',()=>{
 const a=cp(1);const journal=createCheckpointJournal({epoch:1,revision:4,checkpoint:a});
 const payload=createCatchupPayload(journal,4,'00000000');
 assert.equal(payload.kind,'full');assert.equal(payload.revision,4);
 const none=createCatchupPayload(journal,4,checkpointDigest(a));assert.equal(none.kind,'none');
 assert.throws(()=>applyCatchupPayload(cp(99),{revision:4},none),/digest mismatch/);
});

test('compaction makes an old revision fall back to a full checkpoint',()=>{
 const a=cp(1),b=cp(2),c=cp(3);
 let journal=createCheckpointJournal({epoch:1,revision:1,checkpoint:a,maxEntries:2,maxBytes:100000});
 journal=appendCheckpoint(journal,{epoch:1,revision:2,checkpoint:b}).journal;
 journal=appendCheckpoint(journal,{epoch:1,revision:3,checkpoint:c}).journal;
 assert.equal(journal.baseRevision,3);assert.equal(journal.entries.length,0);
 const payload=createCatchupPayload(journal,1,checkpointDigest(a));
 assert.equal(payload.kind,'full');assert.equal(payload.revision,3);assert.deepEqual(payload.checkpoint,c);
});

test('unknown or future revision never guesses a baseline',()=>{
 const a=cp(1);const journal=createCheckpointJournal({epoch:1,revision:4,checkpoint:a});
 const payload=createCatchupPayload(journal,99);
 assert.equal(payload.kind,'full');
 assert.throws(()=>applyCatchupPayload(cp(0),{revision:3},{...payload,kind:'delta',baseRevision:3,entries:[]}),/base mismatch|result mismatch/);
});


test('checkpoint deltas preserve entity order and fall back for duplicate identifiers',()=>{
 const a=cp(1);a.characters=[{id:'first',hp:10},{id:'second',hp:9}];
 for(const characters of [
  [a.characters[1],a.characters[0]],
  [{id:'new',hp:8},...a.characters],
  [a.characters[1],{id:'middle',hp:8},a.characters[0]],
  [{id:'first',hp:8},{id:'first',hp:7}],
 ]){
  const b={...a,characters};
  const delta=createCheckpointDelta(a,b,{epoch:1,fromRevision:1,toRevision:2});
  assert.deepEqual(applyCheckpointDelta(a,delta),b);
 }
});

test('untrusted checkpoint paths cannot mutate inherited prototypes',()=>{
 const base=cp(1),key='rinneCheckpointPollution';
 const entry={version:1,epoch:1,fromRevision:1,toRevision:2,baseDigest:checkpointDigest(base),resultDigest:checkpointDigest(base)};
 try{
  for(const path of [['__proto__',key],['constructor','prototype',key]]){
   assert.throws(()=>applyCheckpointDelta(base,{...entry,ops:[{op:'set',path,value:true}]}),/own property/);
   assert.equal(Object.hasOwn(Object.prototype,key),false);
  }
 }finally{delete Object.prototype[key];}
});

test('nested merge patches preserve own keys without changing prototypes',()=>{
 const a=cp(1),b=cp(1);b.characters[0].metadata=JSON.parse('{"__proto__":{"safeData":true},"constructor":{"label":"data"}}');
 const delta=createCheckpointDelta(a,b,{epoch:1,fromRevision:1,toRevision:2});
 const restored=applyCheckpointDelta(a,delta);
 assert.deepEqual(restored,b);
 assert.equal(Object.hasOwn(Object.prototype,'safeData'),false);
});
