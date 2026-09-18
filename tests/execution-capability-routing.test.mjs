import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const text = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('execution policy forbids premature current-session incapability exits', () => {
  const agents = text('AGENTS.md');
  const policy = text('docs/RINNE_PROJECT_EXECUTION_POLICY.md');

  assert.match(policy, /## 実行不能宣言の禁止と代替経路の強制/);
  assert.match(policy, /「このセッションではできません」/);
  assert.match(policy, /接続済みGitHub API/);
  assert.match(policy, /GitHub Actions \/ browser playtest \/ evidence \/ DCC carrier \/ deploy \/ artifact/);
  assert.match(policy, /既存 Codespaces \+ 通常git/);
  assert.match(policy, /単なる能力宣言ではなく `FAILED`/);
  assert.match(policy, /該当ツールが現在のtool listにない/);
  assert.match(agents, /実行不能宣言の禁止と代替経路の強制/);
  assert.match(agents, /missing direct tool or one failed transport is not a capability verdict/);
});
