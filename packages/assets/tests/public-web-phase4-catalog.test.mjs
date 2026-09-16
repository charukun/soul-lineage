import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_WEB_PHASE4_SOURCES,
  publicWebPhase4AssetCatalog,
  publicWebPhase4AssetsForApp,
} from '../src/public-web-phase4-catalog.js';

const repoRoot = fileURLToPath(new URL('../../../', import.meta.url));
const resolveRepo = relativePath => new URL(relativePath, `file://${repoRoot.replace(/\\/g, '/')}/`);

async function sha256(relativePath) {
  const buffer = await readFile(resolveRepo(relativePath));
  return createHash('sha256').update(buffer).digest('hex');
}

const sourceIds = Object.keys(PUBLIC_WEB_PHASE4_SOURCES);
assert.deepEqual(sourceIds, [
  'kenney-mini-forest',
  'kenney-foliage-sprites',
  'kenney-smoke-particles',
  'kenney-light-masks-phase4',
  'polyhaven-wood-planks',
]);

for (const [sourceId, source] of Object.entries(PUBLIC_WEB_PHASE4_SOURCES)) {
  assert.equal(source.license, 'CC0-1.0');
  assert.equal(source.redistributionAllowed, true);
  const manifest = JSON.parse(await readFile(resolveRepo(source.manifest), 'utf8'));
  assert.equal(manifest.sourceId, sourceId);
  assert.equal(manifest.license, 'CC0-1.0');
  assert.ok(Array.isArray(manifest.files) && manifest.files.length > 0);
  for (const file of manifest.files) {
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assert.equal(await sha256(file.path), file.sha256, `sha256 mismatch: ${file.path}`);
    if (source.mirrorCommit) {
      assert.equal(manifest.commit, source.mirrorCommit);
      assert.match(file.gitBlob, /^[0-9a-f]{40}$/);
    }
  }
}

const assets = Object.values(publicWebPhase4AssetCatalog);
assert.equal(assets.length, 22);
assert.equal(assets.every(item => item.status === 'MATERIALIZED'), true);
for (const appId of ['rinne', 'village', 'demon']) {
  assert.equal(publicWebPhase4AssetsForApp(appId).length, assets.length);
  assert.equal(publicWebPhase4AssetsForApp(appId, { statuses: ['MATERIALIZED'] }).length, assets.length);
}
assert.throws(() => publicWebPhase4AssetsForApp('unknown'), /Unknown app/);

for (const item of assets) {
  if (item.localPath) await readFile(resolveRepo(item.localPath));
  if (item.localPaths) {
    for (const path of Object.values(item.localPaths)) await readFile(resolveRepo(path));
  }
}

for (const [id, item] of Object.entries(publicWebPhase4AssetCatalog)) {
  if (!item.localPath?.endsWith('.glb')) continue;
  const glb = await readFile(resolveRepo(item.localPath));
  assert.equal(glb.subarray(0, 4).toString('ascii'), 'glTF', `${id} is not a GLB`);
  assert.equal(glb.readUInt32LE(4), 2, `${id} is not glTF 2.0`);
}

console.log(`validated ${assets.length} phase 4 shared public-web assets across ${sourceIds.length} CC0 sources`);
