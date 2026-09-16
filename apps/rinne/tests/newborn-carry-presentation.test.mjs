import test from 'node:test';
import assert from 'node:assert/strict';
import {NEWBORN_CARRY,hideCarrierCombatProps,isCarrierCombatPropName,newbornCarryTransform} from '../src/rebuild/newborn-carry-presentation.js';

test('newborn carry stays visibly in front of the carrier and lies sideways',()=>{
  const facingNorth=newbornCarryTransform({x:10,z:20},0);
  assert.equal(facingNorth.x,10+NEWBORN_CARRY.side);
  assert.equal(facingNorth.z,20+NEWBORN_CARRY.forward);
  assert.equal(facingNorth.y,NEWBORN_CARRY.height);
  assert.equal(facingNorth.roll,-Math.PI/2);
  const facingEast=newbornCarryTransform({x:10,z:20},Math.PI/2);
  assert.ok(Math.abs(facingEast.x-(10+NEWBORN_CARRY.forward))<1e-9);
  assert.ok(Math.abs(facingEast.z-(20-NEWBORN_CARRY.side))<1e-9);
});

test('carrier combat props are recognized without classifying body bones as props',()=>{
  assert.equal(isCarrierCombatPropName('Crossbow'),true);
  assert.equal(isCarrierCombatPropName('Weapon_Shield'),true);
  assert.equal(isCarrierCombatPropName('Rig_Medium_LeftHand'),false);
});

test('carrier combat prop hiding leaves bones and ordinary meshes alone',()=>{
  const nodes=[
    {name:'Crossbow',visible:true,isBone:false},
    {name:'WeaponSocket',visible:true,isBone:true},
    {name:'Body',visible:true,isBone:false}
  ];
  const root={traverse(callback){nodes.forEach(callback);}};
  assert.equal(hideCarrierCombatProps(root),1);
  assert.equal(nodes[0].visible,false);
  assert.equal(nodes[1].visible,true);
  assert.equal(nodes[2].visible,true);
});
