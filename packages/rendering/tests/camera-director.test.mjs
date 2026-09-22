import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraDirector, selectCameraShot, CAMERA_PROFILES } from '../src/camera-director.js';
import { normalizeAngle, angleDelta, radians, orbit, length, subtract, damping } from '../src/camera/math.js';
import { CHARACTER_VIEWS, resolveCharacterView, character25DAppearanceRequest, presentationAnchor } from '../src/character-view-resolver.js';
const near = (a, b, e = 1e-8) => assert.ok(Math.abs(a - b) < e, `${a} ≠ ${b}`);
const actor = { id: 'hero', position: { x: 0, y: 0, z: 0 }, yaw: 0, height: 1.8, radius: .4 };
const input = { actor, aspect: 1.4, space: 'world' };
const viewAt = (degrees, state, extra = {}) => resolveCharacterView({ cameraPosition: { x: Math.sin(radians(degrees)), z: Math.cos(radians(degrees)) }, actorPosition: actor.position, state, ...extra });
test('angles normalize every revolution and use the shortest path across ±pi', () => {
  for (let i = -20; i <= 20; i++) near(normalizeAngle(.2 + i * Math.PI * 2), .2);
  near(angleDelta(radians(179), radians(-179)), radians(2)); near(normalizeAngle(Infinity), 0); near(normalizeAngle(NaN), 0);
  near(damping(5, -1), 0); near(damping(5, 10), damping(5, .1));
});
test('eight directions have anatomical left/right parity and arbitrary actor yaw', () => {
  for (let i = 0; i < 8; i++) assert.equal(viewAt(i * 45).currentView, CHARACTER_VIEWS[i]);
  assert.equal(viewAt(90, null, { actorYaw: radians(90) }).currentView, 'front'); assert.equal(viewAt(0, null, { actorYaw: radians(90) }).currentView, 'sideRight');
  assert.equal(character25DAppearanceRequest(viewAt(-90)).view, 'side'); assert.equal(character25DAppearanceRequest(viewAt(-90)).side, 'right'); assert.equal(character25DAppearanceRequest(viewAt(-90)).mirror, false);
});
test('dead zone plus hysteresis retains current ownership during boundary noise', () => {
  let state = viewAt(0);
  for (const angle of [22, 24, 21, 28, 26, 29, 22]) { state = viewAt(angle, state, { dt: .016 }); assert.equal(state.currentView, 'front'); }
  state = viewAt(31, state); assert.equal(state.currentView, 'frontQuarterLeft'); assert.equal(state.previousView, 'front'); near(state.transitionProgress, 0);
  for (const angle of [24, 20, 17, 23, 16]) { state = viewAt(angle, state, { dt: .04 }); assert.equal(state.currentView, 'frontQuarterLeft'); }
  assert.equal(viewAt(14, state).currentView, 'front');
});
test('back wrapping, degenerate view and action lock retain ownership; crossfade progresses', () => {
  let state = viewAt(179); assert.equal(viewAt(-179, state).currentView, 'back');
  state = viewAt(90, state); state = viewAt(90, state, { dt: .08 }); near(state.transitionProgress, .5);
  assert.equal(viewAt(-90, state, { actionState: { lockView: true } }).currentView, 'sideLeft');
  assert.equal(resolveCharacterView({ cameraPosition: actor.position, actorPosition: actor.position, state }).currentView, 'sideLeft');
  near(viewAt(90, state, { dt: .08 }).transitionProgress, 1); near(presentationAnchor(radians(28), 0), 0); near(presentationAnchor(radians(31), 0), radians(45));
});
test('3D default and weak-perspective profile remain perspective without Character25D', () => {
  const d = createCameraDirector(); const first = d.update(input, 0);
  assert.equal(first.mode, 'exploration'); assert.equal(first.profile, 'current3d'); assert.equal(first.fov, 40); near(first.transition.progress, 1);
  d.setProfile('hybrid25dReady'); const next = d.update(input, .016); assert.ok(next.fov < first.fov && next.fov > 34);
  assert.throws(() => d.setProfile('unknown')); assert.throws(() => createCameraDirector({ profile: 'none' })); assert.deepEqual(actor, input.actor); assert.equal(actor.yaw, 0);
});
test('all outdoor distance-control values stay within safe pitch and preserve sphere height', () => {
  for (let i = 0; i <= 10; i++) {
    const t = i / 10, offset = { x: 6 + 9 * t, y: 4.5 + 14 * t, z: 8 + 13 * t };
    const shot = selectCameraShot({ ...input, offset }); const p = orbit(shot.position, shot.lookTarget);
    assert.ok(p.pitch >= CAMERA_PROFILES.current3d.safeViewRange.pitch[0]); assert.ok(p.pitch <= CAMERA_PROFILES.current3d.safeViewRange.pitch[1]); assert.ok(shot.fov > 0);
  }
});
test('combat/conversation use targets and weapon/large-monster bounds, not a fixed height', () => {
  const frame = { look: { x: 0, y: 1, z: 1 }, offset: { x: 8, y: 8, z: 11 } };
  const target = { id: 'boss', position: { x: 0, y: 0, z: 3 }, height: 9, radius: 4 };
  const normal = selectCameraShot({ ...input, mode: 'combat', combatFrame: frame, target: { ...target, height: 1.5, radius: .4 } });
  const boss = selectCameraShot({ ...input, mode: 'combat', combatFrame: frame, target });
  assert.ok(length(subtract(boss.position, boss.lookTarget)) > length(subtract(normal.position, normal.lookTarget))); assert.equal(boss.targetActor, 'hero'); assert.ok(boss.focusActors.includes('boss'));
  const talk = selectCameraShot({ ...input, mode: 'conversation', target }); assert.equal(talk.mode, 'conversation'); assert.ok(talk.fov <= 38);
});
test('all modes share continuous position/look/FOV/yaw transitions, including title exit', () => {
  const d = createCameraDirector(); d.update({ ...input, yaw: radians(179) }, 0);
  const before = d.snapshot(), next = d.update({ ...input, yaw: radians(-179) }, .016); assert.ok(Math.abs(angleDelta(before.yaw, next.yaw)) < radians(2));
  for (const mode of ['combat', 'conversation', 'interior', 'title', 'event', 'exploration']) {
    const a = d.snapshot(); const b = d.update({ ...input, mode, authoredShot: { position: { x: 2, y: 3, z: 4 }, lookTarget: { x: 0, y: 1, z: 0 }, fov: 32 } }, .016);
    assert.ok(length(subtract(a.position, b.position)) < 6, mode); assert.ok(b.fov > 32, mode); assert.equal(b.transition.to, mode); near(b.transition.progress, 0);
  }
});
test('room coordinate rebasing preserves subject-relative pose at zero dt, then morphs', () => {
  const d = createCameraDirector(); const oldActor = { ...actor, position: { x: 100, y: 0, z: 120 } }; const before = d.update({ ...input, actor: oldActor }, 0);
  const next = d.update({ ...input, actor, mode: 'interior', space: 'room:1' }, 0);
  near(next.position.x - actor.position.x, before.position.x - oldActor.position.x); near(next.position.z - actor.position.z, before.position.z - oldActor.position.z);
  assert.equal(next.transition.rebased, true); assert.equal(next.interiorPolicy, 'interiorFirstPerson');
  for (let i = 0; i < 100; i++) d.update({ ...input, actor, mode: 'interior', space: 'room:1' }, .016);
  near(d.snapshot().position.y, actor.height * .86, .01);
});
test('interior variants and custom policies do not require renderer branches', () => {
  for (const interiorPolicy of ['interiorFirstPerson', 'interiorThirdPerson', 'interiorCutaway', 'interiorDiorama']) assert.equal(selectCameraShot({ ...input, mode: 'interior', interiorPolicy }).interiorPolicy, interiorPolicy);
  const d = createCameraDirector(); const remove = d.registerShot('boss', () => ({ mode: 'boss', position: { x: 3, y: 4, z: 5 }, lookTarget: actor.position, fov: 38 }));
  assert.equal(d.update({ ...input, mode: 'boss' }).mode, 'boss'); remove(); assert.throws(() => d.registerShot('bad', 1));
});
test('free yaw is never quantized; snap policies are optional and explicit', () => {
  const free = createCameraDirector().update({ ...input, yaw: .19 }); near(free.yaw, .19);
  const hard = createCameraDirector({ yawPolicy: 'hardSnap' }).update({ ...input, yaw: .19 }); near(hard.yaw, 0);
  const soft = createCameraDirector({ yawPolicy: 'softSnap' }).update({ ...input, yaw: .19 }); assert.ok(soft.yaw > 0 && soft.yaw < .19);
});
test('first-person turning never orbits the eye outside the room', () => {
  const d = createCameraDirector(); d.update({ ...input, mode: 'interior' }, 0);
  for (let i = 0; i < 30; i++) { const s = d.update({ ...input, actor: { ...actor, yaw: Math.PI }, mode: 'interior' }, .016); assert.ok(Math.hypot(s.position.x, s.position.z) <= .081); assert.ok(Math.abs(s.position.y - actor.height * .86) < .001); }
});
