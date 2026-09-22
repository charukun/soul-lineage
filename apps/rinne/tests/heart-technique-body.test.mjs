import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,skillEffects,tickLife,serializeLife,deserializeLife,rebirth} from '../src/rebuild/domain.js';
import {createFront,tickFront} from '../src/rebuild/combat.js';
import {beginCombatState} from '../src/rebuild/combat-loadout-runtime.js';
import {eligibleDiscoveries} from '../src/rebuild/skill-system.js';
import {CAUSAL_ANSWERS,CAUSAL_ANSWER_BY_ID,answerSignature,validateCausalAnswers} from '@soul/game-data';
import {ensureInspiration,recordLifeExperience,advanceInspirationTime,recordCombatQuestion,recordCombatAnswers,inspirationCandidates,answerAvailability,updateInspirationSigns,renameInspiration,archiveInspiration,inspirationEffortScale,INSPIRATION_LIMITS} from '../src/rebuild/inspiration-state.js';
import {combatFinisherRuntime,ensureCombatLoadout,learnedHeartSkills,learnedTechniqueSkills,addCombo,setComboSkill,toggleFavored,setActiveCombo,setHeartActive,setHeartSlot,setOneMotion,setBodyChoice,unlockedBodyOptions,requestOneMotion,selectCombatCombo} from '../src/combat-loadout.js';
import {inspirationJournalModel} from '../src/inspiration-journal-model.js';

function living(seed=77){const s=createLife({name:'検証',seed});s.phase='living';s.ageSeconds=20*60;s.ageYears=20;s.resting=false;return s;}
function migrated(ids=[]){const s=living();delete s.inspiration;s.knownSkills.push(...ids);ensureInspiration(s);ensureCombatLoadout(s);return s;}
function elapsed(s,seconds=91){for(let i=0;i<Math.ceil(seconds*4);i++)advanceInspirationTime(s,.25);}
function combatFixture(s){s.zone='frontier';s.position={x:0,z:0};s.yaw=0;s.hp=s.maxHp=1000;const f=createFront(0,s.seed);f.enemies.forEach((e,i)=>{e.dead=i!==0;e.hp=e.maxHp=1000;});f.enemies[0].x=0;f.enemies[0].z=1.1;return f;}

test('new lives have basic actions, not an XP or repetition unlocked catalog',()=>{
  const s=living();ensureCombatLoadout(s);assert.deepEqual(learnedHeartSkills(s),[]);assert.deepEqual(learnedTechniqueSkills(s),['basic.fist']);assert.deepEqual(s.combatLoadout.heart.active,[]);
  s.experiences.practice={count:100000,score:100000,last:1};assert.deepEqual(eligibleDiscoveries(s),[]);
  for(let i=0;i<200;i++)recordLifeExperience(s,'practice',{place:'同じかかし'});
  assert.equal(s.inspiration.traces.length,1);assert.equal(Object.keys(s.inspiration.records).length,0);assert.deepEqual(s.knownSkills,['basic.fist']);
  validateCausalAnswers();const row=CAUSAL_ANSWER_BY_ID['spark.spear.tide'];assert.equal(answerSignature(row),answerSignature({...row,name:'別名',tempo:1.5,vfx:'red',effects:{damage:99}}));
});

test('a prepared sign can be realized on a later identical visit without duplicating experience',()=>{
  const s=living();recordLifeExperience(s,'play');recordLifeExperience(s,'train');assert.ok(s.knownSkills.includes('skill.observe'));
  recordLifeExperience(s,'balance');const traces=s.inspiration.traces.length,before=Object.keys(s.inspiration.records).length;elapsed(s);
  const discoveries=recordLifeExperience(s,'balance');assert.equal(discoveries.length,1);assert.equal(discoveries[0].kind,'body');assert.equal(s.inspiration.traces.length,traces);assert.equal(Object.keys(s.inspiration.records).length,before+1);
  assert.ok(discoveries[0].provenance.filter(p=>p.traceId).length>=2);
  s.inspiration.pending={id:'spark.spear.tide',committed:true};s.inspiration.execution={paid:true};
  const restored=deserializeLife(serializeLife(s));assert.equal(restored.inspiration.pending,null);assert.equal(restored.inspiration.execution,null);assert.deepEqual(restored.knownSkills,s.knownSkills);
  const legacy=migrated(['skill.focus']);const known=[...legacy.knownSkills];assert.equal(skillEffects(legacy).damage,0);assert.equal(setHeartActive(legacy,'skill.focus',true),true);assert.ok(skillEffects(legacy).damage>.05);assert.deepEqual(legacy.knownSkills,known);setHeartActive(legacy,'skill.focus',false);assert.equal(skillEffects(legacy).damage,0);
});

