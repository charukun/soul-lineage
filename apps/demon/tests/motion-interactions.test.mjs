import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('devour presentation consumes explicit capturedBy state and never owns raid authority',async()=>{
 const source=await readFile(new URL('../src/motion-interactions.js',import.meta.url),'utf8');
 assert.match(source,/npc\?\.capturedBy/);assert.match(source,/explicitInteractionAdapter\('eat-target'/);assert.match(source,/source:'raid\.devour\.capturedBy'/);assert.match(source,/root\.position\.x=/);assert.match(source,/root\.rotation\.y=/);assert.match(source,/presentationOnly:true/);assert.match(source,/worldAuthority:false/);
 assert.doesNotMatch(source,/npc\.x\s*=|npc\.z\s*=|npc\.yaw\s*=|captured\.x\s*=|captured\.z\s*=/,'interaction presentation must not mutate gameplay actors');
 assert.doesNotMatch(source,/consume\s*\(|devourProgress\s*=|\.eaten\s*=/,'interaction adapter must not own devour reward or progress');
});

test('Demon boot installs master human then interaction then crowd before NightView game boot',async()=>{
 const source=await readFile(new URL('../src/main.js',import.meta.url),'utf8'),master=source.indexOf("import('./master-humans.js')"),interaction=source.indexOf("import('./motion-interactions.js')"),crowd=source.indexOf("import('./motion-crowd.js')"),game=source.indexOf("import('./web/main.js')");
 assert.ok(master>=0&&interaction>master&&crowd>interaction&&game>crowd);
});

test('portable devour owns the explicit capture lifetime and clears it on cancellation',async()=>{
 const raidEntry=import.meta.resolve('@soul/raid');
 const source=await readFile(new URL('./devour.js',raidEntry),'utf8');
 assert.match(source,/n\.capturedBy=\{x:p\.x,z:p\.z,yaw:p\.yaw,form:session\.profile\?\.form,growthScale:p\.growthScale,progress:p\.devourProgress\}/);
 assert.match(source,/delete session\.devour\.npc\.capturedBy/);
});
