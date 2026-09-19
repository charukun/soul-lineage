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

test('cinematic boot overlaps world preparation and hands off to realtime when prepared',()=>{
  const boot=main.slice(main.indexOf('async function boot'),main.indexOf('async function enterCoop'));
  assert.ok(boot.indexOf('titleCinematic.begin()')<boot.indexOf('prepareRuntime('));
  assert.match(boot,/prepareRuntime\([\s\S]*titleCinematic\.onPrepared\(\)/);
  assert.match(cinematic,/onPrepared\(\)[\s\S]*startRealtime\(\)/);
  assert.match(cinematic,/startTitlePreview\?\.\(\{cinematic:true,lowResolution:true\}\)/);
});

test('cinematic uses the prepared realtime world at deliberately low resolution',()=>{
  assert.match(cinematic,/startRealtime\(\)/);assert.match(cinematic,/lowResolution:true/);assert.match(cinematic,/dataset\.media='realtime'/);assert.match(cinematic,/16000/);assert.match(cinematic,/skip\(\)/);
  assert.match(main,/titleCinematic\.onPrepared\(\)/);assert.match(main,/title\.addEventListener\('pointerup'[\s\S]*titleCinematic\.skip\(\)/);
  assert.match(css,/data-media="realtime"/);assert.match(css,/data-cinematic-beat="rebirth"/);assert.doesNotMatch(css,/data-primary-action/);
});

test('reduced motion, motion-off, and media failure retain an operable title fallback',()=>{
  assert.match(cinematic,/prefersReducedMotion/);assert.match(cinematic,/title\.dataset\.motion==='on'/);
  assert.match(cinematic,/activateFallback/);assert.match(cinematic,/getPrepared\(\)\?\.startTitlePreview\?\.\(\{cinematic:false\}\)/);
  assert.match(css,/data-motion="off"\] \.title-cinematic-video/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