test('three ordered heart slots retain migrated choices and refuse a fourth or unknown technique',()=>{
  const ids=['skill.focus','skill.danger','skill.calm','skill.patience'],s=migrated(ids);
  assert.equal(setHeartSlot(s,0,ids[0]),true);assert.equal(setHeartSlot(s,1,ids[1]),true);assert.equal(setHeartSlot(s,2,ids[2]),true);assert.deepEqual(s.combatLoadout.heart.active,ids.slice(0,3));assert.equal(setHeartActive(s,ids[3],true),false);
  assert.equal(setHeartSlot(s,1,ids[3]),true);assert.deepEqual(s.combatLoadout.heart.active,[ids[0],ids[3],ids[2]]);assert.equal(setHeartSlot(s,0,'spark.spear.tide'),false);
  const restored=deserializeLife(serializeLife(s));ensureCombatLoadout(restored);assert.deepEqual(restored.combatLoadout.heart.active,s.combatLoadout.heart.active);
});

test('weapons normalize basic actions while age, injuries and real stamina constrain answers',()=>{
  const s=living();s.equipment.weapon='sword';s.skillWeights={jo:{'basic.fist':100},ha:{},kyu:{}};ensureCombatLoadout(s);assert.equal(s.combatLoadout.technique.combos[0].slots.jo,'basic.sword');assert.equal(s.skillWeights.jo['basic.sword'],100);
  assert.equal(answerAvailability(s,'spark.spear.tide').usable,false);s.equipment.weapon='spear';s.ageYears=6;assert.equal(answerAvailability(s,'spark.spear.tide').usable,false);s.ageYears=20;
  s.injuries.rightArm.severity=1;assert.equal(answerAvailability(s,'spark.spear.tide').usable,false);s.injuries.rightArm.severity=0;s.stamina=1;assert.equal(answerAvailability(s,'spark.spear.tide').usable,false);s.stamina=100;
  assert.equal(answerAvailability(s,'spark.spear.tide').usable,true);assert.equal(answerAvailability(s,'spark.spear.tide',{context:{retreatBlocked:true}}).usable,false);
  recordLifeExperience(s,'play');recordLifeExperience(s,'practice');elapsed(s);recordCombatQuestion(s,'close');const context={window:'combat',questions:['close'],mind:{counter:1,survival:1}};
  assert.ok(inspirationCandidates(s,context).some(row=>row.id==='spark.spear.tide'));assert.equal(inspirationCandidates(s,context).some(row=>row.id==='spark.spear.pressure'),false);
  s.stamina=1;const blockedSign=updateInspirationSigns(s,context).find(row=>row.question==='close');assert.ok(blockedSign);assert.equal(blockedSign.ready,false);assert.match(blockedSign.hint,/息|身体|形/);
  s.stamina=100;const readySign=updateInspirationSigns(s,context).find(row=>row.question==='close');assert.equal(readySign?.ready,true);
  recordLifeExperience(s,'forge');assert.ok(inspirationCandidates(s,{...context,mind:{attack:1,guard:1}}).some(row=>row.id==='spark.spear.pressure'));
  const bow=CAUSAL_ANSWERS.find(row=>row.executor==='bow-projectile');assert.ok(bow);assert.equal(answerAvailability(s,bow.id).usable,false);
});

test('favored combos remain functional and an authored answer is learned only through the live combat executor',()=>{
  const s=migrated(['action.guard-step','action.slip','action.lunge']);const first=s.combatLoadout.technique.combos[0],second=addCombo(s);assert.ok(second);
  assert.equal(setComboSkill(s,second.id,'jo','action.guard-step'),true);assert.equal(setComboSkill(s,second.id,'ha','action.slip'),true);assert.equal(setComboSkill(s,second.id,'kyu','action.lunge'),true);toggleFavored(s,second.id,'jo');toggleFavored(s,second.id,'ha');setActiveCombo(s,first.id);
  const c={comboCursor:0,comboId:null},counts=new Map([[first.id,0],[second.id,0]]);for(let i=0;i<8;i++){const row=selectCombatCombo(s,c,{advance:i>0});counts.set(row.id,counts.get(row.id)+1);}assert.ok(counts.get(second.id)>counts.get(first.id));
  const learner=living(91);learner.equipment.weapon='spear';recordLifeExperience(learner,'play');recordLifeExperience(learner,'practice');elapsed(learner);const f=combatFixture(learner),log=[],motions=new Set();
  for(let i=0;i<3600&&!learner.ended&&!learner.down;i++){
    learner.moving=false;const events=tickFront(learner,f,1/60);const pose=learner.combat?.tidebreakPose;if(pose?.skill==='潮返し'&&pose.attack)motions.add(pose.attack);log.push(...events.filter(e=>e.type==='inspiration'||e.type==='player-hit'));tickLife(learner,{realDelta:1/60,lifeDelta:0});
    if(learner.inspiration.records['spark.spear.tide'])break;
  }
  const record=learner.inspiration.records['spark.spear.tide'];
  assert.ok(record,JSON.stringify({motions:[...motions],pending:learner.inspiration.pending,hp:learner.hp,stamina:learner.stamina,last:log.slice(-5)}));
  assert.ok(log.some(e=>e.type==='player-hit'&&e.techniqueId==='spark.spear.tide'&&e.damage>0));assert.ok(log.some(e=>e.type==='inspiration'&&e.id==='spark.spear.tide'));assert.ok(record.provenance.length>=3);
  const settling=[];for(const stage of [1,2])settling.push(...recordCombatAnswers(learner,{zone:'frontier',terrain:'open',encounter:'combat',stage},[{type:'player-hit',damage:1,blockedByTerrain:false,engine:'tidebreak',techniqueId:record.answerId,skill:record.name,phase:'jo'}]));
  assert.equal(record.stable,true);assert.ok(settling.some(e=>e.type==='inspiration-stabilized'&&e.id===record.answerId));assert.ok(learner.events.some(e=>e.type==='inspiration-stabilized'&&e.inspirationId===record.answerId));
  const journal=inspirationJournalModel(learner),journalItem=journal.families.flatMap(f=>f.variants).find(item=>item.id===record.answerId);assert.ok(journalItem?.story);assert.match(journalItem.story,/問い|重なり|形/);
  ensureCombatLoadout(learner);const combo=learner.combatLoadout.technique.combos[0];assert.equal(setComboSkill(learner,combo.id,'jo',record.answerId),true);assert.equal(archiveInspiration(learner,record.answerId,true),false);assert.equal(renameInspiration(learner,record.answerId,'凪返し'),true);
  const restored=deserializeLife(serializeLife(learner));assert.equal(restored.inspiration.records[record.answerId].name,'凪返し');
  console.log('causal-executor-evidence',JSON.stringify({answer:record.answerId,motions:[...motions],origin:record.provenance,realContacts:log.filter(e=>e.techniqueId===record.answerId).length}));
});

