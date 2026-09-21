import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {createCanonicalPresentationDriver} from '../../../packages/johakyu-presentation/src/driver.js';
import {resolveJohakyuLocomotion,resolveJohakyuMotion} from '../../../packages/johakyu-combat/src/motion-contract.js';

const stageSource=()=>readFileSync(new URL('../src/nocturne-stage.js',import.meta.url),'utf8');
const hudCss=()=>readFileSync(new URL('../src/nocturne/johakyu-p7-readout.css',import.meta.url),'utf8');

test('battle2 keeps only 1v1 and 1v3 controls and never wires inspiration',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),stage=stageSource();
 assert.match(html,/<h1>序破急バトル<\/h1>/);assert.equal((html.match(/data-battle-mode=/g)||[]).length,2);assert.match(html,/data-battle-mode="duel"/);assert.match(html,/data-battle-mode="oneVsThree"/);
 assert.doesNotMatch(html+stage,/inspiration|hirameki|閃き|battle-inspire|pendingDiscoveries/i);
 assert.match(html,/data-combat-phase="jo"/);assert.match(html,/data-combat-phase="ha"/);assert.match(html,/data-combat-phase="kyu"/);assert.match(html,/battle-sequence-history/);
});

test('review fixture is a real phase -> technique -> stage composition, not fixed phase tactics',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'}),composition=scenario.composition.hero;
 assert.deepEqual(composition.jo.map(row=>row.id),['action.feint','action.side-step']);
 assert.deepEqual(composition.ha.map(row=>row.id),['action.guard-step','action.counter']);
 assert.deepEqual(composition.kyu.map(row=>row.id),['action.crash','action.precision']);
 for(const phase of ['jo','ha','kyu'])for(const technique of composition[phase]){
   assert.equal(technique.phase,phase);assert.ok(technique.stages.length>=1&&technique.stages.length<=3);
   technique.stages.forEach((stage,index)=>{assert.equal(stage.index,index);assert.equal(stage.phase,phase);assert.equal(stage.techniqueId,technique.id);});
 }
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/const TACTICS=|const TEMPO=|DAMAGE=Object\.freeze\(\{jo:/);
 assert.match(source,/compileTechniqueComposition/);assert.match(source,/techniqueFromCombatForm/);assert.match(source,/advanceCursor/);
});

test('1v1 executes only configured techniques and keeps stage order inside each chain',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'}),composition=scenario.composition.hero,seen=new Set(),rows=[];
 for(let i=0;i<1500;i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self),action=hero?.action;
   if(!action||action.scope==='combat-reaction'||seen.has(action.id))continue;seen.add(action.id);
   const technique=composition[action.phase][action.techniqueIndex],stage=technique?.stages[action.stageIndex];
   assert.ok(technique,'configured technique');assert.ok(stage,'configured stage');
   assert.equal(action.techniqueId,technique.id);assert.equal(action.name,technique.name);assert.equal(action.motion.kind,stage.kind);assert.equal(action.footwork,stage.step.footwork);
   rows.push({battleId:r.frame.battleId,phase:action.phase,techniqueId:action.techniqueId,techniqueIndex:action.techniqueIndex,stageIndex:action.stageIndex});
 }
 assert.ok(rows.length>12);
 const firstBattle=rows.filter(row=>row.battleId===rows[0].battleId),firstSeen=new Set(),ordered=[];
 for(const row of firstBattle){const key=`${row.phase}:${row.techniqueIndex}:${row.stageIndex}`;if(firstSeen.has(key))continue;firstSeen.add(key);ordered.push(key);}
 const canonical=[
   'jo:0:0','jo:0:1','jo:0:2','jo:1:0','jo:1:1','jo:1:2',
   'ha:0:0','ha:0:1','ha:0:2','ha:1:0','ha:1:1','ha:1:2',
   'kyu:0:0','kyu:0:1','kyu:0:2','kyu:1:0','kyu:1:1','kyu:1:2'
 ];
 assert.ok(ordered.length>=12,'real combat should reach the later chain before resolution');
 assert.ok(ordered.some(key=>key.startsWith('kyu:')),'real combat should reach 急 when uninterrupted enough');
 assert.deepEqual(ordered,canonical.slice(0,ordered.length),'observed stages must remain a canonical prefix without skips');
});

