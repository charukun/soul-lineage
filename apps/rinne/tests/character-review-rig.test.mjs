import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group } from 'three';
import { KAYKIT_HUMANOID_BONES, kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';

test('Character Workshop default rig resolves the CC0 KayKit Rig_Medium bone contract', () => {
  const scene = new Group();
  for (const key of KAYKIT_HUMANOID_BONES) {
    const bone = new Bone(); bone.name = key; scene.add(bone);
  }
  const humanoid = kaykitHumanoidFromGLTF({ scene });
  assert.equal(Object.keys(humanoid).length, KAYKIT_HUMANOID_BONES.length);
  assert.equal(humanoid.hips.name, 'hips');
  assert.equal(humanoid.head.name, 'head');
  assert.equal(humanoid.leftUpperArm.name, 'leftUpperArm');
  assert.equal(humanoid.rightFoot.name, 'rightFoot');
});

test('KayKit review rig fails closed when a required humanoid bone is missing', () => {
  const scene = new Group();
  for (const key of KAYKIT_HUMANOID_BONES) {
    if (key === 'head') continue;
    const bone = new Bone(); bone.name = key; scene.add(bone);
  }
  assert.throws(() => kaykitHumanoidFromGLTF({ scene }), /bones missing: head/i);
});
