import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const adaptive=fs.readFileSync(new URL('../src/adaptive-visual-performance.js',import.meta.url),'utf8');

test('demon installs authored LOD before stylized and adaptive runtime bridges',()=>{
  assert.ok(main.indexOf("./authored-visual-lod.js")<main.indexOf("./stylized-visual-target.js"));
  assert.ok(main.indexOf("./stylized-visual-target.js")<main.indexOf("./adaptive-visual-performance.js"));
});

test('demon adaptive bridge controls render, shadow, texture, VFX and visual streaming budgets',()=>{
  for(const token of ['createAdaptiveQualityGovernor','shadowScale','applyTextureQuality','vfxScale','createVisualDistanceStreamer','presentationDistance'])assert.match(adaptive,new RegExp(token));
});
