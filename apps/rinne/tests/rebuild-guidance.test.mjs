import test from 'node:test';
import assert from 'node:assert/strict';
import {createLife} from '../src/rebuild/domain.js';
import {createFront} from '../src/rebuild/combat.js';
import {guidanceFor,guidanceDistance} from '../src/rebuild/guidance.js';

const stations=[
  {id:'garden',label:'広場で遊ぶ',actionLabel:'広場で遊ぶ',x:0,z:0,activity:'play'},
  {id:'home',label:'暮らしを手伝う',actionLabel:'暮らしを手伝う',x:-4,z:-4,activity:'care'},
  {id:'rack.weapon.sword',label:'片手剣',x:5,z:2,equipment:{weapon:'sword'}},
  {id:'port-prayer',label:'船上で祈る',x:166,z:0,activity:'voyage',port:true},
];
const atAge=(age,seed=1)=>{const state=createLife({seed});state.ageYears=age;state.ageSeconds=age*60;if(age>=4)state.phase='living';return state;};

test('birth guidance explains the first unlock and points into the village',()=>{
  const state=atAge(0);
  const guide=guidanceFor({state,stations});
  assert.match(guide.stage,/誕生/);assert.match(guide.detail,/4歳/);assert.equal(guide.target.label,'村の広場');
  assert.ok(guidanceDistance(state,guide)>0);
});

test('childhood and preparation never become age-only waiting states',()=>{
  const child=atAge(5),childGuide=guidanceFor({state:child,stations});
  assert.match(childGuide.objective,/暮らし/);assert.ok(childGuide.target);assert.match(childGuide.detail,/8秒/);
  const prep=atAge(9),prepGuide=guidanceFor({state:prep,stations});
  assert.match(prepGuide.objective,/武具/);assert.equal(prepGuide.target.label,'片手剣');assert.match(prepGuide.detail,/15歳/);
});

test('departure guidance points to the port and explains automatic combat',()=>{
  const state=atAge(15);state.equipment.weapon='sword';
  const guide=guidanceFor({state,stations});
  assert.match(guide.stage,/出立/);assert.equal(guide.target.label,'港');assert.match(guide.detail,/1\.5秒/);assert.match(guide.detail,/自動戦闘/);
});

test('frontier guidance points at enemies then exposes both hidden exits',()=>{
  const state=atAge(20);state.zone='frontier';state.front=0;state.position={x:0,z:5.2};
  const front=createFront(0,state.seed);let guide=guidanceFor({state,stations,front});
  assert.match(guide.objective,/敵へ近づき/);assert.equal(guide.target.label,'最寄りの敵');
  for(const enemy of front.enemies){enemy.dead=true;enemy.hp=0;}front.cleared=true;
  guide=guidanceFor({state,stations,front});assert.equal(guide.target.label,'次の前線');assert.ok(guide.target.z<0);assert.match(guide.objective,/奥の門/);
  state.front=5;front.stage=5;
  guide=guidanceFor({state,stations,front});assert.equal(guide.target.label,'帰還地点');assert.ok(guide.target.z>0);assert.match(guide.objective,/凱旋/);
});

test('downed state has an explicit rescue countdown and return destination',()=>{
  const state=atAge(30);state.zone='frontier';state.down={elapsed:34.2};
  const guide=guidanceFor({state,stations,front:createFront(1,state.seed)});
  assert.match(guide.stage,/救助/);assert.match(guide.detail,/6秒/);assert.match(guide.detail,/村へ戻/);
});

test('return and end-of-life guidance close the loop into reincarnation',()=>{
  const state=atAge(20);state.equipment.weapon='sword';state.lastDepartureCycle=4;state.returns=1;
  let guide=guidanceFor({state,stations});assert.match(guide.stage,/凱旋/);assert.match(guide.detail,/25歳/);assert.ok(guide.target);
  state.ended=true;state.phase='ended';guide=guidanceFor({state,stations});assert.match(guide.stage,/輪廻/);assert.match(guide.detail,/次の人生/);assert.equal(guide.target,null);
});
