import test from 'node:test';
import assert from 'node:assert/strict';
import { createCharacterRuntimeAdapter } from '../src/runtime-character-contract.js';
import { createCharacterModelWrapper } from '../src/character-model-wrapper.js';

function runtime() {
  return createCharacterRuntimeAdapter({
    id: 'test.runtime',
    family: 'test.family',
    rigFamily: 'TestRig',
    format: 'glb',
    asset: { id: 'test.asset' },
    geometry: { sockets: { weapon: 'rightHand', offhand: 'leftHand', head: 'head' } },
    motion: { idle: 'idle-route', walk: 'walk-route', attack: 'attack-route' }
  });
}

function fakeActor(id = 'actor-1') {
  const calls = [];
  const actor = {
    id,
    root: { userData: { characterModel: 'model-a' } },
    visual: { kind: 'visual' },
    bones: { rightHand: { name: 'rightHand' }, leftHand: { name: 'leftHand' }, head: { name: 'head' } },
    attachments: { kind: 'attachments' },
    motionRest: { height: 1 },
    setClip(clip) { calls.push(['clip', clip]); },
    sample(...args) { calls.push(['sample', ...args]); },
    attachWeapon(...args) { calls.push(['attach', ...args]); return 'attached'; },
    detachWeapon(...args) { calls.push(['detach', ...args]); return 'detached'; },
    updateAttachments(...args) { calls.push(['update', ...args]); },
    setVisible(...args) { calls.push(['visible', ...args]); },
    reset(...args) { calls.push(['reset', ...args]); }
  };
  return { actor, calls };
}

test('character model wrapper exposes one semantic API over a runtime actor', () => {
  const { actor, calls } = fakeActor();
  const wrapper = createCharacterModelWrapper({ actor, adapter: runtime() });
  assert.equal(wrapper.schema, 'soul.character-model-wrapper');
  assert.equal(wrapper.modelId, 'model-a');
  assert.equal(wrapper.getBone('weapon'), actor.bones.rightHand);
  assert.equal(wrapper.getBone('offhand'), actor.bones.leftHand);
  assert.equal(wrapper.play('attack').route, 'attack-route');
  assert.equal(actor.root.userData.characterRuntimeState, 'attack');
  assert.equal(actor.root.userData.characterRuntimeRoute, 'attack-route');
  assert.equal(wrapper.attachEquipment('weapon', { mesh: true }, { position: [0, 0, 0] }), 'attached');
  assert.deepEqual(calls.at(-1)[3], { position: [0, 0, 0], bone: 'rightHand' });
  assert.equal(wrapper.detachEquipment('weapon'), 'detached');
});

test('wrapper follows a swapped pooled actor without changing the game-facing handle', () => {
  const first = fakeActor('actor-1');
  const second = fakeActor('actor-2');
  let slot = first.actor;
  let model = 'model-a';
  const wrapper = createCharacterModelWrapper({
    actor: () => slot,
    adapter: runtime(),
    modelId: () => model
  });
  assert.equal(wrapper.id, 'actor-1');
  assert.equal(wrapper.modelId, 'model-a');
  slot = second.actor;
  model = 'model-b';
  assert.equal(wrapper.id, 'actor-2');
  assert.equal(wrapper.modelId, 'model-b');
  wrapper.setVisible(false);
  assert.deepEqual(second.calls.at(-1), ['visible', false]);
  assert.equal(first.calls.length, 0);
});

test('missing motions keep the adapter fallback contract instead of inventing model-specific behavior', () => {
  const { actor } = fakeActor();
  const wrapper = createCharacterModelWrapper({ actor, adapter: runtime() });
  const result = wrapper.play('death');
  assert.equal(result.requestedState, 'death');
  assert.equal(result.resolvedState, 'idle');
  assert.equal(result.route, 'idle-route');
  assert.equal(result.fallback, true);
});
