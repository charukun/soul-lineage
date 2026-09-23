import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuDomainActor,johakyuActorCapability,createJohakyuBattle,createJohakyuCheckpoint,restoreJohakyuCheckpoint} from '@soul/johakyu-combat/domain';
import {cancelJohakyuStage,johakyuStageCapability,johakyuEquippedStageCapability} from '@soul/johakyu-combat/execution-capability';
import {createJohakyuBattleRuntime,compileBattleLoadout} from '@soul/johakyu-battle';
import {beginJohakyuStage,johakyuEquippedTechniqueCapability,johakyuStageIsActive} from '@soul/johakyu-combat/execution-capability';
const reviewTechniqueCapability=(actor,node)=>johakyuEquippedTechniqueCapability(actor,{weapon:actor.equipment.weapon,phase:node.phase,techniqueId:node.technique.id,staminaMultiplier:actor.staminaMultiplier??1,stages:node.technique.stages,fromStage:node.stage.index});
const beginReviewStage=(actor,attempt,node,reaction=null)=>beginJohakyuStage(actor,attempt,{weapon:actor.equipment.weapon,phase:reaction?'uke':node.phase,techniqueId:node.technique.id,...(reaction||node.stage.step),staminaMultiplier:actor.staminaMultiplier??1});
const reviewStageCanResolve=(state,action=state)=>Boolean(state&&state.id===action?.id&&!state.interrupted&&johakyuStageIsActive(state));
import {createLife,staminaMultiplierFor} from '../src/rebuild/domain.js';
import {ensureCombatLoadout} from '../src/combat-loadout.js';
import {SUPPORT_SKILLS} from '../src/rebuild/skill-system.js';
import {tidebreakLoadoutFor,selectCapableTidebreakCombo} from '../src/rebuild/tidebreak-loadout.js';
import {chargeAttackStamina,rinneTechniqueCapability} from '../src/rebuild/combat-execution.js';
import {createFront,tickFront} from '../src/rebuild/combat-core.js';

const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);
const gear=(weapon='sword',armor='cloth')=>({weapon,armor,shield:false});
const actor=(overrides={})=>createJohakyuDomainActor({id:'actor',side:'party',equipment:gear(),...overrides});
function node({weapon='sword',phase='jo',techniqueIndex=0,stageIndex=0}={}){
  const composition=compileBattleLoadout({jo:'action.feint',ha:'action.guard-step',kyu:['action.finish','action.precision']},weapon);
  const chain=composition[phase],technique=chain[techniqueIndex];
  return {phase,chain,technique,stage:technique.stages[stageIndex]};
}
function life({weapon='sword',armor='cloth',discount=false}={}){
  const state=createLife({seed:73917});
  Object.assign(state,{phase:'living',zone:'frontier',ageYears:28,ageSeconds:1680,position:{x:0,z:0},yaw:0,resting:false,equipment:gear(weapon,armor)});
  // These tests inject a current injury, not a birth-time injury that should
  // correctly heal when the real runtime first advances the canonical clock.
  for(const injury of Object.values(state.injuries))injury.at=state.ageSeconds;
  state.knownSkills.push(`basic.${weapon}`,'action.feint');
  const loadout=ensureCombatLoadout(state);
  for(const combo of loadout.technique.combos)combo.slots={jo:'action.feint',ha:`basic.${weapon}`,kyu:`basic.${weapon}`};
  state.combat={phase:'jo',comboId:loadout.technique.activeComboId,targetId:'foe',bodyTargetId:'foe'};
  if(discount){
    const support=SUPPORT_SKILLS.find(row=>Number(row.effects?.staminaCost)<0);
    assert.ok(support,'a canonical stamina-cost support fixture exists');
    state.knownSkills.push(support.id);state.inspiration.legacySkills.push(support.id);loadout.heart.active=[support.id];
  }
  return state;
}
function execution(recipe,index=0,id='stage-1'){
  const step=recipe.steps[index];
  return {hero:{slot:'jo',execution:{attackId:id,recipeId:recipe.id,weapon:recipe.weapon,phase:'jo',stepIndex:index,...step}}};
}
function session(recipe,extra={}){return {targetId:'foe',loadout:{jo:recipe,uke:recipe},lastAttackKey:null,secondary:false,...extra};}

