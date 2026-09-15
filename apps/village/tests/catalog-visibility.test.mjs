import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {World,FURNITURE} from '../src/game/core.js';
import {availableFurniture,canEditRoom} from '../src/game/housing-access.js';

test('consolidated catalog preserves furniture visibility between render frames',()=>{
 const world=new World();world.objects.push({id:'store',kind:'storage',phase:'built',room:[],x:80,z:30,rot:0});
 assert.equal(canEditRoom(world,'store'),true);
 const before=availableFurniture(world,'store',FURNITURE).map(d=>d.id);
 for(let frame=0;frame<6;frame++)assert.deepEqual(availableFurniture(world,'store',FURNITURE).map(d=>d.id),before);
 world.state.known.push('plank','cloth');
 const after=availableFurniture(world,'store',FURNITURE).map(d=>d.id);
 for(let frame=0;frame<6;frame++)assert.deepEqual(availableFurniture(world,'store',FURNITURE).map(d=>d.id),after);
 assert.ok(after.length>=before.length);
});

test('retired compatibility modules cannot overwrite renderer visibility',()=>{
 const main=fs.readFileSync(new URL('../src/web/main.js',import.meta.url),'utf8');
 assert.match(main,/availableFurniture\(world,view\.roomId,FURNITURE\)/);
 for(const file of ['mura-ux-polish-4.js','mura-ux-polish-4b.js']){
  const source=fs.readFileSync(new URL(`../src/${file}`,import.meta.url),'utf8');
  assert.ok(!source.includes('setInterval('));
  assert.ok(!source.includes('card.hidden='));
 }
});
