import { test } from 'node:test';
import assert from 'node:assert/strict';
import { storageScope, definePlatform } from '../src/index.js';
test('local saves cannot collide across games, environments or players', () => {
  const keys = new Set(); for (const environment of ['dev', 'prod']) for (const gameId of ['rinne','village','demon']) for (const playerId of ['guest','player-1']) keys.add(storageScope({ environment, gameId, playerId }));
  assert.equal(keys.size, 12); assert.throws(() => storageScope({ environment: 'dev', gameId: '../rinne' }));
});
test('incomplete platform adapters fail immediately', () => assert.throws(() => definePlatform({ id: 'web', contractVersion: 1 })));
