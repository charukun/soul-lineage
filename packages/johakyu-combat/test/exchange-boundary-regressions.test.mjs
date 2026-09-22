import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuExchangeState as create,reduceJohakyuExchange as reduce,isDeepJohakyuExchangeHit as deep,johakyuExchangeHudState as hud,johakyuExchangeIntent as intent} from '../src/exchange-policy.js';
const event=(type,extra={})=>({type,sourceId:'hero',targetId:'enemy',phase:'jo',...extra});
const start=()=>reduce(create({sourceId:'hero',targetId:'enemy'}),event('normal-start'));
test('an existing compromised limb does not turn every shallow hit into a new decisive break',()=>{
 const prior={compromised:true,incapacitated:false},shallow={damage:2,maxHp:100,impact:{heavy:false},outcome:prior,previousOutcome:prior};
 assert.equal(deep(shallow),false);assert.equal(deep({...shallow,previousOutcome:{compromised:false}}),true);
 assert.equal(deep({...shallow,damage:16}),true);assert.equal(deep({...shallow,outcome:{incapacitated:true}}),true);
 assert.equal(deep({...shallow,impact:{heavy:true,guard:true}}),false);assert.equal(deep({...shallow,impact:{heavy:true}}),true);
 const state=start();assert.equal(reduce(state,event('hit',{deep:deep(shallow)})).continuity,'retain');
});
test('settle from an old serial or a secondary pair cannot erase current owned zanshin',()=>{
 let s=reduce(start(),event('commit',{phase:'kyu'}));s=reduce(s,event('kyu-complete',{phase:'kyu'}));
 assert.equal(reduce(s,event('settle',{serial:s.serial-1})),s);
 assert.equal(reduce(s,event('settle',{sourceId:'enemy-b',targetId:'hero'})),s);
 assert.equal(reduce(s,event('settle',{serial:s.serial})).mode,'read');
});
test('non-kyu native completion is never presented as hero kyu completion',()=>{
 const s=reduce(start(),event('offense-complete'));assert.equal(s.mode,'zanshin');assert.equal(hud(s,{actorId:'hero'}),'maai');
});
test('AI intent is pair-scoped and distinguishes response from the normal offense after a reversal',()=>{
 let s=start();assert.equal(intent(s,{actorId:'hero'}),'pressure');assert.equal(intent(s,{actorId:'enemy'}),'respond');assert.equal(intent(s,{actorId:'enemy-b'}),'read');
 s=reduce(s,event('parry',{strong:true}));assert.equal(intent(s,{actorId:'hero'}),'respond');assert.equal(intent(s,{actorId:'enemy'}),'counter');
 assert.equal(intent(reduce(create({sourceId:'enemy-b',targetId:'hero'}),event('normal-start',{sourceId:'enemy-b',targetId:'hero'})),{actorId:'enemy-b'}),'pressure');
});
