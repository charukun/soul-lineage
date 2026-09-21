import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {loadOrderedEnhancements} from '../src/mura-enhancements.js';

test('all existing lazy enhancements have literal, bundler-discoverable imports',async()=>{
 const source=await readFile(new URL('../src/mura-enhancements.js',import.meta.url),'utf8');
 const modules=[...source.matchAll(/=>import\('\.\/([^']+)'\)/g)].map(match=>match[1]);
 assert.deepEqual(modules,[
  'mura-world-systems.js','mura-performance.js','mura-experience.js','mura-v2-ui.js',
  'mura-background-bgm.js','mura-first-build.js','mura-first-run-autoplay.js',
  'mura-onboarding-coherence.js','mura-director-polish.js','mura-director-touch-fix.js',
  'mura-playability-polish.js','mura-code-share.js','village-kaykit-detail-unity.js','mura-motion-crowd.js',
 ]);
 assert.doesNotMatch(source,/await import\(modulePath\)/);
 for(const modulePath of modules)assert.ok((await readFile(new URL(`../src/${modulePath}`,import.meta.url),'utf8')).length);
});
test('enhancements execute in semantic order and yield between every stage',async()=>{
 const calls=[];
 await loadOrderedEnhancements([
  ['world',async()=>{calls.push('world');await Promise.resolve();calls.push('world-ready');}],
  ['placement',()=>calls.push('placement')],['guide',()=>calls.push('guide')],
 ],()=>calls.push('yield'));
 assert.deepEqual(calls,['world','world-ready','yield','placement','yield','guide','yield']);
});
test('failed imports reject with stage and cause; later stages do not falsely report success',async()=>{
 const cause=new Error('404'),calls=[];
 await assert.rejects(loadOrderedEnhancements([
  ['world-systems',()=>{throw cause;}],['guide',()=>calls.push('guide')],
 ],()=>calls.push('yield')),error=>error.cause===cause&&error.message.includes('world-systems'));
 assert.deepEqual(calls,[]);
});
