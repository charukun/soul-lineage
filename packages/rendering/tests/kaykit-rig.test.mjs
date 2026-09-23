import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { KAYKIT_HUMANOID_BONES, KAYKIT_HUMANOID_EDGES, kaykitHumanoidFromGLTF } from '../src/kaykit-rig.js';

function rig({ omit = null, punctuated = false, rootName = 'root', breakRightFoot = false } = {}) {
  const scene = new THREE.Group();
  const root = new THREE.Group(); root.name = rootName; scene.add(root);
  const name = raw => punctuated ? `Rig_Medium:${raw}` : raw;
  const add = (parent, raw) => {
    if (raw === omit) return null;
    const bone = new THREE.Bone(); bone.name = name(raw); parent.add(bone); return bone;
  };
  const hips = add(root, 'hips');
  const spine = hips && add(hips, 'spine');
  const chest = spine && add(spine, 'chest');
  if (chest) add(chest, 'head');
  for (const suffix of ['l', 'r']) {
    const upperArm = chest && add(chest, `upperarm.${suffix}`);
    const lowerArm = upperArm && add(upperArm, `lowerarm.${suffix}`);
    const wrist = lowerArm && add(lowerArm, `wrist.${suffix}`);
    if (wrist) add(wrist, `hand.${suffix}`);
    const upperLeg = hips && add(hips, `upperleg.${suffix}`);
    const lowerLeg = upperLeg && add(upperLeg, `lowerleg.${suffix}`);
    const footParent = breakRightFoot && suffix === 'r' ? spine : lowerLeg;
    if (footParent) add(footParent, `foot.${suffix}`);
  }
  return { scene };
}

test('KayKit Rig_Medium maps required bones and canonical overlay edges under the upstream-style root node', () => {
  const mapped = kaykitHumanoidFromGLTF(rig());
  assert.equal(KAYKIT_HUMANOID_BONES.length, 15);
  assert.equal(KAYKIT_HUMANOID_EDGES.length, 14);
  for (const key of KAYKIT_HUMANOID_BONES) assert.ok(mapped[key]?.isBone, key);
  for (const [parent, child] of KAYKIT_HUMANOID_EDGES) {
    assert.ok(KAYKIT_HUMANOID_BONES.includes(parent), parent);
    assert.ok(KAYKIT_HUMANOID_BONES.includes(child), child);
  }
  assert.ok(mapped.chest?.isBone);
  assert.equal(mapped.leftUpperArm.name, 'upperarm.l');
  assert.equal(mapped.rightHand.name, 'hand.r');
});

test('KayKit rig mapping tolerates glTF punctuation prefixes and the legacy rig-labelled root', () => {
  const mapped = kaykitHumanoidFromGLTF(rig({ punctuated: true, rootName: 'Rig_Medium' }));
  assert.match(mapped.leftLowerArm.name, /lowerarm\.l$/);
});

test('KayKit rig mapping fails closed on missing required bones instead of root labels', () => {
  assert.throws(() => kaykitHumanoidFromGLTF(rig({ omit: 'foot.r' })), /rightFoot/);
  const scene = new THREE.Group();
  assert.throws(() => kaykitHumanoidFromGLTF({ scene }), /bones missing/);
});

test('KayKit rig mapping fails closed when required bones exist but humanoid ancestry is broken', () => {
  assert.throws(() => kaykitHumanoidFromGLTF(rig({ breakRightFoot: true })), /hierarchy invalid: rightFoot must descend from rightLowerLeg/i);
});
