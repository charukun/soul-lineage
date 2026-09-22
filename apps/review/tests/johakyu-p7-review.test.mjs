import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {createCanonicalPresentationDriver} from '../../../packages/johakyu-presentation/src/driver.js';
import {resolveJohakyuLocomotion,resolveJohakyuMotion} from '../../../packages/johakyu-combat/src/motion-contract.js';
import {BATTLE2_VERSION} from '../src/battle2-version.js';

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


test('browser battle2 resolves damage from rendered weapon sweeps against bone-following body capsules',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),controller=readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js',import.meta.url),'utf8'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8'),driver=readFileSync(new URL('../../../packages/johakyu-presentation/src/driver.js',import.meta.url),'utf8');
 assert.match(runtime,/function collectBodyContactRig/);assert.match(runtime,/function bodyContactCapsules/);assert.match(runtime,/function sweptWeaponBodyContact/);assert.match(runtime,/previousAxis/);assert.match(runtime,/engine:'weapon-body-sweep'/);assert.match(runtime,/BODY_CONTACT_SKIN=\.065/);assert.match(runtime,/radii=\{head:\.21,torso:\.285/);assert.match(runtime,/covered=new Set/);
 assert.match(driver,/sampleContacts/);assert.match(controller,/scenario\.step\(dt,physicalContacts\)/);assert.match(controller,/driven\.sampleContacts/);
 assert.match(source,/function physicalContactFor/);assert.match(source,/contactEngine:'weapon-body-sweep'/);assert.match(source,/part:physical\?\.bodyPart/);assert.match(source,/contactPoint/);
});

test('authored sword motions expose contact timing and blade trajectory metadata',()=>{
 const slash=resolveJohakyuMotion({weapon:'sword',kind:'slash',phase:'jo'}),parry=resolveJohakyuMotion({weapon:'sword',kind:'parry',phase:'uke'});
 assert.equal(slash.supported,true);assert.ok(slash.contactProgress>.45&&slash.contactProgress<.65);assert.ok(['left','right'].includes(slash.deflect));assert.notEqual(slash.bladeTrajectory,'neutral');
 assert.equal(parry.supported,true);assert.ok(parry.contactProgress>.3&&parry.contactProgress<.6);assert.equal(parry.clip,'Block_Hit');
});

test('simultaneous attacks enter a visible authored weapon-clash pose before separating',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 assert.match(source,/Math\.abs\(action\.progress-sourceContact\)>\.24/);assert.match(source,/state\.interrupted='weapon-clash'/);assert.match(source,/otherState\.interrupted='weapon-clash'/);assert.match(source,/reason==='weapon-clash'/);
 assert.match(runtime,/function holdAuthoredContactPose/);assert.match(runtime,/holdAuthoredContactPose\(source,'Block_Hit',\.43,\.14\)/);assert.match(runtime,/holdAuthoredContactPose\(target,'Block_Hit',\.57,\.14\)/);assert.match(runtime,/game\.hitstop=Math\.max\(game\.hitstop,\.075\)/);assert.match(runtime,/poseClip:'Block_Hit'/);
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
 assert.equal(parry.bodyClearance,1.46);assert.ok(parry.contactDistance>=parry.bodyClearance-.001);assert.ok(parry.sourceContactProgress>.45&&parry.sourceContactProgress<.65);assert.ok(parry.defenseContactProgress>.3&&parry.defenseContactProgress<.6);
 assert.ok(Number.isFinite(parry.contactPoint?.x)&&Number.isFinite(parry.contactPoint?.z),'parry must expose a real clash point');
 const midpoint={x:(parryFrame.hero.x+parryFrame.enemy.x)/2,z:(parryFrame.hero.z+parryFrame.enemy.z)/2};
 assert.ok(Math.hypot(parry.contactPoint.x-midpoint.x,parry.contactPoint.z-midpoint.z)<.01,'clash point must sit between the two weapon bearers');
});

