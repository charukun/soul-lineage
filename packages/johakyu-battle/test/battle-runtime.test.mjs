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
 for(const weapon of ['sword','great'])for(const technique of techniqueCatalog(weapon))for(const stage of technique.stages){const a=stageChoreography(technique,stage,{tempo:1,phase:'jo'}),b=stageChoreography(technique,stage,{tempo:2,phase:'kyu'});assert.equal(b.duration,Math.max(a.duration/2,.34));assert.equal(stagePoseProgress(a.contactProgress,a),a.contactProgress);assert.ok(a.timeline.preImpactBurst<a.contactProgress);const burstSeconds=(a.contactProgress-a.timeline.preImpactBurst)*a.duration;assert.ok(burstSeconds>=.018&&burstSeconds<=.041);const p=resolveBattlePresentation({...stage,weapon,choreography:a});assert.equal(p.contact.contactProgress,a.contactProgress);}
});
test('impact separates light/heavy force, guard resistance, reversal and direction',()=>{
 const a=actor('a','party'),b=actor('b','enemy');
 const light=resolveImpact({execution:execution(),source:a,target:b}),heavy=resolveImpact({execution:execution('heavy','great','kyu'),source:{...a,equipment:{weapon:'great',armor:'cloth'}},target:b});
 assert.ok(heavy.damage>light.damage);assert.ok(heavy.impulse>light.impulse);assert.ok(heavy.stagger>light.stagger);assert.ok(heavy.hitstop>light.hitstop);assert.ok(heavy.knockback.z>0);assert.ok(heavy.sourceImpulse.z<0);assert.ok(light.hitstop>=.035&&light.hitstop<=.05);assert.ok(heavy.hitstop>=.06&&heavy.hitstop<=.12);
 const guard=resolveImpact({execution:execution(),source:a,target:{...b,equipment:{...b.equipment,shield:true}},defense:'guard'});assert.ok(guard.blocked);assert.ok(guard.damage<light.damage);assert.ok(guard.staminaDamage>0);
 const broken=resolveImpact({execution:execution('heavy','great'),source:{...a,equipment:{weapon:'great'}},target:{...b,posture:95,stamina:4},defense:'guard'});assert.ok(broken.guardBreak);assert.ok(broken.interrupted);
 const strong=resolveImpact({execution:execution(),source:a,target:{...b,stability:1},defense:'parry'}),weak=resolveImpact({execution:execution('heavy','great'),source:{...a,equipment:{weapon:'great'}},target:{...b,stability:.3},defense:'parry',timingError:.18});assert.ok(strong.strongParry);assert.ok(strong.initiativeReversal);assert.equal(weak.parryStrength,'weak');assert.ok(strong.sourceKick>weak.sourceKick);assert.ok(strong.hitstop>=.1&&strong.hitstop<=.14);assert.ok(weak.hitstop>=.1&&weak.hitstop<=.14);
});
test('jo ha and kyu expose distinct contact density without changing damage authority',()=>{
 const a=actor('a','party'),b=actor('b','enemy'),jo=resolveImpact({execution:execution('slash','sword','jo'),source:a,target:b}),ha=resolveImpact({execution:execution('heavy','great','ha'),source:{...a,equipment:{weapon:'great'}},target:b}),kyu=resolveImpact({execution:execution('heavy','great','kyu'),source:{...a,equipment:{weapon:'great'}},target:b});
 assert.ok(jo.hitstop>=.035&&jo.hitstop<=.05);assert.ok(ha.hitstop>=.06&&ha.hitstop<=.09);assert.ok(kyu.hitstop>=.09&&kyu.hitstop<=.12);assert.ok(jo.hitstop<ha.hitstop&&ha.hitstop<kyu.hitstop);
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
test('impact stop compresses contact actors without freezing the authoritative battle clock',()=>{
 const runtime=createJohakyuBattleRuntime({battleId:'impact-clock',actors:[{...actor('a','party'),self:true,readyDelay:0},{...actor('b','enemy'),canAttack:false}]});let impact=null,at=0;
 for(let i=0;i<300&&!impact;i++){const result=runtime.step(1/60);impact=result.events.find(event=>event.impact);if(impact)at=result.frame.time;}
 assert.ok(impact?.hitstop>=.035);const next=runtime.step(1/60).frame;assert.ok(Math.abs(next.time-at-1/60)<1e-6);assert.ok(next.hitstop<impact.hitstop);
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
  for(let i=0;i<900;i++){
   const hero=runtime.actor('a');runtime.actor('b').position={x:hero.position.x,z:Math.min(5,hero.position.z+1.55)};
   for(const event of runtime.step(1/60).events){if(event.sourceId!=='a'||event.techniqueId!==definition.id)continue;if(event.type==='stage-start')starts.set(event.stageIndex,event);if(event.impact)contacts.push(event);}
  }
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
test('downed state stays settling until the authored fall pose reaches its final sample',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0},b={...actor('b','enemy'),hp:0,downed:true,incapacitated:true};
 const runtime=createJohakyuBattleRuntime({battleId:'downed-pose-authority',actors:[a,b]});
 for(let i=0;i<110;i++){
  const result=runtime.step(1/60),target=result.frame.actors.find(row=>row.id==='b');
  assert.equal(result.events.some(event=>event.type==='finisher-start'),false);
  assert.equal(target.downedState?.phase,'settling');
  assert.ok(target.downedState?.progress<1);
 }
 let start=null,frame=null;for(let i=0;i<30&&!start;i++){const result=runtime.step(1/60);start=result.events.find(event=>event.type==='finisher-start');if(start)frame=result.frame;}
 assert.ok(start);const target=frame.actors.find(row=>row.id==='b');assert.equal(target.downedState?.phase,'settled');assert.equal(target.downedState?.progress,1);
});
test('a downed target gets a deliberate pause, then a complete two-second finisher before recovery',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0,finisherProfile:{id:'kaishaku',durationScale:1}},b={...actor('b','enemy'),hp:0,downed:true,incapacitated:true};
 const runtime=createJohakyuBattleRuntime({battleId:'finisher-pace',actors:[a,b]}),events=[];
 for(let i=0;i<60*4;i++)events.push(...runtime.step(1/60).events);
 const start=events.find(e=>e.type==='finisher-start'),contact=events.find(e=>e.type==='finisher'),complete=events.find(e=>e.type==='finisher-complete');
 assert.ok(start);assert.ok(start.time>=1.85,'finisher must wait until the canonical downed pose is fully settled');assert.ok(contact.time>start.time);assert.ok(complete.time>contact.time);
 assert.ok(Math.abs(complete.time-start.time-2)<.08);assert.equal(events.filter(e=>e.type==='finisher').length,1);
 const after=runtime.snapshot().actors.find(row=>row.id==='a');assert.equal(after.phaseCue?.phase,'zanshin');
 const cueRuntime=createJohakyuBattleRuntime({battleId:'finisher-zanshin',actors:[a,b]});let cueFrame=null;
 for(let i=0;i<60*5&&!cueFrame;i++){const result=cueRuntime.step(1/60);if(result.events.some(e=>e.type==='finisher-complete'))cueFrame=result.frame;}
 const cue=cueFrame?.actors.find(row=>row.id==='a').phaseCue;
 assert.equal(cue?.phase,'zanshin');assert.equal(presentBattleFrame(cueFrame).actors.find(row=>row.id==='a').phaseCue.clip,'Idle');
 for(let i=0;i<110;i++)cueRuntime.step(1/60);
 assert.equal(cueRuntime.snapshot().actors.find(row=>row.id==='a').phaseCue,null);
});
test('enemy finisher waits for full knockdown and only one enemy claims the execution',()=>{
 const hero={...actor('hero','party'),self:true,hp:0,downed:true,incapacitated:true,position:{x:0,z:0}};
 const left={...actor('left','enemy'),position:{x:-.35,z:1.35},readyDelay:0},right={...actor('right','enemy'),position:{x:.35,z:1.35},readyDelay:0};
 const runtime=createJohakyuBattleRuntime({battleId:'enemy-finisher',actors:[hero,left,right]}),events=[];
 for(let i=0;i<360;i++)events.push(...runtime.step(1/60).events);
 const starts=events.filter(e=>e.type==='finisher-start'&&e.targetId==='hero'),contact=events.find(e=>e.type==='finisher'&&e.targetId==='hero'),complete=events.find(e=>e.type==='finisher-complete'&&e.targetId==='hero');
 assert.equal(starts.length,1,'a downed actor must have one finisher owner');assert.ok(starts[0].time>=1.85);assert.ok(contact&&complete);assert.equal(contact.sourceId,starts[0].sourceId);assert.equal(complete.sourceId,starts[0].sourceId);assert.equal(runtime.actor('hero').dead,true);
});
test('finisher contact marks the target dead without lifting it out of the downed pose',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0},b={...actor('b','enemy'),hp:0,downed:true,incapacitated:true};
 const runtime=createJohakyuBattleRuntime({battleId:'finisher-corpse-pose',actors:[a,b]});let finisher=null,frame=null;
 for(let i=0;i<360&&!finisher;i++){const result=runtime.step(1/60);finisher=result.events.find(event=>event.type==='finisher');if(finisher)frame=result.frame;}
 assert.ok(finisher);const target=frame.actors.find(row=>row.id==='b');assert.equal(target.dead,true);assert.equal(target.downed,true,'finisher contact must preserve the lying presentation state');
});
test('rendered contact observations cannot alter the authoritative contact or outcome',()=>{
 const make=()=>createJohakyuBattleRuntime({battleId:'observation',actors:[actor('a','party'),actor('b','enemy')]});const a=make(),b=make();
 for(let i=0;i<360;i++){a.step(1/60);b.step(1/60,[{attackId:b.actor('a').action?.id,targetId:'b',point:{x:0,y:10,z:1.7}}]);assert.deepEqual(a.snapshot(),b.snapshot());}
});

