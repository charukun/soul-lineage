import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stack=fs.readFileSync(new URL('../src/runtime-scale-stack.js',import.meta.url),'utf8');
const runtime=fs.readFileSync(new URL('../src/runtime-render-optimization.js',import.meta.url),'utf8');
const reconciler=fs.readFileSync(new URL('../src/web/scene-reconciler.js',import.meta.url),'utf8');

test('Village installs render optimization before asset/adaptive wrappers',()=>{
  assert.ok(stack.indexOf('./runtime-render-optimization.js')<stack.indexOf('./asset-visuals.js'));
  assert.ok(stack.indexOf('./asset-visuals.js')<stack.indexOf('./adaptive-visual-performance.js'));
});

test('Village uses mutation-bound static batching without breaking object picking',()=>{
  for(const token of ['createStaticBatchController','staticBatchEligible','beforeMutation','staticWorldBatchedInto','optimizedPick'])assert.match(runtime,new RegExp(token));
  assert.match(runtime,/finally\{for\(const node of revealed\)node\.visible=false;\}/);
  assert.match(runtime,/defs\[object\.kind\]\?\.building\)result\.userData\.noBatch=true/);
});

test('Village replaces full-resolution blur with bounded shared miniature focus and keeps tilt control',()=>{
  assert.match(runtime,/createMiniatureFocus/);assert.match(runtime,/focusY:\.48/);assert.match(runtime,/clear:\.12/);assert.match(runtime,/fade:\.32/);assert.match(runtime,/strength:tilt/);
  assert.doesNotMatch(runtime,/WebGLRenderTarget|for\(int i=0;i<12/);
});

test('ready Village buildings share cached materials while unfinished phases keep private materials',()=>{
  assert.match(reconciler,/if\(defs\[o\.kind\]\.building&&!ready\(o\)\)node\.traverse/);
  assert.match(reconciler,/mesh\.material=mesh\.material\.clone\(\)/);
});
