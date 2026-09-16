import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PUBLIC_WEB_ASSET_SOURCES, publicWebAssetCatalog, publicWebAssetsForApp } from '../src/public-web-catalog.js';

const repoRoot = process.cwd();
const repoPath = path => resolve(repoRoot, path);
const phase2ManifestPath = repoPath('assets/vendor/public-web/PHASE2_MANIFEST.json');
const phase3ManifestPath = repoPath('assets/vendor/public-web/PHASE3_MANIFEST.json');

function assertLocalPath(path) {
  assert.ok(existsSync(repoPath(path)), `${path} missing`);
}

function assertManifestHashes(manifest, expectedCount) {
  assert.equal(manifest.auditDate, '2026-09-16');
  assert.equal(manifest.files.length, expectedCount);
  for (const file of manifest.files) {
    assert.match(file.license, /^CC0-1\.0$/);
    assert.match(file.sha256, /^[0-9a-f]{64}$/);
    assertLocalPath(file.path);
    const actual = createHash('sha256').update(readFileSync(repoPath(file.path))).digest('hex');
    assert.equal(actual, file.sha256, `${file.path}: sha256 mismatch`);
  }
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

test('phase 3 source pins remain explicit', () => {
  const rpg = PUBLIC_WEB_ASSET_SOURCES['kenney-rpg-audio'];
  assert.equal(rpg.mirrorRepository, 'Boyquotes/kenney-rpg-audio-for-godot');
  assert.equal(rpg.mirrorCommit, '22eb79bb843bbcadcaa6ed119353a33265ffad11');
  assert.equal(rpg.archiveSha256, '6dbeaf8544da958d8f2adcb4a4a4b76c1ade34a05f8ab9edccd327da7375f38b');
  assert.equal(PUBLIC_WEB_ASSET_SOURCES['kenney-nature-kit'].archiveSha256, 'fa7974a0d342bfe63c38664ba9f8ec1a4aab8ea25f099bdc56870e33588c4d9d');
  assert.equal(PUBLIC_WEB_ASSET_SOURCES['kenney-skyboxes'].license, 'CC0-1.0');
  assert.equal(PUBLIC_WEB_ASSET_SOURCES['kenney-light-masks'].license, 'CC0-1.0');
});

test('materialized public web assets are repository local', () => {
  const materialized = publicWebAssetsForApp('rinne', { statuses: ['MATERIALIZED'] });
  assert.equal(materialized.length, 33);
  for (const item of materialized) {
    if (item.localPath) assertLocalPath(item.localPath);
    if (item.localPaths) Object.values(item.localPaths).forEach(assertLocalPath);
    assert.ok(item.localPath || item.localPaths, `${item.sourceId}: materialized item needs local files`);
    assert.match(PUBLIC_WEB_ASSET_SOURCES[item.sourceId].license, /^(CC0-1\.0|MIT)$/);
  }
  const license = readFileSync(repoPath('assets/vendor/public-web/stegu-webgl-noise/LICENSE'), 'utf8');
  assert.match(license, /Permission is hereby granted, free of charge/);
});

test('phase 2 manifest pins and hashes every imported binary', () => {
  assert.ok(existsSync(phase2ManifestPath), 'phase 2 manifest missing');
  assertManifestHashes(JSON.parse(readFileSync(phase2ManifestPath, 'utf8')), 19);
});

test('phase 3 manifest pins and hashes every imported binary', () => {
  assert.ok(existsSync(phase3ManifestPath), 'phase 3 manifest missing');
  const manifest = JSON.parse(readFileSync(phase3ManifestPath, 'utf8'));
  assertManifestHashes(manifest, 16);
  const gitBacked = manifest.files.filter(file => file.gitBlob);
  assert.equal(gitBacked.length, 10);
  for (const file of gitBacked) {
    assert.equal(file.providerRepository, 'Boyquotes/kenney-rpg-audio-for-godot');
    assert.equal(file.commit, '22eb79bb843bbcadcaa6ed119353a33265ffad11');
    assert.match(file.gitBlob, /^[0-9a-f]{40}$/);
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
