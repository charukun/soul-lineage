import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../..');
const library=resolve(root,'apps/review/public/library');
const readJson=async path=>JSON.parse(await readFile(path,'utf8'));
const gitBlobSha=buffer=>createHash('sha1').update(`blob ${buffer.length}\0`).update(buffer).digest('hex');

test('Kenney medieval library is fully materialized and content-addressed',async()=>{
  const [provenance,manifest]=await Promise.all([
    readJson(resolve(library,'kenney-medieval-provenance.json')),
    readJson(resolve(library,'manifest.json')),
  ]);
  assert.equal(provenance.repository,'eturner58/game-assets');
  assert.equal(provenance.revision,'fc2cd355a8e7c1d8e625fd650abf64f50a1fddaa');
  assert.equal(provenance.author,'Kenney');
  assert.equal(provenance.license,'CC0-1.0');
  assert.equal(provenance.assets.length,45);
  assert.equal(provenance.assets.filter(row=>row.type==='model').length,23);
  assert.equal(provenance.assets.filter(row=>row.type==='audio').length,22);
  const manifestByPath=new Map(manifest.files.map(row=>[row.path,row]));
  const ids=new Set(),paths=new Set();
  for(const asset of provenance.assets){
    assert.ok(!ids.has(asset.id),`duplicate id ${asset.id}`);ids.add(asset.id);
    assert.ok(!paths.has(asset.runtimePath),`duplicate runtimePath ${asset.runtimePath}`);paths.add(asset.runtimePath);
    assert.ok(asset.byteLength>0&&asset.byteLength<=20*1024*1024);
    assert.match(asset.gitBlobSha,/^[0-9a-f]{40}$/);
    const entry=manifestByPath.get(asset.runtimePath);
    assert.ok(entry,`missing manifest entry ${asset.runtimePath}`);
    assert.equal(entry.bytes,asset.byteLength);
    assert.equal(entry.gitBlobSha,asset.gitBlobSha);
    const file=resolve(library,asset.runtimePath);
    const info=await stat(file);
    assert.equal(info.size,asset.byteLength,`byteLength ${asset.runtimePath}`);
    const bytes=await readFile(file);
    assert.equal(gitBlobSha(bytes),asset.gitBlobSha,`git blob ${asset.runtimePath}`);
    if(asset.type==='model'){
      assert.equal(bytes.subarray(0,4).toString('ascii'),'glTF',`GLB magic ${asset.runtimePath}`);
      assert.equal(bytes.readUInt32LE(4),2,`GLB version ${asset.runtimePath}`);
      assert.equal(bytes.readUInt32LE(8),bytes.length,`GLB declared length ${asset.runtimePath}`);
    }else{
      assert.equal(bytes.subarray(0,4).toString('ascii'),'OggS',`Ogg magic ${asset.runtimePath}`);
    }
  }
});

test('Kenney assets are active through the project Asset Origin with no third-party runtime fallback',async()=>{
  const [objects,sounds]=await Promise.all([
    readFile(resolve(root,'apps/rinne/src/review-object-catalog.js'),'utf8'),
    readFile(resolve(root,'apps/rinne/src/review-sound-catalog.js'),'utf8'),
  ]);
  for(const source of [objects,sounds]){
    assert.match(source,/projectAssetUrl/);
    assert.doesNotMatch(source,/raw\.githubusercontent\.com|cdn\.jsdelivr\.net|codeberg\.org/);
  }
  assert.equal((objects.match(/kenneyMedieval\('/g)||[]).length,23);
  assert.equal((sounds.match(/id:'kenney-/g)||[]).length,22);
});
