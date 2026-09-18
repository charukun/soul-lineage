import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticShadow, deriveSemanticShadowActions, recoverCheckpointWithSemanticShadow, validateSemanticShadowRestore } from '../src/coop/semantic-shadow.js';
import { createCheckpointWriter } from '../src/coop/checkpoint-writer.js';
import { createCoopPerformanceProbe } from '../src/coop/performance.js';

const record=life=>({generation:life.generation,name:life.name,age:Math.floor(life.ageYears),birthVillageId:life.birthVillageId,
  returnedHome:life.returns>0,memento:null,defeats:life.defeats,equipment:structuredClone(life.equipment),
  experiences:structuredClone(life.experiences),skills:[...life.knownSkills]});
function life(id='owner',generation=1){
  return {id:`${id}:${generation}`,name:id,seed:7+generation,generation,ended:false,phase:'living',
    birthVillageId:'village-a',homelands:[],lineage:[],ageSeconds:1200,ageYears:20,returns:0,defeats:1,
    equipment:{weapon:'sword',armor:'cloth',shield:false},experiences:{train:{count:1}},knownSkills:['basic.fist']};
}
const checkpoint=(ownerLife=life(),extra={})=>({layout:{id:'village-a'},world:{version:1,worldId:'room',ownerId:'owner',epoch:1,tick:1,
  worldSeconds:1,clockRate:1,players:{owner:{token:'t',portDwell:0,life:structuredClone(ownerLife)}},fronts:{},rebirthOps:{},...extra}});
const receipt=(revision,historySequence)=>({revision,historySequence,root:`r${revision}`,writeId:`w${revision}`});

test('shadow warms from the first durable checkpoint without pretending to audit the past',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000});
  assert.equal(shadow.observe(null,checkpoint(),receipt(1,1)).status,'tracking');
  const snap=shadow.snapshot();assert.equal(snap.status,'tracking');assert.equal(snap.commits,1);assert.equal(snap.lastHistorySequence,1);assert.equal(snap.journalLength,0);assert.equal(snap.epoch,1);assert.equal(snap.playerCount,1);assert.equal(snap.error,null);assert(snap.checkpointBytesTotal>0);assert.equal(snap.journalBytesTotal,0);
});

test('replaceable movement, HP and provisional reward inputs do not enter the journal',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a);b.world.tick++;b.world.players.owner.life.position={x:8,z:9};b.world.players.owner.life.hp=2;
  b.world.players.owner.life.returns=1;b.world.players.owner.life.homelands=['village-a'];b.world.players.owner.life.defeats=9;
  shadow.observe(a,b,receipt(2,1));
  assert.deepEqual(shadow.snapshot().journalTypes,[]);
});

test('life seal captures terminal protected inputs and requires one history effect',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a),l=b.world.players.owner.life;l.ageSeconds=6000;l.ageYears=100;l.ended=true;l.phase='ended';
  l.returns=1;l.homelands=['village-a'];l.defeats=9;l.equipment.weapon='great';
  shadow.observe(a,b,receipt(2,2));
  assert.deepEqual(shadow.snapshot().journalTypes,['life-seal']);
});

test('rebirth and epoch acquire extend the shadow without protecting replaceable fields',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint(),sealed=structuredClone(a),old=sealed.world.players.owner.life;
  shadow.observe(null,a,receipt(1,1));old.ageSeconds=6000;old.ageYears=100;old.ended=true;old.phase='ended';
  shadow.observe(a,sealed,receipt(2,2));
  const born=life('owner',2);born.lineage=[record(old)];born.homelands=[...old.homelands];
  const b=structuredClone(sealed);b.world.players.owner.life=born;b.world.rebirthOps[old.id]={playerId:'owner',lifeId:old.id,villageId:null,resultId:born.id};
  shadow.observe(sealed,b,receipt(3,3));
  const c=structuredClone(b);c.world.epoch=2;c.world.tick++;
  shadow.observe(b,c,receipt(4,3));
  assert.deepEqual(shadow.snapshot().journalTypes,['life-seal','rebirth','epoch-acquire']);
  assert.equal(shadow.snapshot().epoch,2);
});

test('a newly persisted guest becomes one birth effect',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a);b.world.players.guest={token:'g',portDwell:0,life:life('guest',1)};b.world.players.guest.life.lineage=[];
  shadow.observe(a,b,receipt(2,2));
  assert.deepEqual(shadow.snapshot().journalTypes,['birth']);
});

test('same-life lineage rewrite is a hard candidate divergence',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a);b.world.players.owner.life.lineage.push({generation:0});
  assert.throws(()=>shadow.observe(a,b,receipt(2,1)),/protected life identity changed/);
  assert.equal(shadow.snapshot().status,'diverged');
});

test('history count mismatch exposes extractor/current-history disagreement',()=>{
  const shadow=createSemanticShadow({lifeSeconds:6000}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a);b.world.players.guest={token:'g',portDwell:0,life:life('guest')};
  assert.throws(()=>shadow.observe(a,b,receipt(2,1)),/history sequence/);
});

test('source-shaped derivation accepts combat-ended lives as protected seals',()=>{
  const a=checkpoint(),b=structuredClone(a);b.world.players.owner.life.ended=true;b.world.players.owner.life.phase='ended';b.world.players.owner.life.ageSeconds=1300;b.world.players.owner.life.ageYears=1300/60;
  const actions=deriveSemanticShadowActions(a,b,{lifeSeconds:6000});assert.equal(actions.length,1);assert.equal(actions[0].type,'life-seal');
});

