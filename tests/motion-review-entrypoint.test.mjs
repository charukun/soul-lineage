import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workshopPath = new URL('../apps/rinne/characters.html', import.meta.url);
const legacyPath = new URL('../apps/rinne/public/simulator/motion-review.html', import.meta.url);
const entrypointPath = new URL('../apps/rinne/src/motion-review-entrypoint.js', import.meta.url);

test('character workshop is the single user-facing motion review entrypoint', async () => {
  const html = await readFile(workshopPath, 'utf8');

  assert.match(html, />演舞レビュー<\/button>/);
  assert.match(html, />▶ 30秒演舞<\/button>/);
  assert.match(html, /技単体も「確認する動き」から選択/);
  assert.match(html, /src="\.\/src\/motion-review-entrypoint\.js"/);
  assert.doesNotMatch(html, /href="\.\/simulator\/motion-review\.html"/);
});

test('legacy slash review URL deep-links to the canonical motion review tab', async () => {
  const html = await readFile(legacyPath, 'utf8');

  assert.match(html, /url=\.\.\/characters\.html\?review=motion/);
  assert.match(html, /location\.replace\('\.\.\/characters\.html\?review=motion'\)/);
  assert.doesNotMatch(html, /src="\.\/src\/motion-review\.js"/);
});

test('runtime entrypoint keeps canonical labels after Motion QA UI setup', async () => {
  const source = await readFile(entrypointPath, 'utf8');

  assert.match(source, /tab: '演舞レビュー'/);
  assert.match(source, /heading: '演舞レビュー'/);
  assert.match(source, /start: '▶ 30秒演舞'/);
  assert.match(source, /searchParams\.get\('review'\) === REVIEW_QUERY/);
});
