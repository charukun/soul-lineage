import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const stack=fs.readFileSync(new URL('../src/runtime-scale-stack.js',import.meta.url),'utf8');
const hot=fs.readFileSync(new URL('../src/runtime-hotloop-optimization.js',import.meta.url),'utf8');
const pool=fs.readFileSync(new URL('../src/runtime-fx-pool.js',import.meta.url),'utf8');
const refresh=fs.readFileSync(new URL('../src/runtime-static-refresh.js',import.meta.url),'utf8');

test('Demon installs hot-loop reuse before sourced assets and pooling before adaptive wrappers',()=>{
  assert.ok(stack.indexOf('./runtime-hotloop-optimization.js')<stack.indexOf('./asset-visuals.js'));
  assert.ok(stack.indexOf('./asset-visuals.js')<stack.indexOf('./runtime-fx-pool.js'));
  assert.ok(stack.indexOf('./runtime-fx-pool.js')<stack.indexOf('./adaptive-visual-performance.js'));
  assert.ok(stack.indexOf('./adaptive-visual-performance.js')<stack.indexOf('./runtime-static-refresh.js'));
});

test('Demon hot loop reuses camera, shadow and actor-batch scratch instead of allocating them every frame',()=>{
  for(const token of ['scratchByView','cameraPosition','shadowMatrix','shadowPosition','shadowScale','zeroMatrix','fx.recycle'])assert.match(hot,new RegExp(token.replace('.','\\.')));
  const update=hot.slice(hot.indexOf('NightView.prototype.update='),hot.indexOf('NightView.prototype.update.__runtimeHotloopOptimized'));
  assert.doesNotMatch(update,/new T\.(Vector3|Matrix4|Quaternion)/);
  assert.doesNotMatch(hot,/game\.(player|village|time)\s*=/);
});

test('Demon reuses sourced combat FX resources and refreshes static batching after async asset additions',()=>{
  for(const token of ['sourcedSpark','sourcedSlash','fx.recycle','idleSparks','idleSlashes'])assert.match(pool,new RegExp(token.replace('.','\\.')));
  assert.match(refresh,/environment\?\.children\?\.length/);assert.match(refresh,/batchStaticMeshes/);assert.match(refresh,/state\.batch\?\.restore/);
});
