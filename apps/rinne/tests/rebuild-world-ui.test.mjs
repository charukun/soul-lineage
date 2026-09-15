import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/rebuild/app.css',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');

test('game shell uses diegetic ornament layers instead of a flat web card',()=>{
  assert.match(html,/class="world-vignette"/);
  assert.match(html,/id="chapter-mark"/);
  assert.match(html,/class="life-chip ornate"/);
  assert.match(html,/class="objective-card ornate"/);
  assert.match(css,/\.ornate::before/);
  assert.match(css,/clip-path:polygon/);
  assert.match(css,/--brass:/);
  assert.doesNotMatch(css,/backdrop-filter/);
});

test('village frontier homecoming and rebirth have distinct material tones',()=>{
  for(const tone of ['frontier','home','rebirth'])assert.match(css,new RegExp(`data-world-tone=["']${tone}["']`));
  assert.match(runtime,/gameScreen\.dataset\.worldTone=worldTone\(guide\)/);
  assert.match(runtime,/state\.zone===['"]frontier['"]\)return['"]frontier['"]/);
  assert.match(runtime,/guide\.tone===['"]home['"]\)return['"]home['"]/);
  assert.match(runtime,/guide\.tone===['"]rebirth['"]\)return['"]rebirth['"]/);
});

test('state changes read as game feedback without adding action buttons',()=>{
  assert.match(css,/\.chapter-mark/);
  assert.match(css,/\.game-screen\.hurt-pulse \.world-vignette/);
  assert.match(runtime,/event\.type===['"]enemy-hit['"]\)pulseHurt\(\)/);
  assert.equal((html.match(/data-context-action=/g)||[]).length,1);
  assert.match(html,/data-context-action="talk"/);
  assert.doesNotMatch(html,/>攻撃</);
});
