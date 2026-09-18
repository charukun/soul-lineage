import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {visualAssetRegistry,visualAssetById} from '../src/index.js';
const gitBlobSha=bytes=>createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');

test('single production visual registry requires authored materialized licensed provenance',()=>{
 for(const asset of Object.values(visualAssetRegistry)){
  assert.equal(visualAssetById(asset.id),asset);assert.equal(asset.status,'MATERIALIZED');
  assert.ok(['artist-authored','rinne-owned-dcc'].includes(asset.origin),asset.id);
  assert.ok(asset.license&&asset.localPath&&asset.source.revision&&asset.source.path&&asset.source.hash,asset.id);
 }
});
test('Village yurt is exact pinned authored Collada, not a generated reconstruction',()=>{
 const asset=visualAssetById('village.yurt.authored-xion.v2'),bytes=readFileSync(asset.localPath),license=readFileSync(asset.licensePath,'utf8');
 assert.equal(asset.origin,'artist-authored');assert.equal(asset.source.hash,`git-blob:${gitBlobSha(bytes)}`);
 assert.equal(asset.runtime.format,'compiled-collada');assert.equal(asset.meshData.sourceTriangles,1656);assert.ok(asset.meshData.sourcePositionVertices>800);
 assert.match(bytes.toString('utf8'),/<authoring_tool>Blender 2\.78\.0/);assert.match(license,/creativecommons\.org\/licenses\/by-sa\/3\.0/);
});
