import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone, BoxGeometry, MeshStandardMaterial, SkinnedMesh, Skeleton, Float32BufferAttribute, Uint16BufferAttribute, Vector3, Texture } from 'three';
import { createShinoProductionPool } from '../src/master-character-production.js';
const REQUIRED = ['hips', 'spine', 'head', ...['left', 'right'].flatMap(s => ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'].map(n => s + n))];
function fixture() {
  const template = new Group(), humanoid = {};
  REQUIRED.forEach((name, i) => { const bone = new Bone(); bone.name = name; bone.position.y = i ? .03 : 1; humanoid[name] = bone; (i ? humanoid.hips : template).add(bone); });
  const head = new Bone(), tail = new Bone(); head.position.set(0, .1, 0); tail.position.set(0, .3, 0); head.add(tail); humanoid.head.add(head);
  const geometry = new BoxGeometry(.5, 2, .3), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4)); geometry.morphAttributes.position = [geometry.attributes.position.clone(), geometry.attributes.position.clone()];
  const texture = new Texture(), material = new MeshStandardMaterial({ map: texture }); material.name = 'Body_SKIN';
  const mesh = new SkinnedMesh(geometry, material); mesh.bind(new Skeleton([...Object.values(humanoid), head, tail])); template.add(mesh);
  const makeExpression = (name, index, options = {}) => ({ name, isBinary: false, overrideBlink: 'none', overrideMouth: 'none', overrideLookAt: 'none', binds: [{ node: mesh, index, weight: 1 }], ...options });
  const rig = { humanoid, expressions: [makeExpression('happy', 0, { overrideBlink: 'block' }), makeExpression('blink', 1), makeExpression('angry', 0, { isBinary: true })], warnings: [],
    springs: [{ center: humanoid.head, colliders: [], joints: [head, tail].map(node => ({ node, stiffness: 1, gravityPower: .25, gravityDir: [1, 0, 0], dragForce: .4, hitRadius: .02 })) }] };
  const release = () => { geometry.dispose(); material.dispose(); texture.dispose(); mesh.skeleton.dispose(); };
  return { template, humanoid, rig, head, tail, mesh, release };
}
const look = { scale: 1, headScale: 1, height: 1, width: 1, gray: 0, stoop: 0, skinAge: 0, adultHeightMetres: 2.02, canEquipWeapon: true, dead: false, skin: [1, 1, 1], hair: [.2, .2, .2], eyes: [.3, .4, .5], dye: [1, 1, 1] };
const actorMesh = actor => { let result; actor.visual.traverse(n => { if (n.isSkinnedMesh) result = n; }); return result; };
test('30 production actors isolate expression, rig and spring state while sharing geometry and textures', () => {
  const f = fixture(), pool = createShinoProductionPool(f), actors = Array.from({ length: 30 }, (_, i) => pool.spawn(`actor.${i}`));
  actors.forEach(a => a.sample(look)); actors[0].setExpression('happy', .8);
  assert.equal(actorMesh(actors[0]).morphTargetInfluences[0], .8); assert.equal(actorMesh(actors[1]).morphTargetInfluences[0], 0); assert.equal(f.mesh.morphTargetInfluences[0], 0);
  assert.equal(pool.stats().geometries, 1); assert.equal(pool.stats().textures, 1); assert.equal(pool.stats().materials, 30); assert.equal(pool.stats().active, 30);
  const peerBone = actors[1].bones.head.children.find(n => n.isBone), baseline = peerBone.quaternion.clone();
  for (let i = 0; i < 90; i++) actors[0].updateSecondary(1 / 60, true);
  assert.ok(peerBone.quaternion.angleTo(baseline) < 1e-8); assert.ok(f.head.quaternion.angleTo(baseline) < 1e-8);
  const moving = actors[0].bones.head.children.find(n => n.isBone); assert.ok(moving.quaternion.angleTo(baseline) > .01);
  assert.ok(moving.quaternion.toArray().every(Number.isFinite)); pool.dispose(); f.release();
});
test('expression binary threshold, blink overrides and atomic validation', () => {
  const f = fixture(), pool = createShinoProductionPool(f), a = pool.spawn('a'), mesh = actorMesh(a);
  a.sample(look); a.setExpressions({ blink: 1, happy: .5 }); assert.equal(mesh.morphTargetInfluences[1], 0); assert.equal(mesh.morphTargetInfluences[0], .5);
  a.setExpressions({ angry: .5 }); assert.equal(mesh.morphTargetInfluences[0], 0);
  a.setExpressions({ angry: .51 }); assert.equal(mesh.morphTargetInfluences[0], 1);
  assert.throws(() => a.setExpressions({ missing: 1 })); assert.equal(mesh.morphTargetInfluences[0], 1);
  assert.throws(() => a.setExpression('blink', NaN)); a.clearExpressions(); assert.deepEqual(mesh.morphTargetInfluences, [0, 0]); pool.dispose(); f.release();
});
test('recycled actors reset morph weights, transforms and secondary state without reallocating', () => {
  const f = fixture(), pool = createShinoProductionPool(f), a = pool.spawn('a'); a.sample(look); a.setExpression('happy', 1);
  for (let i = 0; i < 20; i++) a.updateSecondary(1 / 60, true);
  pool.despawn('a'); const b = pool.spawn('b'); b.sample(look); assert.equal(a, b); assert.equal(pool.stats().allocated, 1);
  assert.deepEqual(actorMesh(b).morphTargetInfluences, [0, 0]); assert.deepEqual(b.root.position.toArray(), [0, 0, 0]);
  const spring = b.bones.head.children.find(n => n.isBone); assert.ok(spring.quaternion.angleTo(f.head.quaternion) < 1e-8);
  b.updateSecondary(1 / 60, false); assert.ok(spring.quaternion.angleTo(f.head.quaternion) < 1e-8);
  b.sample({ ...look, scale: .4, headScale: 1.22, width: .88, height: .9 }); b.updateSecondary(1, true);
  assert.ok(spring.getWorldPosition(new Vector3()).toArray().every(Number.isFinite)); assert.throws(() => b.updateSecondary(-1)); pool.dispose(); pool.dispose(); f.release();
});
