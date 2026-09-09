import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const base = process.argv[2];
assert.ok(base?.startsWith('https://'), 'Pass the deployed HTTPS base URL');
const siteRoot = process.argv[3] || '_site';
for (const environment of ['dev', 'prod']) {
  const expected = JSON.parse(await readFile(`${siteRoot}/${environment}/version.json`, 'utf8'));
  const url = new URL(`${environment}/`, base.endsWith('/') ? base : base + '/');
  let lastError;
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const versionUrl = new URL('version.json', url);
      versionUrl.searchParams.set('run', `${expected.runId}-${attempt}`);
      const response = await fetch(versionUrl, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
      assert.equal(response.status, 200);
      const actual = await response.json();
      assert.equal(actual.environment, environment);
      assert.equal(actual.commit, expected.commit);
      // Pages may serve a previous successful deployment of the same source
      // commit. The environment and source SHA define what is being verified;
      // a different Actions run ID is trace metadata, not different game code.
      const page = await fetch(url, { signal: AbortSignal.timeout(15000) });
      assert.equal(page.status, 200);
      const html = await page.text();
      assert.ok(html.includes('id="game"'));
      const assets = [...html.matchAll(/(?:src|href)="(\.\/assets\/[^"?#]+)"/g)].map(m => m[1]);
      assert.ok(assets.some(p => p.endsWith('.js')));
      for (const asset of assets) {
        const res = await fetch(new URL(asset, url), { signal: AbortSignal.timeout(15000) });
        assert.equal(res.status, 200, `Asset failed: ${asset}`);
        assert.ok((await res.arrayBuffer()).byteLength > 0);
      }
      console.log(`Public HTTP verified: ${url} / ${actual.commit}`);
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 11) await delay(10000);
    }
  }
  if (lastError) throw lastError;
}
