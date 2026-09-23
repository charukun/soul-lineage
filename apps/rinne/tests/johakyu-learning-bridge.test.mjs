import test from 'node:test';
import assert from 'node:assert/strict';
import {inspirationCombatAnswerPool} from '@soul/game-data';
import {createJohakyuBattleRuntime,resolveTechnique} from '@soul/johakyu-battle';
import {resolveBattlePresentation,presentBattleEvents} from '@soul/johakyu-presentation/battle-presentation';
import {createLife,serializeLife,deserializeLife} from '../src/rebuild/domain.js';
import {recordCombatAnswers,archiveInspiration} from '../src/rebuild/inspiration-state.js';
import {lifeBattleLoadout} from '../src/rebuild/johakyu-life-battle.js';
import {ensureCombatLoadout} from '../src/combat-loadout.js';

test('the whole inspiration pool uses common stage identities, including explicit unsupported results',()=>{
 for(const weapon of ['fist','sword','great','dagger','spear','axe','staff'])for(const row of inspirationCombatAnswerPool(weapon)){
  const t=resolveTechnique(row.id,{weapon});if(!t)continue;
  assert.equal(t.id,row.id);assert.equal(t.stages.length,row.steps.length);assert.ok(t.weaponCompatibility.includes(weapon));
  for(const stage of t.stages){const p=resolveBattlePresentation({...stage,weapon});assert.equal(p.techniqueId,row.id);assert.equal(p.stageIndex,stage.stageIndex);if(!p.supported)assert.ok(p.reason);else assert.ok(p.clip);}
 }
});
test('a generated trial learns only after actual shared stages/contact, survives save, and can be archived',()=>{
 const weapon='sword',definition=inspirationCombatAnswerPool(weapon).map(row=>resolveTechnique(row.id,{weapon})).find(t=>t?.id.startsWith('gen2.')&&t.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported));
 assert.ok(definition,'generated accepted fixture');const life=createLife({seed:79});Object.assign(life,{ageYears:20,ageSeconds:1200,zone:'frontier'});life.equipment.weapon=weapon;life.knownSkills.push('basic.sword');
 life.inspiration.pending={id:definition.id,targetId:'enemy',phase:'jo',armed:true,started:false,cursor:0,contact:false,committed:false,failed:false,question:'reach',proof:[],runtimeName:definition.name,specialEffects:[]};
 const runtime=createJohakyuBattleRuntime({battleId:'learn',actors:[{id:life.id,side:'party',position:{x:0,z:0},equipment:life.equipment,loadout:{jo:{...definition,source:'trial'}},staminaMultiplier:.05},{id:'enemy',side:'enemy',position:{x:0,z:1.6},hp:10000,maxHp:10000,equipment:{weapon:'sword',armor:'cloth'},readyDelay:60,canAttack:false}]});
 const context={targetId:'enemy',zone:'frontier',distanceBand:'contact',terrain:'open',encounter:'duel'};let learned=null,completed=0,contact=false;
 for(let i=0;i<1200&&!learned;i++){
  const {frame,events}=runtime.step(1/60),rows=events.map(e=>({...e,engine:'johakyu'}));
  for(const e of rows.filter(e=>e.sourceId===life.id&&e.techniqueId===definition.id)){if(e.type==='stage-complete')completed++;if(e.impact){contact||=e.damage>0;assert.equal(presentBattleEvents([e])[0].presentation.techniqueId,definition.id);}}
  learned=recordCombatAnswers(life,context,rows).find(e=>e.type==='inspiration'&&e.id===definition.id);
  if(completed<definition.stages.length||!contact)assert.equal(life.knownSkills.includes(definition.id),false);
 }
 assert.ok(learned);assert.ok(contact);assert.equal(completed,definition.stages.length);const restored=deserializeLife(serializeLife(life));assert.ok(restored.knownSkills.includes(definition.id));assert.equal(restored.inspiration.pending,null);assert.equal(archiveInspiration(restored,definition.id),true);assert.equal(restored.inspiration.records[definition.id].archived,true);
});
test('life combo selection expands full techniques inside a phase, without truncating their stages',()=>{
 const state=createLife({seed:3});state.equipment.weapon='sword';state.knownSkills.push('basic.sword','action.counter','action.crash');state.inspiration.legacySkills.push('action.counter','action.crash');const l=ensureCombatLoadout(state),combo=l.technique.combos[0];combo.slots={jo:'action.counter',ha:'action.crash',kyu:'basic.sword'};l.technique.phaseSelections.jo='combo:'+combo.id;
 const chain=lifeBattleLoadout(state,'enemy').jo;assert.deepEqual(chain.map(t=>t.id),['action.counter','action.crash','basic.sword']);assert.deepEqual(chain[0].stages.map(s=>s.kind),['parry','counter','thrust']);assert.deepEqual(chain[1].stages.map(s=>s.kind),['bash','heavy','diagonal']);
});

test('weapon change removes incompatible learned recipes from saved chains before execution',()=>{
 const row=inspirationCombatAnswerPool('sword').find(r=>r.id.startsWith('gen2.sword.')&&resolveTechnique(r.id,{weapon:'sword'})?.stages.every(s=>resolveBattlePresentation({...s,weapon:'sword'}).supported));
 const state=createLife({seed:3});state.equipment.weapon='sword';state.knownSkills.push(row.id);state.inspiration.records[row.id]={answerId:row.id,kind:'technique',family:row.family,archived:false};const l=ensureCombatLoadout(state);l.technique.combos[0].slots.jo=row.id;
 assert.equal(lifeBattleLoadout(state,'enemy').jo[0].id,row.id);state.equipment.weapon='spear';const next=lifeBattleLoadout(state,'enemy');
 for(const chain of Object.values(next))for(const technique of chain){assert.equal(technique.id,'basic.spear');assert.equal(technique.name,'槍の型');assert.ok(technique.stages.every(s=>resolveBattlePresentation({...s,weapon:'spear'}).supported));}
});
