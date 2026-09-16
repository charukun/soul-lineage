import test from 'node:test';
import assert from 'node:assert/strict';
import {attentionLoadPriority,shouldPromoteAttention} from '@soul/rendering/attention-priority';
import {
  MANIFESTATION_STAGES,
  createProgressiveManifestation,
  manifestationProfileFor,
  manifestationVisualPhase
} from '@soul/rendering/progressive-manifestation';

const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
const tick=()=>new Promise(resolve=>setImmediate(resolve));

test('attention priority wins the next available loading slot without preempting active work',async()=>{
  const order=[],block=deferred(),low=deferred(),high=deferred();
  const director=createProgressiveManifestation({maxConcurrent:1});
  director.register('block',{load:async()=>{order.push('block');return block.promise;}});
  director.register('low',{load:async()=>{order.push('low');return low.promise;}});
  director.register('high',{load:async()=>{order.push('high');return high.promise;}});
  director.focus('block',100);director.hint('low',10);director.focus('high',200);
  await tick();assert.deepEqual(order,['block']);
  block.resolve({id:'block'});await tick();await tick();assert.deepEqual(order,['block','high']);
  high.resolve({id:'high'});await tick();await tick();assert.deepEqual(order,['block','high','low']);
  low.resolve({id:'low'});await tick();director.dispose();
});

test('player attention promotes observed targets above generic visible candidates',()=>{
  const background=attentionLoadPriority({visible:true,screenAlignment:.1,screenCoverage:.02,distance:45});
  const observed=attentionLoadPriority({visible:true,screenAlignment:.96,screenCoverage:.18,distance:30});
  const combat=attentionLoadPriority({combat:true,screenAlignment:.2,distance:18});
  assert.ok(observed>background);assert.ok(combat>observed);assert.equal(shouldPromoteAttention(background),false);assert.equal(shouldPromoteAttention(observed),true);assert.equal(attentionLoadPriority({selected:true}),260);
});

test('manifestation state is monotonic and never returns to low resolution after completion',async()=>{
  const director=createProgressiveManifestation({maxConcurrent:1});
  director.register('actor',{profile:'human',load:async({onProgress})=>{onProgress(.25);onProgress(.8);return{ok:true};}});
  director.focus('actor');await director.wait('actor');
  assert.equal(director.snapshot('actor').stage,MANIFESTATION_STAGES.FORMING);
  for(let i=0;i<8;i++)director.update(.1);
  assert.equal(director.snapshot('actor').stage,MANIFESTATION_STAGES.MANIFESTED);
  director.hint('actor',1);director.focus('actor',999);director.update(.1);
  const final=director.snapshot('actor');assert.equal(final.stage,MANIFESTATION_STAGES.MANIFESTED);assert.equal(final.formingProgress,1);assert.equal(final.progress,1);
  director.dispose();
});

test('load failure is explicit and does not masquerade as manifested',async()=>{
  const director=createProgressiveManifestation({maxConcurrent:1});let failed='';
  director.register('broken',{load:async()=>{throw new Error('network down');},onFailure:error=>{failed=error.message;}});
  director.focus('broken');await tick();await tick();
  const snapshot=director.snapshot('broken');assert.equal(snapshot.stage,MANIFESTATION_STAGES.FAILED);assert.match(snapshot.error,/network down/);assert.equal(failed,'network down');director.dispose();
});

test('model nature changes manifestation character while quality scale caps effect cost',()=>{
  const massive=manifestationProfileFor('massive'),subtle=manifestationProfileFor('subtle');assert.ok(massive.duration>subtle.duration);assert.ok(massive.shock>subtle.shock);
  const full=manifestationVisualPhase(MANIFESTATION_STAGES.FORMING,.5,{profile:'hostile',qualityScale:1});
  const mobile=manifestationVisualPhase(MANIFESTATION_STAGES.FORMING,.5,{profile:'hostile',qualityScale:.45});
  assert.ok(full.effect>mobile.effect);assert.ok(full.particles>mobile.particles);assert.equal(full.detail,mobile.detail);
});
