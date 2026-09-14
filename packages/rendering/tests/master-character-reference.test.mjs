import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { CHARACTER_REFERENCE_MODELS } from '../../characters/src/reference-models.js';
import { attachModularAppearanceController } from '../src/master-character-modular.js';
import { attachReferenceCharacterController } from '../src/master-character-reference.js';

function bone(name, position = [0,0,0]) {
  const value = new Bone(); value.name = name; value.position.set(...position); return value;
}

function actorFixture() {
  const root = new Group(), visual = new Group(); root.add(visual);
  const hips=bone('hips'), spine=bone('spine',[0,.45,0]), head=bone('head',[0,.34,0]);
  hips.add(spine); spine.add(head);
  const leftUpperArm=bone('leftUpperArm',[-.18,.23,0]), leftLowerArm=bone('leftLowerArm',[-.27,0,0]), leftHand=bone('leftHand',[-.25,0,0]);
  const rightUpperArm=bone('rightUpperArm',[.18,.23,0]), rightLowerArm=bone('rightLowerArm',[.27,0,0]), rightHand=bone('rightHand',[.25,0,0]);
  spine.add(leftUpperArm,rightUpperArm); leftUpperArm.add(leftLowerArm); leftLowerArm.add(leftHand); rightUpperArm.add(rightLowerArm); rightLowerArm.add(rightHand);
  const leftUpperLeg=bone('leftUpperLeg',[-.09,-.02,0]), leftLowerLeg=bone('leftLowerLeg',[0,-.42,0]), leftFoot=bone('leftFoot',[0,-.40,.06]);
  const rightUpperLeg=bone('rightUpperLeg',[.09,-.02,0]), rightLowerLeg=bone('rightLowerLeg',[0,-.42,0]), rightFoot=bone('rightFoot',[0,-.40,.06]);
  hips.add(leftUpperLeg,rightUpperLeg); leftUpperLeg.add(leftLowerLeg); leftLowerLeg.add(leftFoot); rightUpperLeg.add(rightLowerLeg); rightLowerLeg.add(rightFoot);
  visual.add(hips);
  const source = new Mesh(new BoxGeometry(.2,.5,.12), new MeshStandardMaterial({ name: 'BODY' })); source.name='source-body'; visual.add(source);
  const hair = new Mesh(new BoxGeometry(.1,.1,.1), new MeshStandardMaterial({ name: 'HAIR' })); hair.name='source-hair'; visual.add(hair);
  const bones={hips,spine,head,leftUpperArm,leftLowerArm,leftHand,rightUpperArm,rightLowerArm,rightHand,leftUpperLeg,leftLowerLeg,leftFoot,rightUpperLeg,rightLowerLeg,rightFoot};
  const actor={root,visual,bones,sample(){root.scale.set(1,1,1);head.scale.set(1,1,1);},reset(){root.scale.set(1,1,1);head.scale.set(1,1,1);},resetSecondary(){},destroy(){source.geometry.dispose();source.material.dispose();hair.geometry.dispose();hair.material.dispose();}};
  return {actor,source,hair};
}

const appearance={hair:[.25,.18,.12],dye:[.7,.8,.7]};

test('all reference sheets build selectable runtime geometry on the common humanoid rig', () => {
  const {actor,source}=actorFixture();
  const modular=attachModularAppearanceController(actor);
  const reference=attachReferenceCharacterController(actor);
  for (const model of Object.values(CHARACTER_REFERENCE_MODELS)) {
    modular.setIdentity(model);
    reference.setIdentity(model);
    actor.sample(appearance);
    const marker=actor.visual.getObjectByName(`reference-character:${model.id}`);
    assert.ok(marker, model.id);
    assert.equal(source.visible,false,model.id);
    assert.equal(reference.diagnostics().activeId,model.id);
    assert.ok(reference.diagnostics().meshCount >= 12, `${model.id} has too little geometry`);
    assert.ok(actor.root.scale.x < 1.05, `${model.id} reference scale was not applied`);
  }
  reference.setIdentity(null);
  assert.equal(source.visible,true);
  assert.equal(reference.diagnostics().activeId,null);
  actor.destroy();
});
