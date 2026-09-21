import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLife,serializeLife,deserializeLife,rebirth,lineageRecord,applyEquipmentStation,startAutomaticActivity,tickLife,YEAR_SECONDS,LIFE_SECONDS} from '../src/rebuild/domain.js';
import {ORIGIN_QUESTIONS,createLineageOrigin,normalizeLineageOrigin,describeLineage,normalizeFamilyPractice,chooseOriginAnswer,familyPracticeEpisode,familyWelcome} from '../src/rebuild/lineage-origin.js';
import {lineageSceneSvg,lineageCrestSvg} from '../src/lineage-origin-art.js';

const answers={culture:'wa',ethos:'discern',art:'katana'};
const origin=()=>createLineageOrigin(answers);
const life=(age=0)=>{const state=createLife({name:'千晴',seed:17,lineageOrigin:origin()});state.ageYears=age;state.ageSeconds=age*YEAR_SECONDS;state.phase=age<4?'birth':'living';return state;};
const station={id:'family-training',label:'稽古場',activity:'train'};
const practice=state=>{for(let i=0;i<32;i++)tickLife(state,{realDelta:.25,station});};

test('all 27 independent histories are valid; Japanese culture and katana are explicit choices',()=>{
  const roots=[];
  for(const culture of ORIGIN_QUESTIONS[0].choices)for(const ethos of ORIGIN_QUESTIONS[1].choices)for(const art of ORIGIN_QUESTIONS[2].choices){
    const root=createLineageOrigin({culture:culture.id,ethos:ethos.id,art:art.id});
    const family=describeLineage(root);assert.ok(family.houseName.endsWith('家'));assert.ok(family.motto);assert.ok(family.heirloom);roots.push(root);
  }
  assert.equal(roots.length,27);assert.equal(new Set(roots.map(JSON.stringify)).size,27);
  const family=describeLineage(origin());assert.equal(family.houseName,'月影家');assert.equal(family.cultureLabel,'和の一族');assert.equal(family.artLabel,'刀');assert.equal(family.weapon,'sword');
});

test('answers are immutable and backtracking changes only the selected dimension',()=>{
  const before=Object.freeze({...answers});const revised=chooseOriginAnswer(before,0,'grove');
  assert.equal(before.culture,'wa');assert.deepEqual(revised,{...answers,culture:'grove'});
  assert.deepEqual(chooseOriginAnswer(revised,0,'wa'),answers);
  assert.throws(()=>chooseOriginAnswer(before,0,'katana'));assert.throws(()=>chooseOriginAnswer(before,3,'wa'));
  assert.throws(()=>createLineageOrigin({culture:'wa'}));
});

test('untrusted family input is bounded, canonicalized and never used as markup',()=>{
  for(const key of ['culture','ethos','art'])for(const value of ['__proto__','constructor','<img src=x onerror=alert(1)>',null]){
    assert.throws(()=>normalizeLineageOrigin({...origin(),[key]:value}));
  }
  assert.throws(()=>normalizeLineageOrigin({...origin(),schemaVersion:99}));
  assert.throws(()=>normalizeLineageOrigin({...origin(),founderId:'javascript:evil'}));
  assert.throws(()=>normalizeFamilyPractice({observations:-1}));assert.throws(()=>normalizeFamilyPractice({practices:1.2}));assert.throws(()=>normalizeFamilyPractice({practices:100001}));
  assert.deepEqual(normalizeLineageOrigin({...origin(),houseName:'<script>',power:999999}),origin());
  assert.equal(normalizeLineageOrigin(null),null);
});

test('first birth stores the founder without altering newborn stats, equipment or skills',()=>{
  const state=life(),ordinary=createLife({name:'千晴',seed:17});
  assert.equal(state.lineageOrigin.founderId,state.id);assert.deepEqual(state.familyPractice,{observations:0,practices:0});
  for(const key of ['ageSeconds','hp','maxHp','stamina','phase','equipment','knownSkills'])assert.deepEqual(state[key],ordinary[key],key);
  assert.equal(origin().founderId,null,'the caller-owned answer object is not mutated');
});

test('save and continue preserve the same person, age, family and training without granting duplicate progress',()=>{
  let state=life(22);state.position={x:2,z:3};state.familyPractice={observations:4,practices:7};
  applyEquipmentStation(state,{label:'槍置き場',equipment:{weapon:'spear'}});
  const expected={id:state.id,ageSeconds:state.ageSeconds,generation:state.generation,position:structuredClone(state.position),equipment:structuredClone(state.equipment),lineageOrigin:structuredClone(state.lineageOrigin),familyPractice:structuredClone(state.familyPractice)};
  for(let i=0;i<10;i++)state=deserializeLife(serializeLife(state));
  for(const [key,value] of Object.entries(expected))assert.deepEqual(state[key],value,key);
});

test('pre-feature saves and their descendants remain playable without inventing or resetting a family',()=>{
  const old=createLife({name:'旅人',seed:23});old.ageSeconds=38*YEAR_SECONDS;old.ageYears=38;old.phase='living';
  const restored=deserializeLife(serializeLife(old));assert.equal(restored.id,old.id);assert.equal(restored.ageYears,38);
  assert.equal(restored.lineageOrigin,undefined);assert.equal(describeLineage(restored.lineageOrigin),null);assert.equal(familyWelcome(restored),null);
  assert.equal(rebirth(restored).lineageOrigin,undefined);
});