test('a real miss breaks the current chain and restarts the whole 序破急 loop from 序',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',duelGap:3.6});let proof=null;
 for(let i=0;i<900&&!proof;i++){
   scenario.step(1/60);const trace=scenario.inspect().trace;
   const missIndex=trace.findIndex(row=>row.type==='miss'&&row.sourceId==='hero');
   if(missIndex<0)continue;
   const breakIndex=trace.findIndex((row,index)=>index>missIndex&&row.type==='chain-break'&&row.reason==='miss');
   if(breakIndex<0)continue;
   const restart=trace.slice(breakIndex+1).find(row=>row.type==='stage-start'&&row.actorId==='hero');
   if(restart)proof={broken:trace[breakIndex],restart};
 }
 assert.ok(proof,'miss must produce a chain break followed by a restart');
 assert.equal(proof.broken.restartPhase,'jo');assert.equal(proof.broken.restartTechniqueIndex,0);assert.equal(proof.broken.restartStageIndex,0);assert.equal(proof.restart.phase,'jo');assert.equal(proof.restart.techniqueIndex,0);assert.equal(proof.restart.stageIndex,0);
});

test('shallow early contact retains pressure rather than breaking every attack',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree',enemyLeadSeconds:.3});let hits=0;
 for(let i=0;i<600;i++){
   const r=scenario.step(1/60);for(const event of r.events)if(event.type==='enemy-hit'&&!event.deepHit){hits++;assert.notEqual(event.exchangeContinuity,'reverse');}
 }
 assert.ok(hits>0,'real shallow contact must still apply injury and damage');
 assert.equal(scenario.inspect().trace.some(row=>row.type==='chain-break'&&row.reason==='hit-before-contact'),false);
});

test('ordinary guard retains pressure instead of breaking the offensive chain',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let guard=null;
 for(let i=0;i<1200&&!guard;i++){const r=scenario.step(1/60);guard=r.events.find(e=>e.type==='guard');}
 assert.ok(guard,'duel must produce an ordinary guard');assert.equal(guard.exchangeContinuity,'retain');assert.equal(guard.exchangeMode,'pressure');
 const trace=scenario.inspect().trace;assert.equal(trace.some(row=>row.type==='chain-break'&&row.reason==='blocked'),false,'guard must not reset a running 序破急 pressure chain');
});

test('real guard and parry resolve incoming contact before damage and parry arms a counter',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let parry=null,counter=null;
 for(let i=0;i<720&&!(parry&&counter);i++){
   const r=scenario.step(1/60);
   parry=parry||r.events.find(event=>event.type==='parry'&&event.targetId==='hero');
   counter=counter||r.events.find(event=>event.type==='player-hit'&&event.counter===true);
 }
 assert.ok(parry,'authored parry stage must intercept a real incoming contact');
 assert.equal(parry.damage,0);assert.equal(parry.blocked,true);assert.equal(parry.parried,true);assert.equal(parry.strongParry,true);assert.equal(parry.exchangeContinuity,'reverse');assert.ok(['left','right'].includes(parry.parryDirection));
 assert.ok(counter,'counter stage must only land from the armed parry window');
 assert.ok(counter.damage>0);assert.equal(counter.counter,true);
});

test('1v1 creates situational breathing room before re-engaging instead of permanent contact',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',duelGap:3.8});const observedTrace=new Map();let minDistance=Infinity,maxDistance=0,sawMovingReset=false;
 for(let i=0;i<1440;i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self),enemy=r.frame.actors.find(a=>a.id==='enemy-a'),distance=Math.hypot(hero.position.x-enemy.position.x,hero.position.z-enemy.position.z);
   for(const row of scenario.inspect().trace)observedTrace.set(JSON.stringify(row),row);
   minDistance=Math.min(minDistance,distance);maxDistance=Math.max(maxDistance,distance);
   if((hero.moving&&!hero.action)||(enemy.moving&&!enemy.action))sawMovingReset=true;
 }
 const trace=[...observedTrace.values()],offenseStarts=trace.filter(row=>row.type==='stage-start'&&['slash','back','thrust','pierce','heavy','diagonal','sweep','counter','bash','pommel'].includes(row.kind));
 assert.ok(trace.some(row=>row.type==='maneuver-start'&&row.reason==='engage-range'),'attack must be earned by approach');
 assert.ok(trace.some(row=>row.type==='maneuver-start'&&['hit-withdrawal','parried-recoil','countered-withdrawal','exchange-zanshin'].includes(row.reason)),'an exchange break must reshape spacing');
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
 assert.ok(parry);assert.equal(parry.strongParry,true);assert.ok(counter);
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
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');assert.match(source,/resolveJohakyuLocomotion/);assert.match(source,/reason:'exchange-zanshin'/);
});

