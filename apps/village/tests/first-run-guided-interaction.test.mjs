import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const bootstrap=readFileSync(new URL('../src/mura-first-run-autoplay.js',import.meta.url),'utf8');
const controller=readFileSync(new URL('../src/mura-first-run-guide-controller.js',import.meta.url),'utf8');
const view=readFileSync(new URL('../src/mura-first-run-guide-view.js',import.meta.url),'utf8');
const source=[bootstrap,controller,view].join('\n');
const style=readFileSync(new URL('../src/mura-first-run-guide.css',import.meta.url),'utf8');
const contract=readFileSync(new URL('../docs/FIRST_RUN_GUIDED_INTERACTION.md',import.meta.url),'utf8');
const browser=readFileSync(new URL('./first-build.browser.mjs',import.meta.url),'utf8');

test('first-run guide observes the real build gesture path instead of mutating the world',()=>{
 for(const required of [
  "const GUIDE_KIND='tent'",
  "stage==='build'",
  "stage==='catalog'",
  "stage==='drag'",
  "stage==='place'",
  'DRAG_DISTANCE=32',
  'event.stopImmediatePropagation()',
  'ctx.ui.pending?.kind===GUIDE_KIND',
  'ctx.world.objects.some(object=>object.kind===GUIDE_KIND)',
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

test('first-run guide remains split into bootstrap, input control and presentation responsibilities',()=>{
 assert.ok(bootstrap.length<2500,`bootstrap grew to ${bootstrap.length} chars`);
 assert.ok(controller.includes("from './mura-first-run-guide-view.js'"));
 assert.ok(view.includes('function animateTap'));
 assert.ok(view.includes('function animateDrag'));
 assert.equal(controller.includes('layer.innerHTML='),false);
 assert.equal(view.includes('markFirstRunAutoplaySeen'),false);
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

test('browser smoke completes the new guide with real pointer input instead of skipping it',()=>{
 for(const required of [
  "page.locator('.muraFirstRunStart')",
  "toHaveAttribute('data-stage','build')",
  "toHaveAttribute('data-stage','catalog')",
  "toHaveAttribute('data-stage','drag')",
  'tapPlacement(page)',
  'dragPlacement(page,58,38)',
  "toHaveAttribute('data-stage','place')",
  "toHaveAttribute('data-stage','done')",
  "page.locator('.muraFirstRunFinish')",
  'window.village.world.export()',
  'village.world.load(fixture)',
  'village.world.state.onboarding=onboarding',
  "page.reload({waitUntil:'domcontentloaded'})",
  "page.locator('#muraFirstRunGuide')",
 ])assert.ok(browser.includes(required),required);
 assert.equal(browser.includes("page.locator('.muraFirstRunSkip')"),false);
 const enterTap=browser.indexOf('nativeTap(page,expect,enter)');
 const finishGuide=browser.indexOf('finishFirstRunGuide(page,expect)');
 assert.ok(enterTap>=0&&finishGuide>enterTap,{enterTap,finishGuide});

 const guideStart=browser.indexOf('async function finishFirstRunGuide');
 const guideEnd=browser.indexOf('export async function enterVillageForBrowser');
 const guideSource=browser.slice(guideStart,guideEnd);
 assert.equal(guideSource.includes("nativeTap(page,expect,page.locator('#muraPlacementUndo'))"),false);
 assert.equal(guideSource.includes("nativeTap(page,expect,page.locator('#muraCancelPlacement'))"),false);
});

test('browser smoke hands off from onboarding to ordinary build controls without a second tutorial CTA',()=>{
 const firstBuild=browser.indexOf('export async function verifyVillageFirstBuild');
 const legacyAction=browser.indexOf("page.locator('#tutorialAction')",firstBuild);
 const buildTap=browser.indexOf("nativeTap(page,expect,page.locator('#build'))",firstBuild);
 const tentCard=browser.indexOf("page.locator('#catalog .card[data-kind=\"tent\"]')",firstBuild);
 assert.ok(firstBuild>=0&&legacyAction>firstBuild&&buildTap>legacyAction&&tentCard>buildTap,{firstBuild,legacyAction,buildTap,tentCard});
 const handoff=browser.slice(legacyAction,buildTap);
 assert.ok(handoff.includes('toBeHidden()'));
 assert.equal(handoff.includes('nativeTap(page,expect,page.locator(\'#tutorialAction\'))'),false);
});
