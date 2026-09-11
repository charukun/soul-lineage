import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, Bone, BoxGeometry, MeshStandardMaterial, SkinnedMesh, Skeleton, Float32BufferAttribute, Uint16BufferAttribute, Mesh, Vector3 } from 'three';
import { createMasterCharacterPool } from '../src/master-character.js';
const REQUIRED_BONES = ['hips', 'spine', 'head', ...['left', 'right'].flatMap(s => ['UpperArm', 'LowerArm', 'Hand', 'UpperLeg', 'LowerLeg', 'Foot'].map(n => s + n))];
function fixture() {
  const template = new Group(), humanoid = {};
  REQUIRED_BONES.forEach((name, i) => { const bone = new Bone(); bone.name = name; bone.position.y = i === 0 ? 1 : .02; humanoid[name] = bone; (i ? humanoid.hips : template).add(bone); });
  const geometry = new BoxGeometry(.5, 2, .3), count = geometry.attributes.position.count;
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
  const weights = new Float32Array(count * 4); for (let i = 0; i < count; i++) weights[i * 4] = 1;
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4));
  const material = new MeshStandardMaterial(); material.name = 'Body_SKIN';
  const mesh = new SkinnedMesh(geometry, material); mesh.bind(new Skeleton(Object.values(humanoid))); template.add(mesh);
  return { template, humanoid, geometry, material };
}
// Adapter contract fixtures; lifecycle curves are tested in @soul/characters.
const look = age => ({scale:age===0?.4:age===7?.64:age>=85?.94:1,headScale:age===0?1.22:1,
  height:1.1,width:.88,gray:age>=85?1:0,stoop:age>=85?.24:0,skinAge:age>=85?1:0,adultHeightMetres:2.02,
  canEquipWeapon:age>=7,dead:age>=90,hair:[.1,.2,.3],eyes:[.2,.3,.4],skin:[1,1,1],dye:[1,1,1]});
test('30 actors share geometry, isolate bones/materials and reuse pool slots', () => {
  const f = fixture(), pool = createMasterCharacterPool(f), actors = Array.from({ length: 30 }, (_, i) => pool.spawn(`a${i}`));
  assert.equal(pool.stats().geometries, 1); assert.equal(pool.stats().materials, 30); assert.equal(pool.stats().active, 30);
  actors[0].bones.head.position.x = 99; assert.notEqual(actors[1].bones.head.position.x, 99); assert.notEqual(f.humanoid.head.position.x, 99);
  assert.throws(() => pool.spawn('too-many')); pool.despawn('a0'); const recycled = pool.spawn('new'); assert.equal(recycled, actors[0]); assert.equal(pool.stats().allocated, 30);
  let geometryDisposed = false; f.geometry.addEventListener('dispose', () => { geometryDisposed = true; });
  pool.dispose(); pool.dispose(); assert.equal(geometryDisposed, false); assert.throws(() => pool.spawn('late'));
  f.geometry.dispose(); f.material.dispose();
});
test('age/body/pose overlays do not accumulate', () => {
  const f = fixture(), pool = createMasterCharacterPool(f), a = pool.spawn('a');
  a.sample(look(85)); const old = a.bones.spine.quaternion.clone();
  for (let i = 0; i < 100; i++) a.sample(look(85)); assert.ok(a.bones.spine.quaternion.angleTo(old) < 1e-7);
  a.sample(look(0)); assert.ok(Math.abs(a.bones.head.scale.x - 1.22) < 1e-10);
  a.sample(look(22)); assert.equal(a.bones.head.scale.x, 1); assert.deepEqual(a.bones.spine.quaternion.toArray(), f.humanoid.spine.quaternion.toArray());
  assert.throws(() => a.sample({ ...look(22), width: 100 })); pool.dispose();
});
test('weapon age gate and uniform socket scaling; caller-owned weapon survives disposal', () => {
  const f = fixture(), pool = createMasterCharacterPool(f), a = pool.spawn('a');
  const weapon = new Mesh(new BoxGeometry(.1, 1, .1), new MeshStandardMaterial());
  a.attachWeapon('sword', weapon); a.sample(look(0)); assert.equal(weapon.parent.visible, false);
  a.sample(look(7)); assert.equal(weapon.parent.visible, true);
  a.attachments.updateMatrixWorld(true); const scale = weapon.parent.getWorldScale(new Vector3());
  assert.ok(Math.abs(scale.x - scale.y) < 1e-10 && Math.abs(scale.x - scale.z) < 1e-10);
  a.sample(look(90)); assert.equal(weapon.parent.visible, false);
  assert.equal(a.detachWeapon('sword'), weapon); assert.equal(weapon.parent, null);
  pool.dispose(); weapon.geometry.dispose(); weapon.material.dispose();
});
