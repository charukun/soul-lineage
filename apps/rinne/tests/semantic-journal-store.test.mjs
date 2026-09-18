import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticShadow } from '../src/coop/semantic-shadow.js';
import { createSemanticJournalStore } from '../src/coop/semantic-journal-store.js';

function life(id='owner',generation=1){
  return {id:`${id}:${generation}`,name:id,seed:7+generation,generation,ended:false,phase:'living',
    birthVillageId:'village-a',homelands:[],lineage:[],ageSeconds:1200,ageYears:20,returns:0,defeats:1,
    equipment:{weapon:'sword',armor:'cloth',shield:false},experiences:{train:{count:1}},knownSkills:['basic.fist']};
}
const checkpoint=(ownerLife=life(),extra={})=>({layout:{id:'village-a'},world:{version:1,worldId:'room',ownerId:'owner',epoch:1,tick:1,
  worldSeconds:1,clockRate:1,players:{owner:{token:'t',portDwell:0,life:structuredClone(ownerLife)}},fronts:{},rebirthOps:{},...extra}});
const receipt=(revision,historySequence)=>({revision,historySequence,root:`r${revision}`,writeId:`w${revision}`});

function fixture({clock=0}={}){
  const rows=new Map(),writes=[];let now=clock;
  const storage={
    read:async key=>rows.has(key)?rows.get(key):null,
    write:async(key,value)=>{writes.push(key);rows.set(key,value);},
  };
  const store=createSemanticJournalStore({storage,exclusive:(_id,fn)=>fn(),now:()=>now,provisionalRpoMs:2000});
  const commits=[],shadow=createSemanticShadow({lifeSeconds:6000,onCommit:value=>commits.push(value)});
  const observe=async(previous,next,authorityReceipt)=>{
    shadow.observe(previous,next,authorityReceipt);
    const commit=commits.shift();assert(commit);return {commit,result:await store.observe(commit)};
  };
  return {rows,writes,store,shadow,observe,setNow:value=>{now=value;}};
}

test('semantic journal bootstraps once while ordinary movement stays out of the journal and provisional state follows its RPO',async()=>{
  const f=fixture(),a=checkpoint();
  let run=await f.observe(null,a,receipt(1,1));
  assert.equal(run.result.wroteSemantic,true);assert.equal(run.result.wroteProvisional,true);
  let saved=await f.store.read('room');
  assert.equal(saved.semantic.semanticSequence,0);assert.equal(saved.semantic.lastSemanticRevision,1);assert.equal(saved.provisional.authorityRevision,1);

  const b=structuredClone(a);b.world.tick=2;b.world.worldSeconds=1.5;b.world.players.owner.life.position={x:8,z:9};
  run=await f.observe(a,b,receipt(2,1));
  assert.equal(run.result.wroteSemantic,true);assert.equal(run.result.wroteProvisional,false);
  saved=await f.store.read('room');
  assert.equal(saved.semantic.semanticSequence,0);assert.equal(saved.semantic.lastSemanticRevision,2);assert.equal(saved.provisional.authorityRevision,1);

  f.setNow(2100);const c=structuredClone(b);c.world.tick=3;c.world.worldSeconds=2;
  run=await f.observe(b,c,receipt(3,1));
  assert.equal(run.result.wroteProvisional,true);
  saved=await f.store.read('room');
  assert.equal(saved.semantic.semanticSequence,0);assert.equal(saved.provisional.authorityRevision,3);
});

test('protected events append exactly once with deterministic IDs and same-revision retries are idempotent',async()=>{
  const f=fixture(),a=checkpoint();await f.observe(null,a,receipt(1,1));
  const sealed=structuredClone(a),lifeRow=sealed.world.players.owner.life;
  lifeRow.ageSeconds=1300;lifeRow.ageYears=1300/60;lifeRow.ended=true;lifeRow.phase='ended';sealed.world.tick=2;sealed.world.worldSeconds=2;
  const {commit,result}=await f.observe(a,sealed,receipt(2,2));
  assert.equal(result.semanticSequence,1);
  const retry=await f.store.observe(commit);assert.equal(retry.wroteSemantic,false);
  const saved=await f.store.read('room');
  assert.equal(saved.semantic.journal.length,1);
  assert.equal(saved.semantic.journal[0].eventId,'room:2:0:life-seal');
  assert.equal(saved.semantic.journal[0].payload.type,'life-seal');

  const changed=structuredClone(commit);changed.events[0].worldTick++;
  await assert.rejects(f.store.observe(changed),/same authority revision changed/);
  const after=await f.store.read('room');assert.equal(after.semantic.journal.length,1);
});

test('recovery overlays protected semantic facts onto an older provisional checkpoint',async()=>{
  const f=fixture(),a=checkpoint();await f.observe(null,a,receipt(1,1));
  const sealed=structuredClone(a),lifeRow=sealed.world.players.owner.life;
  lifeRow.ageSeconds=1300;lifeRow.ageYears=1300/60;lifeRow.ended=true;lifeRow.phase='ended';sealed.world.tick=9;sealed.world.worldSeconds=4.5;
  await f.observe(a,sealed,receipt(2,2));
  const stored=await f.store.read('room');assert.equal(stored.provisional.authorityRevision,1);
  const recovered=await f.store.recover('room');
  assert.equal(recovered.world.players.owner.life.ended,true);
  assert.equal(recovered.world.players.owner.life.phase,'ended');
  assert.equal(recovered.world.tick,9);
  assert.equal(recovered.world.worldSeconds,4.5);
});

test('semantic journal integrity fails closed when persisted event bytes are changed',async()=>{
  const f=fixture(),a=checkpoint();await f.observe(null,a,receipt(1,1));
  const sealed=structuredClone(a),lifeRow=sealed.world.players.owner.life;
  lifeRow.ageSeconds=1300;lifeRow.ageYears=1300/60;lifeRow.ended=true;lifeRow.phase='ended';
  await f.observe(a,sealed,receipt(2,2));
  const key='coop-semantic-v1:room:semantic',tampered=JSON.parse(f.rows.get(key));
  tampered.journal[0].payload.lifeId='tampered';f.rows.set(key,JSON.stringify(tampered));
  await assert.rejects(f.store.read('room'),/invalid semantic record/);
});
