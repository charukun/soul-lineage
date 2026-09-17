import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {EFFECT_DOWNLOADS,gitBlobSha,verifyEffectBytes,effectDependencies,verifyEffectClosure,acquireEffect} from '../scripts/prepare-effects.mjs';
import {AUTHORED_EFFECTS,EFFECT_ASSETS,REVIEW_AUTHORED_EFFECTS} from '../src/rebuild/authored-effect-manifest.js';

function effectFixture(dependencies,version=1500){
  const word=n=>{const b=Buffer.alloc(4);b.writeUInt32LE(n);return b;};
  const trailingGroups=version===1610?6:5;
  const info=Buffer.concat([word(version),word(dependencies.length),...dependencies.flatMap(s=>[word(s.length+1),Buffer.from(`${s}\0`,'utf16le')]),...Array.from({length:trailingGroups},()=>word(0))]);
  return Buffer.concat([Buffer.from('EFKE'),word(0),Buffer.from('INFO'),word(info.length),info]);
}
test('selected authored originals, expanded review catalog, runtime and license notices are immutable pins',()=>{
  assert.equal(EFFECT_DOWNLOADS.length,41);assert.equal(new Set(EFFECT_DOWNLOADS.map(r=>r.target)).size,41);
  for(const row of EFFECT_DOWNLOADS){assert.match(row.revision,/^[a-f0-9]{40}$/);assert.match(row.gitBlobSha,/^[a-f0-9]{40}$/);assert.ok(row.byteLength>0);}
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-SAMPLES.txt'),true);
  assert.equal(EFFECT_DOWNLOADS.some(r=>r.target==='LICENSE-MIT.txt'),true);
  assert.equal(Object.keys(AUTHORED_EFFECTS).length,3);assert.equal(Object.keys(REVIEW_AUTHORED_EFFECTS).length,8);assert.equal(EFFECT_ASSETS.some(r=>r.path.endsWith('.fbx')),false);
  assert.equal(AUTHORED_EFFECTS.finisher.path,'samples/02_Tktk03/Light.efkefc');
  assert.deepEqual(EFFECT_ASSETS.filter(r=>r.path.endsWith('.efkefc')).map(r=>r.infoVersion),[1500,1500,1610,1500,1500,1500,1500,1610]);
});
test('INFO parser reads reviewed v1500/v1610 layouts and complete dependency closure',()=>{
  const bytes=effectFixture(['Texture/SwordLine01.png']);assert.deepEqual(effectDependencies(bytes),['Texture/SwordLine01.png']);
  assert.doesNotThrow(()=>verifyEffectClosure(EFFECT_ASSETS[0],bytes));
  assert.deepEqual(effectDependencies(effectFixture([],1610)),[]);
  const light=EFFECT_ASSETS.find(row=>row.path.endsWith('/Light.efkefc'));
  assert.throws(()=>verifyEffectClosure(light,effectFixture([],1500)),/version mismatch/);
  assert.throws(()=>verifyEffectClosure(EFFECT_ASSETS[0],effectFixture(['Texture/missing.png'])),/Unpinned/);
});
test('unsafe paths, unknown versions and truncation cannot pass as authored data',()=>{
  for(const value of ['../escape.png','/tmp/x.png','https:asset.png','Texture\\bad.png'])assert.throws(()=>effectDependencies(effectFixture([value])));
  assert.throws(()=>effectDependencies(effectFixture([],1600)),/Unreviewed/);
  const bytes=effectFixture(['Texture/SwordLine01.png']);assert.throws(()=>effectDependencies(bytes.subarray(0,-1)),/Truncated/);
  assert.throws(()=>effectDependencies(Buffer.from('not an effect')),/Not an EFKE/);
});
test('same-length altered bytes fail integrity validation',()=>{
  const bytes=Buffer.from('authored'),row={path:'sample',byteLength:bytes.length,gitBlobSha:gitBlobSha(bytes)};
  assert.equal(verifyEffectBytes(row,bytes),true);assert.throws(()=>verifyEffectBytes(row,Buffer.from('alteredd')),/integrity/);
});
test('download falls back to another pinned host, verifies cache, and never accepts corruption',async()=>{
  const outputRoot=await mkdtemp(path.join(tmpdir(),'rinne-vfx-'));
  try{
    const bytes=Buffer.from('exact original'),row={path:'source.dat',target:'copy.dat',repository:'example/assets',revision:'a'.repeat(40),byteLength:bytes.length,gitBlobSha:gitBlobSha(bytes)};
    const urls=[],fetchImpl=async url=>{urls.push(url);return urls.length===1?new Response('down',{status:503}):new Response(bytes);};
    const result=await acquireEffect(row,{outputRoot,fetchImpl});assert.equal(result.source,'pinned-upstream');assert.equal(urls.length,2);
    assert.ok(urls.every(u=>u.includes(row.revision)));assert.deepEqual(await readFile(result.target),bytes);
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
