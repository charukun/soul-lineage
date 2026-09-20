import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {NOCTURNE_MODELS,assetUrl,verifyBytes} from '../src/nocturne/assets.js';
const manifest=JSON.parse(readFileSync(new URL('../src/nocturne/manifest.json',import.meta.url),'utf8'));
const library=fileURLToPath(new URL('../public/library/',import.meta.url));
const sha=(data)=>createHash('sha256').update(data).digest('hex');
const arrayBuffer=data=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);

test('all 28 original Nocturne models and their dependencies are pinned in the shared library',()=>{
  assert.equal(NOCTURNE_MODELS.length,28);assert.equal(manifest.packs.length,3);
  const seen=new Set();
  for(const row of manifest.files){
    assert.ok(!seen.has(row.path),row.path);seen.add(row.path);
    assert.match(row.path,/^(model|object|licenses)\/[a-zA-Z0-9/_.-]+$/);
    assert.ok(!row.path.split('/').includes('..'));const path=resolve(library,row.path);assert.ok(path.startsWith(library));
    const bytes=readFileSync(path);assert.equal(bytes.length,row.byteLength,row.path);assert.ok(bytes.length<=20*1024*1024);
    assert.equal(sha(bytes),row.sha256,row.path);
    assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'),row.gitBlob,row.path);
  }
  for(const pack of manifest.packs){assert.equal(pack.license,'CC0-1.0');assert.ok(pack.author&&pack.revision&&pack.sourceUrl&&pack.sha256);assert.ok(seen.has(pack.licensePath));}
  for(const model of NOCTURNE_MODELS){
    assert.ok(model.path.includes('/'+model.gitBlob+'/'));assert.ok(seen.has(model.path));
    const bytes=readFileSync(resolve(library,model.path));assert.equal(bytes.readUInt32LE(0),0x46546c67);assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const doc=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString());
    assert.ok(doc.meshes?.length,model.id);if(model.pack!=='nature')assert.ok(doc.skins?.length&&doc.animations?.length,model.id);
    for(const dep of model.dependencies)assert.ok(seen.has(dep.path));
    for(const r of [...(doc.images||[]),...(doc.buffers||[])])if(r.uri&&!r.uri.startsWith('data:')){
      assert.ok(!/^(https?:|\/)/.test(r.uri)&&!r.uri.includes('..'));
      const relative=model.path.slice(0,model.path.lastIndexOf('/')+1)+r.uri;assert.ok(seen.has(relative),relative);
    }
  }
});

test('actor assets contain the exact locomotion, attack, spawn and death clips used by Nocturne',()=>{
  const common=['Idle','1H_Melee_Attack_Slice_Diagonal','1H_Melee_Attack_Chop'];
  const required={
    'adventurers/Knight':[...common,'Running_A','1H_Melee_Attack_Slice_Horizontal','Death_A','Cheer'],
    'skeletons/Skeleton_Warrior':[...common,'Walking_D_Skeletons','Spawn_Ground_Skeletons','Death_C_Skeletons','2H_Melee_Attack_Chop'],
    'skeletons/Skeleton_Minion':[...common,'Walking_D_Skeletons','Spawn_Ground_Skeletons','Death_C_Skeletons'],
    'skeletons/Skeleton_Mage':['Idle','Walking_D_Skeletons','Spellcast_Shoot','Spawn_Ground_Skeletons','Death_C_Skeletons'],
  };
  for(const [id,names] of Object.entries(required))for(const name of names)assert.ok(manifest.models[id].animations.includes(name),id+': '+name);
});

test('delivery uses the same library path on review DEV, immutable staging and local builds',()=>{
  const path=NOCTURNE_MODELS[0].path;
  for(const origin of ['https://soul-lineage-review-dev.c-okamoto.workers.dev','https://example-staging.workers.dev','http://127.0.0.1:4173']){
    const url=new URL(assetUrl(path,origin+'/battle2'));assert.equal(url.origin,origin);assert.equal(url.pathname,'/library/'+path);
  }
  assert.throws(()=>assetUrl('../escape.glb','http://localhost:4173/battle2'));
});

test('runtime integrity checks accept original bytes and reject truncation or tampering',async()=>{
  const row=NOCTURNE_MODELS.find(r=>r.id==='nature/stone_smallC');const bytes=readFileSync(resolve(library,row.path));
  await verifyBytes(row,arrayBuffer(bytes));
  await assert.rejects(verifyBytes(row,arrayBuffer(bytes.subarray(0,-4))),/byteLength/);
  const corrupted=Buffer.from(bytes);corrupted[corrupted.length-1]^=1;await assert.rejects(verifyBytes(row,arrayBuffer(corrupted)),/SHA-256/);
});
