import test from 'node:test';
import assert from 'node:assert/strict';
import { productionArtProfileForActorId } from '../src/master-character-production-stylized.js';

test('production art role keeps one Shino target above population budget', () => {
  assert.equal(productionArtProfileForActorId('review.1000.0'), 'hero');
  assert.equal(productionArtProfileForActorId('review.1000.1'), 'npc');
  assert.equal(productionArtProfileForActorId('village.abc.4'), 'npc');
  assert.equal(productionArtProfileForActorId('character.Sendagaya_Shino'), 'hero');
  assert.equal(productionArtProfileForActorId('character.sendagaya-shino.v1'), 'hero');
});