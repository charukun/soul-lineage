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
const compact=guide=>{assert.equal('detail' in guide,false);assert.ok(guide.objective.length<=10,guide.objective);assert.ok((guide.badge||'').length<=10,guide.badge);};

test('birth is mother-led and exposes no destination waypoint',()=>{
  const state=atAge(0),guide=guidanceFor({state,stations});compact(guide);
  assert.equal(guide.stage,'1/6 誕生');assert.equal(guide.objective,'母と村巡り');assert.equal(guide.badge,'自立 4歳');assert.equal(guide.target,null);assert.equal(guidanceDistance(state,guide),null);
});

test('childhood and preparation point at automatic actions without action buttons',()=>{
  const child=atAge(5),childGuide=guidanceFor({state:child,stations});compact(childGuide);
  assert.match(childGuide.stage,/村/);assert.ok(childGuide.target);assert.equal(childGuide.badge,'武具 7歳');
  const prep=atAge(9),prepGuide=guidanceFor({state:prep,stations});compact(prepGuide);
  assert.equal(prepGuide.objective,'武具を選ぶ');assert.equal(prepGuide.target.label,'片手剣');assert.equal(prepGuide.badge,'出航 15歳');
});

test('departure guidance is only a destination because departure and combat are automatic',()=>{
  const state=atAge(15);state.equipment.weapon='sword';
  const guide=guidanceFor({state,stations});compact(guide);
  assert.equal(guide.stage,'4/6 出立');assert.equal(guide.objective,'港へ');assert.equal(guide.badge,'出航');assert.equal(guide.target.label,'港');
});

test('frontier guidance is enemy then depth then return with no instruction paragraphs',()=>{
  const state=atAge(20);state.zone='frontier';state.front=0;state.position={x:0,z:5.2};
  const front=createFront(0,state.seed);let guide=guidanceFor({state,stations,front});compact(guide);
  assert.equal(guide.objective,'敵へ');assert.equal(guide.target.label,'敵');assert.match(guide.badge,/敵 /);
  state.combat={targetId:front.enemies[0].id,phase:'jo',attackCooldown:0};guide=guidanceFor({state,stations,front});assert.equal(guide.objective,'戦闘');
  state.combat=null;for(const enemy of front.enemies){enemy.dead=true;enemy.hp=0;}front.cleared=true;
  guide=guidanceFor({state,stations,front});compact(guide);assert.equal(guide.objective,'奥へ');assert.equal(guide.target.label,'次の前線');assert.ok(guide.target.z<0);
  state.front=5;front.stage=5;guide=guidanceFor({state,stations,front});compact(guide);assert.equal(guide.objective,'帰還へ');assert.equal(guide.target.label,'帰還地点');assert.ok(guide.target.z>0);
});

test('rescue is an automatic countdown, not a prompt',()=>{
  const state=atAge(30);state.zone='frontier';state.down={elapsed:34.2};
  const guide=guidanceFor({state,stations,front:createFront(1,state.seed)});compact(guide);
  assert.equal(guide.objective,'救助待ち');assert.equal(guide.badge,'6秒');assert.equal(guide.target,null);
});

test('return and life end stay compact while irreversible reincarnation remains explicit elsewhere',()=>{
  const state=atAge(20);state.equipment.weapon='sword';state.lastDepartureCycle=4;state.returns=1;
  let guide=guidanceFor({state,stations});compact(guide);assert.match(guide.stage,/凱旋/);assert.equal(guide.badge,'次 25歳');assert.ok(guide.target);
  state.ended=true;state.phase='ended';guide=guidanceFor({state,stations});compact(guide);assert.equal(guide.stage,'6/6 輪廻');assert.equal(guide.objective,'記憶を選ぶ');assert.equal(guide.target,null);
});
