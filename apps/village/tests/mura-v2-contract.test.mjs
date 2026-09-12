import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const read=name=>fs.readFileSync(path.join(src,name),'utf8');

test('village v2 boots scalable world and UI layers',()=>{
 const main=read('main.js');
 for(const module of ['mura-world-systems.js','mura-performance.js','mura-v2-ui.js','mura-entry-polish.js'])assert.match(main,new RegExp(module.replace('.','\\.')));
 assert.match(main,/defaultTrack:'v01'/);
 assert.match(main,/preferDefault:true/);
});

test('population, storage, construction and aging contracts stay enabled',()=>{
 const source=read('mura-world-systems.js');
 assert.match(source,/ACTIVE_DETAIL_LIMIT=96/);
 assert.match(source,/POPULATION_CAP=1000/);
 assert.match(source,/Number\.MAX_SAFE_INTEGER/);
 assert.match(source,/kind==='storage'/);
 assert.match(source,/return 7200/);
 assert.match(source,/old_age/);
 assert.match(source,/carryLimit/);
});

// Interaction assertions live in pointer-input.test.mjs and the touch-driven
// playthrough.browser.mjs. These checks only guard retained bootstrap contracts.
test('climate and the existing mayor model remain enabled',()=>{
 const source=read('mura-v2-ui.js');assert.match(source,/currentClimate/);assert.match(source,/MURAAAAAAA_MayorRegalia/);
});
test('entry and explicit interface bootstrap remain enabled',()=>{
 const source=read('mura-entry-polish.js');assert.match(source,/muraEntryCard/);assert.match(source,/muraEnterVillage/);
 assert.match(read('main.js'),/installInterface/);assert.match(read('web/interface.js'),/muraFollowMayor/);
});

test('music adapter resumes after returning to the browser',()=>{
 const music=fs.readFileSync(path.resolve(here,'../../../packages/shared-ui/src/music.js'),'utf8');
 assert.match(music,/visibilitychange/);
 assert.match(music,/shouldResume/);
 assert.match(music,/resumePending/);
 assert.match(music,/window\.__SOUL_MUSIC__/);
});
