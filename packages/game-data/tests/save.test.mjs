import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveEnvelope, readSaveEnvelope } from '../src/index.js';
test('portable saves preserve data and reject foreign game/player or future schema', () => {
  const payload = { worldId: 'village.foundation.v1', score: 0 };
  const save = createSaveEnvelope({ gameId: 'rinne', playerId: 'global-123', payload, updatedAt: 1 });
  payload.score = 99; assert.equal(save.payload.score, 0);
  assert.deepEqual(readSaveEnvelope(save, { gameId: 'rinne', playerId: 'global-123' }), save);
  assert.throws(() => readSaveEnvelope(save, { gameId: 'demon', playerId: 'global-123' }));
  assert.throws(() => readSaveEnvelope({ ...save, schemaVersion: 2 }, { gameId: 'rinne', playerId: 'global-123' }));
});
