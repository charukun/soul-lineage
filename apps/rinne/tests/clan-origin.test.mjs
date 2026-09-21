import test from 'node:test';
import assert from 'node:assert/strict';
import {ORIGIN_QUESTIONS,normalizeClanOrigin,originFromAnswers,normalizeOriginDraft,chooseOriginAnswer,advanceOriginDraft,clanPresentation,familyPracticeLabel} from '../src/rebuild/clan-origin.js';
import {createLife,serializeLife,deserializeLife,rebirth,applyEquipmentStation,startAutomaticActivity,tickLife} from '../src/rebuild/domain.js';
import {resolveSoloLifeStart} from '../src/rebuild/life-start.js';

const origin=originFromAnswers({culture:'wa',ethos:'discern',art:'katana'});
function store(value=null,{fail=false}={}){
  const data=new Map(value===null?[]:[['life-v2',value]]),writes=[];
  return {data,writes,read:async key=>data.get(key)??null,write:async(key,value)=>{writes.push({key,value});if(fail)throw Error('quota exceeded');data.set(key,value);}};
}
const request=(storage,overrides={})=>({mode:'new',storage,saveKey:'life-v2',name:'水鏡',seed:91,villageIds:['village-a','village-b'],clanOrigin:origin,expectedSave:null,...overrides});

test('all 27 independent memories resolve without a score, random roll or class lock',()=>{
  const keys=new Set();
  for(const culture of ORIGIN_QUESTIONS[0].choices)for(const ethos of ORIGIN_QUESTIONS[1].choices)for(const art of ORIGIN_QUESTIONS[2].choices){
    const result=originFromAnswers({culture:culture.id,ethos:ethos.id,art:art.id});keys.add(JSON.stringify(result));
    const view=clanPresentation(result);assert.ok(view.family&&view.home&&view.crest&&view.heirloom&&view.practice);assert.ok(['sword','spear','staff'].includes(view.weapon));
    assert.deepEqual(Object.keys(result).sort(),['art','culture','ethos','version']);
  }
  assert.equal(keys.size,27);assert.equal(clanPresentation(origin).label,'刀の家伝');assert.equal(clanPresentation(origin).family,'水鏡の一族');
});

test('incomplete, unknown or forged origins cannot become a saved family',()=>{
  assert.equal(normalizeClanOrigin(null),null);assert.equal(normalizeClanOrigin(undefined),null);
  for(const raw of [{},{version:2,...origin,art:'<script>'},{...origin,version:2},{...origin,ethos:'__proto__'},[],true])assert.throws(()=>normalizeClanOrigin(raw));
  assert.throws(()=>originFromAnswers({culture:'wa',ethos:'discern'}));
  assert.deepEqual(normalizeClanOrigin({...origin,attackBonus:999}),origin);
});

test('drafts resume the exact question; going back never deletes later choices',()=>{
  let draft=normalizeOriginDraft(null);assert.throws(()=>advanceOriginDraft(draft));
  for(const choice of ['wa','discern','katana']){
    draft=chooseOriginAnswer(draft,choice);draft=advanceOriginDraft(draft);
    assert.deepEqual(normalizeOriginDraft(JSON.parse(JSON.stringify(draft))),draft);
  }
  assert.equal(draft.step,3);assert.deepEqual(originFromAnswers(draft.answers),origin);
  draft.step=0;draft=chooseOriginAnswer(draft,'grove');assert.equal(draft.answers.art,'katana');assert.equal(draft.answers.ethos,'discern');
  assert.equal(normalizeOriginDraft({version:1,step:99,answers:{culture:'wa',art:'katana'}}).step,1);
  assert.deepEqual(normalizeOriginDraft({version:77,answers:{culture:'wa'}}),{version:1,step:0,answers:{}});
  assert.throws(()=>chooseOriginAnswer(normalizeOriginDraft(null),'katana'));
});

test('family origin survives save/reload and repeated rebirth without inherited personal power',()=>{
  const first=createLife({seed:7,clanOrigin:origin,villageIds:['village-a','village-b']});
  assert.equal(first.birthVillageId,createLife({seed:7,villageIds:['village-a','village-b']}).birthVillageId);
  first.ageSeconds=1200;first.ageYears=20;first.phase='living';first.position={x:8,z:9};first.knownSkills.push('basic.sword');first.equipment.weapon='sword';
  const loaded=deserializeLife(serializeLife(first));assert.equal(loaded.id,first.id);assert.equal(loaded.ageSeconds,1200);assert.deepEqual(loaded.position,first.position);assert.deepEqual(loaded.clanOrigin,origin);
  let next=rebirth(loaded);for(let i=0;i<5;i++)next=rebirth(deserializeLife(serializeLife(next)));
  assert.deepEqual(next.clanOrigin,origin);assert.deepEqual(next.lineage[0].clanOrigin,origin);assert.equal(next.ageYears,0);assert.equal(next.generation,7);
  assert.deepEqual(next.equipment,{weapon:'fist',armor:'cloth',shield:false});assert.deepEqual(next.knownSkills,['basic.fist']);assert.deepEqual(next.experiences,{});assert.deepEqual(next.homelands,[]);
  next.clanOrigin.art='staff';assert.equal(first.clanOrigin.art,'katana');assert.equal(next.lineage[0].clanOrigin.art,'katana');
});

