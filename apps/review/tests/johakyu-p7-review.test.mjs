import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BASIC_FORMS,ACTION_FORMS} from '@soul/game-data/combat-forms';
import {createJohakyuP7ReviewScenario} from '../src/nocturne/johakyu-p7-review.js';
import {createCanonicalReviewComposition,reviewTechniqueDefinition} from '../src/nocturne/johakyu-technique-composition.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('battle2 remains 1v1 or 1v3 only and does not connect inspiration',()=>{
 const html=read('../battle2.html'),stage=read('../src/nocturne-stage.js');
 assert.equal((html.match(/data-battle-mode=/g)||[]).length,2);assert.doesNotMatch(html+stage,/inspiration|hirameki|閃き|battle-inspire|pendingDiscoveries/i);
});

test('review technique definitions are derived from canonical combat forms',()=>{
 const basic=reviewTechniqueDefinition('basic.sword',{phase:'jo'}),counter=reviewTechniqueDefinition('action.counter',{phase:'ha'});
 assert.deepEqual(basic.steps.map(s=>s.kind),BASIC_FORMS.sword.kinds);assert.deepEqual(basic.steps.map(s=>s.footwork),BASIC_FORMS.sword.feet);
 assert.deepEqual(counter.steps.map(s=>s.kind),ACTION_FORMS['action.counter'].kinds);assert.deepEqual(counter.steps.map(s=>s.footwork),ACTION_FORMS['action.counter'].feet);
 assert.equal(reviewTechniqueDefinition('action.flow',{phase:'ha'}),null,'unauthored crosscut must fail closed instead of receiving a fake motion');
});

test('composition is stage -> technique -> chain -> jo/ha/kyu and never hardcodes phase behavior',()=>{
 const composition=createCanonicalReviewComposition();
 assert.deepEqual(Object.keys(composition),['jo','ha','kyu']);
 for(const phase of ['jo','ha','kyu']){assert.ok(composition[phase].length>=1&&composition[phase].length<=3);for(const technique of composition[phase])assert.ok(technique.steps.length>=1&&technique.steps.length<=3);}
 const source=read('../src/nocturne/johakyu-p7-review.js');
 assert.doesNotMatch(source,/const TACTICS|opening-read|decisive-opening|quiet|exchange|decisive/);
 assert.match(source,/currentTechnique\(\)/);assert.match(source,/advanceSequence\(reason\)/);assert.match(source,/stageIndex/);assert.match(source,/techniqueIndex/);
});

test('1v1 executes every configured stage in technique order before advancing phase',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'}),starts=[];let lastId=null;
 for(let i=0;i<1800;i++){const r=scenario.step(1/60),hero=r.frame.actors.find(a=>a.self),a=hero?.action;if(a&&a.id!==lastId){lastId=a.id;starts.push({phase:a.phase,techniqueId:a.techniqueId,techniqueIndex:a.techniqueIndex,stageIndex:a.stageIndex,kind:a.motion.kind});}if(starts.some(x=>x.phase==='kyu'&&x.techniqueIndex>=1&&x.stageIndex>=2))break;}
 assert.ok(starts.length>10,JSON.stringify(starts));const order={jo:0,ha:1,kyu:2};let previous=-1;
 for(const row of starts){const current=order[row.phase];assert.ok(current>=previous||previous===2&&current===0,JSON.stringify(starts));previous=current;}
 for(const phase of ['jo','ha','kyu']){const rows=starts.filter(r=>r.phase===phase);assert.ok(rows.length>=3,phase);for(let i=1;i<rows.length;i++){const a=rows[i-1],b=rows[i];assert.ok(b.techniqueIndex>a.techniqueIndex||b.techniqueIndex===a.techniqueIndex&&b.stageIndex===a.stageIndex+1,JSON.stringify(rows));}}
});

test('actual impact identity carries technique, phase and stage',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'duel'});const hits=[];
 for(let i=0;i<1200;i++){const r=scenario.step(1/60);hits.push(...r.events.filter(e=>e.type==='player-hit'));if(hits.length>=6)break;}
 assert.ok(hits.length>=4);for(const hit of hits){assert.ok(hit.techniqueId);assert.ok(hit.techniqueName);assert.ok(['jo','ha','kyu'].includes(hit.phase));assert.ok(Number.isInteger(hit.stageIndex));}
});

test('HUD follows self feet and displays technique name plus stage only',()=>{
 const stage=read('../src/nocturne-stage.js'),runtime=read('../../../packages/johakyu-presentation/src/runtime.js');
 assert.match(runtime,/self\(a\)\{hero=a;selfBinding=a;\}/);assert.match(runtime,/footAnchor\(\)\{if\(!selfBinding\)/);
 assert.match(stage,/techniqueStageName/);assert.match(stage,/meta\?\.techniqueName/);assert.match(stage,/\$\{meta\.stageIndex\+1\}段/);
 assert.doesNotMatch(stage,/currentNode\.textContent=.*stamina|currentNode\.textContent=.*injury/i);
});

test('1v3 uses the same hero technique composition',()=>{
 const scenario=createJohakyuP7ReviewScenario({mode:'oneVsThree'});let observed=null;
 for(let i=0;i<300;i++){const r=scenario.step(1/60);assert.equal(r.frame.actors.filter(a=>a.side==='party').length,1);assert.equal(r.frame.actors.filter(a=>a.side==='enemy').length,3);observed=observed||r.frame.actors.find(a=>a.self)?.action;}
 assert.ok(observed?.techniqueId);
});

test('unsupported battle counts fail closed',()=>assert.throws(()=>createJohakyuP7ReviewScenario({mode:'twoVsThree'}),/Unsupported/));
