import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {CURATED_ASSETS,CURATED_MODEL_ASSETS,curatedAssetById,curatedVisualEntries} from '../packages/assets/src/curated-library.js';
import {CHARACTER_REFERENCE_MODELS,KAYKIT_DEFAULT_MODEL_ID} from '../packages/characters/src/index.js';
const ledger=JSON.parse(fs.readFileSync('apps/review/public/library/provenance/quaternius-characters-20260922.json'));
const manifest=JSON.parse(fs.readFileSync('apps/review/public/library/manifest.json'));
const sha=data=>crypto.createHash('sha256').update(data).digest('hex');
const blob=data=>crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');

test('nine distinct native character models from three explicitly cleared packs',()=>{
  assert.equal(ledger.files.length,9);assert.equal(new Set(ledger.files.map(row=>row.pack)).size,3);
  assert.equal(new Set(ledger.files.map(row=>row.sha256)).size,9);assert.deepEqual(ledger.held,[]);
  const entries=new Map(curatedVisualEntries());
  for(const record of ledger.files){
    const asset=curatedAssetById(record.id);assert.equal(asset.modelId,record.modelId);assert.equal(asset.license,'CC0-1.0');assert.equal(asset.reviewOnly,true);
    assert.equal(asset.productionReady,false);assert.equal(asset.runtimeApproval,false);assert.equal(CHARACTER_REFERENCE_MODELS[asset.modelId],undefined);
    assert.ok(CURATED_MODEL_ASSETS.includes(asset));assert.equal(entries.get(asset.visualAssetId).runtime.animationMode,'native-skeleton');
    assert.equal(entries.get(asset.visualAssetId).runtime.reviewOnly,true);
    const bytes=fs.readFileSync(asset.localPath);assert.equal(bytes.length,asset.byteLength);assert.equal(sha(bytes),asset.sha256);assert.equal(blob(bytes),asset.gitBlobSha);
    const row=manifest.files.find(row=>row.path===asset.runtimePath);assert.ok(row);assert.equal(row.bytes,bytes.length);assert.equal(row.gitBlobSha,asset.gitBlobSha);assert.equal(row.sha256,asset.sha256);
    assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
    const doc=JSON.parse(bytes.toString('utf8',20,20+bytes.readUInt32LE(12)).trim());
    assert.ok(doc.skins.length);assert.ok(doc.animations.length);assert.equal(doc.animations.length,asset.inspection.animations.length);
    assert.ok(doc.images?.every(image=>image.bufferView!==undefined)||!doc.images?.length);
    assert.ok(doc.buffers.every(buffer=>buffer.uri===undefined));
    assert.ok(asset.availableReviewClips.some(name=>/idle/i.test(name)));assert.ok(asset.availableReviewClips.some(name=>/walk|run/i.test(name)));
    assert.ok(asset.availableReviewClips.some(name=>/attack|slash|punch|spell|kick/i.test(name)));assert.ok(asset.availableReviewClips.every(name=>!/gun|shoot/i.test(name)));
    assert.equal(asset.rig.retargeted,false);assert.notEqual(asset.rig.id,'Rig_Medium');
    assert.ok(asset.inspection.triangles<=30000);assert.ok(asset.byteLength<=6000000);
    const license=fs.readFileSync(asset.licensePath,'utf8');assert.match(license,/CC0 1.0 Universal/);assert.match(license,/creativecommons.org\/publicdomain\/zero\/1.0/);
    assert.ok(asset.source.revision.match(/^[0-9a-f]{40}$/));assert.ok(asset.inputs.every(input=>input.sha256&&input.byteLength>0));
  }
  assert.equal(CURATED_ASSETS.filter(asset=>asset.kind==='character').length,9);
  assert.equal(KAYKIT_DEFAULT_MODEL_ID,'kaykit.rogue.v1');
});

test('native thumbnails and individual-license evidence are materialized',()=>{
  for(const asset of CURATED_MODEL_ASSETS.filter(row=>row.kind==='character')){
    assert.match(asset.thumbnailPath||'',/^thumbnail\/quaternius-characters-20260922\//);
    const bytes=fs.readFileSync('apps/review/public/library/'+asset.thumbnailPath),row=manifest.files.find(row=>row.path===asset.thumbnailPath);
    assert.ok(row);assert.equal(row.bytes,bytes.length);assert.equal(row.sha256,sha(bytes));assert.equal(row.gitBlobSha,blob(bytes));
  }
  for(const pack of ledger.packs){assert.equal(pack.license,'CC0-1.0');assert.match(pack.originalSource,/^https:\/\/quaternius.com\/packs\//);assert.ok(pack.includedLicense.sha256);assert.equal(pack.upstreamArchive,null);}
});
