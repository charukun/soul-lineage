import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(path,import.meta.url),'utf8');

test('first-run guide moves attention with the active target instead of pinning instruction at the screen edge',async()=>{
 const [view,css]=await Promise.all([read('../src/mura-first-run-guide-view.js'),read('../src/mura-first-run-guide.css')]);
 for(const token of ['muraFirstRunSpotlight','muraFirstRunTrail','focusRect','placeCoach','animateTrail'])assert.match(view,new RegExp(token),token);
 assert.match(view,/updateTarget\(\{transition:true\}\)/);
 assert.match(view,/stage==='drag'\|\|stage==='place'/);
 assert.match(css,/--mura-coach-left/);
 assert.match(css,/--mura-coach-top/);
 assert.match(css,/box-shadow:0 0 0 999vmax/);
});

test('first-run guide suppresses unrelated HUD while preserving the actionable build surfaces',async()=>{
 const css=await read('../src/mura-first-run-guide.css');
 assert.match(css,/body\.mura-first-run-active :is\(#title,#idleStatus,#idleMoment,#muraHud,#muraDebugTimeAccel,#muraModeControls,#context\)/);
 assert.match(css,/body\.mura-first-run-active #drawer,body\.mura-first-run-active #placement,body\.mura-first-run-active #build/);
 assert.match(css,/pointer-events:none!important/);
});

test('attention motion has a reduced-motion path',async()=>{
 const css=await read('../src/mura-first-run-guide.css');
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/\.muraFirstRunTrail\{display:none!important\}/);
});
