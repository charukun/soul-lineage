import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../ops-board/public/flow-board.js', import.meta.url), 'utf8');
const rescue = readFileSync(new URL('../ops-board/public/rescue-board.js', import.meta.url), 'utf8');

test('PULSE default integration surface is the five-state Fast Lane view', () => {
  assert.match(flow, /FAST LANE/);
  for (const label of ['FAST CHECK', 'MERGE LANE', 'MERGED → DEV', 'REPAIR']) assert.match(flow, new RegExp(label));
  assert.match(flow, /state\.integration/);
  assert.match(flow, /browser・DEV公開・Repairは後追い/);
  assert.match(flow, /通るPRから自動で流します/);
  assert.doesNotMatch(flow, /主な詰まり/);
  assert.doesNotMatch(flow, /待機 \$\{demand\}件/);
});

test('historical latency and Virtual Train are developer diagnostics, not current Fast Lane claims', () => {
  assert.match(flow, /flow:technical/);
  assert.match(flow, /履歴: Ready→Merge/);
  assert.match(flow, /過去の遅いケース/);
  assert.match(flow, /旧Virtual Train診断/);
  assert.match(flow, /履歴診断/);
});

test('Rescue is presented as a separate Repair Lane and only real human decisions ask the user', () => {
  assert.match(rescue, /REPAIR LANE/);
  assert.match(rescue, /REPAIR WAITING/);
  assert.match(rescue, /AUTO HOLD/);
  assert.match(rescue, /HUMAN/);
  assert.match(rescue, /needsHuman = configurationRequired \|\| humanManual\.length > 0/);
  assert.match(rescue, /通常のFast Lane mergeは止まりません/);
  assert.match(rescue, /あなたの操作は不要/);
  assert.doesNotMatch(rescue, /INTEGRATION RESCUE/);
});

test('PULSE UI remains snapshot-only and injection-safe', () => {
  assert.doesNotMatch(`${flow}\n${rescue}`, /api\.github\.com|innerHTML/);
});
