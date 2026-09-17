import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {World,defs,FURNITURE} from '../src/game/core.js';
import {canEditRoom,availableFurniture} from '../src/game/housing-access.js';

test('mayor room permissions and furniture unlocks remain independent and stable',()=>{
 const world=new World();world.objects.push({id:'site',kind:'logging',phase:'built',room:[],x:80,z:30,rot:0});
 const original=defs.logging.clanOnly,items=FURNITURE;
 const previous=items.map(d=>[d.id,defs[d.id].unlock]);
 for(const d of items)defs[d.id].unlock=['plank'];
 try{
  assert.ok(canEditRoom(world,'site'));assert.ok(canEditRoom(world,'b1'));assert.equal(canEditRoom(world,'b2'),false);
  for(let i=0;i<20;i++)assert.deepEqual(availableFurniture(world,'site',items),[]);
  world.state.known.push('plank');const expected=items.map(d=>d.id);
  for(let i=0;i<20;i++)assert.deepEqual(availableFurniture(world,'site',items).map(d=>d.id),expected);
  assert.equal(defs.logging.clanOnly,original);
  world.object('site').phase='planned';assert.deepEqual(availableFurniture(world,'site',items),[]);
 }finally{for(const[id,unlock]of previous)defs[id].unlock=unlock;}
});

test('general NPC assignment cannot use the clan manor and editing does not change that rule',()=>{
 const world=new World();world.objects.push({id:'manor',kind:'clanManor',phase:'built',room:[],x:80,z:80,rot:0});
 world.people.push({id:'normal',source:'local-npc',role:'resident',homeId:'b1'});
 assert.ok(canEditRoom(world,'manor'));assert.ok(world.assign('normal','manor').error);assert.equal(defs.clanManor.clanOnly,true);
 assert.equal(defs.clanManor.w,28);assert.equal(defs.clanManor.d,26);
});

test('post-boot enhancement graph contains only current runtime owners',()=>{
 const source=fs.readFileSync(new URL('../src/mura-enhancements.js',import.meta.url),'utf8');
 const retired=[
  'mura-housing-ui-polish',
  'mura-mobile-feedback-fix',
  'mura-mobile-feedback-fix-2',
  'mura-mobile-feedback-fix-3',
  'mura-rotation-fix',
  'mura-master-characters',
  'mura-ux-polish-4',
  'mura-ux-polish-4b',
 ];
 for(const name of retired)assert.ok(!source.includes(name),`${name} must not remain in the runtime module graph`);
 for(const name of ['mura-world-systems','mura-v2-ui','mura-director-polish','mura-playability-polish','mura-motion-crowd'])assert.ok(source.includes(name),`${name} remains an active runtime owner`);
});
