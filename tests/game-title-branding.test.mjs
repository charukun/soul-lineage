import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const forbidden = [
  '\u8f2a\u5efb\u8ee2\u7126',
  '\u8f2a\u5efb\u8ee2\u751f',
  '100\u5e74\u751f',
  '\u5c3d\u55b0\u5efb\u904a',
  '\u6751\u30a2\u30d7\u30ea',
  '\u6751\u30cf\u30a6\u30b8\u30f3\u30b0\u30b2\u30fc\u30e0',
  'MURAAAAAAA',
  'jinkai',
  '百年転生 — 百年転生',
];
const textExtensions = /\.(?:js|mjs|cjs|ts|tsx|jsx|css|html|json|md|yml|yaml|webmanifest|txt|svg|xml|toml|sh|py)$/i;

test('retired game titles are absent from tracked text sources', () => {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
    .filter(path => textExtensions.test(path))
    .filter(path => path !== 'tests/game-title-branding.test.mjs');
  const offenders = [];
  for (const path of files) {
    for (const title of forbidden) if (path.includes(title)) offenders.push(`${path}: filename contains ${title}`);
    let content;
    try { content = readFileSync(path, 'utf8'); } catch { continue; }
    for (const title of forbidden) {
      if (content.includes(title)) offenders.push(`${path}: ${title}`);
    }
  }
  assert.deepEqual(offenders, [], `retired title references remain:\n${offenders.join('\n')}`);
});
