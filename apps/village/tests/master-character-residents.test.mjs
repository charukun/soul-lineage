import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  MASTER_RESIDENT_RENDERER_STATE,
  MASTER_RESIDENT_REPLACEMENT
} from '../src/mura-master-characters.js';

test('legacy conditional resident renderer stays retired without asset loading side effects', () => {
  assert.equal(MASTER_RESIDENT_RENDERER_STATE, 'retired-conditional-model');
  assert.equal(MASTER_RESIDENT_REPLACEMENT, 'procedural-resident-presentation');

  const source = readFileSync(new URL('../src/mura-master-characters.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /SHINO_review|createShinoProductionPool|GLTFLoader|fetch\s*\(/);
});
