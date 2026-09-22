import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyJohakyuParry,createJohakyuExchangeState,isDeepJohakyuExchangeHit,johakyuExchangeHudState,johakyuExchangeSnapshot,reduceJohakyuExchange} from '../src/exchange-policy.js';
import {johakyuStageCapability,johakyuTechniqueCapability} from '../src/execution-capability.js';
import {createJohakyuDomainActor} from '../src/domain.js';
const event=(type,extra={})=>({type,sourceId:'hero',targetId:'enemy',phase:'jo',...extra});
const start=()=>reduceJohakyuExchange(createJohakyuExchangeState(),event('commit'));
const hud=(state,phase='kyu',extra={})=>johakyuExchangeHudState(state,{actorId:'hero',phase,...extra});

test('guard, weak parry, slip and blade contact retain the same jo-ha-kyu pressure',()=>{
 let state=start();const serial=state.serial;
 for(const [phase,type]of [['jo','guard'],['ha','parry'],['kyu','slip']]){
  state=reduceJohakyuExchange(state,event('commit',{phase}));state=reduceJohakyuExchange(state,event(type,{phase,strong:false}));
  assert.equal(state.mode,'pressure');assert.equal(state.initiativeId,'hero');assert.equal(state.serial,serial);assert.equal(state.continuity,'retain');assert.equal(hud(state,phase),phase);
 }
 state=reduceJohakyuExchange(state,event('blade-contact',{phase:'kyu'}));assert.equal(state.continuity,'retain');
});
test('strong parry reverses but settle, counter and stale callbacks never start normal jo',()=>{
 let state=reduceJohakyuExchange(start(),event('commit',{phase:'ha'})),old=state.serial;
 state=reduceJohakyuExchange(state,event('parry',{strong:true,phase:'ha'}));
 assert.equal(state.mode,'reversal');assert.equal(state.initiativeId,'enemy');assert.equal(state.continuity,'reverse');assert.equal(hud(state),'maai');
 state=reduceJohakyuExchange(state,event('kyu-complete',{phase:'kyu',exchangeSerial:old}));assert.equal(state.mode,'reversal');
 state=reduceJohakyuExchange(state,{type:'settle'});assert.equal(state.mode,'reversal');assert.equal(state.normalStarted,false);
 for(const type of ['counter-start','counter-complete']){state=reduceJohakyuExchange(state,event(type,{sourceId:'enemy',targetId:'hero',counter:true}));assert.equal(state.mode,'reversal');}
 state=reduceJohakyuExchange(state,event('commit',{sourceId:'enemy',targetId:'hero',phase:'ha'}));assert.equal(state.mode,'reversal');
 state=reduceJohakyuExchange(state,event('commit',{sourceId:'enemy',targetId:'hero',phase:'jo'}));assert.equal(state.mode,'pressure');assert.equal(state.lastPhase,'jo');
});
test('successful hero defender stays maai through counter and starts new normal jo',()=>{
 let state=reduceJohakyuExchange(createJohakyuExchangeState(),event('commit',{sourceId:'enemy',targetId:'hero'}));
 assert.equal(hud(state,'ha'),'maai');assert.equal(hud(state,'kyu'),'maai');
 state=reduceJohakyuExchange(state,event('parry',{sourceId:'enemy',targetId:'hero',strong:true,phase:'kyu'}));assert.equal(hud(state),'maai');
 state=reduceJohakyuExchange(state,event('counter-start',{counter:true}));assert.equal(hud(state),'maai');
 const attempt=reduceJohakyuExchange(state,event('commit'));assert.equal(attempt.mode,'reversal');
 state=reduceJohakyuExchange(state,event('counter-complete',{counter:true}));assert.equal(hud(state),'maai');
 state=reduceJohakyuExchange(state,event('commit'));assert.equal(hud(state,'jo'),'jo');assert.equal(hud(state,'jo',{reaction:true}),'maai');
});
test('only owner kyu completion has zanshin, including its short settle window',()=>{
 for(const owner of ['hero','enemy']){const target=owner==='hero'?'enemy':'hero';let state=reduceJohakyuExchange(createJohakyuExchangeState(),event('commit',{sourceId:owner,targetId:target}));
  state=reduceJohakyuExchange(state,event('kyu-complete',{sourceId:owner,targetId:target,phase:'kyu'}));
  assert.equal(state.completedById,owner);assert.equal(hud(state),owner==='hero'?'zanshin':'maai');
  assert.equal(reduceJohakyuExchange(state,event('commit')),state,'opponent cannot erase the completion in the same frame');
  state=reduceJohakyuExchange(state,{type:'settle'});assert.equal(hud(state),'maai');assert.equal(state.mode,'read');
 }
});
test('deep hit, major miss and incapability return READ, not false own completion',()=>{
 for(const extra of [{type:'hit',deep:true},{type:'miss',major:true},{type:'execution-blocked'},{type:'capability-failure'},{type:'incapacitation'},{type:'target-invalid'},{type:'disengage'}]){
  const state=reduceJohakyuExchange(start(),event(extra.type,extra));assert.equal(state.mode,'read');assert.equal(hud(state),'maai');assert.equal(state.completedById,null);
 }
 assert.equal(reduceJohakyuExchange(start(),event('hit',{deep:false})).mode,'pressure');
 assert.equal(isDeepJohakyuExchangeHit({damage:4,maxHp:100,outcome:{compromised:true}}),false,'old injury does not turn every shallow contact into a new break');
 assert.equal(isDeepJohakyuExchangeHit({damage:16,maxHp:100}),true);
 assert.equal(isDeepJohakyuExchangeHit({damage:4,maxHp:100,impact:{guard:true,heavy:true}}),false);
});
test('pairs are isolated and secondary commits cannot corrupt owner phase or cancel pressure',()=>{
 const state=start();assert.equal(reduceJohakyuExchange(state,event('commit',{sourceId:'enemy-b',targetId:'hero'})),state);
 const secondary=reduceJohakyuExchange(createJohakyuExchangeState(),event('commit',{sourceId:'enemy-b',targetId:'hero'}));assert.equal(secondary.initiativeId,'enemy-b');
 const interrupted=reduceJohakyuExchange(state,event('execution-blocked',{sourceId:'enemy',targetId:'hero'}));assert.equal(interrupted,state);
 const attempt=reduceJohakyuExchange(state,event('commit',{sourceId:'enemy',targetId:'hero',phase:'kyu'}));assert.equal(attempt.lastPhase,'jo');assert.equal(attempt.initiativeId,'hero');
});
test('parry classification is deterministic, contact-context driven and capability constrained',()=>{
 assert.equal(classifyJohakyuParry({authored:true,phase:'ha'}).strength,'strong');
 assert.equal(classifyJohakyuParry({counter:true,phase:'jo'}).strength,'weak');
 assert.equal(classifyJohakyuParry({counter:true,phase:'kyu'}).strength,'strong');
 assert.equal(classifyJohakyuParry({authored:true,capable:false}).strength,'weak');
 assert.equal(johakyuExchangeSnapshot(null).mode,'read');
});
test('stamina and body authority can reject continuation despite initiative ownership',()=>{
 const actor=createJohakyuDomainActor({id:'hero',stamina:13});const before=structuredClone(actor);
 assert.equal(johakyuStageCapability(actor,{kind:'heavy',phase:'kyu',staminaCost:12}).allowed,false);
 assert.equal(johakyuTechniqueCapability({...actor,stamina:20},{stages:[{kind:'slash',staminaCost:12},{kind:'heavy',staminaCost:12}]}).canContinue,false);
 assert.deepEqual(actor,before,'policy does not spend or repair physiology');
 actor.injuries.leftArm.severity=.8;actor.injuries.leftLeg.severity=.8;actor.injuries.rightLeg.severity=.8;actor.stamina=100;
 assert.equal(johakyuStageCapability(actor,{weapon:'great',kind:'heavy'}).reason,'arm-injury');
 assert.equal(johakyuStageCapability(actor,{kind:'slash',footwork:'rush'}).reason,'leg-injury');
 assert.equal(reduceJohakyuExchange(start(),event('capability-failure')).mode,'read');
});
test('projectile, one motion and finisher never enter the melee Exchange authority',()=>{
 const state=start();for(const row of [{projectile:true},{phase:'one'},{phase:'finisher'}])assert.equal(reduceJohakyuExchange(state,event('commit',row)),state);
 const source=readFileSync(new URL('../src/exchange-policy.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/Math\.random|applyJohakyuImpactOnce|registerHit|spendActionStamina|\.hp\s*[-+]?=|cursor\s*=/);
});
