import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {buildCaptureFrames,shouldRecordCharacterMotionVideo} from './character-motion-video.browser.mjs';

test('motion review frame plan still covers the 30-second review clock',()=>{
  const frames=buildCaptureFrames();
  assert.equal(frames.length,900);
  for(const frame of frames){
    assert.ok(Number.isFinite(frame.time));
    assert.ok(Number.isFinite(frame.humanoidPhase));
    assert.ok(Number.isFinite(frame.vx));
    assert.ok(Number.isFinite(frame.vz));
  }
  assert.equal(frames[0].label,'idle');
  assert.equal(frames[3*30].label,'walk');
  assert.equal(frames[7*30].label,'run');
});

test('independent Character Studio does not revive the retired RINNE Shino capture surface',async()=>{
  const browser=await readFile(new URL('./character-motion-video.browser.mjs',import.meta.url),'utf8');
  assert.match(browser,/retired conditional-model capture/);
  assert.doesNotMatch(browser,/runtime\.load\('SHINO'\)|rinne-shino|apps\\\/rinne/);
  assert.equal(shouldRecordCharacterMotionVideo({base:null}),false);
});
