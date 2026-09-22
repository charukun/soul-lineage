import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {KAYKIT_CURRENT_MODELS,KAYKIT_CHARACTER_LIBRARY,KAYKIT_CHARACTER_PACKS,KAYKIT_LIBRARY_COUNTS,kaykitLibraryModel} from '../src/kaykit-library.js';
import {KAYKIT_MODELS,KAYKIT_DEFAULT_MODEL_ID} from '../src/kaykit-foundation.js';
const root=new URL('../../../',import.meta.url);
const bytes=path=>readFileSync(new URL(path,root));
const json=path=>JSON.parse(bytes(path));
const sha256=b=>createHash('sha256').update(b).digest('hex');
const gitBlob=b=>createHash('sha1').update(`blob ${b.length}\0`).update(b).digest('hex');
const manifest=json('apps/review/public/library/manifest.json');
const spec=json('scripts/assets/kaykit-current-20260922.json');

test('current original models extend the existing descriptor contract without changing gameplay defaults',()=>{
  assert.equal(KAYKIT_CURRENT_MODELS.length,10);assert.equal(KAYKIT_CHARACTER_LIBRARY.length,15);
  assert.equal(KAYKIT_LIBRARY_COUNTS.currentCharacterIdentities,9);
  assert.equal(KAYKIT_LIBRARY_COUNTS.genuinelyNewCharacterIdentities,1);
  assert.equal(new Set(KAYKIT_CURRENT_MODELS.map(m=>m.characterIdentity)).size,9);
  assert.equal(new Set(KAYKIT_CHARACTER_LIBRARY.map(m=>m.id)).size,15);
  assert.equal(KAYKIT_MODELS.length,5);assert.equal(KAYKIT_DEFAULT_MODEL_ID,'kaykit.rogue.v1');
  for(const model of KAYKIT_MODELS)assert.deepEqual(kaykitLibraryModel(model.id).source,model.source);
  assert.throws(()=>kaykitLibraryModel('missing'),/Unknown KayKit/);
  assert.ok(Object.isFrozen(KAYKIT_CURRENT_MODELS[0].source));
});
test('all ten GLBs are original bytes with materialized, nonbroken content-addressed paths',()=>{
  const hashes=new Set();
  for(const model of KAYKIT_CURRENT_MODELS){
    const body=bytes(model.runtime.localPath),expected=spec.models.find(x=>x.id===model.id);
    assert.equal(body.length,expected.byteLength);assert.equal(sha256(body),expected.sha256);assert.equal(gitBlob(body),expected.gitBlobSha);
    assert.equal(model.source.sha256,expected.sha256);assert.equal(model.source.gitBlobSha,expected.gitBlobSha);
    assert.ok(!hashes.has(expected.sha256),'duplicate source bytes');hashes.add(expected.sha256);
    assert.equal(model.runtime.url,'https://soul-lineage-review-dev.c-okamoto.workers.dev/library/'+model.runtime.assetPath);
    assert.equal(model.runtime.lazy,true);assert.equal(model.productionReady,false);assert.equal(model.visualApproval,'pending');
    const entry=manifest.files.find(x=>x.path===model.runtime.assetPath);assert.equal(entry?.sha256,expected.sha256);assert.equal(entry?.bytes,body.length);
    assert.equal(body.subarray(0,4).toString(),'glTF');assert.equal(body.readUInt32LE(8),body.length);
    const doc=JSON.parse(body.subarray(20,20+body.readUInt32LE(12)).toString());
    assert.ok(doc.skins.length>0&&doc.meshes.length>0);assert.equal(doc.animations?.length||0,0);
    assert.ok(![...doc.buffers,...doc.images].some(x=>x.uri),'external model dependency');
    const names=new Set(doc.nodes.map(n=>n.name));for(const name of ['hips','head','spine','chest','hand.l','hand.r','foot.l','foot.r'])assert.ok(names.has(name),name);
    for(const skin of doc.skins){assert.equal(skin.joints.length,23);assert.ok(skin.joints.every(i=>doc.nodes[i]));}
    for(const accessor of doc.accessors){assert.ok(accessor.count>0);if(accessor.min)assert.ok(accessor.min.every(Number.isFinite));if(accessor.max)assert.ok(accessor.max.every(Number.isFinite));}
  }
});
test('pack-specific original license texts and provenance are hash-verified; paid/unrigged packs are not active',()=>{
  const ledger=json('apps/review/public/library/provenance/kaykit-current-20260922.json');
  assert.equal(ledger.models.length,10);assert.deepEqual(ledger.transforms,[]);
  for(const pack of KAYKIT_CHARACTER_PACKS){
    const text=bytes('apps/review/public/library/'+pack.licensePath);assert.equal(sha256(text),pack.licenseSha256);
    assert.match(text.toString(),/Creative Commons Zero, CC0/);assert.match(text.toString(),/commercial projects/);
    assert.equal(pack.author,'Kay Lousberg');assert.match(pack.sourceUrl,/^https:\/\/kaylousberg\.itch\.io\//);
    assert.match(pack.archiveSha256,/^[a-f0-9]{64}$/);assert.ok(pack.archiveByteLength>0);
  }
  assert.equal(ledger.notAcquired.length,4);
  for(const row of KAYKIT_CURRENT_MODELS){assert.ok(ledger.models.some(x=>x.id===row.id&&x.sha256===row.sha256));assert.equal(row.compatibility.animationMode,'shared-external');assert.equal(row.rigId,'Rig_Medium');}
});
test('generated preview images are separately addressed; no selected model is replaced by a thumbnail',()=>{
  for(const model of KAYKIT_CURRENT_MODELS){
    assert.ok(model.thumbnailUrl,'Every current character must have observed thumbnail evidence');
    assert.match(model.thumbnailPath,/^thumbnail\//);
    const body=bytes('apps/review/public/library/'+model.thumbnailPath);
    const entry=manifest.files.find(x=>x.path===model.thumbnailPath);assert.equal(entry?.sha256,sha256(body));
    assert.equal(model.compatibility.status,'review-verified');
    assert.ok(model.compatibility.clips.length>=9);
  }
});
