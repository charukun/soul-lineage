import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuBattleRuntime,resolveTechnique,techniqueCatalog,compileBattleLoadout,stageChoreography,stagePoseProgress,resolveImpact,chooseExchangeIntent,createJohakyuExchangeState} from '../src/index.js';
import {resolveBattlePresentation,presentBattleFrame,presentBattleEvents} from '@soul/johakyu-presentation/battle-presentation';
import {createJohakyuDomainActor} from '@soul/johakyu-combat/domain';
const actor=(id,side,weapon='sword')=>({...createJohakyuDomainActor({id,side,hp:125,maxHp:125,equipment:{weapon,armor:'cloth',shield:false}}),position:{x:0,z:side==='party'?0:1.7},stability:.7,posture:0,mind:'aggressive',staminaMultiplier:.12});
const execution=(kind='slash',weapon='sword',phase='ha')=>{const technique=resolveTechnique(`basic.${weapon}`,{weapon}),stage={kind,footwork:'forward',charge:'none'};return{id:'execution',actorId:'a',targetId:'b',techniqueId:technique.id,stageIndex:0,kind,footwork:'forward',charge:'none',phase,weapon,choreography:stageChoreography(technique,stage,{weapon})};};
test('all catalog techniques retain every stage and identity through presentation',()=>{
 for(const weapon of ['fist','sword','great','dagger','spear','axe','staff'])for(const definition of techniqueCatalog(weapon)){
  const chain=compileBattleLoadout({jo:definition.id},weapon);assert.equal(chain.jo[0].id,definition.id);
  for(const stage of definition.stages){const p=resolveBattlePresentation({...stage,weapon});assert.equal(p.techniqueId,definition.id);assert.equal(p.stageIndex,stage.stageIndex);if(p.supported){assert.equal(p.kind,stage.kind);assert.equal(p.footwork,stage.footwork);assert.equal(p.charge,stage.charge);}}
 }
 assert.deepEqual(resolveTechnique('action.counter').stages.map(s=>s.kind),['parry','counter','thrust']);
 assert.deepEqual(resolveTechnique('action.crash').stages.map(s=>s.kind),['bash','heavy','diagonal']);
 assert.equal(resolveTechnique('basic.great',{weapon:'sword'}),null);
});
test('stage clock preserves the authored contact under tempo and acceleration',()=>{
 for(const weapon of ['sword','great'])for(const technique of techniqueCatalog(weapon))for(const stage of technique.stages){const a=stageChoreography(technique,stage,{tempo:1}),b=stageChoreography(technique,stage,{tempo:2});assert.equal(b.duration,Math.max(a.duration/2,.34));assert.equal(stagePoseProgress(a.contactProgress,a),a.contactProgress);const p=resolveBattlePresentation({...stage,weapon,choreography:a});assert.equal(p.contact.contactProgress,a.contactProgress);}
});
test('impact separates light/heavy force, guard resistance, reversal and direction',()=>{
 const a=actor('a','party'),b=actor('b','enemy');
 const light=resolveImpact({execution:execution(),source:a,target:b}),heavy=resolveImpact({execution:execution('heavy','great','kyu'),source:{...a,equipment:{weapon:'great',armor:'cloth'}},target:b});
 assert.ok(heavy.damage>light.damage);assert.ok(heavy.impulse>light.impulse);assert.ok(heavy.stagger>light.stagger);assert.ok(heavy.hitstop>light.hitstop);assert.ok(heavy.knockback.z>0);assert.ok(heavy.sourceImpulse.z<0);
 const guard=resolveImpact({execution:execution(),source:a,target:{...b,equipment:{...b.equipment,shield:true}},defense:'guard'});assert.ok(guard.blocked);assert.ok(guard.damage<light.damage);assert.ok(guard.staminaDamage>0);
 const broken=resolveImpact({execution:execution('heavy','great'),source:{...a,equipment:{weapon:'great'}},target:{...b,posture:95,stamina:4},defense:'guard'});assert.ok(broken.guardBreak);assert.ok(broken.interrupted);
 const strong=resolveImpact({execution:execution(),source:a,target:{...b,stability:1},defense:'parry'}),weak=resolveImpact({execution:execution('heavy','great'),source:{...a,equipment:{weapon:'great'}},target:{...b,stability:.3},defense:'parry',timingError:.18});assert.ok(strong.strongParry);assert.ok(strong.initiativeReversal);assert.equal(weak.parryStrength,'weak');assert.ok(strong.sourceKick>weak.sourceKick);
});
test('exchange uses weapon range, phase, mind, posture and initiative',()=>{
 const a=actor('a','party'),b=actor('b','enemy'),exchange=createJohakyuExchangeState({sourceId:'a',targetId:'b'});
 const run=extra=>chooseExchangeIntent({actor:a,target:b,exchange,phase:'jo',distance:2,readSeconds:0,...extra});
 assert.equal(run({distance:4}).intent,'approach');assert.equal(run({actor:{...a,stamina:3}}).intent,'disengage');assert.equal(run({actor:{...a,mind:'counter'},threat:{}}).intent,'intercept');assert.notEqual(run({phase:'jo',readSeconds:.1}).intent,run({phase:'kyu',readSeconds:.1}).intent);
});
test('runtime applies one impact at the stage contact anchor and presentation cannot change damage',()=>{
 const runtime=createJohakyuBattleRuntime({battleId:'identity',actors:[{...actor('a','party'),self:true,loadout:{jo:'action.crash'}},{...actor('b','enemy'),mind:'aggressive'}]});
 const ids=new Set();let count=0;
 for(let i=0;i<1200;i++){
  const {frame,events}=runtime.step(1/60),before=JSON.stringify(runtime.snapshot());presentBattleFrame(frame);presentBattleEvents(events);assert.equal(JSON.stringify(runtime.snapshot()),before);
  for(const event of events.filter(e=>e.impact)){assert.ok(!ids.has(event.id));ids.add(event.id);count++;assert.equal(event.techniqueId,event.impact.techniqueId);assert.equal(event.stageIndex,event.impact.stageIndex);assert.equal(event.kind,event.impact.kind);assert.equal(event.contactEngine,'shared-contact-anchor');const p=presentBattleEvents([event])[0];assert.equal(p.presentation.techniqueId,event.techniqueId);assert.equal(p.presentation.stageIndex,event.stageIndex);}
 }
 assert.ok(count>2);
});
test('shared clock is invariant under host batching and invalid time is rejected',()=>{
 const make=()=>createJohakyuBattleRuntime({battleId:'clock',actors:[actor('a','party'),actor('b','enemy')]});const a=make(),b=make(),ae=[],be=[];
 for(let i=0;i<20;i++)ae.push(...a.step(.1).events);for(let i=0;i<120;i++)be.push(...b.step(1/60).events);
 assert.deepEqual(a.snapshot(),b.snapshot());assert.deepEqual(ae,be);for(const dt of [-1,NaN,Infinity,1])assert.throws(()=>a.step(dt));
});

