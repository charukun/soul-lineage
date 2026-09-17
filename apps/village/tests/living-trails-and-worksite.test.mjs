import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE} from '@soul/rendering';
import {World,DAY_SECONDS} from '../src/game/core.js';
import {Simulation} from '../src/game/simulation.js';

function advance(sim,seconds){for(let t=0;t<seconds;t+=.5)sim.update(Math.min(.5,seconds-t));}
function canvasDocument(){return{createElement(tag){assert.equal(tag,'canvas');return{width:0,height:0,getContext(){return{fillRect(){},beginPath(){},ellipse(){},fill(){},moveTo(){},lineTo(){},stroke(){}};}};}};}

test('carpenter worksite detail stays inside the facility-scale silhouette',async()=>{
 const previous=globalThis.document;globalThis.document=canvasDocument();
 try{
  const {building}=await import('../src/web/models.js');
  const node=building('carpenter');node.updateMatrixWorld(true);
  const size=new THREE.Vector3();new THREE.Box3().setFromObject(node).getSize(size);
  assert.ok(size.x<18,`木工所が横に巨大化しています: ${size.x.toFixed(2)}m`);
  assert.ok(size.z<16,`木工所が奥行き方向に巨大化しています: ${size.z.toFixed(2)}m`);
 }finally{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});

test('unused footpath disappears after four village days',()=>{
 const world=new World(),sim=new Simulation(world);
 world.state.settings.speed=1;world.state.traffic['100,100']=15;sim.trafficRevision++;
 advance(sim,DAY_SECONDS*4+5);
 assert.equal(world.state.traffic['100,100'],undefined);
});
