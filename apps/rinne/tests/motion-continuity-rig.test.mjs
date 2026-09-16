import test from 'node:test';
import assert from 'node:assert/strict';
import {
  WORKSHOP_MOTION_SOURCE_STATE,
  loadWorkshopMotionSource
} from '../src/character-motion-source.js';

test('continuous-correction QA fails closed instead of loading the retired conditional rig', async () => {
  let resolved=false,read=false;
  await assert.rejects(loadWorkshopMotionSource({
    resolveModule:async()=>{resolved=true;},
    readAsset:async()=>{read=true;}
  }),/Motion QA source retired/);
  assert.equal(WORKSHOP_MOTION_SOURCE_STATE,'retired-conditional-model');
  assert.equal(resolved,false);
  assert.equal(read,false);
});
