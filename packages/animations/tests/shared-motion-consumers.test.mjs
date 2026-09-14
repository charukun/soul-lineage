import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL(`../../../${path}`,import.meta.url),'utf8');

test('rendering exposes the animations-owned motion runtime without duplicating it',async()=>{
 const adapter=await read('packages/rendering/src/motion-runtime.js'),pkg=JSON.parse(await read('packages/rendering/package.json'));
 assert.match(adapter,/from '@soul\/animations'/);assert.match(adapter,/createSharedMotionRuntime/);assert.equal(pkg.exports['./motion-runtime'],'./src/motion-runtime.js');assert.equal(pkg.dependencies['@soul/animations'],'*');
});

test('village MasterCharacter residents consume shared runtime presentation only',async()=>{
 const source=await read('apps/village/src/mura-master-characters.js');assert.match(source,/from '@soul\/rendering\/motion-runtime'/);assert.match(source,/createSharedMotionRuntime/);assert.match(source,/residentMotion/);assert.match(source,/personality:e\.motion\.personality\.name/);assert.match(source,/entry\.actor\.root\.position\.set\(p\.x\|\|0,0,p\.z\|\|0\)/);
 assert.doesNotMatch(source,/p\.x\s*=|p\.z\s*=|p\.angle\s*=/,'shared presentation must not mutate village authority');
});

test('demon human MasterCharacters consume shared runtime without changing AI/world state',async()=>{
 const source=await read('apps/demon/src/master-humans.js');assert.match(source,/from '@soul\/rendering\/motion-runtime'/);assert.match(source,/humanMotion/);assert.match(source,/state:e\.motion\?\.transition\?\.state/);assert.match(source,/entry\.actor\.root\.position\.set\(npc\.x\|\|0,0,npc\.z\|\|0\)/);
 assert.doesNotMatch(source,/npc\.x\s*=|npc\.z\s*=|npc\.state\s*=/,'shared presentation must not mutate demon AI/world authority');
});

test('all three game entries retain independent app boundaries',async()=>{
 const village=JSON.parse(await read('apps/village/package.json')),demon=JSON.parse(await read('apps/demon/package.json')),rinne=JSON.parse(await read('apps/rinne/package.json'));
 for(const pkg of [village,demon,rinne])assert.equal(pkg.dependencies['@soul/rendering'],'*');assert.equal(rinne.dependencies['@soul/animations'],'*');assert.equal(village.dependencies['@soul/rinne'],undefined);assert.equal(demon.dependencies['@soul/rinne'],undefined);assert.equal(village.dependencies['@soul/demon'],undefined);
});
