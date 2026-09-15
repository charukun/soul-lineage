import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { contextExcerpt } from '../scripts/context-excerpt.mjs';

async function fixture(t, content) {
  const root = await mkdtemp(join(tmpdir(), 'context-excerpt-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'source.txt');
  await writeFile(file, content);
  return { file, ledger: join(root, 'ledger.json') };
}

test('oversized documents defer and line ranges keep UTF-8 within the byte cap', async t => {
  const input = await fixture(t, '見出し\n' + 'あ'.repeat(100) + '\n最後\n');
  await assert.rejects(contextExcerpt({ ...input, maxBytes: 20 }), /deferred/);
  const result = await contextExcerpt({ ...input, start: 2, end: 2, maxBytes: 20 });
  assert.equal(result.text, 'あ'.repeat(6));
  assert.equal(result.bytes, 18);
  assert.equal(result.truncated, true);
});

test('log reads reject successful jobs, whole logs and limits above 64 KiB', async t => {
  const input = await fixture(t, 'success\nerror: broken\nstack\n');
  const request = { ...input, kind: 'log', start: 2, end: 3 };
  await assert.rejects(contextExcerpt({ ...request, conclusion: 'success' }), /failed\/cancelled/);
  await assert.rejects(contextExcerpt({ ...input, kind: 'log', conclusion: 'failure' }), /line ranges/);
  await assert.rejects(contextExcerpt({ ...request, conclusion: 'failure', maxBytes: 65537 }), /cannot exceed/);
  const result = await contextExcerpt({ ...request, conclusion: 'cancelled' });
  assert.equal(result.text, 'error: broken\nstack\n');
  assert.equal(result.truncated, false);
});

test('same content copied through another route is not emitted twice; changed content is', async t => {
  const input = await fixture(t, 'current specification\n');
  const first = await contextExcerpt(input);
  const copy = input.file + '.copy';
  await writeFile(copy, first.text);
  const repeated = await contextExcerpt({ ...input, file: copy });
  assert.equal(repeated.duplicate, true);
  assert.equal(repeated.text, '');
  assert.equal(repeated.bytes, 0);
  await writeFile(copy, 'updated specification\n');
  assert.equal((await contextExcerpt({ ...input, file: copy })).duplicate, false);
  assert.ok(!(await readFile(input.ledger, 'utf8')).includes('specification'));
});

test('huge single lines and later requested ranges are bounded without whole-file output', async t => {
  const input = await fixture(t, 'x'.repeat(1024 * 1024) + '\nneeded\nignored\n');
  const first = await contextExcerpt({ ...input, start: 1, end: 1, maxBytes: 4096 });
  assert.equal(first.bytes, 4096);
  assert.equal(first.truncated, true);
  assert.equal((await contextExcerpt({ ...input, start: 2, end: 2 })).text, 'needed\n');
});

test('invalid ranges, binary data and using the source as ledger fail safely', async t => {
  const input = await fixture(t, 'abc\0def\n');
  await assert.rejects(contextExcerpt(input), /Binary/);
  await assert.rejects(contextExcerpt({ ...input, start: 4, end: 2 }), /end/);
  await assert.rejects(contextExcerpt({ ...input, start: 1.5, end: 2 }), /positive integer/);
  await assert.rejects(contextExcerpt({ ...input, ledger: input.file }), /separate/);
  assert.equal(await readFile(input.file, 'utf8'), 'abc\0def\n');
});
