import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { digest, fetchBytes } from './deployment-files.mjs';
const base = new URL(process.argv[2].replace(/\/?$/, '/'));
const root = process.argv[3] || '_site';
const expected = JSON.parse(await readFile(`${root}/deployment-manifest.json`, 'utf8'));
let lastError;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const manifestUrl = new URL('deployment-manifest.json', base); manifestUrl.searchParams.set('verify', `${Date.now()}-${attempt}`);
    const live = JSON.parse(await fetchBytes(manifestUrl));
    assert.deepEqual(live.entries.map(e => [e.path, e.inputHash]), expected.entries.map(e => [e.path, e.inputHash]));
    for (const entry of expected.entries) {
      const url = new URL(`${entry.path}/version.json`, base); url.searchParams.set('verify', Date.now());
      const version = JSON.parse(await fetchBytes(url));
      assert.equal(version.commit, entry.version.commit); assert.equal(version.environment, entry.environment);
      if (!entry.legacy) { assert.equal(version.app, entry.app); assert.equal(version.inputHash, entry.inputHash); }
      for (const file of entry.files.filter(f => f.path === 'index.html' || /\.(js|css|svg)$/.test(f.path))) {
        const assetUrl = new URL(`${entry.path}/${file.path}`, base); assetUrl.searchParams.set('content', file.sha256);
        assert.equal(digest(await fetchBytes(assetUrl)), file.sha256, `Published file mismatch: ${entry.path}/${file.path}`);
      }
      console.log(`Public HTTP verified: ${new URL(entry.path + '/', base)} / ${version.commit}`);
    }
    lastError = null; break;
  } catch (error) { lastError = error; console.warn(error.message); if (attempt < 11) await delay(10000); }
}
if (lastError) throw lastError;