test('review actual admission: two-hand defense fails one injured arm; one-hand and non-arm actions remain',()=>{
  const two=actor({equipment:gear('great'),body:{leftArm:.85}}),twoNode=node({weapon:'great',phase:'ha'}),attempt={id:'blocked-guard'},before=two.stamina;
  const denied=beginReviewStage(two,attempt,twoNode);
  assert.equal(denied.reason,'arm-injury');assert.equal(denied.paid,0);assert.equal(two.stamina,before);assert.equal(reviewStageCanResolve(attempt),false);
  const one=actor({body:{leftArm:.85}}),oneNode=node({phase:'ha'}),guard={id:'one-guard'};
  assert.equal(beginReviewStage(one,guard,oneNode).allowed,true);assert.equal(reviewStageCanResolve(guard),true);
  const noArms=actor({equipment:gear('great'),body:{leftArm:.85,rightArm:.85}});
  assert.equal(beginReviewStage(noArms,{id:'retreat'},twoNode,{kind:'retreat',footwork:'retreat'}).allowed,true);
  assert.equal(johakyuStageCapability(two,{weapon:'great',kind:'guard',requiresTwoHands:false}).reason,'arm-injury');
});

test('low stamina forbids offense, not an affordable guard at the runtime admission boundary',()=>{
  const person=actor({stamina:13}),context=node({phase:'ha'});
  assert.equal(johakyuActorCapability(person).canAttack,false);
  const attack=beginReviewStage(person,{id:'attack'},context,{kind:'slash',footwork:'stay'});
  assert.equal(attack.allowed,false);assert.equal(person.stamina,13);
  const guard=beginReviewStage(person,{id:'guard'},context,{kind:'guard',footwork:'stay'});
  assert.equal(guard.allowed,true);assert.equal(guard.paid,9);assert.equal(person.stamina,4);
});

test('selection distinguishes canStart from canContinue and simulates the remaining commitment',()=>{
  const person=actor({stamina:20}),selected=node(),before=structuredClone(person),forecast=reviewTechniqueCapability(person,selected);
  assert.equal(forecast.canStart,true);assert.equal(forecast.canContinue,false);assert.deepEqual(person,before);
  const focus=node({phase:'kyu',techniqueIndex:1,stageIndex:2}),low=actor({stamina:30});
  assert.equal(reviewTechniqueCapability(low,focus).reason,'commitment-stamina');
  const receipt=beginReviewStage(low,{id:'focus'},focus);
  assert.equal(receipt.reason,'commitment-stamina');assert.equal(receipt.paid,0);
});

test('a valid selection is rechecked after injury; a rejected attempt never resurrects or resolves contact',()=>{
  const person=actor({equipment:gear('great')}),selected=node({weapon:'great',phase:'ha'}),attempt={id:'chosen'};
  assert.equal(reviewTechniqueCapability(person,selected).canContinue,true);
  person.injuries.leftArm.severity=.85;
  const stamina=person.stamina,cap=person.staminaCap,receipt=beginReviewStage(person,attempt,selected);
  assert.equal(receipt.allowed,false);assert.equal(receipt.reason,'arm-injury');assert.equal(reviewStageCanResolve(attempt),false);
  person.injuries.leftArm.severity=0;
  assert.equal(beginReviewStage(person,attempt,selected).allowed,false);
  assert.equal(person.stamina,stamina);assert.equal(person.staminaCap,cap);
});

test('light/heavy armor and injury forecast equal the actual debit, once per runtime attempt',()=>{
  for(const armor of ['light','heavy']){
    const person=actor({equipment:gear('sword',armor),body:{torso:.2,leftArm:.25}}),selected=node(),attempt={id:`${armor}-stage`};
    const forecast=reviewTechniqueCapability(person,selected),before=person.stamina;
    assert.equal(forecast.canContinue,true);
    const receipt=beginReviewStage(person,attempt,selected),after=person.stamina,cap=person.staminaCap;
    close(receipt.paid,forecast.stages[0].stamina.effectiveCost);close(before-after,receipt.paid);
    assert.equal(beginReviewStage(person,attempt,selected),receipt);assert.equal(person.stamina,after);assert.equal(person.staminaCap,cap);
    cancelJohakyuStage(attempt);assert.equal(reviewStageCanResolve(attempt),false);
    assert.equal(beginReviewStage(person,attempt,selected).allowed,false);assert.equal(person.stamina,after);
  }
});

