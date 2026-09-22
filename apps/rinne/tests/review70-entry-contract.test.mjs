import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

test('review70 entry contracts use the current storybook UI and keep origin choices visible',async()=>{
  const [guide,world,book]=await Promise.all([
    readFile(new URL('../src/first-run-guide.js',import.meta.url),'utf8'),
    readFile(new URL('../src/rinne-world-ui.css',import.meta.url),'utf8'),
    readFile(new URL('../src/storybook-ui.js',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(guide,/\.upgrade-panel/);
  assert.match(guide,/\.rb-page\[data-book-page="heart"\]/);
  assert.match(guide,/data-book-guide-detail/);
  assert.match(book,/rb-mind-current/);
  assert.match(book,/data-book-guide-detail/);
  assert.match(world,/family-memory-arrive 1\.05s/);
  assert.match(world,/family-memory-relic\{[^}]*animation:r5-float 4\.6s/s);
});

test('review70 global shortcuts ignore text entry, IME and shifted typing',async()=>{
  const upgrade=await readFile(new URL('../src/gameplay-upgrade.js',import.meta.url),'utf8');
  assert.match(upgrade,/textEntry/);
  assert.match(upgrade,/e\.isComposing/);
  assert.match(upgrade,/e\.key==='Process'/);
  assert.match(upgrade,/contenteditable/);
  assert.match(upgrade,/e\.ctrlKey\|\|e\.metaKey\|\|e\.altKey\|\|e\.shiftKey/);
});

test('review70 mobile book keeps readable text, touch targets and body information',async()=>{
  const css=await readFile(new URL('../src/storybook-ui.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:620px\) and \(orientation:portrait\)/);
  assert.match(css,/\.rb-main\{grid-template-columns:1fr/);
  assert.match(css,/\.rb-detail-copy\{overflow:visible;font-size:14px/);
  assert.match(css,/\.rb-close\{width:44px;height:44px/);
  assert.match(css,/\.rb-body-chart\{display:block!important/);
});

test('review70 fatigue breathing asset is materialized into the RINNE public origin',async()=>{
  const file=new URL('../public/library/audio/fatigue/d68f34ffbc9dc7c48ee89dc8a7ab86d66640d5e6/breathing-tired.wav',import.meta.url);
  const info=await stat(file);assert.ok(info.size>500000);
});

test('review70 reading surfaces pause only the solo life clock and expose core composition controls',async()=>{
  const [runtime,book]=await Promise.all([
    readFile(new URL('../src/rebuild/runtime.js',import.meta.url),'utf8'),
    readFile(new URL('../src/storybook-ui.js',import.meta.url),'utf8')
  ]);
  assert.match(runtime,/readingLifePaused=document\.body\.classList\.contains\('rinne-first-run-active'\)\|\|gameScreen\.dataset\.storybookOpen==='true'/);
  assert.match(runtime,/lifeDelta:readingLifePaused\?0:lifeDelta/);
  assert.match(book,/class="rb-tech-tools"/);
  assert.match(book,/100%は基準値/);
  assert.match(book,/心は「何を優先するか」/);
});
