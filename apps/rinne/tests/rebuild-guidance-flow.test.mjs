import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {guidanceFor} from '../src/rebuild/guidance.js';

const stations=[
  {id:'home',label:'暮らしを手伝う',actionLabel:'暮らしを手伝う',x:-5,z:0,activity:'care'},
  {id:'door.home',label:'空き家',x:-4,z:0,enterInterior:true,buildingId:'home-1'},
  {id:'room.home.bed',label:'寝床で呼吸を整える',actionLabel:'寝床で呼吸を整える',x:-2,z:0,activity:'breathe',interiorId:'home-1',housingTrait:true},
  {id:'exit.home',label:'外へ出る',x:0,z:4,exitInterior:true,interiorId:'home-1'},
  {id:'training-dummy',label:'かかし',x:4,z:4,activity:'practice',actionLabel:'かかしで型を反復する',trainingDummy:true},
  {id:'rack.weapon.sword',label:'片手剣',x:6,z:0,equipment:{weapon:'sword'}},
  {id:'village-skirmish',label:'村外の戦場',x:0,z:-30,danger:true},
  {id:'port-prayer',label:'船上で祈る',x:166,z:0,activity:'voyage',port:true},
];
function atAge(age,seed=1){const state=createLife({seed});state.ageYears=age;state.ageSeconds=age*60;state.phase=age>=4?'living':'birth';return state;}

test('first independent guidance introduces housing before repetitive combat practice',()=>{
  const state=atAge(5),guide=guidanceFor({state,stations});
  assert.equal(guide.objective,'空き家へ入る');assert.equal(guide.target.label,'空き家');assert.equal(guide.badge,'暮らしを見る');
});

test('after seeing housing, the normal route explicitly points to the dummy',()=>{
  const state=atAge(5);state.experiences.breathe={count:1,score:1,last:state.ageSeconds};state.knownSkills.push('skill.breath');
  const guide=guidanceFor({state,stations});assert.equal(guide.objective,'かかしへ');assert.equal(guide.target.label,'かかし');
});

test('inside a building the next target is an installed housing trait, not an outdoor station',()=>{
  const state=atAge(6);state.interior={buildingId:'home-1',returnPosition:{x:-4,z:0}};state.position={x:0,z:2};
  const guide=guidanceFor({state,stations});assert.equal(guide.objective,'寝床で呼吸を整える');assert.equal(guide.target.x,-2);
});

test('a trained child is routed from the dummy toward the dangerous village edge',()=>{
  const state=atAge(10);state.equipment.weapon='sword';state.experiences.practice={count:5,score:4,last:0};state.knownSkills.push('action.guard-step','action.slip');
  const guide=guidanceFor({state,stations});assert.equal(guide.objective,'村外へ');assert.equal(guide.badge,'危険');assert.equal(guide.target.label,'村外の戦場');
});
