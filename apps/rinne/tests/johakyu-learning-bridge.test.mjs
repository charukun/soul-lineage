import test from 'node:test';
import assert from 'node:assert/strict';
import {inspirationCombatAnswerPool} from '@soul/game-data';
import {createJohakyuBattleRuntime,resolveTechnique} from '@soul/johakyu-battle';
import {resolveBattlePresentation,presentBattleEvents} from '@soul/johakyu-presentation/battle-presentation';
import {createLife,serializeLife,deserializeLife} from '../src/rebuild/domain.js';
import {archiveInspiration} from '../src/rebuild/inspiration-state.js';
import {lifeBattleLoadout} from '../src/rebuild/johakyu-life-battle.js';
import {ensureCombatLoadout,setPhaseSelection,activeCombo} from '../src/combat-loadout.js';
import {settleInspirationCombat} from '../src/rebuild/inspiration-combat.js';

test('the whole inspiration pool uses common stage identities, including explicit unsupported results',()=>{
 for(const weapon of ['fist','sword','great','dagger','spear','axe','staff'])for(const row of inspirationCombatAnswerPool(weapon)){
  const t=resolveTechnique(row.id,{weapon});if(!t)continue;
  assert.equal(t.id,row.id);assert.equal(t.stages.length,row.steps.length);assert.ok(t.weaponCompatibility.includes(weapon));
  for(const stage of t.stages){const p=resolveBattlePresentation({...stage,weapon});assert.equal(p.techniqueId,row.id);assert.equal(p.stageIndex,stage.stageIndex);if(!p.supported)assert.ok(p.reason);else assert.ok(p.clip);}
 }
});
test('a generated trial is learned on its first authoritative stage and fires in the same battle',()=>{
 const weapon='sword',definition=inspirationCombatAnswerPool(weapon).map(row=>resolveTechnique(row.id,{weapon})).find(t=>t?.id.startsWith('gen2.')&&t.stages.every(s=>resolveBattlePresentation({...s,weapon}).supported));
 assert.ok(definition,'generated accepted fixture');const life=createLife({seed:79});Object.assign(life,{ageYears:20,ageSeconds:1200,zone:'frontier'});life.equipment.weapon=weapon;life.knownSkills.push('basic.sword');
 ensureCombatLoadout(life);assert.equal(setPhaseSelection(life,'jo','basic.sword'),true);
 life.inspiration.pending={id:definition.id,targetId:'enemy',phase:'jo',armed:true,started:false,cursor:0,contact:false,committed:false,failed:false,question:'reach',proof:[],runtimeName:definition.name,specialEffects:[]};
 const runtime=createJohakyuBattleRuntime({battleId:'learn',actors:[{id:life.id,side:'party',position:{x:0,z:0},equipment:life.equipment,loadout:{jo:{...definition,source:'trial'}},staminaMultiplier:.05},{id:'enemy',side:'enemy',position:{x:0,z:1.6},hp:10000,maxHp:10000,equipment:{weapon:'sword',armor:'cloth'},readyDelay:60,canAttack:false}]});
 const context={targetId:'enemy',zone:'frontier',distanceBand:'contact',terrain:'open',encounter:'duel'};let learned=null,completed=0,contact=false,started=false;
 for(let i=0;i<1200&&(!learned||!contact||completed<definition.stages.length);i++){
  const {frame,events}=runtime.step(1/60),rows=events.map(e=>({...e,engine:'johakyu'}));
  if(rows.some(e=>e.type==='inspiration-start'&&e.techniqueId===definition.id)){
    started=true;assert.equal(life.knownSkills.includes(definition.id),false);
  }
  for(const e of rows.filter(e=>e.sourceId===life.id&&e.techniqueId===definition.id)){if(e.type==='stage-complete')completed++;if(e.impact){contact||=e.damage>0;assert.equal(presentBattleEvents([e])[0].presentation.techniqueId,definition.id);}}
  settleInspirationCombat(life,null,rows,context);
  learned||=rows.find(e=>e.type==='inspiration'&&e.id===definition.id);
  if(learned){assert.equal(learned.equipped,true);assert.equal(activeCombo(life).slots.jo,definition.id);assert.equal(life.combatLoadout.technique.phaseSelections.jo,`combo:${activeCombo(life).id}`);}
  if(started)assert.equal(life.knownSkills.includes(definition.id),true);
 }
 assert.ok(started);assert.ok(learned?.firstCast);assert.ok(contact);assert.equal(completed,definition.stages.length);const restored=deserializeLife(serializeLife(life));assert.ok(restored.knownSkills.includes(definition.id));assert.equal(activeCombo(restored).slots.jo,definition.id);assert.equal(archiveInspiration(restored,definition.id),false);
});
test('life combo selection expands full techniques inside a phase, without truncating their stages',()=>{
 const state=createLife({seed:3});state.equipment.weapon='sword';state.knownSkills.push('basic.sword','action.counter','action.crash');state.inspiration.legacySkills.push('action.counter','action.crash');const l=ensureCombatLoadout(state),combo=l.technique.combos[0];combo.slots={jo:'action.counter',ha:'action.crash',kyu:'basic.sword'};l.technique.phaseSelections.jo='combo:'+combo.id;
 const chain=lifeBattleLoadout(state,'enemy').jo;assert.deepEqual(chain.map(t=>t.id),['action.counter','action.crash','basic.sword']);assert.deepEqual(chain[0].stages.map(s=>s.kind),['parry','counter','thrust']);assert.deepEqual(chain[1].stages.map(s=>s.kind),['bash','heavy','diagonal']);
});

