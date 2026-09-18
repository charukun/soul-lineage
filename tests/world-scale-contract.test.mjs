import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {worldScaleTier} from '../packages/world/src/scale-policy.js';
import {defaultMuraLayout,muraDoorWidth,muraHasInterior} from '../packages/world/src/mura/index.js';
import {BUILDINGS,defs as muraDefs} from '../packages/world/src/mura/catalog.js';
import {defs as villageDefs} from '../apps/village/src/game/catalog.js';
import {createMuraModels} from '../packages/rendering/src/mura/models.js';
import {resolveMuraHouseVisual} from '../packages/rendering/src/mura/building-visual.js';
import {visualAssetById} from '../packages/assets/src/index.js';
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

test('Village and Rinne share one canonical human-scale MURA metre catalogue',()=>{
 assert.equal(defaultMuraLayout().units,'metres');
 assert.strictEqual(villageDefs,muraDefs,'Village must not fork shared MURA dimensions');
 const expected={
  mayor:[5,6],guardhome:[5,6],tent:[5,6],home:[6,7],lodge:[9,10],clanManor:[12,14],
  guardpost:[6,6],watchtower:[5,5],barracks:[10,10],chapel:[9,12],smith:[7,7],dojo:[10,9],
  school:[10,9],clinic:[8,8],inn:[9,10],diner:[8,8],restaurant:[10,9],weapons:[7,7],armor:[7,7]
 };
 for(const [kind,size] of Object.entries(expected))assert.deepEqual([muraDefs[kind].w,muraDefs[kind].d],size,kind);
 for(const row of BUILDINGS.filter(row=>muraHasInterior(row.id)))assert.ok(Math.max(row.w,row.d)<=14,`${row.id} footprint ${row.w}x${row.d}m`);
 assert.equal(muraDoorWidth('home'),1.8);
 assert.equal(muraDoorWidth('smith'),2.1);
 assert.equal(muraDoorWidth('clanManor'),2.4);
});

test('production MURA buildings resolve materialized visualAssetId entries',()=>{
 for(const row of BUILDINGS){const asset=visualAssetById(row.visualAssetId);assert.equal(asset.status,'MATERIALIZED',row.id);assert.ok(asset.license&&asset.source.revision&&asset.source.path&&asset.source.hash,row.id);}
});

test('tent semantics are residential-only and render the imported traditional yurt asset',()=>{
 const models=createMuraModels(THREE,{createCanvas:fakeCanvas,textileFibers:0,textileBlotches:0});
 const tentKinds=BUILDINGS.filter(row=>row.shape==='tent').map(row=>row.id);
 assert.deepEqual(tentKinds,['mayor','guardhome','tent']);
 assert.equal(muraDefs.carpenter.shape,undefined,'carpenter must use a permanent work-building silhouette');
 assert.equal(muraDefs.guardpost.shape,undefined,'guard post must use a permanent guard-building silhouette');
 for(const kind of tentKinds){
  assert.equal(resolveMuraHouseVisual(kind),null,`${kind} must stay a distinct residential tent, not a permanent house silhouette`);
  assert.ok(muraDefs[kind].capacity>0,`${kind} must remain residential`);
  assert.equal(muraDefs[kind].jobs,0,`${kind} must not become a work facility`);
  const group=models.building(kind),size=boundsOf(group);
  assert.equal(group.userData.residentialTent,'authored-yurt-v2');
  assert.equal(group.userData.assetBacked,true);
  assert.equal(group.userData.visualAssetId,'village.yurt.authored-xion.v2');
  assert.equal(group.userData.visualAssetOrigin,'artist-authored');
  assert.equal(group.userData.circularHousing,true);
  assert.ok(Math.abs(size.x-size.z)<.16,`${kind} must read as round, got ${size.x} x ${size.z}`);
  assert.ok(size.x<=muraDefs[kind].w+.05&&size.z<=muraDefs[kind].d+.05,`${kind} must fit its canonical footprint`);
  assert.ok(size.y>3.3&&size.y<=3.62,`${kind} authored yurt height ${size.y}`);
 }
 for(const kind of ['logging','storage','quarry','clay','hunting','market']){
  const group=models.building(kind),nodes=[];group.traverse(node=>nodes.push(node));
  assert.equal(nodes.some(node=>node.userData?.residentialTent),false,`${kind} must not reuse a residential tent`);
  assert.equal(nodes.some(node=>node.userData?.workShelter),false,`${kind} must not use a primitive-built work shelter`);
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
