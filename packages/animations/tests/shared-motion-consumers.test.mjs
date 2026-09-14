import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../../../${path}`,import.meta.url),'utf8');

test('rendering exposes the animations-owned motion runtime without duplicating it',async()=>{
 const adapter=await read('packages/rendering/src/motion-runtime.js'),pkg=JSON.parse(await read('packages/rendering/package.json'));
 assert.match(adapter,/from '@soul\/animations'/);assert.match(adapter,/createSharedMotionRuntime/);assert.match(adapter,/personalSpaceNavigationBias/);assert.match(adapter,/createMotionDeviceCalibration/);assert.equal(pkg.exports['./motion-runtime'],'./src/motion-runtime.js');assert.equal(pkg.dependencies['@soul/animations'],'*');
});

test('village MasterCharacter residents consume shared runtime presentation only and are booted post-world',async()=>{
 const source=await read('apps/village/src/mura-master-characters.js'),entry=await read('apps/village/src/mura-enhancements.js'),crowd=await read('apps/village/src/mura-motion-crowd.js');assert.match(source,/from '@soul\/rendering\/motion-runtime'/);assert.match(source,/createSharedMotionRuntime/);assert.match(source,/residentMotion/);assert.match(source,/personality:e\.motion\.personality\.name/);assert.match(entry,/mura-master-characters\.js/);assert.match(entry,/mura-motion-crowd\.js/);assert.ok(entry.indexOf('mura-master-characters.js')<entry.indexOf('mura-motion-crowd.js'));
 assert.match(crowd,/personalSpaceNavigationBias/);assert.match(crowd,/node\.position\.x=person\.x\+bias\.suggestion\.x/);assert.match(crowd,/worldAuthority:false/);assert.doesNotMatch(source,/p\.x\s*=|p\.z\s*=|p\.angle\s*=/,'shared presentation must not mutate village authority');assert.doesNotMatch(crowd,/person\.(?:x|z|angle)\s*=/,'crowd presentation must not mutate village authority');
});

test('demon human MasterCharacters really load before NightView and crowd bias stays presentation only',async()=>{
 const source=await read('apps/demon/src/master-humans.js'),entry=await read('apps/demon/src/main.js'),crowd=await read('apps/demon/src/motion-crowd.js');assert.match(source,/from '@soul\/rendering\/motion-runtime'/);assert.match(source,/humanMotion/);assert.match(entry,/import\('\.\/master-humans\.js'\)/);assert.match(entry,/import\('\.\/motion-crowd\.js'\)/);assert.ok(entry.indexOf("import('./master-humans.js')")<entry.indexOf("import('./web/main.js')"));assert.match(crowd,/personalSpaceNavigationBias/);assert.match(crowd,/root\.position\.x=npc\.x\+bias\.suggestion\.x/);assert.match(crowd,/worldAuthority:false/);
 assert.doesNotMatch(source,/npc\.x\s*=|npc\.z\s*=|npc\.state\s*=/,'shared presentation must not mutate demon AI/world authority');assert.doesNotMatch(crowd,/npc\.(?:x|z|state)\s*=/,'crowd presentation must not mutate demon authority');
});

test('all three game entries retain independent app boundaries',async()=>{
 const village=JSON.parse(await read('apps/village/package.json')),demon=JSON.parse(await read('apps/demon/package.json')),rinne=JSON.parse(await read('apps/rinne/package.json'));
 for(const pkg of [village,demon,rinne])assert.equal(pkg.dependencies['@soul/rendering'],'*');assert.equal(rinne.dependencies['@soul/animations'],'*');assert.equal(village.dependencies['@soul/rinne'],undefined);assert.equal(demon.dependencies['@soul/rinne'],undefined);assert.equal(village.dependencies['@soul/demon'],undefined);
});
