import test from 'node:test';
import assert from 'node:assert/strict';
import {THREE} from '@soul/rendering';
import {decayTrailTraffic} from '../src/game/trail-lifecycle.js';

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

test('unused footpath is visually gone after four village days even at maximum wear',()=>{
 for(const wear of [15,40]){
  const traffic={'100,100':wear};
  decayTrailTraffic(traffic,4);
  assert.ok((traffic['100,100']||0)<1.1,`wear ${wear} should no longer render as a path`);
 }
});
