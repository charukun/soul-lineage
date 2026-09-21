import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {addTechniqueToReviewChain,createReviewTechniqueComposition,flattenReviewTechniqueChain,reviewChainLabel,reviewTechniqueStages} from '../src/review-technique-composition.js';
import {reviewInspirationModeState} from '../src/review-battle-state.js';

const appRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFile(resolve(appRoot,path),'utf8');

test('review composition separates stages, techniques, chains, and jo-ha-kyu',()=>{
  const composition=createReviewTechniqueComposition();
  addTechniqueToReviewChain(composition,'jo',{id:'cut-a',name:'霞',steps:[{kind:'slash'},{kind:'back'}]});
  addTechniqueToReviewChain(composition,'jo',{id:'cut-b',name:'送り',steps:[{kind:'dash'},{kind:'thrust'},{kind:'back'}]});
  assert.equal(reviewChainLabel('jo',composition.jo.length),'序 · 二連');
  assert.deepEqual(reviewTechniqueStages(composition.jo[0]).map(row=>row.label),['一段','二段']);
  assert.deepEqual(flattenReviewTechniqueChain(composition.jo).map(step=>step.kind),['slash','back','dash','thrust','back']);
});

test('inspiration probability mode changes preserve the active phase gate',()=>{
  assert.deepEqual(reviewInspirationModeState('boost','ha'),{mode:'boost',lastPhase:'ha'});
  assert.deepEqual(reviewInspirationModeState('normal','kyu'),{mode:'normal',lastPhase:'kyu'});
});

test('review chains stay compact and move repeated techniques to the active end',()=>{
  const composition=createReviewTechniqueComposition();
  for(const id of ['a','b','c','d'])addTechniqueToReviewChain(composition,'ha',{id,name:id,steps:[{kind:id}]});
  assert.deepEqual(composition.ha.map(row=>row.id),['b','c','d']);
  addTechniqueToReviewChain(composition,'ha',{id:'c',name:'c',steps:[{kind:'c2'}]});
  assert.deepEqual(composition.ha.map(row=>row.id),['b','d','c']);
  assert.deepEqual(flattenReviewTechniqueChain(composition.ha).map(step=>step.kind),['b','d','c2']);
});

test('battle probe is named 技構成 and exposes chain preview semantics while keeping the canonical route',async()=>{
  const [html,review,shell]=await Promise.all([read('review-battle.html'),read('src/review-battle.js'),read('../../packages/shared-ui/src/review-shell.js')]);
  assert.match(html,/<title>Visual Review｜技構成<\/title>/);
  assert.match(html,/<h1>技構成<\/h1>/);
  assert.match(html,/id="battle-technique-composition"/);
  assert.match(html,/段・技・連・序破急/);
  assert.match(review,/addTechniqueToReviewChain/);
  assert.match(review,/flattenReviewTechniqueChain/);
  assert.match(review,/data-chain-preview/);
  assert.match(shell,/id:'battle',label:'技構成'/);
  assert.match(shell,/battle:'review-battle\.html'/);
});