test('every catalog stage runs with the UI identity; contact and presentation keep that identity',()=>{
 for(const weapon of ['fist','sword','great','dagger','spear','axe','staff'])for(const definition of techniqueCatalog(weapon)){
  if(definition.stages.some(stage=>!resolveBattlePresentation({...stage,weapon}).supported))continue;
  const a={...actor('a','party',weapon),loadout:{jo:definition},recoverStamina:true},b={...actor('b','enemy'),hp:10000,maxHp:10000,canAttack:false,stamina:0,recoverStamina:false};
  const runtime=createJohakyuBattleRuntime({battleId:'catalog:'+definition.id,actors:[a,b]});const starts=new Map(),contacts=[];
  for(let i=0;i<900;i++)for(const event of runtime.step(1/60).events){if(event.sourceId!=='a'||event.techniqueId!==definition.id)continue;if(event.type==='stage-start')starts.set(event.stageIndex,event);if(event.impact)contacts.push(event);}
  assert.equal(starts.size,definition.stages.length,weapon+':'+definition.id);
  for(const stage of definition.stages){const started=starts.get(stage.stageIndex);for(const key of ['techniqueId','stageIndex','kind','footwork','charge'])assert.equal(started[key],stage[key]);const presentation=presentBattleEvents([started])[0].presentation;assert.equal(presentation.supported,true,weapon+':'+definition.id+':'+stage.kind);assert.equal(presentation.stageIndex,stage.stageIndex);}
  for(const contact of contacts){assert.equal(contact.impact.techniqueId,definition.id);assert.equal(presentBattleEvents([contact])[0].presentation.techniqueId,definition.id);}
 }
});
test('simultaneous authored contact clashes once and cancels both pending attacks',()=>{
 const a={...actor('a','party'),mind:'aggressive'},b={...actor('b','enemy'),mind:'aggressive'};
 const runtime=createJohakyuBattleRuntime({battleId:'clash',actors:[a,b]}),events=[];runtime.actor('a').cursor.phaseIndex=1;runtime.actor('b').cursor.phaseIndex=1;for(let i=0;i<300;i++)events.push(...runtime.step(1/60).events);
 const clash=events.find(e=>e.type==='clash');assert.ok(clash);assert.equal(clash.damage,0);assert.ok(clash.sourceKick>0);assert.ok(clash.impulse>0);assert.ok(events.some(e=>e.type==='interrupted'&&e.reason==='weapon-clash'&&e.attackId===clash.attackId));assert.equal(events.filter(e=>e.impact&&[clash.attackId,clash.otherAttackId].includes(e.attackId)).length,1);
});
test('a downed target gets a deliberate pause, then a complete two-second finisher before recovery',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0,finisherProfile:{id:'kaishaku',durationScale:1}},b={...actor('b','enemy'),hp:0,downed:true,incapacitated:true};
 const runtime=createJohakyuBattleRuntime({battleId:'finisher-pace',actors:[a,b]}),events=[];
 for(let i=0;i<60*4;i++)events.push(...runtime.step(1/60).events);
 const start=events.find(e=>e.type==='finisher-start'),contact=events.find(e=>e.type==='finisher'),complete=events.find(e=>e.type==='finisher-complete');
 assert.ok(start);assert.ok(start.time>=.4);assert.ok(contact.time>start.time);assert.ok(complete.time>contact.time);
 assert.ok(Math.abs(complete.time-start.time-2)<.08);assert.equal(events.filter(e=>e.type==='finisher').length,1);
});
test('rendered contact observations cannot alter the authoritative contact or outcome',()=>{
 const make=()=>createJohakyuBattleRuntime({battleId:'observation',actors:[actor('a','party'),actor('b','enemy')]});const a=make(),b=make();
 for(let i=0;i<360;i++){a.step(1/60);b.step(1/60,[{attackId:b.actor('a').action?.id,targetId:'b',point:{x:0,y:10,z:1.7}}]);assert.deepEqual(a.snapshot(),b.snapshot());}
});
