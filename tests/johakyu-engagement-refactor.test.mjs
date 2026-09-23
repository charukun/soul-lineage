import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuBattleRuntime} from '../packages/johakyu-battle/src/runtime.js';
import {resolveEngagement,engagementReady} from '../packages/johakyu-battle/src/engagement.js';

const row=(id,side,x,extra={})=>({id,side,position:{x,z:0},equipment:{weapon:'sword',armor:'cloth'},canAttack:false,...extra});
const byId=(battle,id)=>battle.snapshot().actors.find(actor=>actor.id===id);

test('enter, hysteresis and exit use the same spatial authority for hero and enemy',()=>{
 const battle=createJohakyuBattleRuntime({battleId:'readiness',actors:[row('hero','party',0),row('enemy','enemy',5)]});
 for(const id of ['hero','enemy'])assert.equal(byId(battle,id).engagement.state,'idle');
 const enter=byId(battle,'hero').engagement.enterRange,exit=byId(battle,'hero').engagement.exitRange;
 battle.sync([row('hero','party',0),row('enemy','enemy',enter-.01)]);
 for(const id of ['hero','enemy'])assert.equal(byId(battle,id).engagement.state,'ready');
 battle.sync([row('hero','party',0),row('enemy','enemy',(enter+exit)/2)]);
 for(const id of ['hero','enemy'])assert.equal(byId(battle,id).combatReady,true);
 battle.sync([row('hero','party',0),row('enemy','enemy',exit+.01)]);
 for(const id of ['hero','enemy'])assert.equal(byId(battle,id).combatReady,false);
});

test('tactical target stays independent from nearest live threat, including after down',()=>{
 const battle=createJohakyuBattleRuntime({battleId:'threats',actors:[row('hero','party',0,{targetId:'far'}),row('near','enemy',1.5),row('far','enemy',5)]});
 assert.equal(byId(battle,'hero').engagement.threatId,'near');
 assert.equal(byId(battle,'hero').combatReady,true);
 battle.sync([row('hero','party',0,{targetId:'far'}),row('near','enemy',1.5,{downed:true}),row('far','enemy',5)]);
 assert.equal(byId(battle,'hero').engagement.threatId,'far');
 assert.equal(byId(battle,'hero').combatReady,false);
});

test('action and zanshin cannot pin readiness beyond exit range',()=>{
 const actor={equipment:{weapon:'sword'},position:{x:0,z:0},engagement:null,action:null,phaseCue:null};
 const threat={id:'enemy',position:{x:1,z:0}};
 actor.engagement=resolveEngagement({actor,threat,distance:(a,b)=>Math.abs(a.position.x-b.position.x)});
 assert.equal(engagementReady(actor.engagement),true);
 threat.position.x=10;
 actor.action={finisher:false};actor.phaseCue={phase:'zanshin'};
 actor.engagement=resolveEngagement({actor,threat,distance:(a,b)=>Math.abs(a.position.x-b.position.x)});
 assert.equal(actor.engagement.state,'idle');assert.equal(engagementReady(actor.engagement),false);
});

test('pursuit closes distance through movement before beginning an action',()=>{
 const battle=createJohakyuBattleRuntime({battleId:'pursuit',actors:[row('hero','party',0,{pursuit:true,canAttack:true}),row('enemy','enemy',4,{canAttack:false})]});
 const hero=battle.actor('hero');hero.pursuitTargetId='enemy';hero.pursuitUntil=10;hero.pursuitReadyAt=0;hero.readyAt=0;
 const before=hero.position.x;battle.step(1/60);
 assert.ok(hero.position.x>before);assert.equal(hero.action,null);
 assert.equal(byId(battle,'hero').combatReady,false);
});
