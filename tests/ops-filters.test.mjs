import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('development task board exposes compact state filters', async () => {
  const pullBoard = await readFile(new URL('../ops-board/public/pull-board.js', import.meta.url), 'utf8');
  const css = await readFile(new URL('../ops-board/public/pr-board.css', import.meta.url), 'utf8');
  assert.match(pullBoard, /\['all', 'すべて'/);
  assert.match(pullBoard, /\['Draft', '作業中'/);
  assert.match(pullBoard, /\['Ready', '統合待ち'/);
  assert.match(pullBoard, /\['Merged', '統合済み'/);
  assert.match(pullBoard, /\['Closed', '終了'/);
  assert.match(pullBoard, /aria-pressed/);
  assert.match(pullBoard, /selectedFilter/);
  assert.match(css, /\.pull-filters/);
  assert.match(css, /overflow-x:\s*auto/);
});
