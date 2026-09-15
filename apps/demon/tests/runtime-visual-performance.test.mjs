import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {demonEffectivePixelRatio,demonRenderQualityKey,demonSceneQualityKey} from '../src/runtime-visual-performance.js';

const adaptive=await readFile(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');

test('high-DPI hunt keeps a readable render floor across adaptive tiers',()=>{
  assert.equal(demonEffectivePixelRatio(3,1),2);
  assert.equal(demonEffectivePixelRatio(3,.9),1.8);
  assert.equal(demonEffectivePixelRatio(3,.8),1.6);
  assert.equal(demonEffectivePixelRatio(3,.68),1.5);
  assert.equal(demonEffectivePixelRatio(1,.68),1);
});

test('render pressure changes lightweight quality while scene traversal keys stay stable',()=>{
  assert.equal(demonRenderQualityKey({level:1,bottleneck:'gpu'}),'1:gpu');
  assert.notEqual(demonRenderQualityKey({level:1,bottleneck:'cpu'}),demonRenderQualityKey({level:1,bottleneck:'gpu'}));
  assert.equal(demonSceneQualityKey({level:1,bottleneck:'cpu'},4),'1:4');
  assert.equal(demonSceneQualityKey({level:1,bottleneck:'gpu'},4),'1:4');
  assert.notEqual(demonSceneQualityKey({level:2},4),demonSceneQualityKey({level:1},4));
  assert.notEqual(demonSceneQualityKey({level:1},5),demonSceneQualityKey({level:1},4));
});

test('adaptive hot path caches scene-wide visual work and occlusion roots',()=>{
  assert.match(adaptive,/demonEffectivePixelRatio\(dpr,q\.renderScale\)/);
  assert.match(adaptive,/state\?\.appliedSceneKey===sceneKey/);
  assert.match(adaptive,/state\?\.appliedRenderKey!==renderKey/);
  assert.match(adaptive,/state\.occlusionRoots=occlusionRoots\(view\)/);
  assert.match(adaptive,/state\.occlusion\.update\(\{camera:this\.camera,\.\.\.state\.occlusionRoots\}\)/);
  const update=adaptive.slice(adaptive.indexOf('const update=NightView.prototype.update'));
  assert.doesNotMatch(update,/const roots=occlusionRoots\(this\)/);
  assert.doesNotMatch(update,/applyTextureQuality\(this\./);
  assert.doesNotMatch(update,/textureBytes\(this\)/);
});
