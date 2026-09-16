import test from 'node:test';
import assert from 'node:assert/strict';
import {LIFE_YEARS,YEAR_SECONDS,LIFE_SECONDS,createLife,chooseBirthVillage,validateLife,serializeLife,deserializeLife,setClockRate,setMoving,tickLife,applyEquipmentStation,returnHome,rebirth} from '../src/rebuild/domain.js';
import {createFront,normalizeFront,tickFront} from '../src/rebuild/combat.js';

test('100年人生 is exactly 100 minutes at 1x',()=>{
  assert.equal(LIFE_YEARS,100);assert.equal(YEAR_SECONDS,60);assert.equal(LIFE_SECONDS,6000);
  const s=createLife({name:'テスト',seed:1});
  for(let i=0;i<6000*4;i++)tickLife(s,{realDelta:.25});
  assert.equal(s.ended,true);assert.equal(s.ageYears,100);assert.equal(s.phase,'ended');
});

test('birth village is selected from available villages by the life seed',()=>{
  const villages=['village-a','village-b','village-c'];
  assert.equal(createLife({seed:1,villageIds:villages}).birthVillageId,'village-b');
  assert.equal(createLife({seed:2,villageIds:villages}).birthVillageId,'village-c');
  assert.equal(chooseBirthVillage(3,villages),'village-a');
});

test('clock rate changes only life clock and 20x reaches one year in three seconds',()=>{
  const s=createLife({seed:2});setClockRate(s,20);
  for(let i=0;i<12;i++)tickLife(s,{realDelta:.25});
  assert.equal(s.ageYears,1);assert.equal(s.hp,100);
});

test('birth releases at four years and equipment gates at seven',()=>{
  const s=createLife({seed:3});setClockRate(s,20);
  for(let i=0;i<48;i++)tickLife(s,{realDelta:.25});
  assert.equal(Math.floor(s.ageYears),4);assert.equal(s.phase,'living');
  assert.equal(applyEquipmentStation(s,{label:'片手剣',equipment:{weapon:'sword'}}),null);
  for(let i=0;i<36;i++)tickLife(s,{realDelta:.25});
  const changed=applyEquipmentStation(s,{label:'片手剣',equipment:{weapon:'sword'}});
  assert.equal(changed.weapon,'sword');assert.ok(s.knownSkills.includes('basic.sword'));
});

test('spatial automatic activity stops on swipe and can spark without rewriting weights',()=>{
  const s=createLife({seed:4});s.ageSeconds=10*60;s.ageYears=10;s.phase='living';
  const before=structuredClone(s.skillWeights),station={id:'garden',label:'広場で遊ぶ',activity:'play',actionLabel:'広場で遊ぶ'};
  tickLife(s,{realDelta:.25,station});assert.equal(s.activity.kind,'play');
  setMoving(s,true,0);assert.equal(s.activity,null);
  setMoving(s,false,0);tickLife(s,{realDelta:.25,station});
  for(let i=0;i<32;i++)tickLife(s,{realDelta:.25,station});
  assert.equal(s.experiences.play.count,1);assert.deepEqual(s.skillWeights,before);
});

test('return unlocks the birth village and rebirth starts personal power from zero',()=>{
  const s=createLife({name:'千春',seed:5,villageIds:['village-a']});
  s.phase='living';s.zone='frontier';s.equipment={weapon:'spear',armor:'light',shield:true};s.knownSkills.push('skill.step');s.skillWeights={jo:{'skill.step':100},ha:{},kyu:{}};s.experiences.play={count:9,score:4,last:10};s.hp=23;
  assert.equal(returnHome(s),true);assert.deepEqual(s.homelands,['village-a']);
  s.ageSeconds=LIFE_SECONDS;s.ageYears=100;s.ended=true;s.phase='ended';
  const next=rebirth(s,{memento:'skill.step',villageId:'village-a',villageIds:['village-a','village-b']});
  assert.equal(next.generation,2);assert.equal(next.ageYears,0);assert.equal(next.birthVillageId,'village-a');assert.deepEqual(next.homelands,['village-a']);
  assert.deepEqual(next.equipment,{weapon:'fist',armor:'cloth',shield:false});assert.deepEqual(next.knownSkills,['basic.fist']);assert.deepEqual(next.skillWeights,{jo:{'basic.fist':100},ha:{},kyu:{}});assert.deepEqual(next.experiences,{});assert.equal(next.hp,100);
  assert.equal(next.lineage.at(-1).age,100);assert.equal(next.lineage.at(-1).birthVillageId,'village-a');assert.equal(next.lineage.at(-1).returnedHome,true);assert.equal(next.lineage.at(-1).memento,'skill.step');
  assert.doesNotThrow(()=>validateLife(next));
});

test('a village cannot be chosen for rebirth until the lineage returns there',()=>{
  const s=createLife({seed:6,villageIds:['village-a']});s.ageSeconds=LIFE_SECONDS;s.ageYears=100;s.ended=true;s.phase='ended';
  assert.throws(()=>rebirth(s,{villageId:'village-b',villageIds:['village-a','village-b']}),/帰還していない村/);
});

test('old saves without homeland fields migrate to the local village without inventing an unlock',()=>{
  const old=createLife({seed:7});delete old.birthVillageId;delete old.homelands;
  const restored=validateLife(old);assert.equal(restored.birthVillageId,'local-hoshitsugi');assert.deepEqual(restored.homelands,[]);
});

test('contact combat is automatic and never needs an attack button',()=>{
  const s=createLife({seed:6});s.phase='living';s.ageSeconds=20*60;s.ageYears=20;s.zone='frontier';s.position={x:0,z:0};s.equipment.weapon='sword';s.knownSkills.push('basic.sword');s.skillWeights.jo={'basic.sword':100};
  const front=createFront(0,6);front.enemies[0].x=.5;front.enemies[0].z=.5;
  let hit=false;for(let i=0;i<20;i++){const events=tickFront(s,front,.1);if(events.some(e=>e.type==='player-hit'))hit=true;}
  assert.equal(hit,true);assert.ok(s.stamina<100);assert.ok(front.enemies[0].hp<front.enemies[0].maxHp);
});

test('frontier enemy progress survives save and restore',()=>{
  const s=createLife({seed:7});s.phase='living';s.ageSeconds=25*60;s.ageYears=25;s.zone='frontier';s.front=2;
  const front=createFront(2,7);front.enemies[0].hp=11;front.enemies[1].hp=0;front.enemies[1].dead=true;s.frontState=structuredClone(front);
  const restored=deserializeLife(serializeLife(s)),restoredFront=normalizeFront(restored.frontState,2,7);
  assert.equal(restoredFront.enemies[0].hp,11);assert.equal(restoredFront.enemies[1].dead,true);
});

test('corrupt frontier state is rejected instead of silently resetting progress',()=>{
  const broken=createFront(1,8);broken.enemies[0].hp=-1;
  assert.throws(()=>normalizeFront(broken,1,8),/前線の敵データ/);
});
