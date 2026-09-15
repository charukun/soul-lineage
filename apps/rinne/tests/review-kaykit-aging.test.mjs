import test from 'node:test';
import assert from 'node:assert/strict';
import { THREE } from '@soul/rendering';
import { createKayKitAgeAdapter, resolveKayKitAgeBones } from '../src/review/kaykit-age-adapter.js';

function makeRig() {
  const root = new THREE.Group();
  root.name = 'Rig_Medium';
  const add = (name, parent, y) => {
    const bone = new THREE.Bone();
    bone.name = name;
    bone.position.y = y;
    (parent || root).add(bone);
    return bone;
  };
  const hips = add('hips', null, 1);
  const spine = add('spine', hips, .18);
  const chest = add('chest', spine, .22);
  const head = add('head', chest, .34);

  const shared = new THREE.MeshStandardMaterial({color:'#6b442f'});
  shared.name = 'shared-atlas';
  const hair = new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.18), shared);
  hair.name = 'hair_front';
  head.add(hair);
  const clothes = new THREE.Mesh(new THREE.BoxGeometry(.3,.5,.2), shared);
  clothes.name = 'robe';
  chest.add(clothes);
  const face = new THREE.Mesh(new THREE.BoxGeometry(.15,.15,.15), new THREE.MeshStandardMaterial({color:'#d0a17f'}));
  face.name = 'face';
  head.add(face);
  root.updateMatrixWorld(true);
  return {root, hips, spine, chest, head, hair, clothes, face, shared};
}

test('KayKit Rig_Medium aging resolves required bones and preserves shared clothing material', () => {
  const rig = makeRig();
  const bones = resolveKayKitAgeBones(rig.root);
  assert.equal(bones.hips, rig.hips);
  assert.equal(bones.spine, rig.spine);
  assert.equal(bones.chest, rig.chest);
  assert.equal(bones.head, rig.head);

  const adapter = createKayKitAgeAdapter(rig.root);
  const clothingColor = rig.clothes.material.color.getHex();
  const hairBefore = rig.hair.material.color.getHex();
  assert.notEqual(rig.hair.material, rig.shared, 'hair material must be isolated before aging');
  assert.equal(rig.clothes.material, rig.shared, 'non-age surface must keep the shared atlas material');

  const childhood = adapter.apply({scale:.64,headScale:1.16,gray:0,stoop:0,skinAge:0}, [1,1,1]);
  assert.equal(childhood.mode, 'kaykit-rig-medium-aging');
  assert.ok(rig.root.scale.x < 1);
  assert.ok(rig.head.scale.x > 1);

  const spineBefore = rig.spine.quaternion.clone();
  const elder = adapter.apply({scale:.97,headScale:1,gray:1,stoop:.2,skinAge:.8}, [1,1,1]);
  assert.ok(rig.spine.quaternion.angleTo(spineBefore) > .05, 'elder posture must bend the torso');
  assert.notEqual(rig.hair.material.color.getHex(), hairBefore, 'identifiable hair must gray');
  assert.equal(rig.clothes.material.color.getHex(), clothingColor, 'shared clothing atlas must not be gray-tinted');
  assert.ok(elder.hairSurfaces >= 1);
  assert.ok(elder.skinSurfaces >= 1);
});

test('KayKit aging fails closed when the shared rig is incomplete', () => {
  const root = new THREE.Group();
  const hips = new THREE.Bone(); hips.name = 'hips'; root.add(hips);
  assert.throws(() => createKayKitAgeAdapter(root), /Rig_Medium aging bones missing: spine, chest, head/);
});

test('KayKit bone lookup accepts glTF punctuation sanitization variants', () => {
  const root = new THREE.Group();
  let parent = root;
  for (const name of ['Rig_Medium.hips','Rig_Medium:spine','Rig_Medium_chest','Rig-Medium-head']) {
    const bone = new THREE.Bone(); bone.name = name; parent.add(bone); parent = bone;
  }
  const bones = resolveKayKitAgeBones(root);
  assert.match(bones.hips.name, /hips$/);
  assert.match(bones.head.name, /head$/);
});
