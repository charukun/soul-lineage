import assert from 'node:assert/strict';
import test from 'node:test';
import { Bone, Group } from 'three';
import {
  ARCANIST_ATLAS_STUDY_ID,
  ARCANIST_ATLAS_STUDY_STAGE,
  attachArcanistAtlasStudy
} from '../src/arcanist-atlas-study.js';

const palette = Object.freeze({
  hair: [.36,.30,.35], primary: [.30,.24,.42], secondary: [.64,.58,.70],
  accent: [.65,.54,.32], dark: [.13,.11,.16], metal: [.55,.52,.61],
  leather: [.25,.18,.23], wood: [.31,.23,.29]
});

function makeActor() {
  const root = new Group();
  const bones = Object.create(null);
  for (const name of ['head','spine','leftLowerArm','rightLowerArm']) {
    const bone = new Bone();
    bone.name = name;
    bones[name] = bone;
    root.add(bone);
  }
  return { root, bones };
}

function reference() {
  return {
    id: ARCANIST_ATLAS_STUDY_ID,
    referenceStyle: { palette }
  };
}

test('Arcanist Atlas study attaches a distinct BLOCKOUT detail layer and disposes it', () => {
  const actor = makeActor();
  const study = attachArcanistAtlasStudy(actor, reference());

  assert.equal(study.id, ARCANIST_ATLAS_STUDY_ID);
  assert.equal(study.stage, ARCANIST_ATLAS_STUDY_STAGE);
  assert.equal(study.modelingMode, 'runtime-procedural');
  assert.equal(study.productionReady, false);
  assert.ok(study.meshCount >= 30, `expected a substantial authored detail layer, got ${study.meshCount}`);

  const names = [];
  actor.root.traverse(node => names.push(node.name));
  for (const expected of [
    'atlas:hair-lock-left',
    'atlas:glasses-bridge',
    'atlas:mantle-back',
    'atlas:robe-panel-left',
    'atlas:scroll-tube-a',
    'atlas:satchel-body',
    'atlas:staff-halo',
    'atlas:book-pages'
  ]) assert.ok(names.includes(expected), `missing ${expected}`);

  study.destroy();
  const remaining = [];
  actor.root.traverse(node => { if (node.name.startsWith('atlas:')) remaining.push(node.name); });
  assert.deepEqual(remaining, []);
  assert.doesNotThrow(() => study.destroy());
});

test('Arcanist Atlas study fails closed for another reference id', () => {
  const actor = makeActor();
  assert.throws(
    () => attachArcanistAtlasStudy(actor, { ...reference(), id: 'arcanist.reference.v1' }),
    /Unexpected Arcanist Atlas Study reference/
  );
});
