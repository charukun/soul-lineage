import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('family story still starts only after Start and never owns the title',async()=>{
  const [main,ui,css]=await Promise.all([read('../src/main.js'),read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  assert.match(main,/await openFamilyOrigin/);
  assert.match(main,/titleCinematic\.pause\(\);enterRinneLineageAudio\(\)/);
  assert.doesNotMatch(main,/renderFamilyTitle/);
  assert.doesNotMatch(ui,/export function renderFamilyTitle/);
  assert.doesNotMatch(css,/\.title-screen/);
});

test('deep water story shows one memory at a time instead of a three-up choice grid',async()=>{
  const [ui,css]=await Promise.all([read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  assert.match(ui,/dialog\.dataset\.scene = 'deepwater-single'/);
  assert.match(ui,/STORY_PROMPTS = Object\.freeze\(\['どこへ帰る？','何が、残っている？','その手に、何がある？'\]\)/);
  assert.doesNotMatch(ui,/土地の記憶|家の言葉|受け継ぐもの/);
  assert.doesNotMatch(ui,/遠い水底から|声は姿を持たない|次の生へ流れ着く/);
  assert.match(ui,/family-story-question/);
  assert.match(ui,/family-memory-stage/);
  assert.match(ui,/data\.memoryCurrent = 'true'/);
  assert.match(ui,/function cycleMemory\(delta, source='input'\)/);
  assert.match(ui,/event\.key === 'ArrowRight'/);
  assert.match(ui,/event\.key === 'ArrowLeft'/);
  assert.match(ui,/Math\.abs\(dx\) < 48/);
  assert.doesNotMatch(ui,/family-story-choices/);
  assert.doesNotMatch(css,/grid-template-columns:repeat\(3/);
  assert.match(css,/@keyframes family-memory-arrive/);
  assert.match(css,/@keyframes family-memory-absorb/);
  assert.match(css,/data-shifting=true/);
  assert.match(css,/data-answering=true/);
  assert.doesNotMatch(css,/family-ancestral-gate|family-oath-gate|family-orb-rings|family-ritual-progress/);
});

test('Birth becomes a large ascent, then a separate loading beat before gameplay can start',async()=>{
  const [ui,css,audio]=await Promise.all([read('../src/family-origin-ui.js'),read('../src/family-origin.css'),read('../src/gameplay-audio.js')]);
  assert.match(ui,/dialog\.dataset\.phase = 'birth'/);
  assert.match(ui,/dialog\.dataset\.phase = 'loading'/);
  assert.match(ui,/family-birth-loading/);
  assert.match(ui,/playRinneLineageAudio\('loading'\)/);
  assert.ok(ui.indexOf("dialog.dataset.phase = 'birth'") < ui.indexOf("dialog.dataset.phase = 'loading'"));
  assert.ok(ui.indexOf("dialog.dataset.phase = 'loading'") < ui.indexOf("finish(confirmed)"));
  assert.match(css,/@keyframes family-soul-rise/);
  assert.match(css,/@keyframes family-light-burst/);
  assert.match(css,/family-birth-thread/);
  assert.match(css,/family-birth-seed/);
  assert.match(audio,/if\(kind==='loading'\)/);assert.match(audio,/if\(kind==='drift'\)/);
});

test('story keeps save replacement, keyboard semantics and reduced motion',async()=>{
  const [ui,css]=await Promise.all([read('../src/family-origin-ui.js'),read('../src/family-origin.css')]);
  assert.match(ui,/aria-labelledby/);
  assert.match(ui,/aria-pressed/);assert.match(ui,/左右キーまたはスワイプで別の記憶/);
  assert.match(ui,/data-origin-back/);
  assert.match(ui,/data-origin-cancel/);
  assert.match(ui,/dataset\.replaceFamily/);
  assert.match(ui,/journey\.back\(\)/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(css,/family-origin\[data-motion=off\]/);
});
