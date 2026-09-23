import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront,tickFront,tidebreakLoadoutFor} from '../src/rebuild/combat-core.js';
import {createTidebreakRuntime} from '@soul/tidebreak-combat';
import {readJohakyuTechniqueTruth,readJohakyuLoadoutProfile} from '../src/rebuild/johakyu-technique-contract.js';
import {ensureCombatLoadout} from '../src/combat-loadout.js';
import {CAUSAL_ANSWERS} from '@soul/game-data';
function state(){const s=createLife({seed:6});Object.assign(s,{id:'catalog-fixture',phase:'living',ageSeconds:1200,ageYears:20,zone:'frontier',position:{x:0,z:0}});s.equipment.weapon='sword';ensureCombatLoadout(s);return s;}
const frame=(id='basic.sword')=>({targetId:'foe',execution:{recipeId:'rinne-jo-'+id,attackId:1,phase:'jo',stepIndex:0,kind:'slash',weapon:'sword',charge:'none'}});
test('basic, learned, equipped, trial and unknown identities are distinct without life mutation',()=>{
 const s=state();let before=structuredClone(s),truth=readJohakyuTechniqueTruth(s,frame());assert.equal(truth.status,'basic');assert.equal(truth.legal,true);assert.deepEqual(s,before);
 const id='action.guard-step';assert.equal(readJohakyuTechniqueTruth(s,frame(id)).status,'unregistered');
 s.knownSkills.push(id);before=structuredClone(s);truth=readJohakyuTechniqueTruth(s,frame(id));assert.equal(truth.learned,true);assert.equal(truth.trial,false);assert.equal(truth.equipped,false);assert.deepEqual(s,before);
 const answer=CAUSAL_ANSWERS.find(a=>a.kind==='technique'&&a.weapons.includes('sword'));
 s.inspiration.pending={id:answer.id,targetId:'foe',phase:'jo',armed:true,failed:false,committed:false};before=structuredClone(s);
 truth=readJohakyuTechniqueTruth(s,frame(answer.id));assert.equal(truth.status,'trial');assert.equal(truth.learned,false);assert.deepEqual(s,before);
 assert.equal(readJohakyuTechniqueTruth(s,{...frame(answer.id),targetId:'other'}).legal,false);
 assert.equal(readJohakyuTechniqueTruth(s,frame('invented.ultimate')).techniqueId,null);
 const profile=readJohakyuLoadoutProfile(s);assert.equal(profile.readOnly,true);assert.equal(profile.pending.status,'trial');assert.deepEqual(s,before);
});
test('actual runtime execution retains the committed recipe when the next loadout changes',()=>{
 const s=state(),loadout=tidebreakLoadoutFor(s),runtime=createTidebreakRuntime({seed:6,weapon:'sword'});
 runtime.configure({encounterReady:true,weapon:'sword',loadout,positions:{hero:{x:0,z:0,yaw:0},enemy:{x:0,z:1.4,yaw:Math.PI}}});
 let before;for(let i=0;i<600;i++){before=runtime.step(1/60);if(before.hero.execution?.progress>.1)break;}
 assert.ok(before.hero.execution);const id=before.hero.execution.attackId;
 const changed=structuredClone(loadout);changed.jo.id='rinne-jo-action.guard-step';changed.jo.name='NEW POLICY';
 runtime.setPolicy({loadout:changed});const after=runtime.state();assert.deepEqual(after,before);assert.equal(after.hero.execution.attackId,id);assert.notEqual(after.hero.execution.recipeName,'NEW POLICY');
});
test('actual main-game frames and impacts carry executor attack, recipe and target identities',()=>{
 const s=state(),front=createFront(0,6);front.enemies=front.enemies.slice(0,1);front.enemies[0].cooldown=3;front.enemies[0].x=.5;front.enemies[0].z=.5;let observed=0,hits=[];
 for(let i=0;i<900;i++){
   const events=tickFront(s,front,1/60);hits.push(...events.filter(e=>e.type==='player-hit'));
   const truth=s.combat?.tidebreakPose?.johakyu;
   if(truth){observed++;assert.ok(truth.attackId);assert.equal(truth.authority,'johakyu-battle');assert.equal(truth.legal,true);assert.ok(front.enemies.some(e=>e.id===truth.targetId));}
 }
 assert.ok(observed>0);assert.ok(hits.length>0);for(const hit of hits){assert.ok(hit.attackId);assert.equal(hit.sourceId,s.id);assert.ok(hit.techniqueId?.startsWith('basic.'));}
});
