import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { graph, apps, affected, affectedForDev, closure, inputHash, toolingPath, workspaceManifestPath, devBuildToolingPath } from '../scripts/workspaces.mjs';
const nodes = graph();
const all = apps(nodes).map(n => n.id);
const gameApps = ['demon', 'rinne', 'village'];
test('one app change selects only that app', () => assert.deepEqual(affected(nodes, ['apps/village/src/app.js']), ['village']));
test('transitive shared assets and platform changes select their consumers', () => {
  assert.deepEqual(affected(nodes, ['packages/assets/src/index.js']), gameApps);
  assert.deepEqual(affected(nodes, ['packages/platform/src/index.js']), gameApps);
});
test('shared motion quality reaches all rendering consumers', () => assert.deepEqual(affected(nodes, ['packages/animations/src/index.js']), gameApps));
test('shared MURA world/rendering updates reach all consumers', () => {
  for (const file of ['packages/world/src/mura/catalog.js', 'packages/rendering/src/mura/models.js']) assert.deepEqual(affected(nodes, [file]), gameApps);
});
test('audio and character shared contracts reach all current apps',()=>{assert.deepEqual(affected(nodes,['packages/audio/src/index.js']),gameApps);assert.deepEqual(affected(nodes,['packages/characters/src/master-character.js']),gameApps);});
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
test('DEV control-plane files do not rebuild games while runtime/config and build tooling stay scoped or fail closed', () => {
  assert.deepEqual(affectedForDev(nodes, ['README.md', 'docs/PLATFORMS.md', '.github/workflows/ci.yml', 'scripts/integration-fast-lane.mjs', 'scripts/deploy.mjs', 'tests/integration.test.mjs']), []);
  assert.deepEqual(affectedForDev(nodes, ['apps/village/src/app.js']), ['village']);
  assert.deepEqual(affectedForDev(nodes, ['packages/assets/src/index.js']), gameApps);
  for (const path of ['package-lock.json', 'scripts/vite-app.mjs', 'scripts/workspaces.mjs', 'scripts/application-catalog.mjs', 'scripts/prepare-basis-assets.mjs', 'scripts/prepare-kaykit-foundation.mjs', 'scripts/strip-retired-character-assets.mjs', 'scripts/verify-build.mjs', 'scripts/unknown-tool.mjs', 'new.config.js']) assert.deepEqual(affectedForDev(nodes, [path]), all, path);
});
test('DEV deployment hashes include only build-affecting root tooling', () => {
  for (const path of ['package.json', 'package-lock.json', 'scripts/vite-app.mjs', 'scripts/workspaces.mjs', 'scripts/application-catalog.mjs', 'scripts/prepare-basis-assets.mjs', 'scripts/prepare-kaykit-foundation.mjs', 'scripts/strip-retired-character-assets.mjs', 'scripts/verify-build.mjs']) assert.equal(devBuildToolingPath(path), true, path);
  for (const path of ['.github/workflows/ci.yml', 'scripts/integration-fast-lane.mjs', 'scripts/deploy.mjs', 'tests/integration.test.mjs', 'docs/INTEGRATION.md']) assert.equal(devBuildToolingPath(path), false, path);
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
  } finally { rmSync(root, { recursive:true, force:true }); }
});
test('DEV input hash ignores control-plane scripts while Production input hash remains conservative', () => {
  const root = mkdtempSync(join(tmpdir(), 'soul-dev-hash-'));
  const write = (path, body) => { const absolute = join(root, path); mkdirSync(join(absolute, '..'), { recursive: true }); writeFileSync(absolute, body); };
  try {
    execFileSync('git', ['init', '-q', root]);
    mkdirSync(join(root, 'packages'), { recursive: true });
    write('apps/one/package.json', JSON.stringify({ name: '@soul/one' }));
    write('apps/one/main.js', 'export const value = 1;');
    write('scripts/integration-fast-lane.mjs', 'export const lane = 1;');
    write('scripts/vite-app.mjs', 'export const build = 1;');
    write('scripts/workspaces.mjs', 'export const graph = 1;');
    write('scripts/application-catalog.mjs', 'export const apps = 1;');
    write('package.json', JSON.stringify({ workspaces: ['apps/*'] }));
    const g = graph(root);
    const devBefore = inputHash(root, g, 'one', 'dev');
    const prodBefore = inputHash(root, g, 'one', 'prod');
    write('scripts/integration-fast-lane.mjs', 'export const lane = 2;');
    assert.equal(inputHash(root, g, 'one', 'dev'), devBefore);
    assert.notEqual(inputHash(root, g, 'one', 'prod'), prodBefore);
    write('scripts/vite-app.mjs', 'export const build = 2;');
    assert.notEqual(inputHash(root, g, 'one', 'dev'), devBefore);
  } finally { rmSync(root, { recursive:true, force:true }); }
});
