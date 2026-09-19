import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const [html,main,css,media,cinematic,movie,poster]=await Promise.all([
  readFile(new URL('../index.html',import.meta.url),'utf8'),
  readFile(new URL('../src/main.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-rich.css',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic-media.js',import.meta.url),'utf8'),
  readFile(new URL('../src/title-cinematic.js',import.meta.url),'utf8'),
  readFile(new URL('../public/title-assets/title-cinematic.mp4',import.meta.url)),
  readFile(new URL('../public/title-assets/title-cinematic-poster.webp',import.meta.url)),
]);

test('cinematic title uses real generated movie media as the primary path',()=>{
  assert.match(html,/id="title-cinematic-video"[^>]*preload="auto"[^>]*muted[^>]*playsinline/);
  assert.match(media,/title-cinematic\.mp4/);assert.match(media,/title-cinematic-poster\.webp/);
  assert.doesNotMatch(media,/base64/);assert.ok(media.length<2048,'media manifest stays source-light');
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

test('cinematic offers an early primary action while preserving the authored title handoff',()=>{
  assert.match(media,/primaryActionAt:1\.5/);
  assert.match(cinematic,/primaryActionAt\*1000/);assert.match(cinematic,/dataset\.primaryAction='ready'/);
  assert.match(css,/data-intro="cinematic"\]\[data-primary-action="ready"\]\[data-ready="true"\] \.title-actions/);
  assert.match(css,/title-command:not\(#new-life\)\{display:none\}/);
  assert.match(cinematic,/settleUi\(\)[\s\S]*dataset\.intro='settling'[\s\S]*dataset\.intro='idle'/);
  assert.match(css,/data-intro="settling"\] \.title-lockup\{opacity:1/);
  assert.match(css,/data-intro="settling"\] \.title-actions\{opacity:0/);
  assert.match(cinematic,/if\(this\.introPlayed\)\{[\s\S]*this\.seekToLivingStill\(\{play:true\}\);return;/);
  assert.match(main,/titleCinematic\.pause\(\);title\.hidden=true/);
});

test('reduced motion, motion-off, and media failure retain an operable title fallback',()=>{
  assert.match(cinematic,/prefersReducedMotion/);assert.match(cinematic,/title\.dataset\.motion==='on'/);
  assert.match(cinematic,/activateFallback/);assert.match(cinematic,/getPrepared\(\)\?\.startTitlePreview\?\.\(\{cinematic:false\}\)/);
  assert.match(css,/data-motion="off"\] \.title-cinematic-video/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
