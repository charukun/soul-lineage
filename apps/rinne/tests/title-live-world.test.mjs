import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=p=>readFile(new URL(p,import.meta.url),'utf8');
const [main,polish,html,css,controller]=await Promise.all(['../src/main.js','../src/native-ui-polish.js','../index.html','../src/title-rich.css','../src/title-cinematic.js'].map(read));
test('title retires realtime and still-pan opening routes',()=>{
  assert.doesNotMatch(polish,/import.*title-live-world/);
  assert.doesNotMatch(main+controller,/startTitlePreview|startRealtime|title-preview-host|titleParallax/);
  assert.doesNotMatch(html,/title-world-(rays|clouds|motes|lens)|title-assets\/world.webp/);
  assert.doesNotMatch(css,/@keyframes|data-media="realtime"/);
  assert.match(html,/preload="none".*muted playsinline/);
  assert.match(main,/game.hidden=true;game.setAttribute\('aria-hidden','true'\)/);
});
test('boot starts film independently, menu waits for landing, media cannot receive focus',()=>{
  const boot=main.slice(main.indexOf('async function boot'),main.indexOf('async function enterCoop'));
  assert.ok(boot.indexOf('titleCinematic.begin()')<boot.indexOf('prepareRuntime('));
  assert.match(html,/<nav class="title-actions"[^>]*inert aria-hidden="true"/);
  assert.match(controller,/this.menu.inert=phase!=='idle'/);
  assert.match(main,/title.addEventListener\('pointerup'.*titleCinematic.skip/);
  assert.match(css,/data-intro="settling"\] .title-actions\{opacity:0;visibility:hidden;pointer-events:none/);
  assert.match(css,/prefers-reduced-motion:reduce/);
});