test('legacy saves retain their current life without inventing an origin or forcing questions',async()=>{
  const legacy=createLife({seed:5});legacy.ageSeconds=1111;delete legacy.clanOrigin;
  const storage=store(JSON.stringify(legacy)),state=await resolveSoloLifeStart(request(storage,{mode:'continue',clanOrigin:{corrupt:true}}));
  assert.equal(state.id,legacy.id);assert.equal(state.ageSeconds,1111);assert.equal(state.clanOrigin,null);assert.equal(storage.writes.length,0);assert.equal(rebirth(state).clanOrigin,null);
});

test('family training is an actual ordinary experience and seven-year equipment gates remain',()=>{
  const state=createLife({seed:8,clanOrigin:origin});const rack={label:'槍',equipment:{weapon:'spear'}};
  assert.equal(applyEquipmentStation(state,rack),null);assert.deepEqual(state.knownSkills,['basic.fist']);
  state.ageSeconds=5*60;state.ageYears=5;state.phase='living';const station={id:'training',label:'稽古場',activity:'train'};
  assert.equal(startAutomaticActivity(state,station),true);assert.match(state.activity.label,/抜きと納め.*見学/);
  for(let i=0;i<32;i++)tickLife(state,{realDelta:.25,station});assert.equal(state.experiences.train.count,1);
  state.ageSeconds=7*60;state.ageYears=7;assert.equal(applyEquipmentStation(state,rack).weapon,'spear');assert.ok(state.knownSkills.includes('basic.spear'),'katana tradition must not lock out another weapon');
  assert.equal(familyPracticeLabel(createLife(), 'train'),null);
});

test('birth confirmation saves origin and newborn together, before runtime begins',async()=>{
  const storage=store(),state=await resolveSoloLifeStart(request(storage));
  assert.equal(storage.writes.length,1);const saved=deserializeLife(storage.data.get('life-v2'));
  assert.equal(saved.id,state.id);assert.deepEqual(saved.clanOrigin,origin);assert.equal(saved.ageYears,0);assert.equal(saved.generation,1);
});

test('continue restores the saved clan and progress, ignoring any unfinished new origin',async()=>{
  const old=createLife({seed:12,clanOrigin:origin});old.ageSeconds=873;old.phase='living';old.defeats=9;
  const storage=store(serializeLife(old)),next=await resolveSoloLifeStart(request(storage,{mode:'continue',clanOrigin:originFromAnswers({culture:'grove',ethos:'seek',art:'staff'})}));
  assert.equal(next.id,old.id);assert.equal(next.ageSeconds,873);assert.equal(next.defeats,9);assert.deepEqual(next.clanOrigin,origin);assert.equal(storage.writes.length,0);
});

test('missing and corrupt continue saves fail closed instead of starting over',async()=>{
  for(const raw of [null,'{bad','{}','x'.repeat(250001)]){const storage=store(raw);await assert.rejects(()=>resolveSoloLifeStart(request(storage,{mode:'continue'})));assert.equal(storage.writes.length,0);assert.equal(await storage.read('life-v2'),raw);}
});

test('replacing a family requires the exact previously confirmed save',async()=>{
  const previous=serializeLife(createLife({seed:25,clanOrigin:origin})),storage=store(previous);
  await assert.rejects(()=>resolveSoloLifeStart(request(storage)),/変わりました/);assert.equal(storage.writes.length,0);
  await assert.rejects(()=>resolveSoloLifeStart(request(storage,{expectedSave:undefined})),/変わりました/);
  await assert.rejects(()=>resolveSoloLifeStart(request(storage,{expectedSave:'stale'})),/変わりました/);
  const replacement=await resolveSoloLifeStart(request(storage,{expectedSave:previous,clanOrigin:originFromAnswers({culture:'heath',ethos:'guard',art:'spear'})}));
  assert.equal(replacement.clanOrigin.art,'spear');assert.equal(storage.writes.length,1);
});

test('storage failure, missing answers and invalid placement cannot destroy an old save',async()=>{
  const previous=serializeLife(createLife({seed:23,clanOrigin:origin})),storage=store(previous,{fail:true});
  await assert.rejects(()=>resolveSoloLifeStart(request(storage,{expectedSave:previous})),/quota/);assert.equal(await storage.read('life-v2'),previous);
  const fresh=store(previous);
  await assert.rejects(()=>resolveSoloLifeStart(request(fresh,{expectedSave:previous,clanOrigin:null})),/選んで/);
  await assert.rejects(()=>resolveSoloLifeStart(request(fresh,{expectedSave:previous,place:()=>{throw Error('bad layout');}})),/bad layout/);
  assert.equal(fresh.writes.length,0);assert.equal(await fresh.read('life-v2'),previous);
});