test('a missed stage ends its chain instead of continuing at the next stage',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0,loadout:{jo:'combo:combo-1'}},b={...actor('b','enemy'),hp:10000,maxHp:10000,canAttack:false,recoverStamina:false};
 const runtime=createJohakyuBattleRuntime({battleId:'miss-break',actors:[a,b]});let started=false,broken=false;
 for(let i=0;i<900&&!broken;i++){
  const {events}=runtime.step(1/60);
  if(!started&&events.some(e=>e.type==='stage-start'&&e.sourceId==='a'&&e.stageIndex===1)){started=true;runtime.actor('b').position={x:4,z:5};}
  if(events.some(e=>e.type==='chain-break'&&e.actorId==='a'&&e.reason==='miss'))broken=true;
 }
 assert.ok(started);assert.ok(broken);assert.deepEqual(runtime.actor('a').cursor,{phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:1});
});
test('losing a target after a stage resets its unfinished sequence before a new encounter',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0,loadout:{jo:'combo:combo-1'}},b={...actor('b','enemy'),hp:10000,maxHp:10000,canAttack:false,recoverStamina:false};
 const runtime=createJohakyuBattleRuntime({battleId:'target-break',actors:[a,b]});let completed=false,breakEvent=null;
 for(let i=0;i<900&&!completed;i++){
  const {events}=runtime.step(1/60);completed=events.some(e=>e.type==='stage-complete'&&e.sourceId==='a');
 }
 assert.ok(completed);assert.ok(runtime.actor('a').cursor.stageIndex>0||runtime.actor('a').cursor.techniqueIndex>0);
 runtime.actor('b').dead=true;
 for(let i=0;i<20&&!breakEvent;i++)breakEvent=runtime.step(1/60).events.find(e=>e.type==='chain-break'&&e.actorId==='a');
 assert.equal(breakEvent?.reason,'target-lost');assert.equal(runtime.actor('a').cursor.phaseIndex,0);assert.equal(runtime.actor('a').cursor.stageIndex,0);
});

