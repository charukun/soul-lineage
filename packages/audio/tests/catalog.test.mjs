import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog,selectTracks} from '../src/index.js';
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');

test('150 distinct Oggs match the shared catalog and are Production-cleared',async()=>{
 const tracks=Object.values(catalog);assert.equal(tracks.length,150);const hashes=new Set();
 const provenance=JSON.parse(await readFile(new URL('../sources/render-provenance.json',import.meta.url),'utf8'));
 assert.equal(provenance.collectionId,'rinne-three-worlds-150-v2');
 assert.equal(provenance.soundfont.license,'MIT');
 assert.match(provenance.soundfont.sha256,/^[a-f0-9]{64}$/);
 assert.equal(provenance.tracks.length,150);
 const renderedById=new Map(provenance.tracks.map(track=>[track.id,track]));
 for(const track of tracks){
  const b=await readFile(new URL(`../assets/audio/${track.id}.ogg`,import.meta.url));
  assert.equal(b.subarray(0,4).toString(),'OggS');
  const hash=sha256(b);assert.equal(hash,track.sha256);hashes.add(hash);
  assert.equal(track.commercialClearance,true);assert.equal(track.productionStatus,'production');
  assert.equal(track.licenseStatus,'cleared-mit-render');assert.equal(track.renderLicense,'MIT');
  assert.equal(track.renderSource,'MuseScore_General_Lite');assert.equal(track.renderSourceSha256,provenance.soundfont.sha256);
  assert.match(track.sourceMidiSha256,/^[a-f0-9]{64}$/);
  assert.equal(renderedById.get(track.id)?.oggSha256,hash);
 }
 assert.equal(hashes.size,150);
});

test('commercial render retains license and sample-source evidence',async()=>{
 const license=await readFile(new URL('../assets/licenses/MuseScore_General_License.txt',import.meta.url),'utf8');
 const sources=await readFile(new URL('../assets/licenses/MuseScore_General_Sample_Sources.csv',import.meta.url),'utf8');
 assert.match(license,/MIT/i);assert.match(license,/Permission is hereby granted/i);assert.ok(sources.trim().length>64);
});

test('game filters preserve 48 each and all tracks remain searchable',()=>{
 for(const game of ['rinne','village','demon'])assert.equal(selectTracks({game}).length,48);
 assert.equal(selectTracks({query:'魂は、風を継ぐ'}).length,1);
 assert.equal(selectTracks().length,150);
});
