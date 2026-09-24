import test from 'node:test';
import assert from 'node:assert/strict';
import {ReviewGallery,handleGallery} from '../gallery-worker.mjs';
import {GALLERY_SEEDS} from '../gallery-seeds.mjs';
import {readFileSync} from 'node:fs';

function setup(){
  const data=new Map(),storage={
    get:async key=>data.get(key),
    put:async(key,value)=>{data.set(key,value)},
    delete:async key=>{data.delete(key)},
  };
  const gallery=new ReviewGallery({storage});
  const env={
    REVIEW_GALLERY:{idFromName:name=>name,get:()=>gallery},
    HI3DGEN_LIMITS:{idFromName:name=>name,get:()=>({fetch:async()=>new Response('{}')})},
  };
  return {data,env,call:(path,options)=>handleGallery(new Request('https://review.test/api/gallery'+path,options),env)};
}
const png=new Uint8Array([137,80,78,71,13,10,26,10,1,2,3]);
const upload=(bytes=png,type='image/png')=>{
  const body=new FormData();
  body.set('image',new Blob([bytes],{type}),'draft.png');
  body.set('title','村のラフ');body.set('game','village');body.set('kind','scene');body.set('note','夜の村');
  return body;
};
const origin='https://review.test';

test('uploaded references survive new gallery instances and deletion clears image chunks',async()=>{
  const {data,env,call}=setup();
  const created=await call('',{method:'POST',headers:{origin},body:upload()});
  assert.equal(created.status,201);const {item}=await created.json();
  assert.equal(item.game,'village');
  assert.equal((await (await call('')).json()).items.length,GALLERY_SEEDS.length+1);
  const image=await call('/'+item.id+'/image');
  assert.equal(image.headers.get('content-type'),'image/png');
  assert.deepEqual(new Uint8Array(await image.arrayBuffer()),png);
  assert.equal((await (await new ReviewGallery({storage:env.REVIEW_GALLERY.get().state.storage}).fetch(new Request('https://internal/gallery'))).json()).items.length,GALLERY_SEEDS.length+1);
  assert.equal((await call('/'+item.id,{method:'DELETE',headers:{origin}})).status,200);
  assert.equal((await (await call('')).json()).items.length,GALLERY_SEEDS.length);
  assert.equal((await call('/'+item.id+'/image')).status,404);
  assert.equal([...data.keys()].some(key=>key.startsWith('gallery:'+item.id+':')),false);
});

test('mutations require same origin and reject mismatched image signatures',async()=>{
  const {call}=setup();
  assert.equal((await call('',{method:'POST',body:upload()})).status,403);
  assert.equal((await call('',{method:'POST',headers:{origin},body:upload(new Uint8Array([1,2,3]))})).status,400);
  assert.equal((await (await call('')).json()).items.length,GALLERY_SEEDS.length);
});

test('existing project references appear without upload and hide persists without deleting source',async()=>{
  const {env,call}=setup(),before=(await (await call('')).json()).items;
  assert.equal(before.length,GALLERY_SEEDS.length);
  assert.ok(before.every(item=>item.source==='existing'&&(item.media.startsWith('https://')||item.media.startsWith('/gallery-library/'))));
  const chosen=before[0];
  const removed=await call('/'+chosen.id,{method:'DELETE',headers:{origin}});
  assert.equal((await removed.json()).sourcePreserved,true);
  const reloaded=await new ReviewGallery({storage:env.REVIEW_GALLERY.get().state.storage}).fetch(new Request('https://internal/gallery'));
  const after=(await reloaded.json()).items;
  assert.equal(after.length,GALLERY_SEEDS.length-1);assert.ok(!after.some(item=>item.id===chosen.id));
  assert.equal((await call('/'+chosen.id,{method:'DELETE',headers:{origin}})).status,200);
  assert.equal((await (await call('')).json()).items.length,GALLERY_SEEDS.length-1);
});

test('gallery files for Library concepts exist as WebP assets in the review app',()=>{
  for(const row of GALLERY_SEEDS.filter(item=>item.media.startsWith('/gallery-library/'))){
    const bytes=readFileSync(new URL('../public'+row.media,import.meta.url));
    assert.ok(bytes.length>1000);
    assert.equal(bytes.toString('ascii',0,4),'RIFF');
    assert.equal(bytes.toString('ascii',8,12),'WEBP');
  }
});
