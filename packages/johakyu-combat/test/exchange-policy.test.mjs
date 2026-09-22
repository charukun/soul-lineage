import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyJohakyuParry,createJohakyuExchangeState,johakyuExchangeSnapshot,reduceJohakyuExchange} from '../src/exchange-policy.js';

test('guard and weak parry retain one continuous pressure exchange',()=>{
 let state=createJohakyuExchangeState();
 state=reduceJohakyuExchange(state,{type:'commit',sourceId:'hero',targetId:'enemy',phase:'jo'});
 const serial=state.serial;
 state=reduceJohakyuExchange(state,{type:'guard',sourceId:'hero',targetId:'enemy',phase:'jo'});
 assert.equal(state.mode,'pressure');assert.equal(state.initiativeId,'hero');assert.equal(state.serial,serial);assert.equal(state.continuity,'retain');
 state=reduceJohakyuExchange(state,{type:'parry',sourceId:'hero',targetId:'enemy',phase:'ha',strong:false});
 assert.equal(state.mode,'pressure');assert.equal(state.initiativeId,'hero');assert.equal(state.serial,serial);assert.equal(state.continuity,'retain');
});

test('strong parry reverses initiative without inventing damage or phase progression',()=>{
 let state=reduceJohakyuExchange(createJohakyuExchangeState(),{type:'commit',sourceId:'hero',targetId:'enemy',phase:'ha'});
 state=reduceJohakyuExchange(state,{type:'parry',sourceId:'hero',targetId:'enemy',phase:'ha',strong:true});
 assert.equal(state.mode,'reversal');assert.equal(state.initiativeId,'enemy');assert.equal(state.responderId,'hero');assert.equal(state.lastPhase,'ha');assert.equal(state.continuity,'reverse');
 state=reduceJohakyuExchange(state,{type:'settle'});
 assert.equal(state.mode,'pressure');assert.equal(state.initiativeId,'enemy');
});

test('deep hit, major miss, execution block and kyu completion end pressure at zanshin',()=>{
 for(const event of [
  {type:'hit',deep:true,phase:'ha'},
  {type:'miss',major:true,phase:'jo'},
  {type:'execution-blocked',phase:'ha'},
  {type:'kyu-complete',phase:'kyu'}
 ]){
  let state=reduceJohakyuExchange(createJohakyuExchangeState(),{type:'commit',sourceId:'hero',targetId:'enemy',phase:'jo'});
  state=reduceJohakyuExchange(state,{...event,sourceId:'hero',targetId:'enemy'});
  assert.equal(state.mode,'zanshin',event.type);assert.equal(state.continuity,'reset',event.type);
  state=reduceJohakyuExchange(state,{type:'settle'});assert.equal(state.mode,'read',event.type);
 }
});

test('secondary commits cannot steal a pair pressure owner',()=>{
 let state=reduceJohakyuExchange(createJohakyuExchangeState(),{type:'commit',sourceId:'hero',targetId:'enemy-a',phase:'jo'});
 state=reduceJohakyuExchange(state,{type:'commit',sourceId:'enemy-a',targetId:'hero',phase:'enemy'});
 assert.equal(state.initiativeId,'hero');assert.equal(state.lastReason,'secondary-commit');assert.equal(state.continuity,'retain');
});

test('parry strength is deterministic from authored or authoritative impact signals',()=>{
 assert.equal(classifyJohakyuParry({authored:true,phase:'ha'}).strength,'strong');
 assert.equal(classifyJohakyuParry({counter:true,phase:'jo'}).strength,'weak');
 assert.equal(classifyJohakyuParry({counter:true,phase:'kyu'}).strength,'strong');
 assert.equal(classifyJohakyuParry({counter:true,phase:'ha',impact:{heavy:true,power:1.2,knockback:{x:.2,z:0}}}).strength,'strong');
 const snapshot=johakyuExchangeSnapshot(null);assert.equal(snapshot.mode,'read');assert.equal(snapshot.initiativeId,null);
});
