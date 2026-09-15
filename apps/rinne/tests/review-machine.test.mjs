import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildMachineReviewRecipe,isMachineReviewURL,normalizeMachineReviewRequest,MACHINE_REVIEW_DEFAULT_VIEWS,MACHINE_REVIEW_VERSION} from '../src/review/machine-review-contract.js';

test('machine review defaults to deterministic four-view capture',()=>{
  const request=normalizeMachineReviewRequest({},1.25);
  assert.deepEqual([...request.views],[...MACHINE_REVIEW_DEFAULT_VIEWS]);
  assert.equal(request.time,1.25);
  assert.equal(request.settleFrames,2);
  assert.equal(request.restore,true);
});

test('machine review rejects unsupported-only view sets and clamps time',()=>{
  assert.throws(()=>normalizeMachineReviewRequest({views:['hero-angle']}),/supported camera/);
  assert.equal(normalizeMachineReviewRequest({views:['front'],time:999}).time,120);
});

test('machine review recipe records real Lab evidence and keeps approval pending',()=>{
  const recipe=buildMachineReviewRecipe({snapshot:{loaded:true,source:'SHINO / Runtime',clip:'idle',sequence:['idle'],time:.5,build:'abc123',state:{preset:'model.SHINO'}},view:'front',time:.5,width:1024,height:1024,stateURL:'https://example.test/?machine=1'});
  assert.equal(recipe.version,MACHINE_REVIEW_VERSION);
  assert.equal(recipe.renderer,'visual-review-lab');
  assert.equal(recipe.renderContract,'lab-real-asset-v1');
  assert.equal(recipe.preset,'model.SHINO');
  assert.equal(recipe.visualApproval,'pending');
});

test('machine mode is explicit and browser module exposes no AI transport',()=>{
  assert.equal(isMachineReviewURL('https://example.test/?machine=1'),true);
  assert.equal(isMachineReviewURL('https://example.test/'),false);
  const source=readFileSync(new URL('../src/review/machine-review.js',import.meta.url),'utf8');
  assert.match(source,/window\.__reviewMachine/);
  assert.match(source,/captureSet/);
  assert.match(source,/toDataURL\('image\/png'\)/);
  assert.doesNotMatch(source,/\bfetch\s*\(|navigator\.share|indexedDB|FAL_KEY|FAL_API_KEY|fal\.ai/i);
});
