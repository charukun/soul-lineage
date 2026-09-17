import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assetNames = [0, 1, 2, 3].map((index) => `world-loading-${index}.webp`);

test('world-building loading screen uses the approved static artwork', async () => {
  const html = await readFile(resolve(appRoot, 'index.html'), 'utf8');
  const css = await readFile(resolve(appRoot, 'src/title-loading-screen.css'), 'utf8');
  let totalBytes = 0;

  assert.match(html, /id="loading-card"/);
  assert.match(html, />世界をつくっています</);
  assert.match(html, />景色を描いています</);
  assert.match(html, /class="loading-world-art-track"/);

  for (const name of assetNames) {
    assert.ok(html.includes(`./title-assets/${name}`), `${name} must be mounted by the loading screen`);
    const bytes = await readFile(resolve(appRoot, 'title-assets', name));
    totalBytes += bytes.length;
    assert.equal(bytes.subarray(0, 4).toString(), 'RIFF');
    assert.equal(bytes.subarray(8, 12).toString(), 'WEBP');
    assert.ok(bytes.length < 30_000, `${name} should stay lightweight`);
  }

  assert.ok(totalBytes < 60_000, 'loading artwork should remain lightweight enough for boot');
  assert.match(css, /min-aspect-ratio:12\/19/);
  assert.match(css, /data-screen="error"/);
  assert.doesNotMatch(css, /backdrop-filter/);
});
