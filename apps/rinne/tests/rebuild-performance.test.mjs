import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {RINNE_RUNTIME_PERFORMANCE,renderPixelRatio,targetFpsForView} from '../src/rebuild/performance.js';

const renderer=await readFile(new URL('../src/rebuild/renderer.js',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');

test('100-year runtime restores edge quality and only reduces resolution under adaptive pressure',()=>{
  assert.equal(renderPixelRatio(3,1),1.75);
  assert.ok(renderPixelRatio(3,1)>1.35);
  assert.equal(renderPixelRatio(3,.9),1.575);
  assert.equal(renderPixelRatio(3,.8),1.4);
  assert.equal(renderPixelRatio(1,.68),.85);
  assert.match(renderer,/antialias:true/);
  assert.match(renderer,/createAdaptiveQualityGovernor/);
  assert.match(renderer,/applyStylizedShading/);
  assert.doesNotMatch(renderer,/setPixelRatio\(Math\.min\([^\n]+1\.35/);
});

test('runtime uses repository mobile and desktop frame targets',()=>{
  const desktop={innerWidth:1280,matchMedia:()=>({matches:false})};
  const compact={innerWidth:600,matchMedia:()=>({matches:false})};
  const coarse={innerWidth:900,matchMedia:query=>({matches:query==='(pointer: coarse)'})};
  assert.equal(targetFpsForView(desktop),RINNE_RUNTIME_PERFORMANCE.desktopTargetFps);
  assert.equal(targetFpsForView(compact),RINNE_RUNTIME_PERFORMANCE.mobileTargetFps);
  assert.equal(targetFpsForView(coarse),RINNE_RUNTIME_PERFORMANCE.mobileTargetFps);
});

test('frame hot path avoids deep-cloning front state and roster reconstruction',()=>{
  assert.doesNotMatch(runtime,/structuredClone\(front\)/);
  assert.match(runtime,/view\.updateFront\(front\)/);
  assert.match(runtime,/uiElapsed>=RINNE_RUNTIME_PERFORMANCE\.uiSyncInterval/);
  assert.match(renderer,/function updateFront\(front\)/);
  assert.match(renderer,/rosterKey!==enemyRosterKey/);
  assert.doesNotMatch(renderer,/JSON\.stringify\(equipment\)/);
  const frame=runtime.slice(runtime.indexOf('function frame(now)'),runtime.indexOf('if(front)view.syncFront(front)'));
  assert.equal((frame.match(/syncUI\(\)/g)||[]).length,1);
  assert.equal((frame.match(/view\.syncFront\(front\)/g)||[]).length,3);
});
