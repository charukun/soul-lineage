import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bootstrap=readFileSync(new URL('../src/mura-first-run-autoplay.js',import.meta.url),'utf8');
const controller=readFileSync(new URL('../src/mura-first-run-guide-controller.js',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/mura-first-run-guide-view.js',import.meta.url),'utf8');
const source=[bootstrap,controller,view].join('\n');
const style=readFileSync(new URL('../src/mura-first-run-guide.css',import.meta.url),'utf8');
const contract=readFileSync(new URL('../docs/FIRST_RUN_GUIDED_INTERACTION.md',import.meta.url),'utf8');

test('first-run guide observes normal input instead of mutating village state directly',()=>{
  // The browser smoke exercises the actual pointer path. This static guard only
  // protects the architectural invariant that the guide itself cannot build.
  for(const forbidden of [
    'world.add(',
    'world.move(',
    'commitPlacement(',
    'view.setGhost(',
    'dispatchEvent(new PointerEvent',
  ])assert.equal(source.includes(forbidden),false,forbidden);
  assert.match(controller,/addEventListener\('pointerdown'/);
  assert.match(controller,/addEventListener\('pointerup'/);
});

test('first-run guide stays non-blocking, touch-safe and reduced-motion aware',()=>{
  assert.match(style,/#muraFirstRunGuide\{[^}]*pointer-events:none/s);
  assert.match(style,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(style,/\.muraFirstRunFinger\{/);
  assert.match(view,/muraFirstRunFinger/);
  assert.match(view,/animateDrag\([\s\S]*finger/);
  assert.doesNotMatch(style,/\.muraFirstRunTouch\{/);
  assert.doesNotMatch(style,/aria-modal/);
});

test('first-run acceptance contract protects user input and mobile usability',()=>{
  for(const required of [
    '通常プレイと同じDOM / pointer入力経路',
    '時間経過だけで次の操作へ自動進行しない',
    'デモ後はユーザー本人の同じ操作を待ち',
    '直接 `world.add` / `world.move` / `commitPlacement` を呼んで建築を成立させない',
    'Pixel Fold級',
    '主要ボタンを44px相当以上',
    'Mobile screenshot correction',
  ])assert.ok(contract.includes(required),required);
});
