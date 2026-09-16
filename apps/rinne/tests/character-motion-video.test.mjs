import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCaptureFrames} from './character-motion-video.browser.mjs';

test('motion video plan covers the existing 30-second review at recording rate',()=>{
  const frames=buildCaptureFrames();
  assert.equal(frames.length,900);
  for(const frame of frames){
    assert.ok(Number.isFinite(frame.time));
    assert.ok(Number.isFinite(frame.humanoidPhase));
    assert.ok(Number.isFinite(frame.vx));
    assert.ok(Number.isFinite(frame.vz));
    assert.ok(frame.weaponDraw>=0&&frame.weaponDraw<=1);
  }
  assert.equal(frames[0].label,'idle');
  assert.equal(frames[3*30].label,'walk');
  assert.equal(frames[7*30].label,'run');
  assert.equal(frames[11*30].label,'draw');
  assert.equal(frames[14*30].label,'guard');
  assert.equal(frames[23*30].label,'sheathe');
  assert.equal(frames[27*30].label,'idle-end');
  assert.ok(frames.slice(17*30,23*30).some(frame=>frame.attack?.kind==='slash'),'combat block must include the authored slash');
});

test('capture surface records the real Shino HumanoidRuntime instead of a schematic substitute',async()=>{
  const source=await readFile(new URL('../public/simulator/src/motion-capture.js',import.meta.url),'utf8');
  const html=await readFile(new URL('../public/simulator/motion-capture.html',import.meta.url),'utf8');
  assert.match(source,/new HumanoidRuntime\(api\)/);
  assert.match(source,/runtime\.load\('SHINO'\)/);
  assert.match(source,/canvas\.captureStream\(fps\)/);
  assert.match(source,/new MediaRecorder/);
  assert.match(source,/SLASH_REVISION/);
  assert.match(source,/resetPresentationHistory\(\)/);
  assert.match(html,/motion-capture-stage/);
  assert.doesNotMatch(source,/stick|skeleton proxy|schematic/i);
});

test('successful Motion QA hands off to a scoped exact-head Shino video artifact',async()=>{
  const qa=await readFile(new URL('./character-motion-qa.browser.mjs',import.meta.url),'utf8');
  const video=await readFile(new URL('./character-motion-video.browser.mjs',import.meta.url),'utf8');
  assert.match(qa,/verifyCharacterMotionVideo/);
  assert.match(qa,/process\.env\.HEAD_SHA/);
  assert.match(video,/shouldRecordCharacterMotionVideo/);
  assert.match(video,/apps\\\/rinne\\\/src\\\/character-motion-/);
  assert.match(video,/authored-slash\|humanoid\|motion-/);
  assert.match(video,/motion-video-receipt\.json/);
  assert.match(video,/exactHead/);
  assert.match(video,/model:'SHINO'/);
  assert.match(video,/playbackSpeed:1/);
  assert.match(video,/range:\[0,VIDEO_SECONDS\]/);
  assert.match(video,/ffmpeg/);
});
