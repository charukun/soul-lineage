import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {CURATED_ASSETS,CURATED_MODEL_ASSETS,CURATED_SOUND_ASSETS,fetchCuratedAssetBytes} from '../packages/assets/src/curated-library.js';
import {visualAssetRegistry} from '../packages/assets/src/visual-asset-registry.js';
const root=fileURLToPath(new URL('../',import.meta.url));
const library=path.join(root,'apps/review/public/library');
const ledger=JSON.parse(await fs.readFile(path.join(library,'provenance/curation-20260921.json'),'utf8'));
const manifest=JSON.parse(await fs.readFile(path.join(library,'manifest.json'),'utf8'));
const manifestByPath=new Map(manifest.files.map(item=>[item.path,item]));
const sha256=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const blobSha=bytes=>crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');

function parseGlb(bytes){
  assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
  const length=bytes.readUInt32LE(12);assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const json=JSON.parse(bytes.toString('utf8',20,20+length).trim());
  assert.equal(json.asset.version,'2.0');
  assert.ok((json.buffers||[]).every(item=>!('uri' in item)));
  assert.ok((json.images||[]).every(item=>!('uri' in item)&&Number.isInteger(item.bufferView)));
  return json;
}

test('556 additions are active without replacing the central registry or legacy entries',()=>{
  assert.equal(ledger.active,true);assert.equal(CURATED_ASSETS.length,556);
  assert.equal(CURATED_MODEL_ASSETS.length,409);assert.equal(CURATED_SOUND_ASSETS.length,147);
  assert.equal(new Set(CURATED_ASSETS.map(item=>item.id)).size,556);
  assert.equal(new Set(CURATED_ASSETS.map(item=>item.gitBlobSha)).size,556);
  assert.equal(ledger.nativeValidation.assetCount,556);assert.equal(ledger.nativeValidation.nativeClipCount,165);
  assert.match(ledger.nativeValidation.head,/^[0-9a-f]{40}$/);
  for(const id of ['village.yurt.authored-royal-xion.v3','mura.kenney-fantasy-town.v1','mura.housing-legacy-procedural.v1'])assert.ok(visualAssetRegistry[id],id);
  for(const item of CURATED_MODEL_ASSETS){
    const entry=visualAssetRegistry[item.visualAssetId];assert.ok(entry,item.id);
    assert.equal(entry.status,'MATERIALIZED');assert.equal(entry.active,true);assert.equal(entry.runtime.lazy,true);
    assert.equal(entry.runtime.assetPath,item.runtimePath);assert.equal(entry.review.productionVisualApproval,false);
    assert.equal(entry.runtime.animationMode,item.kind==='creature'?'native-skeleton':'none');
  }
});

