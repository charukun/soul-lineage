import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';

test('battle2 exposes only 1v1 and 1v3 controls and never wires inspiration',()=>{
 const html=readFileSync(new URL('../battle2.html',import.meta.url),'utf8'),stage=readFileSync(new URL('../src/nocturne-stage.js',import.meta.url),'utf8');
 assert.match(html,/<h1>序破急バトル<\/h1>/);assert.equal((html.match(/data-battle-mode=/g)||[]).length,2);assert.match(html,/data-battle-mode="duel"/);assert.match(html,/data-battle-mode="oneVsThree"/);
 assert.doesNotMatch(html+stage,/inspiration|hirameki|閃き|battle-inspire|pendingDiscoveries/i);assert.match(html,/data-combat-phase="jo"/);assert.match(html,/data-combat-phase="ha"/);assert.match(html,/data-combat-phase="kyu"/);assert.match(html,/battle-sequence-history/);assert.match(stage,/pushAction/);assert.match(stage,/motionLabel/);assert.doesNotMatch(stage,/currentNode\.textContent=.*meta\.stamina|currentNode\.textContent=.*injury/i);
});
test('1v1 fixture contains exactly one hero and one enemy',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let phases=new Set(),events=0;
 for(let i=0;i<360;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(r.meta.phase)phases.add(r.meta.phase);events+=r.events.length;assert.equal(r.frame.reviewMode,'duel');assert.equal(r.frame.actors.length,2);assert.equal(r.meta.party,1);assert.ok(r.meta.enemies<=1);assert.equal(r.meta.phase,hero.action?.phase??null);assert.equal(r.meta.actionId,hero.action?.id??null);}
 assert.deepEqual([...phases].sort(),['ha','jo','kyu']);assert.ok(events>0);
});
test('1v3 fixture contains one hero and three enemies with canonical impact/body/stamina state',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree'}),ids=new Set();let maxInjury=0,minStamina=100;
 for(let i=0;i<600;i++){const r=scenario.step(1/60);assert.equal(r.frame.reviewMode,'oneVsThree');assert.equal(r.frame.actors.length,4);assert.equal(r.frame.actors.filter(a=>a.side==='party').length,1);assert.equal(r.frame.actors.filter(a=>a.side==='enemy').length,3);minStamina=Math.min(minStamina,r.meta.stamina);for(const a of r.frame.actors)for(const b of Object.values(a.body))maxInjury=Math.max(maxInjury,b.severity);for(const e of r.events){assert.ok(!ids.has(e.id));ids.add(e.id);}}
 assert.ok(ids.size>0);assert.ok(maxInjury>0);assert.ok(minStamina<100);
});
test('unsupported battle counts fail closed',()=>{assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/);});

test('HUD metadata follows the actual hero motion rather than an independent timer',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});let checked=0;
 for(let i=0;i<240;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self);if(!hero.action)continue;checked++;assert.equal(r.meta.phase,hero.action.phase);assert.equal(r.meta.actionName,hero.action.name);assert.equal(r.meta.actionMotion,hero.action.motion.kind);}
 assert.ok(checked>60);
});
