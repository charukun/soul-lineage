import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const flow = readFileSync(new URL('../ops-board/public/flow-board.js', import.meta.url), 'utf8');
const flowCss = readFileSync(new URL('../ops-board/public/flow-board.css', import.meta.url), 'utf8');
const rescue = readFileSync(new URL('../ops-board/public/rescue-board.js', import.meta.url), 'utf8');

test('PULSE integration detail stays a thin deterministic READY view', () => {
  assert.match(flow, /INTEGRATION/);
  for (const label of ['EXACT HEAD', 'MERGE', 'DEVELOP → DEV', 'REPAIR']) assert.match(flow, new RegExp(label));
  assert.match(flow, /state\.integration/);
  assert.match(flow, /READY以降の機械処理/);
  assert.match(flow, /通るPRから自動で流します/);
  assert.doesNotMatch(flow, /主な詰まり/);
  assert.doesNotMatch(flow, /待機 \$\{demand\}件/);
});

test('retired planner train and latency diagnostics are not shipped in current PULSE', () => {
  for (const legacy of ['旧Virtual Train診断', '旧Reconciliation診断', '履歴: Draft→Ready', '履歴: Ready→Merge', '旧Planner / Train']) {
    assert.doesNotMatch(flow, new RegExp(legacy));
  }
  assert.doesNotMatch(flow, /flow:technical|legacyDiagnostics|rs-flow-metric|rs-flow-grid/);
  assert.doesNotMatch(flowCss, /rs-flow-disclosure|rs-flow-detail|rs-flow-metric|rs-flow-grid|rs-flow-knowledge/);
});

test('Rescue remains a separate technical Repair view and only real human decisions ask the user', () => {
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
