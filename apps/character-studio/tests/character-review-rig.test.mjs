import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Bone, Group } from 'three';
import { KAYKIT_HUMANOID_BONES, KAYKIT_HUMANOID_EDGES, kaykitHumanoidFromGLTF } from '@soul/rendering/kaykit-rig';
import { createGoldenBaseRig } from '../src/img2threejs-bald-chibi.js';

function canonicalScene() {
  const scene = new Group(), add = (parent, name) => { const bone = new Bone(); bone.name = name; parent.add(bone); return bone; };
  const hips = add(scene, 'hips'), spine = add(hips, 'spine'), chest = add(spine, 'chest');
  add(chest, 'head');
  for (const suffix of ['l', 'r']) {
    const upperArm = add(chest, `upperarm.${suffix}`), lowerArm = add(upperArm, `lowerarm.${suffix}`), wrist = add(lowerArm, `wrist.${suffix}`);
    add(wrist, `hand.${suffix}`);
    const upperLeg = add(hips, `upperleg.${suffix}`), lowerLeg = add(upperLeg, `lowerleg.${suffix}`);
    add(lowerLeg, `foot.${suffix}`);
  }
  return scene;
}

test('Character Workshop default rig resolves the CC0 KayKit Rig_Medium humanoid contract', () => {
  const humanoid = kaykitHumanoidFromGLTF({ scene: canonicalScene() });
  assert.equal(KAYKIT_HUMANOID_BONES.length, 15);
  assert.equal(KAYKIT_HUMANOID_EDGES.length, 14);
  assert.equal(humanoid.hips.name, 'hips');
  assert.equal(humanoid.head.name, 'head');
  assert.equal(humanoid.leftUpperArm.name, 'upperarm.l');
  assert.equal(humanoid.rightFoot.name, 'foot.r');
});

test('KayKit review rig fails closed when a required humanoid bone is missing', () => {
  const scene = canonicalScene();
  scene.getObjectByName('head').removeFromParent();
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

test('Character Workshop visualizes only canonical humanoid links, not IK and control helper bones', () => {
  const runtime = readFileSync(new URL('../src/review/character/runtime.js', import.meta.url), 'utf8');
  assert.match(runtime, /KAYKIT_HUMANOID_EDGES/);
  assert.match(runtime, /createHumanoidBoneOverlay/);
  assert.doesNotMatch(runtime, /new THREE\.SkeletonHelper/);
  for (const edge of KAYKIT_HUMANOID_EDGES.flat()) {
    assert.ok(KAYKIT_HUMANOID_BONES.includes(edge), edge);
    assert.doesNotMatch(edge, /ik|control|wrist|handslot|toe/i);
  }
});
