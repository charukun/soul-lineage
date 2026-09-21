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

test('HUD follows the rendered hero feet and uses only short action text',()=>{
 const stage=stageSource(),css=hudCss(),html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8');
 const runtime=readFileSync(new URL('../../../packages/johakyu-presentation/src/runtime.js',import.meta.url),'utf8');
 const controller=readFileSync(new URL('../src/nocturne/johakyu-p7-controller.js',import.meta.url),'utf8');
 assert.match(runtime,/self\(a\)\{hero=a;selfBinding=a;\}/);assert.match(runtime,/footAnchor\(\)\{if\(!selfBinding\)return null;return project\(selfBinding\.pos\.clone\(\)\.add\(new V\(0,\.03,0\)\)\);\}/);assert.doesNotMatch(runtime,/footAnchor\(\)\{if\(!hero/);
 assert.match(controller,/footAnchor:\(\)=>driven\.footAnchor/);assert.match(stage,/function positionHud\(\)/);assert.match(stage,/runtime\?\.footAnchor\?\.\(\)/);
 assert.match(stage,/hud\.style\.left/);assert.match(stage,/hud\.style\.top/);assert.match(css,/\.battle-sequence-hud\{[^}]*top:50%/);
 assert.doesNotMatch(html,/間合いを測っている/);
 assert.match(stage,/function shortActionName/);assert.match(stage,/line\.textContent=row\.label/);
 assert.doesNotMatch(stage,/line\.append\(phase,text\)|\$\{row\.name\}.*\$\{row\.move\}/);
 assert.doesNotMatch(stage,/currentNode\.textContent=.*meta\.stamina|currentNode\.textContent=.*injury/i);
});

test('action history remains floating text that fades itself, not a web-style list repaint',()=>{
 const stage=stageSource(),css=hudCss();
 assert.match(stage,/spawnActionText/);assert.match(stage,/historyNode\.append\(line\)/);assert.match(stage,/animationend/);assert.match(stage,/setTimeout\(remove,4200\)/);
 assert.doesNotMatch(stage,/historyNode\.replaceChildren\(\.\.\.history\.map/);
 assert.match(css,/\.battle-sequence-history__float\{/);assert.match(css,/position:absolute/);assert.match(css,/johakyu-text-drift 3\.7s/);assert.match(css,/@keyframes johakyu-text-drift/);
 assert.doesNotMatch(css,/battle-sequence-history__float[^}]*background:/);
});


test('1v1 visibly separates quiet jo, dense ha and decisive kyu',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'}),seen=new Set(),starts={jo:[],ha:[],kyu:[]},dist={jo:[],ha:[],kyu:[]},damage={jo:[],ha:[],kyu:[]};
 for(let i=0;i<1100;i++){
   const r=scenario.step(1/60),phase=r.meta.flowPhase,hero=r.frame.actors.find(a=>a.self),enemy=r.frame.actors.find(a=>a.side==='enemy'&&!a.dead&&!a.downed);
   if(hero?.action&&!seen.has(hero.action.id)){seen.add(hero.action.id);starts[phase].push(i/60);}
   if(hero&&enemy)dist[phase].push(Math.hypot(hero.position.x-enemy.position.x,hero.position.z-enemy.position.z));
   for(const event of r.events)if(event.sourceId==='hero')damage[event.phase].push(event.damage);
 }
 const avg=rows=>rows.reduce((a,b)=>a+b,0)/Math.max(1,rows.length),gap=rows=>avg(rows.slice(1).map((v,i)=>v-rows[i]));
 for(const phase of ['jo','ha','kyu'])assert.ok(starts[phase].length>=2,phase+' actions');
 assert.ok(gap(starts.jo)>gap(starts.ha)+.25,'jo must breathe more than ha');
 assert.ok(avg(dist.jo)>avg(dist.ha)+.3,'jo must keep visibly more distance');
 assert.ok(avg(dist.ha)>avg(dist.kyu)+.15,'kyu must close decisively');
 assert.ok(avg(damage.kyu)>avg(damage.ha)*1.7,'kyu impacts must feel materially more decisive');
});

test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});
