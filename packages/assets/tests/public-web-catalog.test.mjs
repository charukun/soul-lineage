import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUBLIC_WEB_ASSET_SOURCES, publicWebAssetCatalog, publicWebAssetsForApp } from '../src/public-web-catalog.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

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
  assert.equal(materialized.length, 2);
  for (const item of materialized) {
    assert.ok(item.localPath);
    assert.ok(existsSync(resolve(repoRoot, item.localPath)), `${item.localPath} missing`);
    assert.equal(PUBLIC_WEB_ASSET_SOURCES[item.sourceId].license, 'MIT');
  }
  const license = readFileSync(resolve(repoRoot, 'assets/vendor/public-web/stegu-webgl-noise/LICENSE'), 'utf8');
  assert.match(license, /Permission is hereby granted, free of charge/);
});

test('remote candidates never masquerade as local runtime assets', () => {
  for (const item of Object.values(publicWebAssetCatalog).filter(item => item.status === 'AUDITED_REMOTE_CANDIDATE')) {
    assert.equal(item.localPath, undefined);
    assert.equal(item.runtimeUrl, undefined);
  }
  assert.throws(() => publicWebAssetsForApp('unknown'), /Unknown app/);
});