test('interrupted/stale action identity cannot produce defense or a delayed contact',()=>{
  const person=actor(),selected=node({phase:'ha'}),attempt={id:'live'};
  assert.equal(beginReviewStage(person,attempt,selected).allowed,true);
  assert.equal(reviewStageCanResolve(attempt,{id:'old'}),false);
  attempt.interrupted='hit-before-contact';assert.equal(reviewStageCanResolve(attempt,{id:'live'}),false);
  cancelJohakyuStage(attempt);delete attempt.interrupted;assert.equal(reviewStageCanResolve(attempt),false);
  const dead=actor({dead:true}),before=dead.stamina;
  assert.equal(beginReviewStage(dead,{id:'dead'},selected).reason,'incapacitated');assert.equal(dead.stamina,before);
});

test('main selection, main payment and review payment agree with the same life modifier',()=>{
  const state=life({armor:'heavy',discount:true});state.injuries.torso.severity=.2;
  const choice=selectCapableTidebreakCombo(state,{phase:'jo',comboId:state.combat.comboId});assert.equal(choice.ok,true);
  const recipe=tidebreakLoadoutFor(state,choice.comboId).jo,selected=node(),multiplier=staminaMultiplierFor(state);
  assert.notEqual(multiplier,1,'exercise a real canonical skill/effort modifier');
  const review=actor({...state,id:'review',side:'party',staminaMultiplier:multiplier}),forecast=reviewTechniqueCapability(review,selected);
  close(choice.capability.stages[0].stamina.effectiveCost,forecast.stages[0].stamina.effectiveCost);
  const run=session(recipe),next=execution(recipe),before=state.stamina,events=[];
  assert.equal(chargeAttackStamina(state,run,next,events),true);
  const receipt=beginReviewStage(review,{id:'review'},selected);
  close(run.stageReceipt.paid,receipt.paid);close(before-state.stamina,receipt.paid);close(state.stamina,review.stamina);
  const cap=state.staminaCap;assert.equal(chargeAttackStamina(state,run,next,events),true);close(state.stamina,review.stamina);assert.equal(state.staminaCap,cap);
  assert.deepEqual(events,[]);
});

test('main actual selection forecasts only unstarted stages of the accepted runtime recipe',()=>{
  const state=life(),recipe=tidebreakLoadoutFor(state).jo,quote=rinneTechniqueCapability(state,'jo',recipe),cost=quote.stages[0].stamina.effectiveCost;
  state.stamina=cost*2.8;
  assert.equal(rinneTechniqueCapability(state,'jo',recipe).canContinue,false);
  state.combat.tidebreakPose={execution:execution(recipe).hero.execution};
  const choice=selectCapableTidebreakCombo(state,{phase:'jo',comboId:state.combat.comboId});
  assert.equal(choice.ok,true);assert.equal(choice.capability.stages.length,2);assert.equal(choice.capability.stages[0].index,1);
});

