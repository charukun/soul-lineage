import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group } from 'three';
import { KAYKIT_HUMANOID_BONES, kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';

test('Character Workshop default rig resolves the CC0 KayKit Rig_Medium bone contract', () => {
  const scene = new Group();
  for (const sourceName of Object.values(KAYKIT_HUMANOID_BONES)) {
    const bone = new Bone(); bone.name = sourceName; scene.add(bone);
  }
  const humanoid = kaykitHumanoidFromGLTF({ scene });
  assert.equal(humanoid.rigId, 'Rig_Medium');
  assert.equal(humanoid.bones.size, Object.keys(KAYKIT_HUMANOID_BONES).length);
  assert.equal(humanoid.bones.get('hips').name, KAYKIT_HUMANOID_BONES.hips);
  assert.equal(humanoid.bones.get('head').name, KAYKIT_HUMANOID_BONES.head);
});

test('KayKit review rig fails closed when a required humanoid bone is missing', () => {
  const scene = new Group();
  for (const [key, sourceName] of Object.entries(KAYKIT_HUMANOID_BONES)) {
    if (key === 'head') continue;
    const bone = new Bone(); bone.name = sourceName; scene.add(bone);
  }
  assert.throws(() => kaykitHumanoidFromGLTF({ scene }), /missing required bone/i);
});
