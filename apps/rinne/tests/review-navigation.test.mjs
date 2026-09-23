import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {REVIEW_NAVIGATION_FALLBACK,canReturnToPreviousReview} from '../../../packages/shared-ui/src/review-navigation.js';

const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('review back uses same-origin history only when it is safe',()=>{
  assert.equal(REVIEW_NAVIGATION_FALLBACK,'https://soul-lineage-review-dev.c-okamoto.workers.dev/');
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/',currentHref:'https://review.test/review-battle',historyLength:2}),true);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/review-motion',currentHref:'https://review.test/review-assets',historyLength:4}),true);
  assert.equal(canReturnToPreviousReview({referrer:'https://outside.test/',currentHref:'https://review.test/review-effects',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'',currentHref:'https://review.test/review-assets',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/review-assets',currentHref:'https://review.test/review-assets',historyLength:3}),false);
  assert.equal(canReturnToPreviousReview({referrer:'https://review.test/',currentHref:'https://review.test/review-assets',historyLength:1}),false);
});

test('RINNE specialist reviews use shared shell navigation without Vite injection',async()=>{
  const [vite,rinneShell,sharedShell]=await Promise.all([
    read('vite.config.js'),
    read('src/review/shared/lab-shell.js'),
    read('../../packages/shared-ui/src/review/shell.js'),
  ]);
  assert.doesNotMatch(vite,/reviewNavigationEntries|review-navigation\.js|transformIndexHtml/);
  assert.match(rinneShell,/historyBack:true/);
  assert.match(sharedShell,/bindReviewBackNavigation/);
  assert.match(sharedShell,/REVIEW_NAVIGATION_FALLBACK/);
});

test('stage gear discovers declarative controls instead of a per-screen selector map',async()=>{
  const [rinneShell,stage,...pages]=await Promise.all([
    read('src/review/shared/lab-shell.js'),
    read('../../packages/shared-ui/src/review/stage.js'),
    ...['review-motion.html','review-assets.html','review-objects.html','review-effects.html','review-sound.html'].map(read),
  ]);
  assert.doesNotMatch(rinneShell,/STAGE_CONTROL_GROUPS|motion-camera-strip|asset-camera-strip/);
  assert.match(rinneShell,/mountReviewStageControls\(\)/);
  assert.match(stage,/selector='\[data-review-stage-control\]'/);
  assert.match(stage,/if\(!nodes\.length\)return null/);
  const counts=pages.map(html=>(html.match(/data-review-stage-control/g)||[]).length);
  assert.deepEqual(counts,[1,1,1,1,2]);
});

test('slot picker is a shared-ui primitive and RINNE keeps only the adapter',async()=>{
  const [auto,pkg,picker]=await Promise.all([
    read('src/review/shared/slot-auto.js'),
    read('../../packages/shared-ui/package.json'),
    read('../../packages/shared-ui/src/review/slot-picker.js'),
  ]);
  assert.match(auto,/@soul\/shared-ui\/review-slot-picker/);
  assert.doesNotMatch(auto,/installBattleSlots|battle-canvas/);
  assert.equal(JSON.parse(pkg).exports['./review-slot-picker'],'./src/review/slot-picker.js');
  assert.match(picker,/import '\.\/slot-picker\.css'/);
  assert.match(await read('src/review-slot-auto.js'),/\.\/review\/shared\/slot-auto\.js/);
  await assert.rejects(read('src/review-slot-picker.js'));
  await assert.rejects(read('src/review-slot-picker.css'));
});

test('Rinne review launcher remains only a compatibility bridge to the independent Lab',async()=>{
  const html=await read('review.html');
  assert.match(html,/soul-lineage-review-dev\.c-okamoto\.workers\.dev/);
  assert.match(html,/data-review-bridge/);
  assert.doesNotMatch(html,/data-review-target=/);
});
