import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createMuraModels} from '@soul/rendering/mura';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../src/rebuild/app.css',import.meta.url),'utf8');
const pop=await readFile(new URL('../src/rebuild/pop.css',import.meta.url),'utf8');
const runtime=await readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8');
const renderer=await readFile(new URL('../src/rebuild/renderer.js',import.meta.url),'utf8');
const models=createMuraModels.toString();

test('game shell keeps tactile depth while the visible skin is restrained casual fantasy',()=>{
  assert.match(html,/class="world-vignette"/);assert.match(html,/id="chapter-mark"/);assert.match(html,/class="life-chip ornate"/);assert.match(html,/class="objective-card ornate"/);
  assert.match(css,/\.ornate::before/);assert.doesNotMatch(css,/backdrop-filter/);
  for(const token of ['--pop-cream:','--pop-honey:','--pop-coral:','--pop-sky:','--pop-violet:','--pop-leather:'])assert.match(pop,new RegExp(token));
  assert.match(pop,/box-shadow:[^;]*inset[^;]*0 3px 0/);assert.match(pop,/transform:translateY\(2px\)/);assert.match(pop,/border-radius:9px/);
  assert.match(pop,/\.loading-dots\{display:none\}/);assert.match(pop,/repeating-conic-gradient/);
  assert.doesNotMatch(pop,/--pop-green:/);assert.doesNotMatch(pop,/--pop-pink:/);assert.doesNotMatch(pop,/#ff9ecb/i);assert.doesNotMatch(pop,/border-radius:26px/);
  assert.match(html,/theme-color" content="#7896a1"/);
});

test('village frontier homecoming and rebirth stay distinct without green or candy wash',()=>{
  for(const tone of ['frontier','home','rebirth'])assert.match(pop,new RegExp(`data-world-tone=["']${tone}["']`));
  assert.match(runtime,/gameScreen\.dataset\.worldTone=worldTone\(guide\)/);
  assert.match(runtime,/state\.zone===['"]frontier['"]\)return['"]frontier['"]/);assert.match(runtime,/guide\.tone===['"]home['"]\)return['"]home['"]/);assert.match(runtime,/guide\.tone===['"]rebirth['"]\)return['"]rebirth['"]/);
  assert.match(renderer,/scene\.background=new THREE\.Color\(0x91d7f5\)/);assert.match(renderer,/FogExp2\(0xcfe6ef/);assert.doesNotMatch(renderer,/scene\.background=new THREE\.Color\(0x91a88b\)/);
});

test('state changes read as game feedback without adding action buttons',()=>{
  assert.match(pop,/\.chapter-mark/);assert.match(pop,/\.game-screen\.hurt-pulse \.world-vignette/);assert.match(runtime,/event\.type===['"]enemy-hit['"]\)pulseHurt\(\)/);
  assert.equal((html.match(/data-context-action=/g)||[]).length,1);assert.match(html,/data-context-action="talk"/);assert.doesNotMatch(html,/>攻撃</);
});

test('birth immediately identifies being carried and release restores self-movement wording',()=>{
  assert.match(runtime,/母に抱かれたままスワイプ/);assert.match(runtime,/いまは私の腕の中/);assert.match(runtime,/抱っこしたまま村を見て回ろうね/);
  assert.match(runtime,/showBirthIntro\(\)/);assert.match(runtime,/event\.type===['"]release['"][^{]*\{[^}]*地面へ。今日からは自分の足で歩けるよ。[^}]*armMovementHint\(\)/s);
  assert.match(runtime,/held\?['"]母に抱かれたままスワイプ['"]:['"]スワイプで移動['"]/);
  assert.match(runtime,/setMoving\(state,state\.phase===['"]birth['"]\?false:moved,state\.yaw\)/);
});

test('runtime preboots renderer/world once and session disposal preserves prepared resources',()=>{
  assert.match(runtime,/export async function prepareRuntime/);assert.match(runtime,/createWorldRenderer\(\{canvas,document,layout,stations\}\)/);assert.match(runtime,/canvas\.dataset\.runtime=['"]prepared['"]/);
  assert.match(runtime,/prepared\|\|await prepareRuntime/);assert.match(runtime,/host\.active=true/);assert.match(runtime,/host\.active=false/);assert.match(runtime,/if\(ownsPrepared\)host\.dispose\(\)/);
  assert.match(runtime,/\$\(['"]back-title['"]\)\.onclick=async\(\)=>\{await save\(\);dispose\(\);onExit\?\.\(\);\}/);
});

test('Rinne lowers only its procedural textile startup density while shared default quality stays intact',()=>{
  assert.match(models,/textileFibers=14000/);assert.match(models,/textileBlotches=160/);assert.match(models,/i<textileFibers/);assert.match(models,/j<textileBlotches/);
  assert.match(renderer,/textileFibers:2800/);assert.match(renderer,/textileBlotches:72/);
});
