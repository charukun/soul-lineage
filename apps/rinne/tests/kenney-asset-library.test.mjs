import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {RINNE_KENNEY_EXPANSION_OBJECTS,RINNE_KENNEY_EXPANSION_SOUNDS} from '../src/review-kenney-library.js';
import {RINNE_OBJECT_REVIEW_CATALOG} from '../src/review-object-catalog.js';
import {RINNE_SOUND_REVIEW_LIBRARY} from '../src/review-sound-catalog.js';
const root=new URL('../../review/',import.meta.url);
const readJson=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const blobSha=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
test('reconciled Kenney expansion keeps only new hashes and verifies every materialized byte',async()=>{
 const [spec,prov,manifest]=await Promise.all([readJson('asset-imports/rinne-kenney-20260920.json'),readJson('public/library/provenance/rinne-kenney-20260920.json'),readJson('public/library/manifest.json')]);
 assert.equal(spec.records.length,52);assert.equal(prov.records.length,52);assert.equal(prov.reusedExistingHashes,15);
 assert.equal(RINNE_KENNEY_EXPANSION_OBJECTS.length,31);assert.equal(RINNE_KENNEY_EXPANSION_SOUNDS.length,21);
 const m=new Map(manifest.files.map(x=>[x.path,x]));
 for(const row of prov.records){
  assert.equal(row.license,'CC0-1.0');assert.equal(row.author,'Kenney');assert.ok(row.byteLength<=20*1024*1024);assert.match(row.originalSource,/^https:\/\/kenney\.nl\/assets\//);
  const bytes=await readFile(new URL('public/library/'+row.runtimeAssetPath,root));
  assert.equal(bytes.length,row.byteLength);assert.equal(blobSha(bytes),row.gitBlobSha);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);
  assert.equal(bytes.subarray(0,4).toString('ascii'),row.kind==='model'?'glTF':'OggS');
  const entry=m.get(row.runtimeAssetPath);assert.ok(entry);assert.equal(entry.gitBlobSha,row.gitBlobSha);assert.equal(entry.sha256,row.sha256);
 }
 for(const row of RINNE_KENNEY_EXPANSION_OBJECTS){const item=RINNE_OBJECT_REVIEW_CATALOG.find(x=>x.id===row.id);assert.ok(item);assert.match(item.url,/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/library\/model\/kenney\//);}
 for(const row of RINNE_KENNEY_EXPANSION_SOUNDS){const item=RINNE_SOUND_REVIEW_LIBRARY.find(x=>x.id===row.id);assert.ok(item);assert.match(item.url,/soul-lineage-review-dev\.c-okamoto\.workers\.dev\/library\/audio\/kenney\//);}
});
