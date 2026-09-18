import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Visual Review uses only the Rinne Pages DEV route',async()=>{
  const [opsBoard,collector,applications,review,vite]=await Promise.all([
    read('.github/workflows/ops-board.yml'),read('ops-board/collector.mjs'),read('ops-board/applications.mjs'),read('apps/rinne/review.html'),read('apps/rinne/vite.config.js')
  ]);
  assert.doesNotMatch(opsBoard,/review-preview\.yml|Publish Visual Review on explicit Ops Board dispatch/);
  assert.doesNotMatch(collector,/visual-review\/public|VISUAL_REVIEW_PUBLIC_URL|visualReviewEnvironment/);
  assert.doesNotMatch(applications,/rinne-visual-review\.c-okamoto\.workers\.dev|VISUAL_REVIEW_PUBLIC_URL/);
  assert.match(applications,/dev\/rinne\/\$\{path\}/);
  assert.match(applications,/rinneDevToolTarget\('visual-review','DEV公開','review\.html'/);
  assert.equal((review.match(/data-review-target=/g)||[]).length,5);
  assert.doesNotMatch(review,/<iframe\b/);
  assert.match(vite,/review:fileURLToPath\(new URL\('\.\/review\.html'/);
  assert.match(vite,/reviewEffects:fileURLToPath\(new URL\('\.\/review-effects\.html'/);
  assert.match(vite,/reviewBattle:fileURLToPath\(new URL\('\.\/review-battle\.html'/);
});

test('Review launcher contains no embedded specialist runtime',async()=>{
  const review=await read('apps/rinne/review.html');assert.doesNotMatch(review,/<iframe\b/);assert.doesNotMatch(review,/<script\b/);assert.match(review,/href="\.\/review-battle\.html"/);
});
