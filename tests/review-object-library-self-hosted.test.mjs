import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';

const expected=[
  'kaykit-banner-shield-red','kaykit-barrel-large-decorated','kaykit-bed-decorated','kaykit-box-small-decorated',
  'kaykit-candle-triple','kaykit-chair','kaykit-chest','kaykit-chest-gold','kaykit-coin-stack-large',
  'kaykit-crates-stacked','kaykit-keg-decorated','kaykit-keyring-hanging'
];

test('curated KayKit Dungeon assets are active and self-hosted',async()=>{
  const source=await readFile('apps/rinne/src/review-object-catalog.js','utf8');
  for(const id of expected)assert.match(source,new RegExp(`['"]${id}['"]`));
  assert.match(source,/projectAssetUrl/);
  assert.doesNotMatch(source,/raw\.githubusercontent\.com|cdn\.jsdelivr\.net|codeberg\.org/);
  const provenance=JSON.parse(await readFile('apps/review/public/library/provenance/kaykit-dungeon-curation-20260920.json','utf8'));
  assert.equal(provenance.active,true);assert.equal(provenance.files.length,expected.length);assert.equal(provenance.license,'CC0-1.0');
  const manifest=JSON.parse(await readFile('apps/review/public/library/manifest.json','utf8'));
  for(const row of provenance.files){
    assert.ok(row.byteLength>0&&row.byteLength<=manifest.maxAssetBytes);assert.match(row.sha256,/^[0-9a-f]{64}$/);
    const item=manifest.files.find(file=>file.path===row.runtimePath);assert.ok(item);assert.equal(item.bytes,row.byteLength);assert.equal(item.gitBlobSha,row.gitBlobSha);assert.equal(item.sha256,row.sha256);
    assert.equal((await stat('apps/review/public/library/'+row.runtimePath)).size,row.byteLength);
  }
});
