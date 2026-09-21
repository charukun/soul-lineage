import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBuildingObject,
  createPlaceableObject,
  defineWorldObject
} from '../src/world-object.js';

const house = () => createBuildingObject({
  id: 'house-01',
  kind: 'cottage',
  assetId: 'house-cottage',
  footprint: [2.8, 2.7],
  entrances: [{
    id: 'front',
    outside: { position: [0, 0, 1.9], rotation: [0, Math.PI, 0] },
    inside: { position: [0, 0, 0.8], rotation: [0, 0, 0] }
  }],
  housing: { floors: 1, ownerId: 'family-01' }
});

test('building wrapper owns placement and entrance transitions independent from render nodes', () => {
  const object = house();
  assert.equal(object.has('housing'), true);
  assert.equal(object.canInteract('enter'), true);

  object.place({ position: [12, 0, -4], rotation: [0, 1.2, 0] });
  assert.deepEqual(object.state.transform.position, [12, 0, -4]);

  const entered = object.enter();
  assert.equal(entered.type, 'enter');
  assert.deepEqual(entered.transform.position, [0, 0, 0.8]);
  assert.deepEqual(object.state.interior, { entranceId: 'front', destination: 'house-01' });

  const exited = object.exit();
  assert.equal(exited.type, 'exit');
  assert.deepEqual(exited.transform.position, [0, 0, 1.9]);
  assert.equal(object.state.interior, null);
});

test('door state and snapshots are keyed by semantic entrance rather than mesh names', () => {
  const object = house();
  assert.equal(object.setDoorOpen('front', true), true);
  const snapshot = object.snapshot();
  assert.deepEqual(snapshot.doorStates, { front: true });
  snapshot.doorStates.front = false;
  assert.equal(object.state.doorStates.front, true);
  assert.throws(() => object.setDoorOpen('missing', true), /Unknown entrance/);
});

test('placeable furniture exposes actions and interaction points without renderer coupling', () => {
  const chair = createPlaceableObject({
    id: 'chair-01',
    kind: 'chair',
    footprint: [0.65, 0.65],
    actions: ['sit'],
    interactionPoints: [{
      id: 'seat',
      action: 'sit',
      position: [0, 0.5, 0],
      rotation: [0, Math.PI, 0]
    }]
  });

  assert.equal(chair.canInteract('sit'), true);
  assert.equal(chair.canInteract('rest'), false);
  assert.deepEqual(chair.interactionPoint('sit', 'seat').position, [0, 0.5, 0]);
});

test('invalid enterable and placeable definitions fail at the wrapper boundary', () => {
  assert.throws(() => defineWorldObject({
    kind: 'broken-house',
    components: { enterable: { entrances: [] } }
  }), /at least one entrance/);

  assert.throws(() => defineWorldObject({
    kind: 'broken-chair',
    components: { placeable: { footprint: [1] } }
  }), /footprint/);
});