test('main just-in-time adapter rejects changed body/stamina and uses actual executed footwork',()=>{
  const state=life({weapon:'great'}),recipe=tidebreakLoadoutFor(state).ha,run=session(recipe),events=[];
  const next=execution(recipe,0);next.hero.execution.phase='ha';run.loadout.ha=recipe;
  assert.equal(rinneTechniqueCapability(state,'ha',recipe).canContinue,true);
  state.injuries.leftArm.severity=.85;const before=state.stamina;
  assert.equal(chargeAttackStamina(state,run,next,events),false);assert.equal(state.stamina,before);assert.equal(run.invalid,true);
  state.injuries.leftArm.severity=0;
  assert.equal(chargeAttackStamina(state,run,next,events),false);assert.equal(events.length,1);
  const exhausted=life(),ordinary=tidebreakLoadoutFor(exhausted).jo,other=session(ordinary);
  assert.equal(rinneTechniqueCapability(exhausted,'jo',ordinary).canContinue,true);exhausted.stamina=0;
  assert.equal(chargeAttackStamina(exhausted,other,execution(ordinary),[]),false);assert.equal(exhausted.stamina,0);
  const hurtLeg=life();hurtLeg.injuries.leftLeg.severity=.85;
  const stale={id:'rinne-jo-action.feint',weapon:'sword',steps:[{kind:'ready',footwork:'stay',charge:'none'}]},actual=execution(stale);
  actual.hero.execution.footwork='cross';assert.equal(chargeAttackStamina(hurtLeg,session(stale),actual,[]),false);
});

test('main body-owned defensive stage is paid despite being a secondary/offense-disabled session',()=>{
  const state=life();state.stamina=13;
  const recipe={id:'rinne-threat-guard',weapon:'sword',steps:[{kind:'guard',footwork:'stay',charge:'none'}]},run=session(recipe,{secondary:true});
  const quote=rinneTechniqueCapability(state,'jo',recipe),before=state.stamina;
  assert.equal(quote.canStart,true);assert.equal(chargeAttackStamina(state,run,execution(recipe),[]),true);
  assert.ok(run.stageReceipt.paid>0);close(before-state.stamina,quote.stages[0].stamina.effectiveCost);
});

test('shared runtime debits a stage exactly once and rejects a changed grip before contact',()=>{
 const make=(hurt=false)=>createJohakyuBattleRuntime({battleId:'payment',recoverStamina:false,actors:[{...actor({id:'hero',equipment:gear(hurt?'great':'sword','heavy'),body:hurt?{leftArm:.85}:{}}),position:{x:0,z:0},loadout:{jo:hurt?'basic.great':'action.feint'}},{...actor({id:'enemy',side:'enemy',stamina:0}),position:{x:0,z:1.7},canAttack:false}]});
 const runtime=make();let started;for(let i=0;i<600&&!started;i++)started=runtime.step(1/60).events.find(e=>e.type==='stage-start'&&e.sourceId==='hero');assert.ok(started);
 const hero=runtime.actor('hero'),quote=johakyuEquippedStageCapability(actor({equipment:gear('sword','heavy')}),{phase:started.phase,...node().stage.step});
 close(started.staminaBefore-hero.stamina,started.staminaPaid);close(started.staminaPaid,quote.stamina.effectiveCost);const after=hero.stamina;runtime.step(0);assert.equal(hero.stamina,after);
 const injured=make(true),events=[];for(let i=0;i<720;i++)events.push(...injured.step(1/60).events);assert.ok(events.some(e=>e.type==='execution-blocked'&&e.sourceId==='hero'&&e.reason==='arm-injury'));assert.equal(events.some(e=>e.type==='player-hit'),false);
});

test('actual main tick cannot emit offense or successful parry for a grip-rejected body',()=>{
  const state=life({weapon:'great'});state.injuries.leftArm.severity=.85;
  const front=createFront(0,1);front.enemies=front.enemies.slice(0,1);front.enemies[0].x=0;front.enemies[0].z=1.9;state.combat=null;
  const events=[];for(let i=0;i<90;i++)events.push(...tickFront(state,front,1/60));
  assert.ok(events.some(row=>row.type==='execution-blocked'&&row.reason==='arm-injury'));
  assert.equal(events.some(row=>row.type==='player-hit'||row.type==='evaded'),false);
});

test('equipment and resolved life modifier survive the existing checkpoint route',()=>{
  const battle=createJohakyuBattle({actors:[actor({equipment:gear('sword','heavy'),staminaMultiplier:.82})]});
  const restored=restoreJohakyuCheckpoint(createJohakyuCheckpoint({battle,lifeId:'life',ageSeconds:1,encounterId:'encounter'})).battle.actors.get('actor');
  assert.deepEqual(restored.equipment,gear('sword','heavy'));assert.equal(restored.staminaMultiplier,.82);
});