test('battle2 presentation layers hit reactions, local hit stop, two-actor framing and self-hosted positional SFX without removing fatigue',()=>{
 const runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8'),audio=readFileSync(new URL('../src/nocturne/audio.js',import.meta.url),'utf8'),sharedAudio=readFileSync(new URL('../../../packages/johakyu-presentation/src/audio.js',import.meta.url),'utf8');
 assert.match(runtime,/resolveFatiguePresentation/);assert.match(runtime,/applyFatigue\(a,row,dt\)/);assert.match(runtime,/reactionClip=\['head','leftArm','rightArm'\]\.includes\(event\.bodyPart\)\?'Hit_B':'Hit_A'/);
 assert.match(runtime,/game\.hitstop=Math\.max/);assert.match(runtime,/midpoint=opponent\?hero\.pos\.clone\(\)\.lerp\(opponent\.pos,\.5\)/);assert.match(runtime,/camera\.zoom=lerp/);
 assert.match(runtime,/sound\.swing\?\./);assert.match(runtime,/sound\.parry\?\./);assert.match(runtime,/sound\.impact\?\./);assert.match(runtime,/event\.contactPoint/);assert.match(runtime,/strongParry/);assert.match(runtime,/bladeClashPoint/);assert.match(runtime,/function weaponAxis/);assert.match(runtime,/sampleWeaponTrace/);assert.match(runtime,/deflectionFromBladeTrace/);assert.match(runtime,/syncContactPose/);assert.match(runtime,/source\.parryRecoil=/);assert.match(runtime,/collectParryRig/);assert.match(runtime,/applyParryRecoil\(a\)/);assert.match(runtime,/contactHold/);assert.match(sharedAudio,/createStereoPanner/);assert.match(sharedAudio,/fatigueVoices/);
 for(const path of [
  '../public/library/audio/kenney/sword-swing/368a5d13d3b2cc9d0bf6abe86c5ba950e49aaeb4.ogg',
  '../public/library/audio/kenney/sword-metal/7c57bffa367f23199029ef8dade2643b58627e98.ogg',
  '../public/library/audio/kenney-impact-additions/impactmetal-heavy-002/4e1053cad3e3aa16694ffefad1789b3343373aa0.ogg',
  '../public/library/audio/kenney/footstep-00/7ea335755952eb5570f72d9581d1dfce6536d6b9.ogg'
 ])assert.equal(existsSync(new URL(path,import.meta.url)),true,path);
 assert.match(audio,/BATTLE2_SOUND_SAMPLES/);
});

test('battle2 consumes canonical actor capability without duplicating the next injury layer',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');assert.match(source,/johakyuActorCapability/);assert.match(source,/capability\.canAttack/);assert.match(source,/capability:\{canMove:capability\.canMove,canAttack:capability\.canAttack/);assert.match(source,/johakyuStageCapability/);assert.match(source,/stage\.allowed/);assert.doesNotMatch(source,/void capability/);
});

test('battle2 shows a human semantic version while keeping source SHA internal',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),stage=stageSource(),css=readFileSync(new URL('../src/battle2.css',import.meta.url),'utf8');
 assert.match(BATTLE2_VERSION,/^\d+\.\d+\.\d+$/);assert.equal(BATTLE2_VERSION,'2.2.27');
 assert.match(html,/id="battle2-version"/);assert.match(stage,/versionNode\.textContent=`v\$\{BATTLE2_VERSION\}`/);assert.match(stage,/get version\(\)\{return BATTLE2_VERSION;\}/);
 assert.match(stage,/get sourceSha\(\)\{return __BUILD_INFO__\.commit;\}/);assert.doesNotMatch(stage,/buildCommit|\.slice\(0,7\)|DEV ·/);assert.match(css,/\.battle2-version\{/);
});

