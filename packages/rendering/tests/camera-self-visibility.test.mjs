import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraSelfVisibility } from '../src/camera-self-visibility.js';
import { selectCameraShot } from '../src/camera-director.js';
test('first-person rendering hides only self and restores visibility without touching transforms or equipment', () => {
  const hero = { visible: true, yaw: 1, position: { x: 0, y: 0, z: 0 } }, absent = { visible: false }, weapon = { visible: true };
  const actor = { position: hero.position, height: 2, radius: .4 }, gate = createCameraSelfVisibility();
  const shot = selectCameraShot({ actor, mode: 'interior' });
  assert.equal(shot.selfVisibility, 'firstPerson'); assert.equal(gate.apply([hero, absent, hero], shot, actor), true);
  assert.equal(hero.visible, false); assert.equal(weapon.visible, true); assert.equal(hero.yaw, 1);
  gate.restore(); assert.equal(hero.visible, true); assert.equal(absent.visible, false);
  assert.equal(gate.apply([hero], { ...shot, position: { x: 0, y: 3, z: 10 } }, actor), false);
  assert.equal(gate.apply([hero], selectCameraShot({ actor, mode: 'exploration' }), actor), false);
  gate.apply([hero], shot, actor); gate.dispose(); assert.equal(hero.visible, true);
});
