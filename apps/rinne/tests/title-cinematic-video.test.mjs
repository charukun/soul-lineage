import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [html,main,css,media,manifest,cinematic,movie,poster]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../src/main.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-rich.css',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic-media.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic-manifest.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic.js',import.meta.url),'utf8'),
  readFile(new URL('../public/title-assets/title-cinematic.mp4',import.meta.url)),
  readFile(new URL('../public/title-assets/title-cinematic-poster.webp',import.meta.url)),
]);

test('cinematic title uses real generated movie media as the primary path',()=>{
  assert.match(html,/id="title-cinematic-video"[^>]*preload="auto"[^>]*muted[^>]*playsinline/);
  assert.match(manifest,/title-cinematic\.mp4/);assert.match(manifest,/title-cinematic-poster\.webp/);
  assert.match(manifest,/recommendedWidth:1920/);assert.match(manifest,/recommendedHeight:1080/);assert.match(manifest,/recommendedFps:24/);
  assert.match(media,/revision/);assert.doesNotMatch(media,/base64/);assert.ok(manifest.length<2048,'cinematic manifest stays source-light');
  assert.equal(movie.subarray(4,8).toString(),'ftyp');assert.ok(movie.length>400000);
  assert.ok(poster.length>50000);
  assert.match(css,/data-media="video"/);
  assert.match(css,/data-media="fallback"\]\[data-intro="cinematic"\]/);
});

test('cinematic boot is event-driven and overlaps world preparation',()=>{
  const boot=main.slice(main.indexOf('async function boot'),main.indexOf('async function enterCoop'));
  assert.ok(boot.indexOf('titleCinematic.begin()')<boot.indexOf('prepareRuntime('));
  assert.match(cinematic,/addEventListener\('loadeddata',this\.onLoaded\)/);
  assert.match(cinematic,/addEventListener\('canplay',this\.onCanPlay\)/);
  assert.match(cinematic,/addEventListener\('timeupdate',this\.onTimeUpdate\)/);
  assert.match(cinematic,/requestVideoFrameCallback/);
  assert.match(cinematic,/intro load timeout/);
});

test('cinematic stays UI-free until the authored landing and supports whole-screen tap skip',()=>{
  assert.match(manifest,/firstViewSkipAfter:1\.5/);assert.match(manifest,/repeatViewSkipAfter:0/);
  assert.match(cinematic,/dataset\.skip='ready'/);assert.match(cinematic,/skip\(\)/);assert.match(cinematic,/markIntroSeen/);
  assert.match(main,/title\.addEventListener\('pointerup'[\s\S]*titleCinematic\.skip\(\)/);
  assert.doesNotMatch(main,/pendingLaunchMode|requestLaunch|onPrimaryActionReady/);
  assert.doesNotMatch(css,/data-primary-action/);
  assert.match(css,/data-intro="cinematic"\]\[data-skip="ready"\]/);
  assert.match(cinematic,/settleUi\(\{skipped:true\}\)/);
  assert.match(cinematic,/if\(this\.introPlayed\)\{[\s\S]*this\.seekToLivingStill\(\{play:true\}\);return;/);
});

test('reduced motion, motion-off, and media failure retain an operable title fallback',()=>{
  assert.match(cinematic,/prefersReducedMotion/);assert.match(cinematic,/title\.dataset\.motion==='on'/);
  assert.match(cinematic,/activateFallback/);assert.match(cinematic,/getPrepared\(\)\?\.startTitlePreview\?\.\(\{cinematic:false\}\)/);
  assert.match(css,/data-motion="off"\] \.title-cinematic-video/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
