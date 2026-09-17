import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('world-building loading screen is live UI instead of a baked screenshot', async () => {
  const html = await readFile(resolve(appRoot, 'index.html'), 'utf8');
  const css = await readFile(resolve(appRoot, 'src/title-loading-screen.css'), 'utf8');
  const progress = await readFile(resolve(appRoot, 'src/loading-screen.js'), 'utf8');
  let titleAssets = [];
  try {
    titleAssets = await readdir(resolve(appRoot, 'title-assets'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }

  assert.match(html, /id="loading-card"/);
  assert.match(html, /id="loading-title">世界をつくっています</);
  assert.match(html, /id="loading-message">世界のしくみを呼び出しています</);
  assert.match(html, /id="loading-progress"[^>]*role="progressbar"/);
  assert.match(html, /src="\.\/src\/loading-screen\.js"/);
  assert.doesNotMatch(html, /world-loading-/);
  assert.doesNotMatch(html, /loading-world-art/);

  assert.match(css, /#loading-card\[data-world-ready="true"\]/);
  assert.match(css, /\.loading-progress>i/);
  assert.match(css, /@keyframes loading-orbit-turn/);
  assert.doesNotMatch(css, /backdrop-filter/);
  assert.doesNotMatch(css, /url\(/);

  assert.match(progress, /村の地図をひらいています/);
  assert.match(progress, /景色を描いています/);
  assert.match(progress, /旅人を迎えています/);
  assert.match(progress, /MutationObserver/);
  assert.match(progress, /gameCanvas\.dataset\.runtime==='prepared'/);

  assert.deepEqual(
    titleAssets.filter((name) => name.startsWith('world-loading-')),
    [],
    'baked loading artwork should not remain in the app assets',
  );
});