test('phase changes only when the configured chain completes',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let previous='jo',battleId='',changes=[];
 for(let i=0;i<1500;i++){
   const r=scenario.step(1/60),phase=r.meta.phase;
   if(battleId===r.meta.battleId&&phase!==previous)changes.push({from:previous,to:phase,trace:r.trace?.at?.(-1)});
   battleId=r.meta.battleId;previous=phase;
 }
 const trace=scenario.inspect().trace.filter(row=>row.type==='phase-change');
 assert.ok(trace.some(row=>row.phase==='ha'&&row.reason==='configured-chain-complete'));
 assert.ok(trace.some(row=>row.phase==='kyu'&&row.reason==='configured-chain-complete'));
 assert.doesNotMatch(JSON.stringify(trace),/opening-read|decisive-opening|danger-window/);
});

test('1v3 retains canonical impact, body and stamina state',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree'}),ids=new Set();let maxInjury=0,minStamina=100;
 for(let i=0;i<900;i++){const r=scenario.step(1/60);assert.equal(r.frame.reviewMode,'oneVsThree');assert.equal(r.frame.actors.length,4);assert.equal(r.frame.actors.filter(a=>a.side==='party').length,1);assert.equal(r.frame.actors.filter(a=>a.side==='enemy').length,3);minStamina=Math.min(minStamina,r.meta.stamina);for(const a of r.frame.actors)for(const b of Object.values(a.body))maxInjury=Math.max(maxInjury,b.severity);for(const e of r.events){assert.ok(!ids.has(e.id));ids.add(e.id);assert.ok(e.techniqueId);assert.ok(e.stageLabel);}}
 assert.ok(ids.size>0);assert.ok(maxInjury>0);assert.ok(minStamina<100);
});


test('canonical footwork persists in world space and only reachable impacts become hits',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let origin=null,maxTravel=0,hits=0;
 for(let i=0;i<900;i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);origin??={...hero.position};
   maxTravel=Math.max(maxTravel,Math.hypot(hero.position.x-origin.x,hero.position.z-origin.z));
   for(const event of r.events.filter(e=>e.type==='player-hit')){
     hits++;assert.ok(Number.isFinite(event.contactDistance));assert.equal(event.contactReach,2.35);
     assert.ok(event.contactDistance<=event.contactReach+1e-9,`out-of-range hit: ${event.contactDistance}`);
   }
 }
 assert.ok(maxTravel>.2,`footwork must persist beyond a cosmetic offset: ${maxTravel}`);assert.ok(hits>0);
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(source,/selectReachableTarget/);assert.match(source,/type:'miss'/);assert.doesNotMatch(source,/function footworkOffset/);
});


test('authored sword motions expose contact timing and blade trajectory metadata',()=>{
 const slash=resolveJohakyuMotion({weapon:'sword',kind:'slash',phase:'jo'}),parry=resolveJohakyuMotion({weapon:'sword',kind:'parry',phase:'uke'});
 assert.equal(slash.supported,true);assert.ok(slash.contactProgress>.45&&slash.contactProgress<.65);assert.ok(['left','right'].includes(slash.deflect));assert.notEqual(slash.bladeTrajectory,'neutral');
 assert.equal(parry.supported,true);assert.ok(parry.contactProgress>.3&&parry.contactProgress<.6);assert.equal(parry.clip,'Block_Hit');
});

test('duel body clearance prevents mesh penetration and parry exposes a weapon-clash point',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let minDistance=Infinity,parry=null,parryFrame=null;
 for(let i=0;i<900&&(!parry||i<240);i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self),enemy=r.frame.actors.find(a=>a.id==='enemy-a'),distance=Math.hypot(hero.position.x-enemy.position.x,hero.position.z-enemy.position.z);
   minDistance=Math.min(minDistance,distance);
   const event=r.events.find(e=>e.type==='parry');
   if(event&&!parry){parry=event;parryFrame={hero:{...hero.position},enemy:{...enemy.position}};}
 }
 assert.ok(minDistance>=1.459,`body centers must never collapse through each other: ${minDistance}`);
 assert.ok(parry,'duel must produce a parry');
 assert.equal(parry.bodyClearance,1.46);assert.ok(parry.contactDistance>=parry.bodyClearance-.001);assert.ok(parry.sourceProgress>=parry.sourceContactProgress-.001);assert.ok(parry.defenseContactProgress>.3&&parry.defenseContactProgress<.6);
 assert.ok(Number.isFinite(parry.contactPoint?.x)&&Number.isFinite(parry.contactPoint?.z),'parry must expose a real clash point');
 const midpoint={x:(parryFrame.hero.x+parryFrame.enemy.x)/2,z:(parryFrame.hero.z+parryFrame.enemy.z)/2};
 assert.ok(Math.hypot(parry.contactPoint.x-midpoint.x,parry.contactPoint.z-midpoint.z)<.01,'clash point must sit between the two weapon bearers');
});

