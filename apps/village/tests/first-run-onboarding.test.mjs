import test from 'node:test';
import assert from 'node:assert/strict';
import {initial,validate} from '../src/game/core.js';
import {consumeFirstRunAutoplayAfterReset,markFirstRunAutoplaySeen,markFirstRunAutoplayStarted,requestFirstRunAutoplayAfterReset,shouldRecoverFirstRunAutoplay,shouldRunFirstRunAutoplay} from '../src/game/first-run-onboarding.js';

function memoryStorage(){
 const values=new Map();
 return{
  getItem:key=>values.has(key)?values.get(key):null,
  setItem:(key,value)=>values.set(key,String(value)),
  removeItem:key=>values.delete(key),
 };
}

test('existing unmarked villages never receive the first-run autoplay',()=>{
 const state=initial();
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:false}),false);
});

test('a genuinely fresh village starts the autoplay once',()=>{
 const state=initial();
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),true);
 markFirstRunAutoplaySeen(state);
 assert.equal(shouldRunFirstRunAutoplay(state,{freshLoad:true}),false);
});

test('an interrupted autoplay survives validation and resumes safely',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 const restored=validate(JSON.parse(JSON.stringify(state)));
 assert.equal(restored.onboarding.firstRunAutoplay.started,true);
 assert.equal(restored.onboarding.firstRunAutoplay.seen,false);
 assert.equal(shouldRunFirstRunAutoplay(restored,{freshLoad:false}),true);
});

test('completion is persisted as a one-way first-run handoff',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 markFirstRunAutoplaySeen(state);
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
 const storage=memoryStorage();
 assert.equal(requestFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('prod',storage),false);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),true);
 assert.equal(consumeFirstRunAutoplayAfterReset('dev',storage),false);
});

test('title reset replay never takes the interrupted placement recovery shortcut',()=>{
 const state=initial();
 markFirstRunAutoplayStarted(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),true);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:true,guidePlaced:true}),false);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:false}),false);
 markFirstRunAutoplaySeen(state);
 assert.equal(shouldRecoverFirstRunAutoplay(state,{resetReplay:false,guidePlaced:true}),false);
});

test('title entry is a lifecycle boundary before post-entry enhancement loading',async()=>{
 const {readFile}=await import('node:fs/promises');
 const main=await readFile(new URL('../src/main.js',import.meta.url),'utf8');
 const entry=await readFile(new URL('../src/mura-entry-polish.js',import.meta.url),'utf8');
 const enhancements=await readFile(new URL('../src/mura-enhancements.js',import.meta.url),'utf8');
 assert.ok(main.indexOf("./web/interface.js")<main.indexOf("./mura-entry-polish.js"));
 assert.ok(main.indexOf("./mura-entry-polish.js")<main.indexOf("./mura-enhancements.js"));
 assert.match(main,/addEventListener\('village:entered',[\s\S]*loadPostEntryEnhancements/);
 assert.match(main,/yieldEntryPaint\(\)[\s\S]*loadMuraEnhancements\(\)[\s\S]*yieldBrowserTurn\(\)[\s\S]*character-runtime-integration/);
 assert.doesNotMatch(enhancements,/^import\s+['"]\.\/mura-world-systems\.js['"]/m);
 assert.match(enhancements,/for\(const modulePath of ORDERED_ENHANCEMENTS\)[\s\S]*await import\(modulePath\)[\s\S]*await yieldToBrowser\(\)/);
 assert.match(entry,/dispatchEvent\(new CustomEvent\('village:entered'\)\)/);
});
