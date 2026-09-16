import test from 'node:test';
import assert from 'node:assert/strict';
import {canDepart,createLife,deserializeLife,enterBuilding,leaveBuilding,serializeLife} from '../src/rebuild/domain.js';

function living(){const state=createLife({seed:71});state.phase='living';state.ageYears=20;state.ageSeconds=1200;state.position={x:5,z:6};return state;}
const door={id:'door.house',label:'空き家',enterInterior:true,buildingId:'house-1',interiorSpawn:{x:0,z:2},outsideSpawn:{x:5,z:8}};

test('building entry changes world-space position while retaining the exact return point',()=>{
  const state=living();assert.equal(enterBuilding(state,door),true);assert.equal(state.interior.buildingId,'house-1');assert.deepEqual(state.position,{x:0,z:2});assert.deepEqual(state.interior.returnPosition,{x:5,z:8});assert.equal(canDepart(state),false);
  assert.equal(leaveBuilding(state),true);assert.equal(state.interior,null);assert.deepEqual(state.position,{x:5,z:8});
});

test('interior location survives save and continue without a schema break',()=>{
  const state=living();enterBuilding(state,door);const restored=deserializeLife(serializeLife(state));
  assert.deepEqual(restored.interior,state.interior);assert.deepEqual(restored.position,state.position);
});

test('old schema-v2 saves without an interior field migrate to the outdoor default',()=>{
  const state=living();delete state.interior;const restored=deserializeLife(JSON.stringify(state));assert.equal(restored.interior,null);
});
