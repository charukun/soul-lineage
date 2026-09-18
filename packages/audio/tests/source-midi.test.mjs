import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const studioSha='8d399b0f20e6e93d14de249317958b1f50628b32ee8d65a640220210ed11ecb6';

test('150 canonical source MIDIs match the Studio manifest',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../sources/midi-manifest.json',import.meta.url),'utf8'));
 assert.equal(manifest.collectionId,'rinne-three-worlds-150-v2');
 assert.equal(manifest.sourceStudio.name,'Rinne_BGM_150_Studio.html');
 assert.equal(manifest.sourceStudio.sha256,studioSha);
 assert.equal(manifest.tracks.length,150);
 assert.equal(new Set(manifest.tracks.map(track=>track.id)).size,150);
 for(const track of manifest.tracks){
  const bytes=await readFile(new URL(`../sources/midi/${track.id}.mid`,import.meta.url));
  assert.equal(bytes.subarray(0,4).toString(),'MThd');
  assert.equal(sha256(bytes),track.sha256);
  assert.equal(bytes.length,track.bytes);
 }
});
