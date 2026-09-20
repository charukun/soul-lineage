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

test('motion review reserves thumbnail space in required five-column phone grid',async()=>{
  const css=await read('apps/rinne/src/review-motion.css');
  assert.match(css,/\.motion-grid \.review-choice-card\{min-height:112px!important/);
  assert.match(css,/\.motion-grid \.review-choice-card>\.review-runtime-thumbnail\{width:100%!important;aspect-ratio:36\/23!important/);
  assert.match(css,/@media\(max-width:620px\)[\s\S]*?\.motion-grid \.review-choice-card\{min-height:96px!important/);
});
