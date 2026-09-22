import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const renderer = await readFile(new URL('../src/rebuild/renderer.js', import.meta.url), 'utf8');
const adapter = await readFile(new URL('../src/rebuild/presentation-camera.js', import.meta.url), 'utf8');
test('Rinne fades scoped scenery, interior walls and forest instances using actor silhouettes, never actor roots', () => {
  assert.match(renderer, /createForegroundOcclusionFader/);
  assert.match(renderer, /targets:cameraFrame\.samples/);
  assert.match(renderer, /occluderRoots:inside\?\[interiorGroups\.get\(state\.interior\.buildingId\)\]:\[objects,stationsRoot\]/);
  assert.match(renderer, /instanceOccluders:inside\?\[\]:terrain\.forestMeshes/);
  assert.match(renderer, /enabled:village&&!titleFrame/);
  assert.match(renderer, /dataset\.occludedObjects/);
  assert.doesNotMatch(renderer, /occluderRoot:(?:root|land|stationsRoot)/);
  assert.match(adapter, /actorSilhouetteSamples\(actor\)/);
  assert.match(adapter, /resolveCharacterView/);
  assert.doesNotMatch(adapter, /state\.yaw\s*=/);
});
