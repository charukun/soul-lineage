import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EFFECT_DOWNLOADS,gitBlobSha,verifyEffectBytes,effectDependencies,verifyEffectClosure,acquireEffect} from '../scripts/prepare-effects.mjs';
import {AUTHORED_EFFECTS,EFFECT_ASSETS} from '../src/rebuild/authored-effect-manifest.js';
import {REVIEW_VFX_LIBRARY_COUNT} from '../src/rebuild/review-vfx-library-manifest.js';

function effectFixture(dependencies,version=1500){
  const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const trailingGroups=version>=1610?6:5;
  const info=Buffer.concat([word(version),word(dependencies.length),...dependencies.flatMap(s=>[word(s.length+1),Buffer.from(`${s}\0`,'utf16le')]),...Array.from({length:trailingGroups},()=>word(0))]);
  return Buffer.concat([Buffer.from('EFKE'),word(0),Buffer.from('INFO'),word(info.length),info]);
}
function dependentFilesFixture(dependencies,version=1710){
  const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const records=dependencies.flatMap(s=>[word(1),word(1),word(s.length+1),Buffer.from(`${s}\0`,'utf16le')]);
  const info=Buffer.concat([word(version),word(dependencies.length),...records]);
  return Buffer.concat([Buffer.from('EFKE'),word(0),Buffer.from('INFO'),word(info.length),info]);
}
test('authored originals, runtime and pinned license notices are immutable pins',()=>{
  assert.equal(new Set(EFFECT_DOWNLOADS.map(r=>r.target)).size,EFFECT_DOWNLOADS.length);
  for(const row of EFFECT_DOWNLOADS){assert.match(row.revision,/^[a-f0-9]{40}$/);assert.match(row.gitBlobSha,/^[a-f0-9]{40}$/);assert.ok(row.byteLength>0);}
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-SAMPLES.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-REVIEW-LIBRARY-CC0.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-EFFECT-MATERIALS-CC0.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-RESOURCE-DATA-CC0.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-MIT.txt'),true);
  assert.equal(Object.keys(AUTHORED_EFFECTS).length,3);
  assert.equal(AUTHORED_EFFECTS.finisher.path,'samples/02_Tktk03/Light.efkefc');
  const production=EFFECT_ASSETS.filter(r=>r.path.endsWith('.efkefc')&&!r.reviewOnly);
  assert.deepEqual(production.map(r=>r.infoVersion),[1500,1500,1610]);
  assert.equal(EFFECT_ASSETS.filter(r=>r.reviewLibrary).length,REVIEW_VFX_LIBRARY_COUNT);
});
test('INFO parser reads all explicitly reviewed dependency layouts and complete closure',()=>{
  const bytes=effectFixture(['Texture/SwordLine01.png']);assert.deepEqual(effectDependencies(bytes),['Texture/SwordLine01.png']);
  assert.doesNotThrow(()=>verifyEffectClosure(EFFECT_ASSETS[0],bytes));
  assert.deepEqual(effectDependencies(effectFixture([],1610)),[]);
  assert.deepEqual(effectDependencies(dependentFilesFixture(['Textures/fire.png']),1710),['Textures/fire.png']);
  assert.deepEqual(effectDependencies(effectFixture(['Textures/cutoff.png'],1603),1603),['Textures/cutoff.png']);
  assert.deepEqual(effectDependencies(effectFixture(['Textures/dissolve.png'],1606),1606),['Textures/dissolve.png']);
  assert.deepEqual(effectDependencies(dependentFilesFixture(['Gradient.efkmat'],1703),1703),['Gradient.efkmat']);
  assert.deepEqual(effectDependencies(dependentFilesFixture(['Texture/Particle02.png'],1705),1705),['Texture/Particle02.png']);
  const light=EFFECT_ASSETS.find(row=>row.path.endsWith('/Light.efkefc')&&!row.reviewLibrary);
  assert.throws(()=>verifyEffectClosure(light,effectFixture([],1500)),/version mismatch/);
  assert.throws(()=>verifyEffectClosure(EFFECT_ASSETS[0],effectFixture(['Texture/missing.png'])),/Unpinned/);
  const reviewLibrary=EFFECT_ASSETS.find(row=>row.reviewLibrary);
  assert.doesNotThrow(()=>verifyEffectClosure(reviewLibrary,effectFixture([],1500)));
  const hanmado=EFFECT_ASSETS.find(row=>row.path.endsWith('/hit_hanmado_0409.efkefc'));
  assert.doesNotThrow(()=>verifyEffectClosure(hanmado,effectFixture(['../Texture/hit.png'],1610)));
  assert.throws(()=>verifyEffectClosure(hanmado,effectFixture(['../../outside.png'],1610)),/escapes reviewed root/);
});
test('unsafe paths, unknown versions and truncation cannot pass after 1710 support',()=>{
  for(const value of ['../escape.png','/tmp/x.png','https:asset.png',String.raw`Texture\\bad.png`])assert.throws(()=>effectDependencies(effectFixture([value])));
  assert.throws(()=>effectDependencies(effectFixture([],1800)),/Unreviewed/);
  const bytes=effectFixture(['Texture/SwordLine01.png']);assert.throws(()=>effectDependencies(bytes.subarray(0,-1)),/Truncated/);
  assert.throws(()=>effectDependencies(Buffer.from('not an effect')),/Not an EFKE/);
});
test('same-length altered bytes fail integrity validation',()=>{
  const bytes=Buffer.from('authored'),row={path:'sample',byteLength:bytes.length,gitBlobSha:gitBlobSha(bytes)};
  assert.equal(verifyEffectBytes(row,bytes),true);assert.throws(()=>verifyEffectBytes(row,Buffer.from('alteredd')),/integrity/);
});
test('download uses sourcePath when target path is namespaced, falls back, verifies cache, and rejects corruption',async()=>{
  const outputRoot=await mkdtemp(path.join(tmpdir(),'rinne-vfx-'));
  try{
    const bytes=Buffer.from('exact original'),row={path:'review-library/source.dat',sourcePath:'source.dat',target:'review-library/copy.dat',repository:'example/assets',revision:'a'.repeat(40),byteLength:bytes.length,gitBlobSha:gitBlobSha(bytes)};
    const urls=[],fetchImpl=async url=>{urls.push(url);return urls.length===1?new Response('down',{status:503}):new Response(bytes);};
    const result=await acquireEffect(row,{outputRoot,fetchImpl});assert.equal(result.source,'pinned-upstream');assert.equal(urls.length,2);
    assert.ok(urls.every(u=>u.includes('/source.dat')));assert.ok(urls.every(u=>!u.includes('/review-library/source.dat')));
    assert.deepEqual(await readFile(result.target),bytes);
    assert.equal((await acquireEffect(row,{outputRoot,fetchImpl:()=>{throw Error('must not fetch');}})).source,'verified-cache');
    await writeFile(result.target,'corrupt');await assert.rejects(acquireEffect(row,{outputRoot,fetchImpl:async()=>new Response('wrong')}),/acquisition failed/);
  }finally{await rm(outputRoot,{recursive:true,force:true});}
});
test('oversized and traversal downloads are rejected',async()=>{
  const outputRoot=await mkdtemp(path.join(tmpdir(),'rinne-vfx-'));
  try{
    const row={path:'x',target:'x',repository:'example/assets',revision:'b'.repeat(40),byteLength:1,gitBlobSha:gitBlobSha(Buffer.from('x'))};
    await assert.rejects(acquireEffect(row,{outputRoot,fetchImpl:async()=>new Response('too large')}),/Oversized/);
    await assert.rejects(acquireEffect({...row,target:'../x'},{outputRoot}),/Unsafe/);
  }finally{await rm(outputRoot,{recursive:true,force:true});}
});
