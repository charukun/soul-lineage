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

test('first-run guide is non-blocking and uses a neutral touch cursor',()=>{
 for(const required of [
  '#muraFirstRunGuide{position:fixed;inset:0',
  'pointer-events:none',
  '.muraFirstRunGuideCard',
  'clip-path:polygon',
  'repeating-linear-gradient',
  'muraFirstRunTouch',
  'muraFirstRunDragTrail',
  '@media(max-height:560px)',
  '@media(prefers-reduced-motion:reduce)',
 ])assert.ok(style.includes(required)||view.includes(required),required);
 assert.equal(style.includes('muraFirstRunFinger'),false);
 assert.equal(view.includes('muraFirstRunFinger'),false);
 assert.equal(style.includes('aria-modal'),false);
});

test('quality pass keeps action coaching compact, legible and touch-safe',()=>{
 for(const required of [
  "layer.dataset.mode=next==='welcome'||next==='done'?'card':'coach'",
  'class="muraFirstRunStep"',
  '--mura-first-run-progress',
  "nodes.cue.textContent='できた'",
  "nodes.cue.textContent='もう一度'",
  "touch.dataset.label='タップ'",
  "touch.dataset.label='なぞる'",
  'function scheduleRepeat',
  'await wait(timing.hold)',
  'timing.repeat',
 ])assert.ok(view.includes(required),required);
 for(const required of [
  '#muraFirstRunGuide[data-mode="card"] .muraFirstRunGuideCard',
  '#muraFirstRunGuide[data-mode="coach"] .muraFirstRunGuideCard',
  '.muraFirstRunProgress i',
  '.muraFirstRunCue[data-state="success"]',
  '@media(max-width:340px)',
  '.muraFirstRunTouch{width:44px',
  '.muraFirstRunReplay{flex:0 0 auto;min-height:28px!important',
 ])assert.ok(style.includes(required),required);
 for(const required of ['hold:900','repeat:1700','tap:1300','drag:2200'])assert.ok(controller.includes(required),required);
 const actionTexts=['画面下の「つくる」を1回タップ。','光っている「空きテント」を1回タップ。','1本指で画面をなぞり、テントを置きたい場所へ。','場所がよければ、画面を短く1回タップ。'];
 for(const text of actionTexts)assert.ok(view.includes(text),text);
});

test('first-run acceptance contract requires user input and mobile screenshot corrections',()=>{
 for(const required of [
  '通常プレイと同じDOM / pointer入力経路',
  '時間経過だけで次の操作へ自動進行しない',
  'デモ後はユーザー本人の同じ操作を待ち',
  '直接 `world.add` / `world.move` / `commitPlacement` を呼んで建築を成立させない',
  'Pixel Fold級',
  'Quality pass',
  '`1 / 4` の数値と細い進行線',
  '主要ボタンを44px相当以上',
  'Mobile screenshot correction',
  '人体の一部を模した自作の指形状は使わない',
  '最低1秒程度認識できる',
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
