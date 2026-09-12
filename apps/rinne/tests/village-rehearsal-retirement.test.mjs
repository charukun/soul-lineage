import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = path => readFileSync(new URL(path, root), 'utf8');

test('retired Village Rehearsal is not a source, static asset, or build entry', () => {
  assert.equal(existsSync(new URL('village-rehearsal.html', root)), false);
  assert.equal(existsSync(new URL('public/village-rehearsal.html', root)), false);
  assert.doesNotMatch(read('vite.config.js'), /village-rehearsal\.html/);
});

test('retirement preserves the main and character-review build entries', () => {
  const config = read('vite.config.js');
  for (const page of ['./index.html', './characters.html', './characters-advanced.html']) {
    assert.ok(config.includes(`new URL('${page}',import.meta.url)`), `${page} remains a build input`);
  }
});

test('main game keeps village joining and opt-in host migration diagnostics', () => {
  const main = read('src/main.js');
  assert.match(main, /installOnlinePlayer\(document\.getElementById\('village-panel'\)\)/);
  assert.match(main, /getElementById\('open-village'\)\.addEventListener\('click'/);
  assert.match(main, /new URLSearchParams\(location\.search\)\.has\('villageHostLab'\)/);
  assert.match(main, /lab\s*=\s*installVillageHostRehearsal\(/);
});
