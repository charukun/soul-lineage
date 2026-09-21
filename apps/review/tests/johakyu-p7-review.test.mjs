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

test('1v1 phases advance from actual contact pressure instead of a time-cycle',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'}),phases=new Set(),changes=[];let previousFlow='jo',previousBattle='';
 for(let i=0;i<900;i++){
   const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(r.meta.phase)phases.add(r.meta.phase);
   assert.equal(r.frame.reviewMode,'duel');assert.equal(r.frame.actors.length,2);assert.equal(r.meta.party,1);assert.ok(r.meta.enemies<=1);
   assert.equal(r.meta.phase,hero.action?.phase??null);assert.equal(r.meta.actionId,hero.action?.id??null);
   if(previousBattle&&r.meta.battleId===previousBattle&&r.meta.flowPhase!==previousFlow){changes.push({from:previousFlow,to:r.meta.flowPhase,events:r.events.length,reason:r.meta.flowReason});assert.ok(r.events.length>0,'phase change must follow real contact');}
   previousFlow=r.meta.flowPhase;previousBattle=r.meta.battleId;
 }
 assert.ok(phases.has('jo'));assert.ok(phases.has('ha'));assert.ok(phases.has('kyu'));assert.ok(changes.some(row=>row.from==='jo'&&row.to==='ha'));assert.ok(changes.some(row=>row.to==='kyu'));
});

test('situational choreography contains quiet reads, defensive answers and decisive attacks',()=>{
 const source=readFileSync(new URL('../src/nocturne/johakyu-p7-review.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/phaseAt\(time\)|Math\.floor\(time\/ATTACK_SECONDS\)/);
 for(const token of ["kind:'ready'","kind:'retreat'","kind:'guard'","kind:'counter'","kind:'heavy'"])assert.ok(source.includes(token),token);
 assert.match(source,/opening-read-won|opening-read-contested/);assert.match(source,/decisive-opening|danger-window/);assert.match(source,/decisive-window-closed/);
});

test('1v3 retains canonical impact, body and stamina state',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree'}),ids=new Set();let maxInjury=0,minStamina=100;
 for(let i=0;i<720;i++){const r=scenario.step(1/60);assert.equal(r.frame.reviewMode,'oneVsThree');assert.equal(r.frame.actors.length,4);assert.equal(r.frame.actors.filter(a=>a.side==='party').length,1);assert.equal(r.frame.actors.filter(a=>a.side==='enemy').length,3);minStamina=Math.min(minStamina,r.meta.stamina);for(const a of r.frame.actors)for(const b of Object.values(a.body))maxInjury=Math.max(maxInjury,b.severity);for(const e of r.events){assert.ok(!ids.has(e.id));ids.add(e.id);}}
 assert.ok(ids.size>0);assert.ok(maxInjury>0);assert.ok(minStamina<100);
});

test('HUD metadata follows the actual hero motion',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let checked=0;
 for(let i=0;i<360;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(!hero.action)continue;checked++;assert.equal(r.meta.phase,hero.action.phase);assert.equal(r.meta.actionName,hero.action.name);assert.equal(r.meta.actionMotion,hero.action.motion.kind);}
 assert.ok(checked>120);
});

test('action history is floating text that fades itself, not a web-style list repaint',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/spawnActionText/);assert.match(stage,/historyNode\.append\(line\)/);assert.match(stage,/animationend/);assert.match(stage,/setTimeout\(remove,4200\)/);
 assert.doesNotMatch(stage,/historyNode\.replaceChildren\(\.\.\.history\.map/);
 assert.match(css,/\.battle-sequence-history__float\{/);assert.match(css,/position:absolute/);assert.match(css,/johakyu-text-drift 3\.7s/);assert.match(css,/@keyframes johakyu-text-drift/);
 assert.doesNotMatch(css,/battle-sequence-history__float[^}]*background:/);
});

test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});
