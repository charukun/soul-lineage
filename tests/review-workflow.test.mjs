import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review publication verifies direct navigation, real models and VFX on desktop and mobile',async()=>{
  const [workflow,opsBoard,smoke,collector,browserCheck,review]=await Promise.all([
    read('.github/workflows/review-preview.yml'),read('.github/workflows/ops-board.yml'),read('scripts/browser/visual-review-smoke.mjs'),read('ops-board/collector.mjs'),read('ops-board/browser-check.mjs'),read('apps/rinne/review.html')
  ]);
  assert.match(workflow,/workflow_call:/);assert.match(workflow,/source_sha:[\s\S]*required: true/);assert.match(workflow,/npm run build:review/);assert.match(workflow,/visual-review\/public/);assert.match(workflow,/browser-verified/);
  assert.match(smoke,/version\.json/);assert.match(smoke,/version\.commit,expectedSha|version\.commit, expectedSha/);
  assert.match(smoke,/name:\s*'desktop'[\s\S]*1280[\s\S]*900/);assert.match(smoke,/name:\s*'mobile'[\s\S]*390[\s\S]*844[\s\S]*isMobile:\s*true/);
  assert.match(smoke,/new URL\('review\.html',reviewUrl\)/);assert.match(smoke,/reviewHtmlDirect:true/);
  assert.match(smoke,/data-review-target/);assert.match(smoke,/page\.goBack/);assert.match(smoke,/waitForReviewUrl=pattern=>page\.waitForURL\(pattern,\{waitUntil:'domcontentloaded',timeout:15000\}\)/);assert.match(smoke,/characters\.html\?review=motion/);assert.match(smoke,/review-assets\.html/);assert.match(smoke,/review-effects\.html/);assert.match(smoke,/review-battle\.html/);
  assert.match(smoke,/battleGeometry.*runtime-models/);assert.match(smoke,/battleModels.*ready/);assert.match(smoke,/kaykit\.mage\.v1/);assert.match(smoke,/kaykit\.barbarian\.v1/);assert.match(smoke,/battle-toggle/);assert.match(smoke,/battle-restart/);assert.match(smoke,/fx-status/);assert.match(smoke,/原本再生可能/);
  assert.equal((review.match(/data-review-target=/g)||[]).length,5);assert.doesNotMatch(review,/<iframe\b/);assert.doesNotMatch(review,/develop-review\.js|focus-shell|app-context/);
  assert.match(opsBoard,/visual-review:[\s\S]*uses: \.\/\.github\/workflows\/review-preview\.yml/);assert.match(collector,/status\.context === 'visual-review\/public'/);assert.match(browserCheck,/page\.locator\('#app-dialog \.app-dialog-close'\)\.click\(\)/);
});

test('Review build promotes review.html without deleting its direct route',async()=>{
  const build=await read('scripts/build-review.mjs');assert.match(build,/npm.*build:rinne/s);assert.match(build,/review\.html/);assert.match(build,/game\.html/);assert.match(build,/copyFileSync\(reviewIndex,appIndex\)/);assert.doesNotMatch(build,/rmSync\(reviewIndex\)/);
});

test('Review launcher contains no embedded specialist runtime',async()=>{
  const review=await read('apps/rinne/review.html');assert.doesNotMatch(review,/<iframe\b/);assert.doesNotMatch(review,/<script\b/);assert.match(review,/href="\.\/review-battle\.html"/);
});
