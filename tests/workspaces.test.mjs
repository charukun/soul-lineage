import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { graph, apps, affected, closure, inputHash, toolingPath, workspaceManifestPath } from '../scripts/workspaces.mjs';
const nodes = graph();
const all = apps(nodes).map(n => n.id);
test('one app change selects only that app', () => assert.deepEqual(affected(nodes, ['apps/village/src/app.js']), ['village']));
test('transitive shared assets and platform changes select their consumers', () => {
  assert.deepEqual(affected(nodes, ['packages/assets/src/index.js']), all);
  assert.deepEqual(affected(nodes, ['packages/platform/src/index.js']), all);
});
test('unused packages do not build unrelated games', () => assert.deepEqual(affected(nodes, ['packages/animations/src/index.js']), []));
test('audio and character shared contracts reach all current apps',()=>{assert.deepEqual(affected(nodes,['packages/audio/src/index.js']),all);assert.deepEqual(affected(nodes,['packages/characters/src/master-character.js']),all);});
test('workspace manifests are dependency-graph inputs without widening ordinary tooling paths', () => {
  for (const path of ['apps/demon/package.json', 'apps/rinne/package.json', 'packages/characters/package.json']) {
    assert.equal(workspaceManifestPath(path), true);
    assert.equal(toolingPath(path), false);
  }
  assert.equal(workspaceManifestPath('package.json'), false);
  assert.equal(toolingPath('package.json'), true);
});
test('docs skip apps; lock/config and unknown/deleted paths fail closed', () => {
  assert.deepEqual(affected(nodes, ['README.md', 'docs/PLATFORMS.md']), []);
  for (const path of ['package-lock.json', 'scripts/deploy.mjs', 'packages/removed/src/main.js', 'new.config.js']) assert.deepEqual(affected(nodes, [path]), all);
});
test('workspace cycles are rejected', () => {
  const fake = new Map([['a', { dependencies: ['b'] }], ['b', { dependencies: ['a'] }]]);
  assert.throws(() => closure(fake, 'a'), /cycle/);
});
test('input hashes isolate apps, include transitive dependencies and environment, ignore docs', () => {
  const root = mkdtempSync(join(tmpdir(), 'soul-graph-'));
  const write = (path, body) => { const absolute = join(root, path); mkdirSync(join(absolute, '..'), { recursive: true }); writeFileSync(absolute, body); };
  try {
    execFileSync('git', ['init', '-q', root]);
    for (const id of ['one', 'two']) write(`apps/${id}/package.json`, JSON.stringify({ name: `@soul/${id}`, dependencies: { '@soul/common': '*' } }));
    write('packages/common/package.json', JSON.stringify({ name: '@soul/common' }));
    write('packages/common/src/index.js', 'export const value = 1;');
    const g = graph(root), before = inputHash(root, g, 'one', 'dev');
    write('apps/two/main.js', 'changed'); write('README.md', 'docs');
    assert.equal(inputHash(root, g, 'one', 'dev'), before);
    assert.notEqual(inputHash(root, g, 'one', 'prod'), before);
    write('packages/common/src/index.js', 'export const value = 2;');
    assert.notEqual(inputHash(root, g, 'one', 'dev'), before);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
