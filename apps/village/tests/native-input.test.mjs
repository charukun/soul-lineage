import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeTap} from './first-build.browser.mjs';

function harness(samplesToReturn, {enabled=true}={}) {
  const events=[], samples=[], budgets=[];
  const locator={
    async scrollIntoViewIfNeeded(options){budgets.push(options.timeout);},
    async evaluate(){const value=samplesToReturn[Math.min(samples.length,samplesToReturn.length-1)];samples.push(value);return value;},
  };
  const expect=value=>({
    async toBeVisible(options){assert.equal(value,locator);budgets.push(options.timeout);},
    async toBeEnabled(options){assert.equal(value,locator);budgets.push(options.timeout);assert.ok(enabled,'disabled');},
    toBeGreaterThan(min){assert.ok(value>min);},
    toBe(expected){assert.equal(value,expected);},
  });
  expect.poll=(sample,options)=>({async toBe(expected){
    budgets.push(options.timeout);
    for(let attempt=0;attempt<3;attempt++)if(await sample()===expected)return;
    assert.fail('native target remains obstructed');
  }});
  const page={mouse:{
    async move(x,y){events.push({type:'move',x,y,samples:samples.length});},
    async down(){events.push({type:'down',samples:samples.length});},
    async up(){events.push({type:'up',samples:samples.length});},
  }};
  return{page,expect,locator,events,samples,budgets};
}
const ready={x:80,y:650,width:100,height:100,hit:true};

test('native tap re-samples an opening drawer and presses only its accessible current point',async()=>{
  const h=harness([{...ready,y:850,hit:false},ready,true]);
  await nativeTap(h.page,h.expect,h.locator);
  assert.deepEqual(h.events,[
    {type:'move',x:80,y:650,samples:2},
    {type:'down',samples:3},
    {type:'up',samples:3},
  ]);
  assert.ok(h.budgets.every(value=>value===8000));
});

test('native tap accepts hover geometry changes when the actual pointer still hits the same control',async()=>{
  const h=harness([ready,true]);
  await nativeTap(h.page,h.expect,h.locator);
  assert.deepEqual(h.events,[
    {type:'move',x:80,y:650,samples:1},
    {type:'down',samples:2},
    {type:'up',samples:2},
  ]);
});

test('native tap retries when a rerender moves a different control under the sampled point',async()=>{
  const moved={...ready,y:562};
  const h=harness([ready,false,moved,true]);
  await nativeTap(h.page,h.expect,h.locator);
  assert.deepEqual(h.events,[
    {type:'move',x:80,y:650,samples:1},
    {type:'move',x:80,y:562,samples:3},
    {type:'down',samples:4},
    {type:'up',samples:4},
  ]);
});

test('native tap never presses persistently covered or zero-size targets',async()=>{
  for(const point of [{...ready,hit:false},{...ready,width:0}]){
    const h=harness([point]);
    await assert.rejects(nativeTap(h.page,h.expect,h.locator),/remains obstructed/);
    assert.deepEqual(h.events,[]);
  }
});

test('native tap does not interact with disabled controls',async()=>{
  const h=harness([ready],{enabled:false});
  await assert.rejects(nativeTap(h.page,h.expect,h.locator),/disabled/);
  assert.deepEqual(h.events,[]);assert.deepEqual(h.samples,[]);
});
