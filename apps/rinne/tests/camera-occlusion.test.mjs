import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const renderer = await readFile(new URL('../src/rebuild/renderer.js', import.meta.url), 'utf8');

test('Rinne scopes player visibility fading to outdoor layout objects', () => {
  assert.match(renderer, /createForegroundOcclusionFader/);
  assert.match(renderer, /occluderRoot:objects/);
  assert.match(renderer, /enabled:village&&!inside/);
  assert.match(renderer, /dataset\.occludedObjects/);
  assert.doesNotMatch(renderer, /occluderRoot:(?:root|land|stationsRoot)/);
});