test('body choices retain their grammar and descendants inherit bounded motifs, never parent technique IDs',()=>{
  const fresh=living();ensureCombatLoadout(fresh);assert.equal(unlockedBodyOptions(fresh,'stance').some(r=>r.id==='chinshin'),false);
  const s=migrated(['skill.balance','skill.edge','skill.recovery-breath']);assert.equal(setBodyChoice(s,'stance','chinshin'),true);assert.equal(setBodyChoice(s,'finisher','sokudan'),true);assert.equal(setBodyChoice(s,'zanshin','breath'),true);assert.deepEqual(s.combatLoadout.body,{stance:'chinshin',finisher:'sokudan',zanshin:'breath'});
  recordLifeExperience(s,'play');recordLifeExperience(s,'practice');recordLifeExperience(s,'care');recordLifeExperience(s,'observe');elapsed(s);recordLifeExperience(s,'care');s.ended=true;
  const child=rebirth(s,{name:'次代'});assert.deepEqual(child.knownSkills,['basic.fist']);assert.equal(Object.keys(child.inspiration.records).length,0);assert.ok(child.inspiration.heritage.length>0);assert.ok(child.inspiration.heritage.length<=INSPIRATION_LIMITS.heritage);assert.ok(child.inspiration.heritage.every(h=>h.sourceLifeId===s.id));
  for(const value of Object.values(child.inspiration.body))assert.ok(value>=.7&&value<=1.3);
  let next=child;for(let i=0;i<35;i++){next.ended=true;next=rebirth(next);}assert.ok(next.lineage.length<=INSPIRATION_LIMITS.lineage);assert.ok(next.inspiration.heritage.length<=INSPIRATION_LIMITS.heritage);assert.ok(next.lineageArchive.earlierGenerations>0);assert.ok(serializeLife(next).length<250000);
});

test('migrated manual one-motion keeps its stamina price and recovery exposure',()=>{
  const s=migrated(['action.guard-step']);const f=combatFixture(s);assert.equal(setOneMotion(s,'action.guard-step'),true);s.combat=beginCombatState(s,f.enemies[0].id);assert.equal(requestOneMotion(s),'action.guard-step');
  const expectedCost=22*inspirationEffortScale(s);let fired=null,armSpend=null;
  for(let i=0;i<1800&&!s.ended&&!s.down;i++){
    s.moving=false;const queued=s.combat?.oneMotionQueued,before=s.stamina,events=tickFront(s,f,1/60);
    if(queued&&!s.combat?.oneMotionQueued)armSpend=before-s.stamina;
    fired=events.find(e=>e.type==='one-motion')||fired;if(fired)break;
    tickLife(s,{realDelta:1/60,lifeDelta:0});
  }
  assert.ok(fired,'the queued manual action must execute in the real combat runtime');
  assert.ok(armSpend!==null&&armSpend>=expectedCost-1e-7,`payment must be observed before normal regeneration: ${armSpend} / ${expectedCost}`);
  assert.ok(s.combat.attackCooldown>1.5);assert.ok(s.combat.zanshinSeconds>.8);
});


test('不殺の心得は葬焉を外さず休止し、トドメ判断だけを止める',()=>{
  const s=migrated(['skill.nonlethal']);assert.equal(setHeartActive(s,'skill.nonlethal',true),true);const policy=combatFinisherRuntime(s);
  assert.equal(policy.nonlethal,true);assert.equal(policy.execute,false);assert.equal(policy.finisher.id,'kaishaku');
});
