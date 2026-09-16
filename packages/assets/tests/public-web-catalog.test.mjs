import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { PUBLIC_WEB_ASSET_SOURCES, publicWebAssetCatalog, publicWebAssetsForApp } from '../src/public-web-catalog.js';

const repoRoot = new URL('../../../', import.meta.url);
const phase2ManifestUrl = new URL('assets/vendor/public-web/PHASE2_MANIFEST.json', repoRoot);

function assertLocalPath(path) {
  assert.ok(existsSync(new URL(path, repoRoot)), `${path} missing`);
}

test('public web catalog keeps only redistributable audited sources', () => {
  for (const [id, source] of Object.entries(PUBLIC_WEB_ASSET_SOURCES)) {
    assert.equal(source.redistributionAllowed, true, `${id}: redistribution must be explicit`);
    assert.match(source.license, /^(CC0-1\.0|MIT)$/);
    assert.match(source.canonicalUrl, /^https:\/\//);
  }
  for (const app of ['rinne', 'village', 'demon']) {
    assert.equal(publicWebAssetsForApp(app).length, Object.keys(publicWebAssetCatalog).length);
  }
});

test('materialized public web assets are repository local', () => {
  const materialized = publicWebAssetsForApp('rinne', { statuses: ['MATERIALIZED'] });
  assert.equal(materialized.length, 19);
  for (const item of materialized) {
    if (item.localPath) assertLocalPath(item.localPath);
    if (item.localPaths) Object.values(item.localPaths).forEach(assertLocalPath);
    assert.ok(item.localPath || item.localPaths, `${item.sourceId}: materialized item needs local files`);
    assert.match(PUBLIC_WEB_ASSET_SOURCES[item.sourceId].license, /^(CC0-1\.0|MIT)$/);
  }
  const license = readFileSync(new URL('assets/vendor/public-web/stegu-webgl-noise/LICENSE', repoRoot), 'utf8');
  assert.match(license, /Permission is hereby granted, free of charge/);
});

test('phase 2 manifest pins and hashes every imported binary', () => {
  assert.ok(existsSync(phase2ManifestUrl), 'phase 2 manifest missing');
  const manifest = JSON.parse(readFileSync(phase2ManifestUrl, 'utf8'));
  assert.equal(manifest.auditDate, '2026-09-16');
  assert.equal(manifest.files.length, 19);
  for (const file of manifest.files) {
    assert.match(file.license, /^CC0-1\.0$/);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assertLocalPath(file.path);
    const actual = createHash('sha256').update(readFileSync(new URL(file.path, repoRoot))).digest('hex');
    assert.equal(actual, file.sha256, `${file.path}: sha256 mismatch`);
  }
});

test('remote candidates never masquerade as local runtime assets', () => {
  for (const item of Object.values(publicWebAssetCatalog).filter(item => item.status === 'AUDITED_REMOTE_CANDIDATE')) {
    assert.equal(item.localPath, undefined);
    assert.equal(item.localPaths, undefined);
    assert.equal(item.runtimeUrl, undefined);
  }
  assert.throws(() => publicWebAssetsForApp('unknown'), /Unknown app/);
});
