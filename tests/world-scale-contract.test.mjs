import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {worldScaleTier} from '../packages/world/src/scale-policy.js';
import {defaultMuraLayout} from '../packages/world/src/mura/index.js';
import {defs as muraDefs} from '../packages/world/src/mura/catalog.js';
import {defs as villageDefs} from '../apps/village/src/game/catalog.js';
import {createMuraModels} from '../packages/rendering/src/mura/models.js';
import {resolveMuraHouseVisual} from '../packages/rendering/src/mura/building-visual.js';
import {HOUSING_WORLD_UNITS,ITEMS} from '../packages/housing/catalog.js';
import {makeModel} from '../packages/housing/models.js';
import {makeVillage,RAID_WORLD_UNITS} from '../packages/raid/world.js';
import {worldScaleKernel} from '../packages/platform-web/src/world-scale-kernel.js';
import {presencePolicy} from '../packages/network/src/presence-lod.js';
import {audioLODForDistance} from '../packages/audio/src/audio-lod.js';

const fakeCanvas=()=>({
 width:0,height:0,
 getContext:()=>({fillStyle:'',strokeStyle:'',lineWidth:1,fillRect(){},beginPath(){},ellipse(){},fill(){},moveTo(){},lineTo(){},stroke(){}})
});

function boundsOf(group){
 group.updateMatrixWorld(true);
 const size=new THREE.Vector3();new THREE.Box3().setFromObject(group).getSize(size);return size;
}

test('world, worker, network and audio adapters share the same distance tiers',()=>{
 for(const distance of [0,18,19,48,49,92,93,168,169,400]){
  const canonical=worldScaleTier(distance).id,worker=worldScaleKernel({focus:{x:0,z:0},entities:[{id:'x',x:distance,z:0}]})[0].tier;
  assert.equal(worker,canonical,`worker ${distance}`);assert.equal(presencePolicy(distance).tier,canonical,`network ${distance}`);assert.equal(audioLODForDistance(distance).tier,canonical,`audio ${distance}`);
 }
});

test('Village and Rinne share one canonical MURA metre catalogue',()=>{
 assert.equal(defaultMuraLayout().units,'metres');
 assert.strictEqual(villageDefs,muraDefs,'Village must not fork shared MURA dimensions');
 for(const kind of ['mayor','guardhome','tent'])assert.deepEqual([muraDefs[kind].w,muraDefs[kind].d],[5,6],kind);
 assert.deepEqual([muraDefs.clanManor.w,muraDefs.clanManor.d],[28,26]);
});

test('residential tents are compact human-scale assets in every MURA renderer',()=>{
 const models=createMuraModels(THREE,{createCanvas:fakeCanvas,textileFibers:0,textileBlotches:0});
 for(const kind of ['mayor','guardhome','tent']){
  assert.equal(resolveMuraHouseVisual(kind),null,`${kind} must stay a tent, not a house silhouette`);
  const size=boundsOf(models.building(kind));
  assert.ok(Math.abs(size.x-5)<.03,`${kind} width ${size.x}`);
  assert.ok(Math.abs(size.y-3.6)<.03,`${kind} height ${size.y}`);
  assert.ok(Math.abs(size.z-6)<.03,`${kind} depth ${size.z}`);
 }
 assert.ok(resolveMuraHouseVisual('home'),'permanent homes still use the shared authored house visual');
});

test('尽喰廻遊 raid villages and housing visuals use metre-scale dimensions',()=>{
 assert.equal(HOUSING_WORLD_UNITS,'metres');
 assert.equal(RAID_WORLD_UNITS,'metres');
 const village=makeVillage({id:'world-scale-test',seed:7,name:'scale',target:'traveller',source:'generated',raidScale:'small'});
 assert.equal(village.units,'metres');
 assert.ok(village.entities.length>0);
 const cottage=boundsOf(makeModel('cottage',0,1,{optimize:false})),declared=ITEMS.cottage;
 assert.ok(Math.abs(cottage.x-declared.w)<.4,`Jinku cottage width ${cottage.x}m vs ${declared.w}m`);
 assert.ok(Math.abs(cottage.z-declared.d)<.4,`Jinku cottage depth ${cottage.z}m vs ${declared.d}m`);
 assert.ok(cottage.y>2&&cottage.y<4.5,`Jinku cottage height ${cottage.y}m`);
});
