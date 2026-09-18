import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { productionArtProfileForActorId } from '../src/master-character-production-stylized.js';
const source=fs.readFileSync(new URL('../src/master-character-production-stylized.js',import.meta.url),'utf8');

test('production art role keeps one Shino target above population budget', () => {
  assert.equal(productionArtProfileForActorId('review.1000.0'), 'hero');
  assert.equal(productionArtProfileForActorId('review.1000.1'), 'npc');
  assert.equal(productionArtProfileForActorId('village.abc.4'), 'npc');
  assert.equal(productionArtProfileForActorId('character.Sendagaya_Shino'), 'hero');
  assert.equal(productionArtProfileForActorId('character.sendagaya-shino.v1'), 'hero');
});

test('population animation consumes crowd Hz while Hero ignores crowd throttling',()=>{
  assert.match(source,/crowdAnimationHz/);
  assert.match(source,/profileId==='hero'\?0/);
  assert.match(source,/crowdLimited/);
});