test('HUD follows exchange initiative instead of leaving stale jo ha kyu lit while defending',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',heroStartPhase:'ha',heroStartTechniqueIndex:1,enemyLeadSeconds:.2});let sawOffense=false,sawDefense=false,sawZanshin=false;
 for(let i=0;i<1200&&!(sawOffense&&sawDefense&&sawZanshin);i++){const r=scenario.step(1/60),meta=r.meta;
  if(['jo','ha','kyu'].includes(meta.hudState)){sawOffense=true;assert.equal(meta.initiativeId,'hero');assert.equal(meta.exchangeMode,'pressure');}
  if(meta.hudState==='maai'){sawDefense=true;const action=r.frame.actors.find(a=>a.self)?.action;assert.ok(meta.exchangeMode!=='pressure'||meta.initiativeId!=='hero'||action?.scope==='combat-reaction'||action?.scope==='combat-counter-transition');}
  if(meta.hudState==='zanshin'){sawZanshin=true;assert.equal(meta.exchangeMode,'zanshin');assert.equal(meta.completedBy,'hero');}
 }
 assert.ok(sawOffense,'offensive pressure must still light a jo ha kyu step');assert.ok(sawDefense,'defense/read must return to the left maai edge');assert.ok(sawZanshin,'exchange completion must light zanshin');
});

test('HUD metadata comes from the executing technique and stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let checked=0;
 for(let i=0;i<480;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(!hero.action)continue;checked++;
   assert.equal(r.meta.phase,hero.action.phase);assert.equal(r.meta.techniqueId,hero.action.techniqueId);assert.equal(r.meta.techniqueName,hero.action.name);
   assert.equal(r.meta.stageIndex,hero.action.stageIndex);assert.equal(r.meta.stageLabel,hero.action.stageLabel);assert.equal(r.meta.chainLabel,hero.action.chainLabel);
 }
 assert.ok(checked>120);
});

test('HUD is fixed to the screen center while preserving exchange state',()=>{
 const stage=stageSource(),css=hudCss(),html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8');
 assert.ok(!stage.includes('function positionHud')&&!stage.includes('footAnchor')&&!stage.includes('hud.style.left')&&!stage.includes('hud.style.top'));
 assert.ok(stage.includes("hud.dataset.anchored='true'"));assert.ok(stage.includes("const hudState=meta.hudState||'maai'"));assert.ok(stage.includes('phasePanel.dataset.phase=hudState'));
 assert.ok(css.includes('left:50%;top:50%'));assert.ok(css.includes('grid-template-columns:36px 24px 27px 24px 27px 24px 36px'));
 assert.doesNotMatch(html,/>間合い<|>残心</);assert.ok(stage.includes('function shortActionName'));assert.ok(stage.includes('line.textContent=historyDisplayLabel(row)'));
});

test('HUD centers 破 with symmetric exchange waveforms and no scale recentering',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),css=hudCss();
 assert.ok(html.includes('battle-sequence-hud__edge--maai')&&html.includes('battle-sequence-hud__edge--zanshin'));
 assert.ok(css.includes('grid-template-columns:36px 24px 27px 24px 27px 24px 36px'));assert.ok(css.includes('width:198px'));
 assert.doesNotMatch(css,/battle-sequence-hud__phase[^}]*transform:scale/);assert.ok(css.includes('[data-phase="maai"] .battle-sequence-hud__edge--maai'));assert.ok(css.includes('[data-phase="zanshin"] .battle-sequence-hud__edge--zanshin'));
});

test('action history is a paced single-line flow of semantic beats and technique chains',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/HISTORY_DISPLAY_MS=3200/);assert.match(stage,/historyQueue/);assert.match(stage,/drainHistoryQueue/);assert.match(stage,/historyDisplayLabel/);
 assert.match(stage,/historyNode\.replaceChildren\(line\)/);assert.match(stage,/animationend/);assert.match(stage,/kind:'technique'/);assert.match(stage,/kind:'semantic'/);
 assert.match(stage,/function actionHistoryKey/);assert.match(stage,/連「\$\{name\}」/);assert.doesNotMatch(stage,/\$\{meta\.stageIndex\+1\}段/);
 for(const copy of ['間合いを取る','武器で弾いた','様子を見る','仕切り直す'])assert.ok(stage.includes(copy),copy);
 assert.match(stage,/interrupted\?'maai'/);assert.match(stage,/seenNarration/);
 assert.match(css,/\.battle-sequence-history__flow\{/);assert.match(css,/johakyu-history-flow 3\.2s/);assert.match(css,/@keyframes johakyu-history-flow/);
 assert.doesNotMatch(css,/battle-sequence-history__float/);
});

