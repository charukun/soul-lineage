import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KAYKIT_HUMANOID_BONES, kaykitHumanoidFromGLTF } from '../src/kaykit-rig.js';

function rig({ omit = null, punctuated = false } = {}) {
  const scene = new THREE.Group();
  const root = new THREE.Group(); root.name = 'Rig_Medium'; scene.add(root);
  const names = [
    'hips','spine','chest','head',
    'upperarm.l','lowerarm.l','hand.l','upperleg.l','lowerleg.l','foot.l',
    'upperarm.r','lowerarm.r','hand.r','upperleg.r','lowerleg.r','foot.r'
  ];
  let parent = root;
  for (const raw of names) {
    if (raw === omit) continue;
    const bone = new THREE.Bone();
    bone.name = punctuated ? `Rig_Medium:${raw}` : raw;
    parent.add(bone);
    if (['hips','spine','chest'].includes(raw)) parent = bone;
  }
  return { scene };
}

test('KayKit Rig_Medium maps public bone names to the shared humanoid contract', () => {
  const mapped = kaykitHumanoidFromGLTF(rig());
  assert.equal(KAYKIT_HUMANOID_BONES.length, 15);
  for (const key of KAYKIT_HUMANOID_BONES) assert.ok(mapped[key]?.isBone, key);
  assert.ok(mapped.chest?.isBone);
  assert.equal(mapped.leftUpperArm.name, 'upperarm.l');
  assert.equal(mapped.rightHand.name, 'hand.r');
});

test('KayKit rig mapping tolerates glTF punctuation prefixes but fails closed on missing bones', () => {
  const mapped = kaykitHumanoidFromGLTF(rig({ punctuated: true }));
  assert.match(mapped.leftLowerArm.name, /lowerarm\.l$/);
  assert.throws(() => kaykitHumanoidFromGLTF(rig({ omit: 'foot.r' })), /rightFoot/);
  const scene = new THREE.Group();
  assert.throws(() => kaykitHumanoidFromGLTF({ scene }), /Rig_Medium root is missing/);
});