test('a real miss breaks the current chain and restarts its phase from the first stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',duelGap:3.6});let proof=null;
 for(let i=0;i<900&&!proof;i++){
   scenario.step(1/60);const trace=scenario.inspect().trace;
   const missIndex=trace.findIndex(row=>row.type==='miss'&&row.sourceId==='hero');
   if(missIndex<0)continue;
   const breakIndex=trace.findIndex((row,index)=>index>missIndex&&row.type==='chain-break'&&row.reason==='miss');
   if(breakIndex<0)continue;
   const restart=trace.slice(breakIndex+1).find(row=>row.type==='stage-start');
   if(restart)proof={broken:trace[breakIndex],restart};
 }
 assert.ok(proof,'miss must produce a chain break followed by a restart');
 assert.equal(proof.restart.phase,proof.broken.phase);assert.equal(proof.restart.techniqueIndex,proof.broken.techniqueIndex);assert.equal(proof.restart.stageIndex,0);
});

test('an early incoming hit breaks an unprotected chain instead of retrying a later stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',enemyLeadSeconds:.3});let proof=null;
 for(let i=0;i<1200&&!proof;i++){
   scenario.step(1/60);const trace=scenario.inspect().trace;
   const breakIndex=trace.findIndex(row=>row.type==='chain-break'&&row.reason==='hit-before-contact');
   if(breakIndex<0)continue;
   const restart=trace.slice(breakIndex+1).find(row=>row.type==='stage-start');
   if(restart)proof={broken:trace[breakIndex],restart};
 }
 assert.ok(proof,'early real contact must break the chain');
 assert.equal(proof.restart.phase,proof.broken.phase);assert.equal(proof.restart.techniqueIndex,proof.broken.techniqueIndex);assert.equal(proof.restart.stageIndex,0);
});


test('real guard and parry resolve incoming contact before damage and parry arms a counter',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let parry=null,counter=null;
 for(let i=0;i<720&&!(parry&&counter);i++){
   const r=scenario.step(1/60);
   parry=parry||r.events.find(event=>event.type==='parry'&&event.targetId==='hero');
   counter=counter||r.events.find(event=>event.type==='player-hit'&&event.counter===true);
 }
 assert.ok(parry,'authored parry stage must intercept a real incoming contact');
 assert.equal(parry.damage,0);assert.equal(parry.blocked,true);assert.equal(parry.parried,true);assert.ok(['left','right'].includes(parry.parryDirection));
 assert.ok(counter,'counter stage must only land from the armed parry window');
 assert.ok(counter.damage>0);assert.equal(counter.counter,true);
});

