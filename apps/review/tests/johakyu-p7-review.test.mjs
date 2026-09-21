import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

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
   if(!action||seen.has(action.id))continue;seen.add(action.id);
   const technique=composition[action.phase][action.techniqueIndex],stage=technique?.stages[action.stageIndex];
   assert.ok(technique,'configured technique');assert.ok(stage,'configured stage');
   assert.equal(action.techniqueId,technique.id);assert.equal(action.name,technique.name);assert.equal(action.motion.kind,stage.kind);assert.equal(action.footwork,stage.step.footwork);
   rows.push({battleId:r.frame.battleId,phase:action.phase,techniqueId:action.techniqueId,techniqueIndex:action.techniqueIndex,stageIndex:action.stageIndex});
 }
 assert.ok(rows.length>12);
 const firstBattle=rows.filter(row=>row.battleId===rows[0].battleId),firstSeen=new Set(),ordered=[];
 for(const row of firstBattle){const key=`${row.phase}:${row.techniqueIndex}:${row.stageIndex}`;if(firstSeen.has(key))continue;firstSeen.add(key);ordered.push(key);}
 assert.deepEqual(ordered.slice(0,18),[
   'jo:0:0','jo:0:1','jo:0:2','jo:1:0','jo:1:1','jo:1:2',
   'ha:0:0','ha:0:1','ha:0:2','ha:1:0','ha:1:1','ha:1:2',
   'kyu:0:0','kyu:0:1','kyu:0:2','kyu:1:0','kyu:1:1','kyu:1:2'
 ]);
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
 assert.equal(proof.restart.phase,proof.broken.phase);assert.equal(proof.restart.techniqueIndex,0);assert.equal(proof.restart.stageIndex,0);
});

test('an early incoming hit breaks an unprotected chain instead of retrying a later stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel',enemyLeadSeconds:.3});let proof=null;
 for(let i=0;i<720&&!proof;i++){
   scenario.step(1/60);const trace=scenario.inspect().trace;
   const breakIndex=trace.findIndex(row=>row.type==='chain-break'&&row.reason==='hit-before-contact');
   if(breakIndex<0)continue;
   const restart=trace.slice(breakIndex+1).find(row=>row.type==='stage-start');
   if(restart)proof={broken:trace[breakIndex],restart};
 }
 assert.ok(proof,'early real contact must break the chain');
 assert.equal(proof.restart.phase,proof.broken.phase);assert.equal(proof.restart.techniqueIndex,0);assert.equal(proof.restart.stageIndex,0);
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

test('action history remains floating text rather than a list repaint',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/spawnActionText/);assert.match(stage,/historyNode\.append\(line\)/);assert.match(stage,/animationend/);assert.match(stage,/setTimeout\(remove,4200\)/);
 assert.doesNotMatch(stage,/historyNode\.replaceChildren\(\.\.\.history\.map/);
 assert.match(css,/\.battle-sequence-history__float\{/);assert.match(css,/position:absolute/);assert.match(css,/johakyu-text-drift 3\.7s/);assert.match(css,/@keyframes johakyu-text-drift/);
 assert.doesNotMatch(css,/battle-sequence-history__float[^}]*background:/);
});

test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});
