import test from 'node:test';
import assert from 'node:assert/strict';
import {combatBodyHudModel} from '../src/combat-body-hud.js';

function stateWith(part,severity){
  return{seed:7,generation:1,ageSeconds:0,maxHp:230,injuries:{[part]:{severity,at:0}}};
}

test('body HUD model keeps all six body parts compact until a part is selected',()=>{
  const model=combatBodyHudModel(stateWith('rightArm',.72));
  assert.equal(model.parts.length,6);
  assert.equal(model.selected,null);
  const rightArm=model.parts.find(part=>part.id==='rightArm');
  assert.equal(rightArm.label,'右腕');
  assert.equal(rightArm.stage,'重傷');
  assert.equal(rightArm.durability,28);
  assert.equal(rightArm.tone,'severe');
});

test('selected body part exposes injury effects used by combat presentation',()=>{
  const model=combatBodyHudModel(stateWith('rightArm',.72),'rightArm');
  assert.equal(model.selected.label,'右腕');
  assert.equal(model.selected.reaction,'大きくひるむ');
  assert.equal(model.selected.attack,83);
  assert.equal(model.selected.movement,100);
  assert.match(model.selected.note,/攻撃動作/);
});