test('1v1 creates situational breathing room before re-engaging instead of permanent contact',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let minDistance=Infinity,maxDistance=0,sawMovingReset=false;
 for(let i=0;i<900;i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self),enemy=r.frame.actors.find(a=>a.id==='enemy-a'),distance=Math.hypot(hero.position.x-enemy.position.x,hero.position.z-enemy.position.z);
   minDistance=Math.min(minDistance,distance);maxDistance=Math.max(maxDistance,distance);
   if((hero.moving&&!hero.action)||(enemy.moving&&!enemy.action))sawMovingReset=true;
 }
 const trace=scenario.inspect().trace,offenseStarts=trace.filter(row=>row.type==='stage-start'&&['slash','back','thrust','pierce','heavy','diagonal','sweep','counter','bash','pommel'].includes(row.kind));
 assert.ok(trace.some(row=>row.type==='maneuver-start'&&row.reason==='engage-range'),'attack must be earned by approach');
 assert.ok(trace.some(row=>row.type==='maneuver-start'&&['hit-withdrawal','guard-recoil','parried-recoil','countered-withdrawal','reset-angle'].includes(row.reason)),'an exchange must reshape spacing');
 assert.ok(sawMovingReset,'between-action footwork must be visible in canonical frames');
 assert.ok(maxDistance-minDistance>.45,`distance must breathe rather than pin: ${minDistance}..${maxDistance}`);
 assert.ok(offenseStarts.length>3);assert.ok(offenseStarts.every(row=>row.distance<=3.161),JSON.stringify(offenseStarts.slice(0,5)));
 assert.ok(offenseStarts.some(row=>row.distance>2.35),'step-in attacks should be allowed to begin at the edge of measure before real contact');
 const starts=trace.filter(row=>row.type==='stage-start').map(row=>row.time),gaps=starts.slice(1).map((time,index)=>time-starts[index]);
 assert.ok(gaps.some(gap=>gap>.3),'combat rhythm needs at least one real settle/reposition gap');
});

test('parry visibly seizes initiative, counter follows, and the countered actor withdraws before resuming',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let parry=null,counter=null;
 for(let i=0;i<900&&!(parry&&counter);i++){const r=scenario.step(1/60);parry=parry||r.events.find(e=>e.type==='parry'&&e.targetId==='hero');counter=counter||r.events.find(e=>e.type==='player-hit'&&e.counter===true);}
 assert.ok(parry);assert.ok(counter);
 const trace=scenario.inspect().trace,parryIndex=trace.findIndex(row=>row.type==='parry'&&row.id===parry.id),counterIndex=trace.findIndex(row=>row.type==='player-hit'&&row.id===counter.id&&row.counter);
 assert.ok(parryIndex>=0&&counterIndex>parryIndex,'counter must read after the authored parry contact');
 const recoil=trace.slice(parryIndex,counterIndex+1).find(row=>row.type==='maneuver-start'&&row.actorId===parry.sourceId&&row.reason==='parried-recoil');
 assert.ok(recoil);assert.equal(recoil.footwork,'retreat');
 const withdrawal=trace.slice(counterIndex).find(row=>row.type==='maneuver-start'&&row.actorId===counter.targetId&&row.reason==='countered-withdrawal');
 assert.ok(withdrawal);assert.equal(withdrawal.footwork,'retreat');
 let lockedFrames=0;
 for(let i=0;i<24;i++){const r=scenario.step(1/60),actor=r.frame.actors.find(a=>a.id===counter.targetId);if(!actor.action)lockedFrames++;}
 assert.ok(lockedFrames>=18,'countered side must not immediately restart an attack');
});

test('shared presentation forwards authored guard/parry contacts while still suppressing blocked damage events',()=>{
 const delivered=[],port={supports:()=>({supported:true}),spawn:row=>({id:row.id}),remove(){},update(){},impact:event=>delivered.push(event.type)};
 const driver=createCanonicalPresentationDriver(port),base={version:1,authority:'rinne-domain',battleId:'defense',epoch:1,revision:1,actors:[{id:'hero',self:true},{id:'enemy'}],obstacles:[],projectiles:[]};
 driver.present(base,0);
 driver.present({...base,revision:2},1/60,[
   {id:'parry',type:'parry',blocked:true,damage:0,sourceId:'enemy',targetId:'hero'},
   {id:'guard',type:'guard',blocked:true,damage:0,sourceId:'enemy',targetId:'hero'},
   {id:'blocked-hit',type:'enemy-hit',blocked:true,damage:8,sourceId:'enemy',targetId:'hero'}
 ]);
 assert.deepEqual(delivered,['parry','guard']);driver.dispose();
});

