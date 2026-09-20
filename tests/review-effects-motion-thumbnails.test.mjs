import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Regression guard for five-column visual review thumbnails and authored VFX cards.
const read=path=>readFile(new URL(`../${path}`,import.meta.url),'utf8');

test('runtime thumbnails scale inside five-column review cards',async()=>{
  const shared=await read('packages/shared-ui/src/review-shell.css');
  assert.match(shared,/\.review-runtime-thumbnail\{[^}]*width:100%!important[^}]*aspect-ratio:36\/23!important/);
  assert.match(shared,/\.review-choice-grid\{[^}]*repeat\(5,minmax\(0,1fr\)\)!important/);
});

test('effect review exposes high-resolution visible thumbnails in five columns',async()=>{
  const [js,css]=await Promise.all([
    read('apps/rinne/src/review-effects.js'),
    read('apps/rinne/src/review-effects.css'),
  ]);
  assert.match(js,/antialias:true,preserveDrawingBuffer:true/);
  assert.match(js,/setSize\(288,184,false\)/);
  assert.match(js,/PerspectiveCamera\(40,288\/184/);
  assert.match(css,/\.fx-catalog\{grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css,/\.fx-option\{min-height:108px!important/);
  assert.match(css,/@media\(max-width:640px\)[\s\S]*?\.fx-option\{min-height:96px!important/);
});

test('motion review is image-first in the required five-column phone grid',async()=>{
  const [js,css,runtime]=await Promise.all([
    read('apps/rinne/src/review-motion.js'),
    read('apps/rinne/src/review-motion.css'),
    read('apps/rinne/src/review-runtime-thumbnail.js'),
  ]);
  assert.match(css,/\.motion-grid \.review-choice-card\{min-height:0!important;display:block!important;aspect-ratio:36\/23!important/);
  assert.match(css,/\.motion-grid \.review-choice-card>\.review-runtime-thumbnail\{width:100%!important;height:100%!important;aspect-ratio:36\/23!important/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-grid \.review-choice-card\{min-height:0!important/);
  assert.match(js,/button\.setAttribute\('aria-label',label\);button\.title=label;button\.append\(thumbnail\);/);
  assert.doesNotMatch(js,/motion-category/);
  assert.match(runtime,/requestIdleCallback\?requestIdleCallback\(callback,\{timeout:90\}\)/);
  assert.match(runtime,/paintPlaceholder\(canvas\)/);
});

test('motion review recovers incompatible motion sources and keeps mobile controls in flow',async()=>{
  const [js,css,html,runtime]=await Promise.all([
    read('apps/rinne/src/review-motion.js'),
    read('apps/rinne/src/review-motion.css'),
    read('apps/rinne/review-motion.html'),
    read('apps/rinne/src/review-motion-source-runtime.js'),
  ]);
  assert.match(js,/const invalidMotionIds=new Set\(\)/);
  assert.match(js,/nextPlayableMotion/);
  assert.match(js,/button\.dataset\.invalid=String\(invalid\);button\.disabled=invalid/);
  assert.match(js,/互換のあるモーションへ切り替えています/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-playback\{order:2;position:static!important/);
  assert.match(css,/\.motion-grid \.review-choice-card\[data-invalid="true"\]/);
  assert.match(html,/<details class="motion-models">/);
  assert.match(html,/<summary><span class="control-label">表示モデル<\/span><strong>素体を変更<\/strong><\/summary>/);
  assert.match(runtime,/hips:\['pelvis','Hips','hips','mixamorig:Hips'\]/);
  assert.match(runtime,/normalizeBoneName/);
});