test('checkpoint writer records shadow divergence without turning a successful save into gameplay failure',async()=>{
  let tick=0;
  const world={dirtyHistory:false,data:{players:{}},save:()=>({world:{tick:++tick}})};
  const observer={observe(){throw Error('candidate mismatch');},snapshot:()=>({status:'diverged'})};
  const writer=createCheckpointWriter({world,now:()=>0,save:async()=>({historySequence:0}),semanticObserver:observer});
  await writer.request();
  assert.equal(writer.failure,null);
  assert.match(writer.semanticError.message,/candidate mismatch/);
  assert.deepEqual(writer.semanticShadow,{status:'diverged'});
});


test('shadow byte samples feed the existing performance capture namespace without changing authority',()=>{
  const probe=createCoopPerformanceProbe({now:()=>0}),shadow=createSemanticShadow({lifeSeconds:6000,onSample:sample=>probe.recordSemanticCommit(sample)});
  const a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a),l=b.world.players.owner.life;l.ageSeconds=6000;l.ageYears=100;l.ended=true;l.phase='ended';
  shadow.observe(a,b,receipt(2,2));
  const raw=probe.snapshot();
  assert.equal(raw.semanticCheckpointBytes.length,2);assert.equal(raw.semanticJournalBytes[0],0);assert(raw.semanticJournalBytes[1]>0);
  assert.deepEqual(raw.semanticEventCount,[0,1]);assert.deepEqual(raw.semanticHistoryEffects,[0,1]);
  assert.equal(shadow.snapshot().checkpointBytesTotal,raw.semanticCheckpointBytes.reduce((a,b)=>a+b,0));
});


test('persisted shadow anchor resumes across a Host restart and observes epoch acquisition',()=>{
  let persisted=null;const first=createSemanticShadow({lifeSeconds:6000,onState:value=>{persisted=value;}}),a=checkpoint();
  first.observe(null,a,receipt(1,1));
  const restored=validateSemanticShadowRestore(persisted,{worldId:'room',ownerId:'owner',authorityRoot:'r1',historySequence:1});
  const second=createSemanticShadow({lifeSeconds:6000,restored});
  const b=structuredClone(a);b.world.epoch=2;b.world.tick++;
  second.observe(null,b,receipt(2,1));
  const snap=second.snapshot();assert.equal(snap.coverage,'restored');assert.equal(snap.authorityRoot,'r2');
  assert.deepEqual(snap.journalTypes,['epoch-acquire']);assert.equal(snap.journalLength,1);assert.equal(snap.epoch,2);
});

test('stale persisted shadow becomes a coverage gap instead of being silently trusted',()=>{
  let persisted=null;const first=createSemanticShadow({lifeSeconds:6000,onState:value=>{persisted=value;}});first.observe(null,checkpoint(),receipt(1,1));
  assert.throws(()=>validateSemanticShadowRestore(persisted,{worldId:'room',ownerId:'owner',authorityRoot:'different',historySequence:1}),/coverage anchor/);
  assert.throws(()=>validateSemanticShadowRestore(persisted,{worldId:'room',ownerId:'owner',authorityRoot:'r1',historySequence:2}),/coverage anchor/);
});


test('shadow recovery overlays a protected birth onto an older provisional checkpoint',()=>{
  let persisted=null;const shadow=createSemanticShadow({lifeSeconds:6000,onState:value=>{persisted=value;}}),a=checkpoint();shadow.observe(null,a,receipt(1,1));
  const b=structuredClone(a);b.world.tick=8;b.world.worldSeconds=4;b.world.players.guest={token:'secret-g',portDwell:0,life:life('guest')};
  shadow.observe(a,b,receipt(2,2));
  const stale=structuredClone(a);stale.world.players.ghost={token:'old',portDwell:0,life:life('ghost')};
  const recovered=recoverCheckpointWithSemanticShadow(stale,persisted);
  assert.deepEqual(Object.keys(recovered.world.players).sort(),['guest','owner']);assert.equal(recovered.world.players.guest.token,'secret-g');
  assert.equal(recovered.world.players.guest.life.id,'guest:1');assert.equal(recovered.world.tick,8);assert.equal(recovered.world.worldSeconds,4);
});

test('shadow recovery can cross a rebirth when the provisional checkpoint still has the predecessor',()=>{
  let persisted=null;const shadow=createSemanticShadow({lifeSeconds:6000,onState:value=>{persisted=value;}}),a=checkpoint(),sealed=structuredClone(a),old=sealed.world.players.owner.life;
  shadow.observe(null,a,receipt(1,1));old.ageSeconds=1300;old.ageYears=1300/60;old.ended=true;old.phase='ended';sealed.world.tick=9;sealed.world.worldSeconds=4.5;
  shadow.observe(a,sealed,receipt(2,2));
  const born=life('owner',2);born.lineage=[record(old)];born.homelands=[...old.homelands];const b=structuredClone(sealed);b.world.tick=10;b.world.worldSeconds=5;b.world.players.owner.life=born;b.world.rebirthOps[old.id]={playerId:'owner',lifeId:old.id,villageId:null,resultId:born.id};
  shadow.observe(sealed,b,receipt(3,3));
  const recovered=recoverCheckpointWithSemanticShadow(a,persisted);
  assert.equal(recovered.world.players.owner.life.id,'owner:2');assert.deepEqual(recovered.world.players.owner.life.lineage,[record(old)]);
  assert.equal(recovered.world.rebirthOps['owner:1'].resultId,'owner:2');assert.equal(recovered.world.tick,10);
});
