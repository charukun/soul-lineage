import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../ops-board/public/index.html', import.meta.url), 'utf8');
const script = readFileSync(new URL('../ops-board/public/rapid-board.js', import.meta.url), 'utf8');

test('rapid board exposes work, app publication, issues and recent history without replacing source data', () => {
  for (const id of ['rapid-active-list','rapid-iteration-list','rapid-app-list','rapid-issue-list','rapid-recent-list']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(script, /state\?\.pullRequests\?\.normal/);
  assert.match(script, /state\?\.applications/);
  assert.match(script, /function managedApps/);
  assert.doesNotMatch(script, /all\.slice\(0, 3\)|managedApps\(state\)\.slice\(0, 3\)/);
  assert.match(script, /eventDrivenAlerts/);
  assert.match(script, /state\?\.history\?\.publications/);
  assert.match(script, /state\?\.controlTower\?\.timeline/);
  assert.match(script, /state\?\.developmentSessions/);
  assert.match(script, /rapid-session-flow/);
  assert.match(script, /renderIterations/);
  assert.match(script, /activeSessions/);
  assert.match(script, /renderProgressMini/);
  assert.match(script, /renderSession\(session,\{graph:true\}\)/);
  assert.match(script, /renderSession\(session,\{iteration:true,graph:true\}\)/);
  assert.match(script, /iterationSteps/);
  assert.match(script, /buildIssueRepairPrompt/);
  assert.match(script, /navigator\.clipboard/);
  assert.match(script, /修復プロンプトをコピー/);
  assert.match(script, /iterations\.html#iteration=/);
  assert.match(script, /NOW/);
  assert.match(script, /再検証/);
  assert.match(script, /iterationRank/);
  assert.match(script, /Run ·/);
  assert.match(script, /対象未記録/);
  assert.doesNotMatch(script, /api\.github\.com|innerHTML/);
});

test('app cards include a DEV link and per-app PR history', () => {
  assert.match(script, /DEVを開く/);
  assert.match(script, /変更履歴/);
  assert.match(script, /target\.id === appId/);
});

test('existing diagnostic surfaces remain present for drill-down', () => {
  for (const id of ['control-tower','pulls','applications','publication-history','failures']) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
});
