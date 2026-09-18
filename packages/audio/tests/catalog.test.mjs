import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog,selectTracks} from '../src/index.js';
test('150 distinct Oggs match the shared catalog and preserve audition rights',async()=>{
 const tracks=Object.values(catalog);assert.equal(tracks.length,150);const hashes=new Set();
 for(const track of tracks){const b=await readFile(new URL(`../assets/audio/${track.id}.ogg`,import.meta.url));assert.equal(b.subarray(0,4).toString(),'OggS');const hash=createHash('sha256').update(b).digest('hex');assert.equal(hash,track.sha256);hashes.add(hash);assert.equal(track.commercialClearance,false);assert.equal(track.productionStatus,'audition');}
 assert.equal(hashes.size,150);
});
test('game filters preserve 48 each and all tracks remain searchable',()=>{
 for(const game of ['rinne','village','demon'])assert.equal(selectTracks({game}).length,48);
 assert.equal(selectTracks({query:'魂は、風を継ぐ'}).length,1);
 assert.equal(selectTracks().length,150);
});