test('first-cast protection and stagger stay inside the shared executor and do not carry to normal use',()=>{
 const technique=resolveTechnique('basic.sword',{weapon:'sword'});
 const actor=(id,source)=>({id,side:'party',position:{x:0,z:0},equipment:{weapon:'sword',armor:'cloth'},loadout:{jo:{...technique,source}},staminaMultiplier:.05});
 const enemy={id:'enemy',side:'enemy',position:{x:0,z:1.6},hp:1000,maxHp:1000,equipment:{weapon:'sword',armor:'cloth'},readyDelay:60,canAttack:false};
 const trial=createJohakyuBattleRuntime({battleId:'first',actors:[actor('hero','trial'),enemy]});
 let cue;for(let i=0;i<240&&!cue;i++)cue=trial.step(1/60).events.find(e=>e.type==='inspiration-start');
 assert.ok(cue);assert.equal(cue.authority,'johakyu-battle');assert.equal(cue.firstInspirationPresentation.cue,'閃');
 assert.ok(trial.actor('hero').firstInspirationUntil>cue.time);
 assert.ok(trial.actor('enemy').staggerUntil>cue.time);
 const normal=createJohakyuBattleRuntime({battleId:'normal',actors:[actor('hero','learned'),enemy]});
 for(let i=0;i<240;i++)assert.equal(normal.step(1/60).events.some(e=>e.type==='inspiration-start'),false);
 assert.equal(normal.actor('hero').firstInspirationUntil,undefined);
 const boss=createJohakyuBattleRuntime({battleId:'boss',actors:[actor('hero','trial'),{...enemy,boss:true}]});
 let bossCue;for(let i=0;i<240&&!bossCue;i++)bossCue=boss.step(1/60).events.find(e=>e.type==='inspiration-start');
 assert.ok(bossCue);assert.ok(boss.actor('enemy').staggerUntil-bossCue.time<=.121);
});

test('inspiration begins in the current kyu beat and returns to jo after the new technique',()=>{
 const technique=resolveTechnique('basic.sword',{weapon:'sword'});
 const runtime=createJohakyuBattleRuntime({battleId:'current-beat',actors:[
   {id:'hero',side:'party',position:{x:0,z:0},equipment:{weapon:'sword',armor:'cloth'},loadout:{jo:technique,ha:technique,kyu:technique},staminaMultiplier:.05},
   {id:'enemy',side:'enemy',position:{x:0,z:1.6},hp:10000,maxHp:10000,equipment:{weapon:'sword',armor:'cloth'},readyDelay:60,canAttack:false}
 ]});
 runtime.actor('hero').cursor.phaseIndex=2;
 assert.equal(runtime.inspire('hero',{...technique,source:'trial'},'enemy','kyu'),true);
 const initial=runtime.step(1/60);
 assert.ok(initial.events.some(e=>e.type==='inspiration-start'&&e.phase==='kyu'));
 assert.equal(initial.frame.actors.find(a=>a.id==='hero').action.phase,'kyu');
 let completed=false;
 for(let i=0;i<240&&!completed;i++)completed=runtime.step(1/60).events.some(e=>e.type==='phase-change'&&e.phase==='jo');
 assert.equal(completed,true);
 assert.equal(runtime.actor('hero').cursor.phaseIndex,0);
});

test('weapon change removes incompatible learned recipes from saved chains before execution',()=>{
 const row=inspirationCombatAnswerPool('sword').find(r=>r.id.startsWith('gen2.sword.')&&resolveTechnique(r.id,{weapon:'sword'})?.stages.every(s=>resolveBattlePresentation({...s,weapon:'sword'}).supported));
 const state=createLife({seed:3});state.equipment.weapon='sword';state.knownSkills.push(row.id);state.inspiration.records[row.id]={answerId:row.id,kind:'technique',family:row.family,archived:false};const l=ensureCombatLoadout(state);l.technique.combos[0].slots.jo=row.id;
 assert.equal(lifeBattleLoadout(state,'enemy').jo[0].id,row.id);state.equipment.weapon='spear';const next=lifeBattleLoadout(state,'enemy');
 for(const chain of Object.values(next))for(const technique of chain){assert.equal(technique.id,'basic.spear');assert.equal(technique.name,'槍の型');assert.ok(technique.stages.every(s=>resolveBattlePresentation({...s,weapon:'spear'}).supported));}
});
