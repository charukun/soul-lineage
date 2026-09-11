import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readStudioCatalog,verifyMitLicense} from '../tools/rerender-bgm150-mit.mjs';

const midi=Buffer.from('4d546864000000060000000101e04d54726b0000000400ff2f00','hex');
const digest=createHash('sha256').update(midi).digest('hex');
const ids=[...Array.from({length:48},(_,i)=>`r${String(i+1).padStart(2,'0')}`),...Array.from({length:48},(_,i)=>`v${String(i+1).padStart(2,'0')}`),...Array.from({length:48},(_,i)=>`d${String(i+1).padStart(2,'0')}`),...Array.from({length:6},(_,i)=>`s${String(i+1).padStart(2,'0')}`)];
const catalog={collectionId:'rinne-three-worlds-150-v2',tracks:ids.map(id=>({id,midiBase64:midi.toString('base64'),midiSha256:digest}))};
const html=`<html><script id="catalogData" type="application/json">${JSON.stringify(catalog)}</script></html>`;

test('Studio parser requires all 150 embedded original MIDIs',()=>{
 const parsed=readStudioCatalog(html);assert.equal(parsed.tracks.length,150);assert.equal(parsed.tracks[0].id,'r01');assert.equal(parsed.tracks.at(-1).id,'s06');
});
test('Studio parser rejects altered MIDI bytes',()=>{
 const bad=structuredClone(catalog);bad.tracks[0].midiBase64=Buffer.concat([midi,Buffer.from([1])]).toString('base64');
 assert.throws(()=>readStudioCatalog(`<script id="catalogData">${JSON.stringify(bad)}</script>`),/MIDI digest mismatch/);
});
test('MIT evidence must contain permission and notice-retention clauses',()=>{
 assert.equal(verifyMitLicense('MIT License\nPermission is hereby granted, free of charge, to any person...\nThe above copyright notice and this permission notice shall be included...'),true);
 assert.throws(()=>verifyMitLicense('MIT-ish'),/permission grant missing/i);
});
