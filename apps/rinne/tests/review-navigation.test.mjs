import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { REVIEW_NAVIGATION_FALLBACK, canReturnToPreviousReview } from '../src/review-navigation-state.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('review back uses same-origin history only when it is safe',()=>{
  assert.equal(REVIEW_NAVIGATION_FALLBACK,'https://soul-lineage-review-dev.c-okamoto.workers.dev/');
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/',currentHref:'https://review.test/review-battle.html',historyLength:2}),true);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/characters.html',currentHref:'https://review.test/characters-advanced.html',historyLength:4}),true);
  assert.equal(canReturnToPreviousReview({referrer:'https://outside.test/',currentHref:'https://review.test/review-effects.html',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'',currentHref:'https://review.test/review-assets.html',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/review-assets.html',currentHref:'https://review.test/review-assets.html',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/',currentHref:'https://review.test/review-assets.html',historyLength:1}),false);
});

test('all Visual Review specialist pages receive the shared navigation module',async()=>{
  const vite=await read('vite.config.js');
  const entries=vite.match(/const reviewNavigationEntries=new Set\(\[([\s\S]*?)\]\);/)?.[1]||'';
  for(const page of ['/review-motion','/review-assets','/review-objects','/review-effects','/review-sound','/review-battle'])assert.match(entries,new RegExp(`'${page.replaceAll('.','\\.')}'`));
  assert.doesNotMatch(entries,/characters(?:-advanced)?\.html/);
  assert.doesNotMatch(entries,/'\/review\.html'/);
  assert.match(vite,/order:'pre'/);
  assert.match(vite,/src:'\.\/src\/review-navigation\.js'/);
  const [objectsHtml,objectsJs,objectsCatalog]=await Promise.all([read('review-objects.html'),read('src/review-object-library.js'),read('src/review-object-catalog.js')]);
  assert.match(objectsHtml,/id="object-categories"/);
  assert.match(objectsJs,/CATEGORY_OPTIONS/);
  assert.match(objectsJs,/selectedCategory==='all'/);
  for(const category of ['props','outdoor','furniture','training','weapons'])assert.match(objectsJs,new RegExp(`id:'${category}'`));
});

test('shared navigation replaces legacy controls and is mobile-safe',async()=>{
  const [runtime,css]=await Promise.all([read('src/review-navigation.js'),read('src/review-navigation.css')]);
  assert.match(runtime,/\.stage-head > \.back-link/);
  assert.match(runtime,/\.page-head > \.back/);
  assert.match(runtime,/Visual Reviewへ戻る/);
  assert.match(runtime,/doc\.body\.prepend\(back\)/);
  assert.match(runtime,/win\.history\.back\(\)/);
  assert.match(css,/min-height:44px/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/safe-area-inset-left/);
});

test('Rinne review launcher is only a compatibility bridge to the independent Lab',async()=>{
  const html=await read('review.html');
  assert.match(html,/soul-lineage-review-dev\.c-okamoto\.workers\.dev/);
  assert.match(html,/data-review-bridge/);
  assert.doesNotMatch(html,/data-review-target=/);
});
