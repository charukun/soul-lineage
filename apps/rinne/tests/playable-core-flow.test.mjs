import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife,tickLife,practiceDummy} from '../src/rebuild/domain.js';
import {guidanceFor} from '../src/rebuild/guidance.js';

const stations=[
 {id:'door.home',label:'空き家',x:-4,z:0,enterInterior:true,buildingId:'home-1'},
 {id:'garden',label:'広場で遊ぶ',actionLabel:'広場で遊ぶ',x:0,z:0,activity:'play'},
 {id:'dojo',label:'稽古を見る',actionLabel:'稽古を見る',x:4,z:0,activity:'train'},
 {id:'training-dummy',label:'かかし',x:5,z:1,activity:'practice',trainingDummy:true},
 {id:'rack.weapon.sword',label:'片手剣',x:6,z:0,equipment:{weapon:'sword'}},
 {id:'village-skirmish',label:'村外の戦場',x:0,z:-30,danger:true},
 {id:'port-prayer',label:'港',x:166,z:0,activity:'voyage',port:true},
];
function life(age=5){const s=createLife({seed:71});s.phase='living';s.ageYears=age;s.ageSeconds=age*60;s.resting=false;return s;}
function complete(state,station){for(let i=0;i<32;i++)tickLife(state,{realDelta:.25,lifeDelta:0,station});}

test('early play route deliberately creates distinct life evidence before combat',()=>{
 const state=life(5);assert.match(guidanceFor({state,stations}).objective,/空き家/);
 state.experiences.breathe={count:1,score:1,last:state.ageSeconds};assert.equal(guidanceFor({state,stations}).objective,'広場で遊ぶ');
 complete(state,stations[1]);assert.equal(guidanceFor({state,stations}).objective,'稽古を見る');complete(state,stations[2]);
 assert.ok(state.knownSkills.includes('skill.observe'),'watching training after play should causally realize a heart insight');assert.equal(guidanceFor({state,stations}).objective,'かかしで打つ');
});
test('canonical dummy accepts an explicit strike and records one bounded practice episode',()=>{
 const state=life(8);state.equipment.weapon='sword';state.knownSkills.push('basic.sword');const first=practiceDummy(state,stations[3]);
 assert.ok(first.some(e=>e.type==='training-hit'));assert.ok(first.some(e=>e.type==='activity-complete'));assert.equal(state.experiences.practice.count,1);
 const second=practiceDummy(state,stations[3]);assert.ok(second.some(e=>e.type==='training-hit'));assert.equal(second.some(e=>e.type==='activity-complete'),false);assert.equal(state.experiences.practice.count,1);
});
test('armed child is routed from real dummy practice to the visible village encounter',()=>{
 const state=life(8);state.equipment.weapon='sword';state.experiences.practice={count:2,score:1.4,last:0};const guide=guidanceFor({state,stations});
 assert.equal(guide.objective,'村外で実戦する');assert.equal(guide.badge,'技の閃きへ');assert.equal(guide.target.id,'village-skirmish');
});