test('all payloads, original identities, embedded dependencies and thumbnails match provenance',async()=>{
  const generated=new Map(CURATED_ASSETS.map(item=>[item.id,item]));let clips=0;
  for(const item of ledger.files){
    assert.equal(item.active,true);assert.equal(item.license,'CC0-1.0');assert.equal(item.origin,'artist-authored');
    assert.ok(item.author&&item.originalSource.startsWith('https://'));
    assert.match(item.source.revision,/^[0-9a-f]{40}$/);assert.match(item.source.sha256,/^[0-9a-f]{64}$/);
    assert.equal(item.source.hash,'git-blob:'+item.source.gitBlobSha);assert.ok(item.source.byteLength>0);
    assert.ok(!item.runtimePath.includes('..')&&!item.runtimePath.includes('://'));
    assert.equal(generated.get(item.id).sha256,item.sha256);
    await fs.access(path.join(root,item.licensePath));
    const bytes=await fs.readFile(path.join(root,item.localPath)),entry=manifestByPath.get(item.runtimePath);
    assert.ok(entry,item.id);assert.equal(bytes.length,item.byteLength);assert.equal(entry.bytes,item.byteLength);
    assert.equal(sha256(bytes),item.sha256);assert.equal(blobSha(bytes),item.gitBlobSha);assert.equal(entry.gitBlobSha,item.gitBlobSha);
    assert.ok(item.inputs.length>0&&item.inputs.every(input=>input.byteLength>0&&/^[a-f0-9]{40}$/.test(input.gitBlobSha)&&/^[a-f0-9]{64}$/.test(input.sha256)));
    if(item.kind==='audio'){
      assert.equal(bytes.toString('ascii',0,4),'OggS');assert.ok(item.byteLength<=1048576);
    }else{
      const gltf=parseGlb(bytes);assert.ok(gltf.meshes.length>0);assert.equal(item.inspection.externalDependencies,0);
      assert.ok(item.inspection.triangles>0&&item.inspection.triangles<=30000);
      assert.ok(item.inspection.textureDimensions.every(size=>size.every(n=>n>0&&n<=2048)));
      if(item.kind==='creature'){
        assert.ok(gltf.skins?.length);assert.equal(gltf.animations.length,item.inspection.animations.length);clips+=gltf.animations.length;
        assert.ok(item.byteLength<=6000000);
      }else assert.ok(item.byteLength<=2097152);
      assert.match(item.thumbnailPath,/^thumbnail\/curation-20260921\//);
      const thumbnail=await fs.readFile(path.join(library,item.thumbnailPath)),thumbnailEntry=manifestByPath.get(item.thumbnailPath);
      assert.equal(thumbnail.toString('ascii',0,4),'RIFF');assert.equal(thumbnail.toString('ascii',8,12),'WEBP');
      assert.equal(thumbnail.length,thumbnailEntry.bytes);assert.equal(blobSha(thumbnail),thumbnailEntry.gitBlobSha);assert.equal(sha256(thumbnail),thumbnailEntry.sha256);
    }
  }
  assert.equal(clips,165);
});

test('curated review adapters are wired into existing catalogs and do not use acquisition hosts as runtime URLs',async()=>{
  const objects=await fs.readFile(path.join(root,'apps/rinne/src/review-object-catalog.js'),'utf8');
  const sounds=await fs.readFile(path.join(root,'apps/rinne/src/review-sound-catalog.js'),'utf8');
  assert.match(objects,/\.\.\.CURATED_REVIEW_OBJECTS/);assert.match(objects,/\.\.\.RINNE_KENNEY_EXPANSION_OBJECTS/);
  assert.match(sounds,/\.\.\.CURATED_REVIEW_SOUNDS/);assert.match(sounds,/\.\.\.kenneyExpansionSfx/);
  assert.match(objects,/id:'barrel'/);assert.match(objects,/id:'training-dummy'/);assert.match(objects,/id:'weapon-great'/);
  const adapter=await fs.readFile(path.join(root,'apps/rinne/src/review-curated-library.js'),'utf8');
  assert.match(adapter,/projectAssetUrl/);assert.doesNotMatch(adapter,/raw\.githubusercontent\.com|cdn\.jsdelivr\.net|codeberg\.org/);
  const runtime=await fs.readFile(path.join(root,'apps/rinne/src/review-object-library.js'),'utf8');
  assert.match(runtime,/fetchCuratedAssetBytes/);assert.match(runtime,/new THREE\.AnimationMixer/);
  assert.match(runtime,/mixer\.uncacheRoot/);assert.match(runtime,/loadAbort\?\.abort/);assert.match(runtime,/sequence!==loadSequence/);
});

test('runtime byte loader rejects corruption, wrong sizes and nonproject URLs',async()=>{
  const asset=CURATED_ASSETS[0],bytes=await fs.readFile(path.join(root,asset.localPath));
  let calls=0;
  const fetchImpl=async(url,options)=>{
    calls++;assert.match(String(url),/^https:\/\/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/library\//);
    assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
    return new Response(bytes,{headers:{'content-length':String(bytes.length)}});
  };
  assert.equal((await fetchCuratedAssetBytes(asset,{fetchImpl})).byteLength,bytes.length);assert.equal(calls,1);
  await assert.rejects(()=>fetchCuratedAssetBytes({...asset,sha256:'0'.repeat(64)},{fetchImpl}),/SHA-256 mismatch/);
  await assert.rejects(()=>fetchCuratedAssetBytes({...asset,byteLength:asset.byteLength+1},{fetchImpl}),/byteLength mismatch/);
  await assert.rejects(()=>fetchCuratedAssetBytes({...asset,runtimePath:'https://raw.githubusercontent.com/example/asset.glb'},{fetchImpl}));
  await assert.rejects(()=>fetchCuratedAssetBytes(asset,{fetchImpl:async()=>new Response(bytes.subarray(0,8))}),/byteLength mismatch/);
  await assert.rejects(()=>fetchCuratedAssetBytes(asset,{fetchImpl:async()=>new Response('missing',{status:404})}),/load failed/);
});
