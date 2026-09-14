import test from 'node:test';
import assert from 'node:assert/strict';
import {audioLODForDistance,createAudioVoiceBudget} from '../src/audio-lod.js';

test('audio LOD collapses distant sources into ambience instead of individual voices',()=>{
 assert.equal(audioLODForDistance(5).mode,'spatial');assert.equal(audioLODForDistance(120).mode,'ambience');assert.equal(audioLODForDistance(300).mode,'none');
});

test('voice budget prioritises important/combat and caps active voices',()=>{
 const budget=createAudioVoiceBudget({maxVoices:2});const plan=budget.plan([{id:'a',x:10,z:0},{id:'b',x:8,z:0,combat:true},{id:'c',x:4,z:0}],{focus:{x:0,z:0}});
 assert.equal(plan.voices.length,2);assert.ok(plan.voices.some(v=>v.id==='b'));assert.equal(budget.snapshot().active,2);
});
