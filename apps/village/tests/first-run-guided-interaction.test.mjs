import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/mura-first-run-autoplay.js',import.meta.url),'utf8');
const style=readFileSync(new URL('../src/mura-first-run-guide.css',import.meta.url),'utf8');
const contract=readFileSync(new URL('../docs/FIRST_RUN_GUIDED_INTERACTION.md',import.meta.url),'utf8');

test('first-run guide observes the real build gesture path instead of mutating the world',()=>{
 for(const required of [
  "const GUIDE_KIND='tent'",
  "stage==='build'",
  "stage==='catalog'",
  "stage==='drag'",
  "stage==='place'",
  "DRAG_DISTANCE=32",
  "event.stopImmediatePropagation()",
  "ui.pending?.kind===GUIDE_KIND",
  "world.objects.some(object=>object.kind===GUIDE_KIND)",
  'もう一度見る',
  '村を始める',
 ])assert.ok(source.includes(required),required);

 for(const forbidden of [
  'world.add(',
  'world.move(',
  'commitPlacement(',
  'view.setGhost(',
  '.click()',
  'dispatchEvent(new PointerEvent',
 ])assert.equal(source.includes(forbidden),false,forbidden);
});

test('first-run guide is non-blocking and tactile rather than a full-screen flat modal',()=>{
 for(const required of [
  '#muraFirstRunGuide{position:fixed;inset:0',
  'pointer-events:none',
  '.muraFirstRunGuideCard',
  'clip-path:polygon',
  'repeating-linear-gradient',
  'muraFirstRunFinger',
  '@media(max-height:560px)',
  '@media(prefers-reduced-motion:reduce)',
 ])assert.ok(style.includes(required),required);
 assert.equal(style.includes('aria-modal'),false);
});

test('first-run acceptance contract requires user input and no direct placement shortcut',()=>{
 for(const required of [
  '通常プレイと同じDOM / pointer入力経路',
  '時間経過だけで次の操作へ自動進行しない',
  'デモ後はユーザー本人の同じ操作を待ち',
  '直接 `world.add` / `world.move` / `commitPlacement` を呼んで建築を成立させない',
  'Pixel Fold級',
 ])assert.ok(contract.includes(required),required);
});
