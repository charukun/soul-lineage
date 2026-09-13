import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeTap} from './first-build.browser.mjs';

function harness(points, {enabled=true}={}) {
  const clicks=[], samples=[], budgets=[];
  const locator={
    async scrollIntoViewIfNeeded(options){budgets.push(options.timeout);},
    async evaluate(){const point=points[Math.min(samples.length,points.length-1)];samples.push(point);return point;},
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
  const page={mouse:{async click(x,y){clicks.push({x,y,samples:samples.length});}}};
  return{page,expect,locator,clicks,samples,budgets};
}
const ready={x:80,y:650,width:100,height:100,hit:true};

test('native tap re-samples an opening drawer and clicks only its accessible current position',async()=>{
  const h=harness([{...ready,x:80,y:850,hit:false},ready]);
  await nativeTap(h.page,h.expect,h.locator);
  assert.deepEqual(h.clicks,[{x:80,y:650,samples:2}]);
  assert.ok(h.budgets.every(value=>value===8000));
});
test('native tap never clicks persistently covered or zero-size targets',async()=>{
  for(const point of [{...ready,hit:false},{...ready,width:0}]){
    const h=harness([point]);
    await assert.rejects(nativeTap(h.page,h.expect,h.locator),/remains obstructed/);
    assert.deepEqual(h.clicks,[]);
  }
});
test('native tap does not interact with disabled controls',async()=>{
  const h=harness([ready],{enabled:false});
  await assert.rejects(nativeTap(h.page,h.expect,h.locator),/disabled/);
  assert.deepEqual(h.clicks,[]);assert.deepEqual(h.samples,[]);
});
