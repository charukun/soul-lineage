import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=()=>readFile(new URL('../public/simulator/src/humanoid-selection.js',import.meta.url),'utf8');
test('semantic events are presentation channels and never replace gameplay contact authority',async()=>{const text=await source();assert.match(text,/__RINNE_MOTION_EVENT_CHANNELS__/);assert.match(text,/contactAuthority:'gameplay-external'/);assert.match(text,/presentationOnly:true/);assert.doesNotMatch(text,/contactAuthority:'presentation'/);assert.doesNotMatch(text,/damage\s*\(/);});
test('impact-derived weapon deflection requires identified attacker and expires',async()=>{const text=await source();assert.match(text,/beat\?\.actorId==null\|\|!beat\?\.direction/);assert.match(text,/String\(actor\?\.id\)===String\(beat\.actorId\)/);assert.match(text,/source:'impact-beat'/);assert.match(text,/duration:\.14/);assert.match(text,/age>duration/);assert.match(text,/a\._weaponContactPresentation=null/);assert.match(text,/if\(commit\)/);});
