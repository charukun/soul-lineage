import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const code=readFileSync(new URL('../src/review/shared/runtime-thumbnail.js',import.meta.url),'utf8')
 .replace("import * as THREE from 'three';",'const THREE={};')
 .replace("import {disposeReviewObject} from '@soul/rendering';",'const disposeReviewObject=()=>{};');

test('clearing queued thumbnails before an idle callback is safe and subsequent jobs still run',async()=>{
 const original=globalThis.requestIdleCallback,callbacks=[];
 globalThis.requestIdleCallback=callback=>callbacks.push(callback);
 try{
  const thumbnails=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
  let loads=0;const load=()=>{loads++;throw new Error('Detached/cancelled thumbnails must not fetch models');};
  thumbnails.scheduleRuntimeThumbnail({isConnected:false},'cancelled',load);
  assert.equal(callbacks.length,1);thumbnails.clearRuntimeThumbnailQueue();
  await assert.doesNotReject(callbacks.shift()());
  thumbnails.scheduleRuntimeThumbnail({isConnected:false},'next',load);
  assert.equal(callbacks.length,1,'Idle cancellation must not leave the renderer active forever');
  await assert.doesNotReject(callbacks.shift()());assert.equal(loads,0);
 }finally{if(original===undefined)delete globalThis.requestIdleCallback;else globalThis.requestIdleCallback=original;}
});
test('Studio only requests materialized raster previews; original SVG symbols remain confined to the Rinne SVG renderer',()=>{
 const studio=readFileSync(new URL('../../character-studio/src/review/character/main.js',import.meta.url),'utf8');
 assert.match(studio,/if \(model\.thumbnailUrl && !model\.legacyVersion\) b\.dataset\.thumbnailUrl/);
 const rinne=readFileSync(new URL('../src/review/motion/entrypoint.js',import.meta.url),'utf8');
 assert.match(rinne,/if\(model\.legacyVersion\)return createStaticThumbnail\(model\.thumbnailUrl,model\.label\)/);
});
