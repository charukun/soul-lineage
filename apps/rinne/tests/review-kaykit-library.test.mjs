import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {loadPinnedReviewTarget} from '../src/review/motion/source-runtime.js';
import {KAYKIT_CURRENT_MODELS} from '@soul/characters';
const baseUrl='https://soul-lineage-rinne-dev.c-okamoto.workers.dev/review-motion';
const model=url=>({license:'CC0-1.0',source:{gitBlobSha:'a'.repeat(40),byteLength:1},runtime:{url}});
test('review models reject third-party, lookalike and non-HTTP origins before fetching',async()=>{
 for(const url of ['https://evil.example/a.glb','https://raw.githubusercontent.com/a.glb','https://soul-lineage-review-dev.c-okamoto.workers.dev.evil.example/library/a.glb','file:///tmp/a.glb','https://soul-lineage-review-dev.c-okamoto.workers.dev/library/../a.glb']){
  let calls=0;await assert.rejects(loadPinnedReviewTarget(model(url),{baseUrl,fetcher:()=>{calls++;throw Error('unexpected');}}),/self-hosted/);assert.equal(calls,0);
 }
});
test('approved project origin still enforces model identity and prohibits redirects',async()=>{
 let observed;const row=KAYKIT_CURRENT_MODELS[0];
 await assert.rejects(loadPinnedReviewTarget(row,{baseUrl,fetcher:async(url,options)=>{observed={url,options};return new Response(new Uint8Array([0]));}}),/integrity mismatch/);
 assert.equal(observed.url,row.runtime.url);assert.equal(observed.options.redirect,'error');
});
test('current model thumbnails use image elements, not cross-origin SVG symbol references',()=>{
 const src=readFileSync(new URL('../src/review/motion/entrypoint.js',import.meta.url),'utf8');
 const block=src.slice(src.indexOf('function createModelThumbnail'),src.indexOf('function renderModelGrid'));
 assert.match(block,/createElement\('img'\)/);assert.match(block,/image\.loading='lazy'/);assert.doesNotMatch(block,/createStaticThumbnail\(model\.thumbnailUrl/);
 for(const row of KAYKIT_CURRENT_MODELS)assert.match(row.thumbnailUrl,/\.webp$/);
});