test('threat-driven reaction parry can occur outside the configured technique cursor and create a counter opportunity',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',duelGap:2.4,heroStartPhase:'kyu',heroStartTechniqueIndex:0,enemyLeadSeconds:.5});let parry=null,counter=null,reactionFrame=null;
 for(let i=0;i<1200&&!(parry&&counter&&reactionFrame);i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);reactionFrame=reactionFrame||(hero?.action?.scope==='combat-reaction'?hero.action:null);parry=parry||r.events.find(e=>e.type==='parry'&&e.targetId==='hero'&&e.defenseScope==='combat-reaction');counter=counter||r.events.find(e=>e.type==='player-hit'&&e.sourceId==='hero'&&e.counter===true);}
 assert.ok(reactionFrame,'reaction must use a separate action scope');assert.ok(parry,'an incoming threat must be parryable between configured technique stages');assert.ok(counter,'parry must create a real counter opportunity');
 const trace=scenario.inspect().trace,parryStart=trace.find(row=>row.type==='reaction-start'&&row.actorId==='hero'&&row.reaction==='parry');
 assert.ok(parryStart);assert.equal(parryStart.contextTechniqueId,'action.crash','reaction must preserve the technique cursor instead of impersonating action.counter');
});

test('parry direction opens an angled counter lane instead of returning straight through center',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',duelGap:2.4,heroStartPhase:'kyu',heroStartTechniqueIndex:0,enemyLeadSeconds:.5});let parry=null,counterAction=null;
 for(let i=0;i<1200&&!(parry&&counterAction);i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);
   parry=parry||r.events.find(e=>e.type==='parry'&&e.targetId==='hero'&&e.defenseScope==='combat-reaction');
   if(parry&&hero?.action?.scope==='combat-reaction'&&hero.action.reaction==='counter')counterAction=hero.action;
 }
 assert.ok(parry);assert.ok(counterAction,'parry must create an observable reaction counter');
 assert.equal(counterAction.parryDirection,parry.parryDirection);
 assert.equal(counterAction.footwork,parry.parryDirection==='right'?'counterR':'counterL');
});

test('side and orbit spacing use authored strafe clips that exist on both combat actors',()=>{
 const expected={sideL:'Running_Strafe_Left',sideR:'Running_Strafe_Right',orbitL:'Running_Strafe_Left',orbitR:'Running_Strafe_Right',retreat:'Walking_Backwards'},manifest=JSON.parse(readFileSync(new URL('../src/nocturne/manifest.json',import.meta.url),'utf8'));
 for(const [footwork,clip] of Object.entries(expected)){const binding=resolveJohakyuLocomotion({footwork});assert.equal(binding.supported,true);assert.equal(binding.clip,clip);for(const id of ['adventurers/Knight','skeletons/Skeleton_Warrior'])assert.ok(manifest.models[id].animations.includes(clip),id+'/'+clip);}
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');assert.match(source,/resolveJohakyuLocomotion/);assert.match(source,/reason:'reset-angle'/);
});

test('battle2 presentation layers hit reactions, local hit stop, two-actor framing and self-hosted positional SFX without removing fatigue',()=>{
 const runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8'),audio=readFileSync(new URL('../src/nocturne/audio.js',import.meta.url),'utf8'),sharedAudio=readFileSync(new URL('../../../packages/johakyu-presentation/src/audio.js',import.meta.url),'utf8');
 assert.match(runtime,/resolveFatiguePresentation/);assert.match(runtime,/applyFatigue\(a,row,dt\)/);assert.match(runtime,/reactionClip=\['head','leftArm','rightArm'\]\.includes\(event\.bodyPart\)\?'Hit_B':'Hit_A'/);
 assert.match(runtime,/game\.hitstop=Math\.max/);assert.match(runtime,/midpoint=opponent\?hero\.pos\.clone\(\)\.lerp\(opponent\.pos,\.5\)/);assert.match(runtime,/camera\.zoom=lerp/);
 assert.match(runtime,/sound\.swing\?\./);assert.match(runtime,/sound\.parry\?\./);assert.match(runtime,/sound\.impact\?\./);assert.match(runtime,/event\.contactPoint/);assert.match(runtime,/bladeClashPoint/);assert.match(runtime,/function weaponAxis/);assert.match(runtime,/sampleWeaponTrace/);assert.match(runtime,/deflectionFromBladeTrace/);assert.match(runtime,/syncContactPose/);assert.match(runtime,/source\.parryRecoil=/);assert.match(runtime,/collectParryRig/);assert.match(runtime,/applyParryRecoil\(a\)/);assert.match(runtime,/contactHold/);assert.match(sharedAudio,/createStereoPanner/);assert.match(sharedAudio,/fatigueVoices/);
 for(const path of [
  '../public/library/audio/kenney/sword-swing/368a5d13d3b2cc9d0bf6abe86c5ba950e49aaeb4.ogg',
  '../public/library/audio/kenney/sword-metal/7c57bffa367f23199029ef8dade2643b58627e98.ogg',
  '../public/library/audio/kenney-impact-additions/impactmetal-heavy-002/4e1053cad3e3aa16694ffefad1789b3343373aa0.ogg',
  '../public/library/audio/kenney/footstep-00/7ea335755952eb5570f72d9581d1dfce6536d6b9.ogg'
 ])assert.equal(existsSync(new URL(path,import.meta.url)),true,path);
 assert.match(audio,/BATTLE2_SOUND_SAMPLES/);
});

