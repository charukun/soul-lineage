import test from 'node:test';
import assert from 'node:assert/strict';
import {KAYKIT_DEFAULT_MODEL_ID,KAYKIT_RIG_ID} from '@soul/characters';
import {loadWorkshopMotionSource} from '../src/character-motion-source.js';

test('motion-quality review rejects the retired Shino/VRMA pipeline and keeps the clean rig target explicit', async () => {
  await assert.rejects(loadWorkshopMotionSource({
    resolveModule:async()=>{throw new Error('retired source must not resolve runtime modules');},
    readAsset:async()=>{throw new Error('retired source must not read assets');}
  }),/conditional Shino runtime asset is not distributable/);
  assert.match(KAYKIT_DEFAULT_MODEL_ID,/^kaykit\./);
  assert.equal(KAYKIT_RIG_ID,'Rig_Medium');
});