test('battle2 lamps fill left to right, fade together on interruption, and maai breathes while waiting',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/node\.dataset\.lit=String\(index>=0&&i<=index\)/);assert.match(stage,/link\.dataset\.lit=String\(index>i\)/);assert.match(stage,/link\.dataset\.current=String\(index===i\)/);
 assert.match(stage,/beginComboFade/);assert.match(stage,/COMBO_FADE_MS=900/);assert.match(css,/data-lit="true"/);assert.match(css,/data-combo-interrupted="true"/);
 assert.match(css,/johakyu-maai-pulse 1\.38s/);assert.match(css,/@keyframes johakyu-maai-pulse/);
});

test('phase activations hold a half-second stance, chime, and emissive cue',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),stage=stageSource(),audio=readFileSync(new URL('../src/nocturne/audio.js',import.meta.url),'utf8'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 assert.match(source,/PHASE_CUE_SECONDS=\.5/);assert.match(source,/clip:'Blocking'/);assert.match(source,/clip:'1H_Melee_Attack_Slice_Diagonal'/);assert.match(source,/clip:'1H_Melee_Attack_Stab'/);assert.match(source,/glow:'#ff8f32'/);assert.match(source,/glow:'#ffa447'/);assert.match(source,/glow:'#ffbb63'/);assert.match(source,/phaseCueKey:/);
 assert.match(stage,/sound\?\.phaseCue\?\./);assert.match(audio,/function phaseCue/);assert.match(audio,/sound\.parry\?\./);
 assert.match(runtime,/unaccepted-phase-cue/);assert.match(runtime,/phase-cue:/);assert.match(runtime,/cueGlow/);
});

test('battle2 defaults to defense, retreats on broken chains, and makes landed hits costly',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(source,/DEFENSE_COOLDOWN=Object\.freeze\(\{guard:\.24,parry:\.3,slip:\.2\}\)/);assert.match(source,/cycle=\['parry','slip','guard'\]/);
 assert.match(source,/reason:'combo-break-retreat',footwork:'retreat'/);assert.match(source,/reactionCooldowns\.set\(target\.id/);
 assert.match(source,/heavy:24/);assert.match(source,/counter:21/);assert.match(source,/damage\*1\.4/);
});

test('burst choreography gives player varied non-horizontal attacks and enemies a distinct attack set',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 assert.match(source,/HERO_BURST_PRESENTATION/);assert.match(source,/1H_Melee_Attack_Slice_Diagonal/);assert.match(source,/1H_Melee_Attack_Stab/);assert.match(source,/1H_Melee_Attack_Chop/);
 assert.match(source,/ENEMY_BURST_PRESENTATION/);assert.match(source,/1H_Melee_Attack_Jump_Chop/);assert.match(source,/1H_Melee_Attack_Slice_Horizontal/);
 assert.match(source,/presentationClip/);assert.match(runtime,/row\.action\?\.presentationClip/);
});

test('phase cue glow visibly blinks instead of holding a steady emissive level',()=>{
 const runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 assert.match(runtime,/cueBlink/);assert.match(runtime,/Math\.sin\(cueProgress\*Math\.PI\*4\)/);assert.match(runtime,/cueColor&&cueBlink/);
});

test('battle2 enemy respawn reuses the battlebk ground-spawn animation and timing',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 assert.match(source,/spawnStyle:actor\.side==='enemy'\?'battlebk-ground':null/);assert.match(source,/seedReadyWindow\(\.82\)/);
 assert.match(runtime,/spawnStyle==='battlebk-ground'/);assert.match(runtime,/Spawn_Ground_Skeletons/);assert.match(runtime,/spawnClip\?\.8:0/);
});

test('battle2 enemy durability matches the battlebk opening-wave baseline',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree'}),actors=scenario.inspect().frame.actors.filter(row=>row.side==='enemy');
 assert.equal(actors.length,3);for(const actor of actors){assert.equal(actor.hp,46);assert.equal(actor.maxHp,46);}
});

