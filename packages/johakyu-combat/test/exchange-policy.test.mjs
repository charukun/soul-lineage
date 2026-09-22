import test from 'node:test';
import assert from 'node:assert/strict';
import {createJohakyuExchangeState as create,reduceJohakyuExchange as reduce,classifyJohakyuParry as classify,johakyuExchangeHudState as hud,johakyuExchangeSnapshot as snapshot} from '../src/exchange-policy.js';
const event=(type,extra={})=>({type,sourceId:'hero',targetId:'enemy',phase:'jo',...extra});
const start=()=>reduce(create({sourceId:'hero',targetId:'enemy'}),event('commit'));
test('ordinary guard, weak parry, shallow slip/deflection/hit retain the same pressure',()=>{
  let s=start();const serial=s.serial;
  for(const type of ['guard','parry','slip','deflection','hit']){s=reduce(s,event(type));assert.equal(s.continuity,'retain');assert.equal(s.mode,'pressure');assert.equal(s.initiativeId,'hero');assert.equal(s.serial,serial);}
  for(const p of ['ha','kyu']){s=reduce(s,event('commit',{phase:p}));assert.equal(hud(s,{phase:p}),p);}
});
test('strong parry reverses, settle and counter do NOT start normal offense',()=>{
  const old=start();let s=reduce(old,event('parry',{strong:true}));
  assert.equal(s.mode,'reversal');assert.equal(s.initiativeId,'enemy');assert.equal(s.continuity,'reverse');
  for(const type of ['settle','counter-start','counter-complete','commit']){s=reduce(s,event(type,{sourceId:'enemy',targetId:'hero',phase:'kyu'}));assert.equal(s.mode,'reversal');assert.equal(hud(s,{actorId:'enemy',phase:'kyu'}),'maai');}
  assert.equal(reduce(s,event('kyu-complete',{phase:'kyu',serial:old.serial})),s);
  assert.equal(reduce(s,event('normal-start',{sourceId:'enemy',targetId:'hero',phase:'ha'})),s);
  s=reduce(s,event('normal-start',{sourceId:'enemy',targetId:'hero'}));assert.equal(hud(s,{actorId:'enemy',phase:'jo'}),'jo');assert.ok(s.serial>old.serial);
});
test('hero reversal keeps stale ha/kyu and every counter reaction on left wave',()=>{
  let s=reduce(create(),event('commit',{sourceId:'enemy',targetId:'hero'}));
  for(const phase of ['ha','kyu'])assert.equal(hud(s,{phase}),'maai');
  s=reduce(s,event('parry',{sourceId:'enemy',targetId:'hero',strong:true}));
  for(const phase of ['ha','kyu'])assert.equal(hud(s,{phase}),'maai');
  s=reduce(s,event('counter-start'));assert.equal(hud(s,{phase:'kyu',reaction:true}),'maai');
  s=reduce(s,event('normal-start'));assert.equal(hud(s,{phase:'jo'}),'jo');
  assert.equal(hud(s,{phase:'jo',reaction:true}),'maai');
});
test('right zanshin belongs only to the actor that actually completed kyu',()=>{
  let s=start();s=reduce(s,event('commit',{phase:'kyu'}));s=reduce(s,event('kyu-complete',{phase:'kyu'}));
  assert.equal(hud(s),'zanshin');assert.equal(hud(s,{actorId:'enemy',phase:'kyu'}),'maai');
  assert.equal(s.completedBy,'hero');s=reduce(s,{type:'settle'});assert.equal(hud(s),'maai');assert.equal(s.mode,'read');
});
test('failure is READ, not a successful zanshin; late contact cannot revive it',()=>{
  for(const [type,more] of [['hit',{deep:true}],['miss',{major:true}],['execution-blocked',{}],['capability-failure',{}],['incapacitation',{}],['target-invalidation',{}],['disengage',{}]]){
    let s=reduce(start(),event(type,more));assert.equal(s.mode,'read');assert.equal(hud(s),'maai');assert.equal(s.completedBy,null);
    s=reduce(s,event('guard'));assert.equal(s.mode,'read');
  }
});
test('secondary commitments cannot replace the primary phase or freeze another pair',()=>{
  let a=reduce(start(),event('commit',{phase:'ha'}));const b=create({sourceId:'enemy-b',targetId:'hero'});
  assert.equal(reduce(a,event('commit',{sourceId:'enemy',targetId:'hero',phase:'kyu'})),a);
  assert.equal(reduce(a,event('parry',{sourceId:'enemy-b',targetId:'hero',strong:true})),a);
  const active=reduce(b,event('commit',{sourceId:'enemy-b',targetId:'hero'}));assert.equal(active.mode,'pressure');assert.equal(a.lastPhase,'ha');assert.deepEqual(snapshot(a).pair,['hero','enemy']);
});
test('classification is deterministic, contact/capability-bound, and shallow slip never strong',()=>{
  assert.equal(classify({authored:true}).strong,true);
  assert.equal(classify({counter:true,phase:'jo'}).strong,false);
  assert.equal(classify({counter:true,phase:'kyu'}).strong,true);
  for(const extra of [{contact:false},{capable:false},{slip:true}])assert.equal(classify({authored:true,...extra}).strong,false);
  const input={counter:true,impact:{heavy:true}};assert.deepEqual(classify(input),classify(input));
});
