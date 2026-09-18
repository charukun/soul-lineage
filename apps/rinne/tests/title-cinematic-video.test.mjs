import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [html,main,css,media]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../src/main.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-rich.css',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic-media.js',import.meta.url),'utf8'),
]);

test('cinematic title uses real generated movie media as the primary path',()=>{
  assert.match(html,/id="title-cinematic-intro"[^>]*preload="auto"[^>]*muted[^>]*playsinline/);
  assert.match(html,/id="title-living-still"[^>]*loop/);
  assert.match(media,/data:video\/mp4;base64,/);assert.match(media,/data:image\/webp;base64,/);
  assert.ok(media.length>400000,'embedded movie payload should be present');
  assert.match(css,/data-media="intro"/);assert.match(css,/data-media="living"/);
  assert.match(css,/data-media="fallback"\]\[data-intro="cinematic"\]/);
});

test('cinematic boot is event-driven and overlaps world preparation',()=>{
  const boot=main.slice(main.indexOf('async function boot'),main.indexOf('async function enterCoop'));
  assert.ok(boot.indexOf('beginTitleIntro()')<boot.indexOf('prepareRuntime('));
  assert.match(main,/addEventListener\('loadeddata',onTitleIntroLoaded\)/);
  assert.match(main,/addEventListener\('canplay',onTitleIntroCanPlay\)/);
  assert.match(main,/addEventListener\('ended',onTitleIntroEnded\)/);
  assert.match(main,/requestVideoFrameCallback/);
  assert.match(main,/intro load timeout/);
});

test('cinematic handoff reveals title before menu and return skips the long intro',()=>{
  assert.match(main,/function settleTitleUi\(\)[\s\S]*dataset\.intro='settling'[\s\S]*dataset\.intro='idle'/);
  assert.match(css,/data-intro="settling"\] \.title-lockup\{opacity:1/);
  assert.match(css,/data-intro="settling"\] \.title-actions\{opacity:0/);
  assert.match(main,/if\(titleIntroPlayed\)\{[\s\S]*playLivingStill\(\);return;/);
  assert.match(main,/pauseTitleMedia\(\);title\.hidden=true/);
});

test('reduced motion, motion-off, and media failure retain an operable title fallback',()=>{
  assert.match(main,/prefersReducedTitleMotion/);assert.match(main,/title\.dataset\.motion==='on'/);
  assert.match(main,/activateTitleFallback/);assert.match(main,/prepared\?\.startTitlePreview\?\.\(\{cinematic:false\}\)/);
  assert.match(css,/data-motion="off"\] \.title-cinematic-video/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
