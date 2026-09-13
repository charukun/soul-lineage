import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('PULSE links and renders the character reference library from shared state', () => {
  const index = read('ops-board/public/index.html');
  const page = read('ops-board/public/character-references.html');
  const ui = read('ops-board/public/character-references.js');
  const collector = read('ops-board/collector.mjs');

  assert.match(index, /character-references\.html/);
  assert.match(page, /id="reference-groups"/);
  assert.match(ui, /state\?\.characterReferences/);
  assert.doesNotMatch(ui, /api\.github\.com/);
  assert.match(collector, /collectCharacterReferences/);
  assert.match(collector, /characterReferences/);
});
