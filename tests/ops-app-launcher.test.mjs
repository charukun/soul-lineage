import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Ops Board exposes verified publication targets as obvious direct launch links', async () => {
  const [appBoard, appCss] = await Promise.all([
    readFile(new URL('../ops-board/public/app-board.js', import.meta.url), 'utf8'),
    readFile(new URL('../ops-board/public/app-board.css', import.meta.url), 'utf8'),
  ]);

  assert.match(appBoard, /const safeHref = value =>/);
  assert.match(appBoard, /const node = el\(url \? 'a' : 'div'/);
  assert.match(appBoard, /node\.href = url; node\.target = '_blank'; node\.rel = 'noreferrer'/);
  assert.match(appCss, /\.app-target-summary\.is-link::after\{content:'開く ↗'/);
  assert.match(appCss, /\.app-target-summary\.is-link:focus-visible/);
});
