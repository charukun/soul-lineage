import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {REVIEW_DOWNLOADS} from '../../../packages/assets/src/review-catalog.js';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('30-second compact performance has a lightweight direct mobile route',()=>{
  const html=read('../public/performance.html');
  const viewer=read('../public/simulator/src/compact-performance-viewer.js');
  const compact=read('../public/simulator/src/compact-performance.js');
  assert.match(html,/30秒演舞 · Knight/);
  assert.match(html,/compact-performance-viewer\.js/);
  assert.match(viewer,/CompactPerformanceRuntime/);
  assert.match(viewer,/samplePerformance/);
  assert.doesNotMatch(viewer,/HumanoidRuntime/);
  assert.match(compact,/asset-review\/motion-library\/Knight\.glb/);
  assert.doesNotMatch(compact,/raw\.githubusercontent\.com/);
});

test('compact Knight is pinned and bundled by the review asset pipeline',()=>{
  const row=REVIEW_DOWNLOADS.find(item=>item.id==='character.kaykit.knight');
  assert.ok(row);
  assert.equal(row.repository,'KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0');
  assert.equal(row.commit,'672074b73ba276876a19e8816ecdc5241817ab47');
  assert.equal(row.path,'addons/kaykit_character_pack_adventures/Characters/gltf/Knight.glb');
  assert.equal(row.output,'motion-library/Knight.glb');
  assert.equal(row.size,3659532);
  assert.equal(row.gitBlob,'717b56ca2b5ff5392679774725201ba03a3eefab');
});
