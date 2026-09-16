import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {PUBLIC_GITHUB_ASSET_SOURCE,publicGithubAssetCatalog,publicGithubAssetsForApp} from '../src/index.js';

const repoRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..','..','..');
const materializedRoot=resolve(repoRoot,'assets/vendor/public-github/kaykit-medieval-hexagon');
const manifest=JSON.parse(readFileSync(resolve(materializedRoot,'MANIFEST.json'),'utf8'));

test('public GitHub shared catalog stays pinned and complete',()=>{
  assert.equal(PUBLIC_GITHUB_ASSET_SOURCE.repository,'KayKit-Game-Assets/KayKit-Medieval-Hexagon-Pack-1.0');
  assert.equal(PUBLIC_GITHUB_ASSET_SOURCE.commit,'84fa4e91af6a88989be7c99e0891cede11f2ca38');
  assert.equal(PUBLIC_GITHUB_ASSET_SOURCE.license,'CC0-1.0');
  assert.equal(manifest.source.repository,PUBLIC_GITHUB_ASSET_SOURCE.repository);
  assert.equal(manifest.source.commit,PUBLIC_GITHUB_ASSET_SOURCE.commit);
  assert.equal(manifest.license,PUBLIC_GITHUB_ASSET_SOURCE.license);

  const catalog=Object.values(publicGithubAssetCatalog);
  assert.equal(catalog.length,13);
  assert.deepEqual(catalog.map(item=>item.id).sort(),manifest.assets.map(item=>item.id).sort());
  for(const app of ['rinne','village','demon']) assert.equal(publicGithubAssetsForApp(app).length,13);
});

test('every materialized glTF has its pinned local dependencies',()=>{
  for(const asset of Object.values(publicGithubAssetCatalog)){
    assert.equal(asset.status,'VISUAL_CANDIDATE');
    assert.deepEqual(asset.apps,['rinne','village','demon']);
    const gltfPath=resolve(materializedRoot,asset.category,`${asset.source}.gltf`);
    const binPath=resolve(materializedRoot,asset.category,`${asset.source}.bin`);
    const texturePath=resolve(materializedRoot,asset.category,'hexagons_medieval.png');
    assert.ok(existsSync(gltfPath),`${asset.id}: glTF missing`);
    assert.ok(existsSync(binPath),`${asset.id}: bin missing`);
    assert.ok(existsSync(texturePath),`${asset.id}: texture missing`);
    const gltf=JSON.parse(readFileSync(gltfPath,'utf8'));
    assert.equal(gltf.asset?.version,'2.0',`${asset.id}: glTF 2.0 expected`);
    assert.equal(gltf.buffers?.[0]?.uri,`${asset.source}.bin`,`${asset.id}: local buffer dependency expected`);
    assert.equal(gltf.images?.[0]?.uri,'hexagons_medieval.png',`${asset.id}: local texture dependency expected`);
  }
});

test('unknown app fails closed',()=>{
  assert.throws(()=>publicGithubAssetsForApp('unknown'),/Unknown app/);
});
