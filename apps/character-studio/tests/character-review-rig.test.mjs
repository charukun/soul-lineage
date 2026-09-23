import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, Group } from 'three';
import { KAYKIT_HUMANOID_BONES, kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';
import { createGoldenBaseRig } from '../src/img2threejs-bald-chibi.js';

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

test('Golden Base exposes the same Rig_Medium humanoid hierarchy used by the KayKit cast', () => {
  const scene = new Group();
  const bones = createGoldenBaseRig(scene);
  const humanoid = kaykitHumanoidFromGLTF({ scene });
  assert.equal(scene.userData.rigId, 'kaykit.Rig_Medium.v1');
  assert.equal(scene.userData.boneOverlayKind, 'rig');
  assert.equal(humanoid.leftUpperArm.name, 'upperarm.l');
  assert.equal(humanoid.leftLowerArm.parent, humanoid.leftUpperArm);
  assert.equal(humanoid.leftHand.parent, humanoid.leftLowerArm);
  assert.equal(humanoid.rightUpperLeg.name, 'upperleg.r');
  assert.equal(humanoid.rightLowerLeg.parent, humanoid.rightUpperLeg);
  assert.equal(humanoid.rightFoot.parent, humanoid.rightLowerLeg);
  assert.equal(bones.head.name, 'head');
});