test('an uninterrupted combo flows across constituent techniques and phase boundaries without a wait',()=>{
 const a={...actor('a','party'),self:true,readyDelay:0,staminaMultiplier:.01,loadout:{jo:'combo:combo-1',ha:'basic.sword',kyu:'basic.sword'}},
   b={...actor('b','enemy'),hp:10000,maxHp:10000,canAttack:false,stamina:0,recoverStamina:false};
 const runtime=createJohakyuBattleRuntime({battleId:'combo-momentum',actors:[a,b]}),events=[];
 for(let i=0;i<1800;i++){
  const hero=runtime.actor('a');runtime.actor('b').position={x:hero.position.x,z:Math.min(5,hero.position.z+1.55)};
  events.push(...runtime.step(1/60).events);
  if(events.some(e=>e.type==='stage-start'&&e.sourceId==='a'&&e.phase==='ha'))break;
 }
 const starts=events.filter(e=>e.type==='stage-start'&&e.sourceId==='a'),completes=events.filter(e=>e.type==='stage-complete'&&e.sourceId==='a');
 const nextTechnique=starts.find(e=>e.phase==='jo'&&e.techniqueIndex===1&&e.stageIndex===0);
 const precedingTechnique=completes.findLast(e=>e.phase==='jo'&&e.techniqueIndex===0&&e.stageIndex===2);
 const nextPhase=starts.find(e=>e.phase==='ha'&&e.stageIndex===0),precedingPhase=completes.findLast(e=>e.phase==='jo'&&e.techniqueIndex===2&&e.stageIndex===2);
 assert.ok(nextTechnique&&precedingTechnique&&nextPhase&&precedingPhase);
 assert.ok(nextTechnique.time-precedingTechnique.time<.12,'constituent techniques should connect promptly');
 assert.ok(nextPhase.time-precedingPhase.time<.12,'jo should flow into ha without a gap');
 const opening=starts.find(e=>e.phase==='jo'&&e.techniqueIndex===0&&e.stageIndex===1);
 assert.ok(runtime.inspect().frame.actors.find(e=>e.id==='a'));assert.ok(opening);
});
