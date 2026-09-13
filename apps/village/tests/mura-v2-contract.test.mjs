import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const src=path.resolve(here,'../src');
const read=name=>fs.readFileSync(path.join(src,name),'utf8');

test('village v2 boots scalable world and UI layers',()=>{
 const main=read('main.js'),enhancements=read('mura-enhancements.js');
 assert.match(main,/mura-enhancements\.js/);
 for(const module of ['mura-world-systems.js','mura-performance.js','mura-v2-ui.js','mura-entry-polish.js'])assert.match(enhancements,new RegExp(module.replace('.','\\.')));
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

test('placement, highlight, climate and rich detail UI contracts stay enabled',()=>{
 const source=read('mura-v2-ui.js');
 assert.match(source,/muraSelectionTag/);
 assert.match(source,/muraRotateRange/);
 assert.match(source,/muraCancelPlacement/);
 assert.match(source,/currentClimate/);
 assert.match(source,/virtualResidents/);
 assert.match(source,/querySelector\('#relocate'\)\?\.remove/);
 assert.match(source,/MURAAAAAAA_MayorRegalia/);
 assert.match(source,/MURAAAAAAA_FacilityIdentity/);
});

test('entry screen and idle Village Now contracts stay enabled',()=>{
 const source=read('mura-entry-polish.js');
 assert.match(source,/id="muraEntryCard"/);
 assert.match(source,/id="muraEnterVillage"/);
 assert.match(source,/mura-entry-open/);
 assert.match(source,/panel\.classList\.remove\('visible'\)/);
 assert.match(source,/id='muraFollowMayor'/);
 assert.match(source,/view\.followId=mayor\.id/);
 assert.match(source,/muraMayorFollow/);
 assert.match(source,/#tutorial\{/);
 assert.match(source,/grid-template-columns:auto minmax\(0,1fr\) auto/);
});

test('camera inertia preserves release velocity and coasts after pointer up',()=>{
 const source=read('mura-experience.js');
 assert.match(source,/const cancelInertiaFrame/);
 assert.match(source,/Do not call stopInertia here/);
 assert.match(source,/Math\.pow\(\.94/);
 assert.match(source,/inertia\.vx\*dt\*1\.18/);
 assert.match(source,/inertia\.vx=inertia\.vx\*\.62\+rawX\*\.38/);
});

test('music adapter resumes after returning to the browser',()=>{
 const music=fs.readFileSync(path.resolve(here,'../../../packages/shared-ui/src/music.js'),'utf8');
 assert.match(music,/visibilitychange/);
 assert.match(music,/shouldResume/);
 assert.match(music,/resumePending/);
 assert.match(music,/window\.__SOUL_MUSIC__/);
});
