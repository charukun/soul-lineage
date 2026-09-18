import test from 'node:test';
import assert from 'node:assert/strict';
import { createSemanticShadow, deriveSemanticShadowActions } from '../src/coop/semantic-shadow.js';
import { createCheckpointWriter } from '../src/coop/checkpoint-writer.js';

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
  assert.deepEqual(shadow.snapshot(),{status:'tracking',commits:1,lastHistorySequence:1,journalLength:0,journalTypes:[],epoch:1,playerCount:1,error:null});
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

test('source-shaped derivation rejects early-ended lives under the current co-op rule',()=>{
  const a=checkpoint(),b=structuredClone(a);b.world.players.owner.life.ended=true;b.world.players.owner.life.phase='ended';b.world.players.owner.life.ageSeconds=1300;
  assert.throws(()=>deriveSemanticShadowActions(a,b,{lifeSeconds:6000}),/terminal rule mismatch/);
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
