import test from 'node:test';
import assert from 'node:assert/strict';
import { Bone, BoxGeometry, Group, Mesh, MeshStandardMaterial } from 'three';
import { attachModularAppearanceController } from '../src/master-character-modular.js';

function actorFixture() {
  const root = new Group(), visual = new Group(); root.add(visual);
  const hips = new Bone(), spine = new Bone(), head = new Bone();
  hips.name = 'hips'; spine.name = 'spine'; head.name = 'head'; hips.add(spine); spine.add(head); visual.add(hips);
  const hair = new Mesh(new BoxGeometry(.1, .1, .1), new MeshStandardMaterial({ name: 'HAIR' })); visual.add(hair);
  const actor = {
    root, visual, bones: { hips, spine, head }, secondaryResets: 0,
    sample(appearance) { this.lastAppearance = appearance; root.scale.set(1, 1, 1); head.scale.set(1, 1, 1); },
    reset() { root.scale.set(1, 1, 1); head.scale.set(1, 1, 1); },
    resetSecondary() { this.secondaryResets++; },
    destroy() { hair.geometry.dispose(); hair.material.dispose(); }
  };
  return { actor, hair };
}

const appearance = { hair: [.2, .1, .05], dye: [.6, .7, .8] };

test('modular controller changes silhouette after the canonical actor sample', () => {
  const { actor, hair } = actorFixture();
  const controller = attachModularAppearanceController(actor);
  controller.setProfile({ version: 1, face: 'round', hair: 'bob', body: 'sturdy', outfit: 'mantle', accessory: 'glasses' });
  actor.sample(appearance);
  assert.ok(actor.root.scale.x > 1.05);
  assert.ok(actor.bones.head.scale.x > 1.05);
  assert.equal(hair.material.visible, false);
  assert.equal(actor.visual.getObjectByName('hair:bob')?.visible, true);
  assert.equal(actor.visual.getObjectByName('outfit:mantle')?.visible, true);
  assert.equal(actor.visual.getObjectByName('accessory:glasses')?.visible, true);
  assert.ok(actor.secondaryResets >= 1);
  actor.destroy();
});

test('reset restores the unmodified Shino presentation', () => {
  const { actor, hair } = actorFixture();
  const controller = attachModularAppearanceController(actor);
  controller.setProfile({ version: 1, face: 'long', hair: 'crop', body: 'compact', outfit: 'apron', accessory: 'headband' });
  actor.sample(appearance); actor.reset(); actor.sample(appearance);
  assert.equal(hair.material.visible, true);
  assert.deepEqual(actor.root.scale.toArray(), [1, 1, 1]);
  assert.deepEqual(actor.bones.head.scale.toArray(), [1, 1, 1]);
  assert.equal(controller.profile.hair, 'original');
  actor.destroy();
});

test('invalid modular part identifiers fail closed', () => {
  const { actor } = actorFixture();
  const controller = attachModularAppearanceController(actor);
  assert.throws(() => controller.setProfile({ version: 1, face: 'classic', hair: 'mohawk', body: 'balanced', outfit: 'uniform', accessory: 'none' }), /Invalid modular appearance hair/);
  actor.destroy();
});
