import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {RINNE_KENNEY_OBJECTS,RINNE_KENNEY_SOUNDS,RINNE_KENNEY_ASSET_SOURCE} from '../src/review-kenney-library.js';
import {RINNE_OBJECT_REVIEW_CATALOG} from '../src/review-object-catalog.js';
import {RINNE_SOUND_REVIEW_LIBRARY} from '../src/review-sound-catalog.js';

const root=new URL('../../review/',import.meta.url);
const readJson=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

test('Kenney expansion is materialized, hashed, licensed, parse-signature checked and active in review runtime',async()=>{
  const [spec,prov,manifest]=await Promise.all([
    readJson('asset-imports/rinne-kenney-20260920.json'),
    readJson('public/library/provenance/rinne-kenney-20260920.json'),
    readJson('public/library/manifest.json'),
  ]);
  assert.equal(spec.records.length,67);
  assert.equal(prov.records.length,67);
  assert.equal(RINNE_KENNEY_OBJECTS.length,43);
  assert.equal(RINNE_KENNEY_SOUNDS.length,24);
  assert.equal(RINNE_KENNEY_ASSET_SOURCE.license,'CC0-1.0');
  const manifestByPath=new Map(manifest.files.map(row=>[row.path,row]));
  const provById=new Map(prov.records.map(row=>[row.id,row]));
  for(const row of spec.records){
    const p=provById.get(row.id);assert.ok(p,row.id);
    assert.equal(p.gitBlobSha,row.gitBlobSha);
    assert.equal(p.byteLength,row.byteLength);
    assert.match(p.sha256,/^[0-9a-f]{64}$/);
    assert.equal(p.license,'CC0-1.0');
    assert.equal(p.author,'Kenney');
    const bytes=await readFile(new URL('public/library/'+p.runtimeAssetPath,root));
    assert.equal(bytes.length,p.byteLength);
    assert.equal(gitBlobSha(bytes),p.gitBlobSha);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),p.sha256);
    if(row.kind==='model')assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF',row.id);
    else assert.equal(bytes.subarray(0,4).toString('ascii'),'OggS',row.id);
    const m=manifestByPath.get(p.runtimeAssetPath);assert.ok(m,p.runtimeAssetPath);
    assert.equal(m.gitBlobSha,row.gitBlobSha);
    assert.equal(m.bytes,row.byteLength);
    assert.equal(m.sha256,p.sha256);
    assert.ok(row.byteLength<=20*1024*1024);
  }
  for(const row of RINNE_KENNEY_OBJECTS){
    const active=RINNE_OBJECT_REVIEW_CATALOG.find(item=>item.id===row.id);assert.ok(active,row.id);
    assert.match(active.url,/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/library\/model\/kenney\//);
    assert.doesNotMatch(active.url,/raw\.githubusercontent|jsdelivr|codeberg/);
  }
  for(const row of RINNE_KENNEY_SOUNDS){
    const active=RINNE_SOUND_REVIEW_LIBRARY.find(item=>item.id===row.id);assert.ok(active,row.id);
    assert.match(active.url,/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/library\/audio\/kenney\//);
    assert.doesNotMatch(active.url,/raw\.githubusercontent|jsdelivr|codeberg/);
  }
});
