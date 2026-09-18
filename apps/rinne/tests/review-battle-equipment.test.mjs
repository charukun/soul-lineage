import test from 'node:test';
import assert from 'node:assert/strict';
import {hideEmbeddedCombatProps,isEmbeddedCombatPropName,reviewBattleEquipmentFor} from '../src/review-battle-equipment.js';

test('review battle suppresses bundled combat props before installing one deliberate loadout',()=>{
  assert.equal(isEmbeddedCombatPropName('Sword_1Handed'),true);
  assert.equal(isEmbeddedCombatPropName('BodyMesh'),false);
  const nodes=[
    {isMesh:true,name:'Rogue_Body',geometry:{name:'Body'},material:{name:'rogue_texture'},visible:true},
    {isMesh:true,name:'Dagger',geometry:{name:'dagger'},material:{name:'rogue_texture'},visible:true},
    {isMesh:true,name:'Bow_Back',geometry:{name:'bow'},material:{name:'rogue_texture'},visible:true}
  ];
  const root={traverse(fn){for(const node of nodes)fn(node);}};
  assert.equal(hideEmbeddedCombatProps(root),2);
  assert.equal(nodes[0].visible,true);
  assert.equal(nodes[1].visible,false);
  assert.equal(nodes[2].visible,false);
  assert.deepEqual(reviewBattleEquipmentFor('kaykit.rogue.v1').map(row=>row.asset),['dagger']);
  assert.deepEqual(reviewBattleEquipmentFor('kaykit.knight.v1').map(row=>row.asset),['sword_1handed','shield_badge']);
});