test('rebirth preserves one founder and family across generations while life progress resets',()=>{
  const first=life(100);first.ageSeconds=LIFE_SECONDS;first.ended=true;first.phase='ended';first.familyPractice={observations:3,practices:8};
  const savedOrigin=structuredClone(first.lineageOrigin),record=lineageRecord(first);
  let next=rebirth(first);
  assert.equal(next.generation,2);assert.equal(next.ageYears,0);assert.equal(next.equipment.weapon,'fist');
  assert.deepEqual(next.familyPractice,{observations:0,practices:0});assert.deepEqual(next.lineage[0].familyPractice,{observations:3,practices:8});
  assert.deepEqual(record.lineageOrigin,savedOrigin);assert.deepEqual(next.lineageOrigin,savedOrigin);
  next.lineage[0].familyPractice.practices=12;assert.equal(first.familyPractice.practices,8);
  for(let i=0;i<3;i++)next=rebirth(deserializeLife(serializeLife(next)));
  assert.equal(next.generation,5);assert.deepEqual(next.lineageOrigin,savedOrigin);assert.match(familyWelcome(next),/月影家へ、おかえり/);
});

test('family tradition respects infancy and the seven-year equipment gate',()=>{
  const baby=life(3);assert.equal(startAutomaticActivity(baby,station),false);
  assert.equal(applyEquipmentStation(baby,{label:'剣',equipment:{weapon:'sword'}}),null);
  const child=life(6);assert.equal(applyEquipmentStation(child,{label:'剣',equipment:{weapon:'sword'}}),null);
  practice(child);assert.deepEqual(child.familyPractice,{observations:1,practices:0});assert.equal(child.equipment.weapon,'fist');assert.ok(!child.knownSkills.includes('basic.sword'));
});

test('completed family practice is a real causal episode, not a passive stat bonus',()=>{
  const state=life(10);applyEquipmentStation(state,{label:'剣',equipment:{weapon:'sword'}});
  assert.equal(startAutomaticActivity(state,station),true);assert.equal(state.activity.label,'家伝の間合い');
  for(let i=0;i<31;i++)tickLife(state,{realDelta:.25,station});assert.equal(state.familyPractice.practices,0);
  tickLife(state,{realDelta:.25,station});assert.equal(state.familyPractice.practices,1);
  const saved=deserializeLife(serializeLife(state));assert.equal(saved.familyPractice.practices,1);
  const episode=familyPracticeEpisode(saved,'train','稽古場');assert.equal(episode.kind,'distance');assert.equal(episode.place,'月影家・家伝の間合い');
  assert.equal(saved.familyPractice.practices,2);
});

test('another weapon remains usable and other everyday experiences remain untouched',()=>{
  const state=life(12);assert.ok(applyEquipmentStation(state,{label:'槍',equipment:{weapon:'spear'}}));
  practice(state);assert.equal(state.equipment.weapon,'spear');assert.deepEqual(state.familyPractice,{observations:1,practices:0});
  const before=structuredClone(state.familyPractice);assert.deepEqual(familyPracticeEpisode(state,'read','書庫'),{kind:'read',place:'書庫'});assert.deepEqual(state.familyPractice,before);
});

test('each memory uses bundled vector art rather than third-party runtime media',()=>{
  for(const question of ORIGIN_QUESTIONS)for(const choice of question.choices){const svg=lineageSceneSvg(choice.scene);assert.match(svg,/<svg /);assert.match(svg,/aria-hidden="true"/);assert.doesNotMatch(svg,/(?:https?:|<image|<script|onload=)/);}
  assert.match(lineageSceneSvg('wa',{family:true}),/origin-people/);assert.match(lineageCrestSvg('discern'),/<circle/);
});

test('the origin controller has no storage writes, and runtime wiring keeps continue distinct from new',async()=>{
  const read=path=>readFile(new URL(`../src/${path}`,import.meta.url),'utf8');
  const [ui,main,runtime,css]=await Promise.all([read('lineage-origin-ui.js'),read('main.js'),read('rebuild/runtime.js'),read('lineage-origin.css')]);
  assert.doesNotMatch(ui,/localStorage|storage\.write|requestAnimationFrame|setInterval/);
  assert.match(ui,/data-origin-cancel/);assert.match(ui,/data-origin-back/);assert.match(ui,/data-origin-confirm/);assert.match(ui,/timers\.clear\(\)/);
  assert.match(main,/lineageOriginUI\.choose/);assert.match(main,/localStorage\.getItem\(storageKey\)!==previousSave/);
  assert.match(main,/await launch\('new',null,lineageOrigin\)/);assert.match(main,/void launch\('continue'\)/);
  assert.match(runtime,/if\(!raw\)throw Error/);assert.match(runtime,/familyPanel\.dispose\(\)/);assert.match(runtime,/mode==='new'&&!await save\(\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);assert.match(css,/safe-area-inset-bottom/);assert.match(css,/data-motion=off/);
});