test('battle2 consumes canonical actor capability without duplicating the next injury layer',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');assert.match(source,/johakyuActorCapability/);assert.match(source,/capability\.canAttack/);assert.match(source,/capability:\{canMove:capability\.canMove,canAttack:capability\.canAttack/);assert.doesNotMatch(source,/johakyuStageCapability|void capability/);
});

test('battle2 shows the current build version from canonical build info',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),stage=stageSource(),css=readFileSync(new URL('../src/battle2.css',import.meta.url),'utf8');
 assert.match(html,/id="battle2-version"/);assert.match(stage,/__BUILD_INFO__\?\.commit/);assert.match(stage,/DEV · \$\{buildCommit\.slice\(0,7\)\}/);assert.match(css,/\.battle2-version\{/);
});

test('HUD metadata comes from the executing technique and stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let checked=0;
 for(let i=0;i<480;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(!hero.action)continue;checked++;
   assert.equal(r.meta.phase,hero.action.phase);assert.equal(r.meta.techniqueId,hero.action.techniqueId);assert.equal(r.meta.techniqueName,hero.action.name);
   assert.equal(r.meta.stageIndex,hero.action.stageIndex);assert.equal(r.meta.stageLabel,hero.action.stageLabel);assert.equal(r.meta.chainLabel,hero.action.chainLabel);
 }
 assert.ok(checked>120);
});

test('HUD follows the canonical self actor feet and stays terse',()=>{
 const stage=stageSource(),css=hudCss(),html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8');
 const runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js',import.meta.url),'utf8');
 assert.match(runtime,/self\(a\)\{hero=a;selfBinding=a;\}/);assert.match(runtime,/footAnchor\(\)\{if\(!selfBinding\)return null/);
 assert.match(controller,/footAnchor:\(\)=>driven\.footAnchor/);assert.match(stage,/function positionHud\(\)/);assert.match(stage,/runtime\?\.footAnchor\?\.\(\)/);
 assert.match(stage,/hud\.style\.left/);assert.match(stage,/hud\.style\.top/);assert.doesNotMatch(html,/間合いを測っている/);
 assert.match(stage,/function shortActionName/);assert.match(stage,/line\.textContent=row\.label/);
 assert.doesNotMatch(stage,/currentNode\.textContent=.*meta\.stamina|currentNode\.textContent=.*injury/i);
});

test('HUD centers 破 on the hero axis and spans 間合い through 残心',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),css=hudCss();
 assert.ok(html.includes('battle-sequence-hud__edge--maai')&&html.includes('間合い'));assert.ok(html.includes('battle-sequence-hud__edge--zanshin')&&html.includes('残心'));
 assert.ok(css.includes('grid-template-columns:minmax(58px,1fr) 28px 44px 28px 44px 28px minmax(58px,1fr)'));
 assert.ok(css.includes('.battle-sequence-hud__edge path{'));
});

test('action history remains floating text rather than a list repaint',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/spawnActionText/);assert.match(stage,/historyNode\.append\(line\)/);assert.match(stage,/animationend/);assert.match(stage,/setTimeout\(remove,4200\)/);
 assert.doesNotMatch(stage,/historyNode\.replaceChildren\(\.\.\.history\.map/);
 assert.match(css,/\.battle-sequence-history__float\{/);assert.match(css,/position:absolute/);assert.match(css,/johakyu-text-drift 3\.7s/);assert.match(css,/@keyframes johakyu-text-drift/);
 assert.doesNotMatch(css,/battle-sequence-history__float[^}]*background:/);
});

test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});