test('battle2 enemies attack once per opening, circle in range, and use battlebk-like outgoing damage',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(source,/ENEMY_DAMAGE_SCALE=\.45/);assert.match(source,/'enemy-attack-reset':\.9/);
 assert.match(source,/actor\.side==='enemy'&&state\.motion\.offense/);assert.match(source,/breakChain\(actor,state,'enemy-attack-reset'\)/);
 assert.match(source,/reason==='enemy-attack-reset'/);assert.match(source,/reason:'enemy-reset-circle'/);assert.match(source,/footwork=cursor\.cycle%2\?'orbitL':'orbitR'/);
 assert.match(source,/source\.side==='enemy'\?Math\.max\(1,Math\.round\(baseDamage\*ENEMY_DAMAGE_SCALE\)\):baseDamage/);
});

test('public battle2 uses authored technique specs and footwork instead of the basic burst loop',()=>{
 const controller=readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js',import.meta.url),'utf8'),source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(controller,/comboStyle:'composed'/);assert.doesNotMatch(controller,/comboStyle:'burst'/);
 for(const id of ['action.feint','action.side-step','action.guard-step','action.counter','action.crash','action.precision'])assert.ok(source.includes(id),id);
 for(const footwork of ["sideR","cross","retreat","sideL","chase","forward"])assert.ok(source.includes(footwork),footwork);
 assert.match(source,/actor\.side==='enemy'&&stageDamage\(node\.stage\)>0\?burstPresentationClip/);
});

test('battle2 and 百年転生 consume the same shared 心技体装 component and visual skin',()=>{
 const ui=readFileSync(new URL('../src/nocturne/battle2-loadout.js',import.meta.url),'utf8'),stage=stageSource(),controller=readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js',import.meta.url),'utf8'),source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8'),css=readFileSync(new URL('../src/battle2.css',import.meta.url),'utf8'),shared=readFileSync(new URL('../../../packages/shared-ui/src/rinne-primary-four.js',import.meta.url),'utf8'),sharedCss=readFileSync(new URL('../../../packages/shared-ui/src/rinne-primary-four.css',import.meta.url),'utf8');
 assert.match(ui,/rinnePrimaryFourMarkup/);assert.match(ui,/@soul\/shared-ui\/rinne-primary-four\.css/);for(const attr of ['data-heart','data-techniques','data-body','data-items'])assert.match(shared,new RegExp(attr));
 assert.match(sharedCss,/--rinne-four-heart:#e9a6a4/);assert.match(sharedCss,/--rinne-four-technique:#91c9dc/);assert.match(sharedCss,/--rinne-four-body:#b8b0d7/);assert.match(sharedCss,/--rinne-four-items:#e5b579/);
 assert.doesNotMatch(css,/\.battle2-loadout-nav \.upgrade-control/);
 assert.match(stage,/createBattle2LoadoutUI/);assert.match(stage,/loadout:loadoutUI\.value/);assert.match(controller,/configureLoadout/);assert.match(source,/normalizeBattle2Loadout/);assert.match(source,/heroCompositionFor/);assert.match(source,/bodyDistanceScale/);assert.match(ui,/hash=2166136261/);assert.match(ui,/toString\(36\)\.padStart\(7,'0'\)/);
 assert.match(css,/\.battle2-loadout-grid\{display:grid;grid-template-columns:repeat\(5,minmax\(0,1fr\)\)/);
});
test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});


test('battle2 narration rate-limits repeated spacing text instead of flooding the HUD',()=>{
 const stage=stageSource();
 assert.match(stage,/lastNarrationAt=new Map\(\)/);
 assert.match(stage,/NARRATION_MIN_SECONDS=2\.2/);assert.match(stage,/now-previous<NARRATION_MIN_SECONDS/);
 assert.match(stage,/row\.actorId!==\'hero\'/);
 assert.match(stage,/if\(pushNarration\(row,meta\)\)break/);
});


test('duel seeds a single opening initiative so 1v1 cannot deadlock in mutual spacing',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.match(source,/type:'initiative-seeded'/);
 assert.match(source,/type:'normal-start',phase:'jo',seeded:true/);
});
