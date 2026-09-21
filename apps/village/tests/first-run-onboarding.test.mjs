import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initial,validate} from '../src/game/core.js';
import {consumeFirstRunAutoplayAfterReset,hasFirstRunAutoplayAfterReset,markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,requestFirstRunAutoplayAfterReset,shouldRecoverFirstRunAutoplay,shouldRunFirstRunAutoplay} from '../src/game/first-run-onboarding.js';

function memoryStorage(){
 const values=new Map();
 return{getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key)};
}
test('existing unmarked villages never receive the first-run autoplay',()=>{
 assert.equal(shouldRunFirstRunAutoplay(initial(),{freshLoad:false}),false);
});
test('a genuinely fresh village starts the autoplay once',()=>{
 const state=initial();assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),true);
 markFirstRunAutoplaySeen(state);assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),false);
});
test('an interrupted autoplay survives validation and resumes safely',()=>{
 const state=initial();markFirstRunAutoplayStarted(state);
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.onboarding.firstRunAutoplay.started,true);
 assert.equal(restored.onboarding.firstRunAutoplay.seen,false);
 assert.equal(shouldRunFirstRunAutoplay(restored,{freshLoad:false}),true);
});
test('completion is persisted as a one-way first-run handoff',()=>{
 const state=initial();markFirstRunAutoplayStarted(state);markFirstRunAutoplaySeen(state);
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.deepEqual(restored.onboarding.firstRunAutoplay,{version:4,started:false,seen:true});
 assert.equal(shouldRunFirstRunAutoplay(restored,{freshLoad:false}),false);
});
test('legacy completion gets exactly one restored moving-finger guide replay',()=>{
 for(const version of[1,2,3]){
  const state=initial();state.onboarding={firstRunAutoplay:{version,started:false,seen:true}};
  assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:false}),true);
  markFirstRunAutoplayStarted(state);assert.equal(state.onboarding.firstRunAutoplay.version,4);
  markFirstRunAutoplaySeen(state);assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:false}),false);
 }
});
test('title reset replay request survives one reload and is environment scoped',()=>{
 const storage=memoryStorage();assert.equal(requestFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('prod',storage),false);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),false);
});
test('entry inspection does not consume the reset request before guide installation',()=>{
 const storage=memoryStorage();requestFirstRunAutoplayAfterReset('dev',storage);
 assert.equal(hasFirstRunAutoplayAfterReset('prod',storage),false);
 assert.equal(hasFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(hasFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(hasFirstRunAutoplayAfterReset('dev',storage),false);
});
test('an explicit reset starts the guide even if a completion marker survived',()=>{
 const state=initial();markFirstRunAutoplaySeen(state);
 assert.equal(shouldRunFirstRunAutoplay(state,{resetReplay:true}),true);
 assert.equal(shouldRunFirstRunAutoplay(state,{resetReplay:false}),false);
});
test('title reset replay never takes the interrupted placement recovery shortcut',()=>{
 const state=initial();markFirstRunAutoplayStarted(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),true);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:true,guidePlaced:true}),false);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:false}),false);
 markFirstRunAutoplaySeen(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),false);
});
test('entry listener is ready before first entry or synchronous returning entry',async()=>{
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const entry=await readFile(new URL('../src/mura-entry-polish.js',import.meta.url),'utf8');
 const autoplay=await readFile(new URL('../src/mura-first-run-autoplay.js',import.meta.url),'utf8');
 assert.ok(main.indexOf('./web/interface.js')<main.indexOf('./mura-entry-polish.js'));
 assert.ok(main.indexOf("addEventListener('village:entered'")<main.indexOf("await import('./mura-entry-polish.js')"));
 assert.match(main,/if\(!village.ui.entryOpen\)void loadPostEntryEnhancements\(\)/);
 assert.match(main,/yieldEntryPaint\(\)[\s\S]*loadMuraEnhancements\(\)[\s\S]*yieldBrowserTurn\(\)[\s\S]*character-runtime-integration/);
 assert.match(main,/dataset.enhancements='error';[\s\S]*reportError\(error\)/);
 assert.match(entry,/dispatchEvent\(new CustomEvent\('village:entered'\)\)/);
 assert.match(entry,/localStorage.setItem\(ENTRY_SEEN_KEY,'1'\)/);
 assert.ok(autoplay.indexOf('startFirstRunGuide({village,canvas})')<autoplay.indexOf('consumeFirstRunAutoplayAfterReset(environment)'));
 assert.match(autoplay,/object.id===previousGuide.placedId/);
});
