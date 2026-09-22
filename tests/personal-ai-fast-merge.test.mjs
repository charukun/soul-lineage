import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

test('develop PRs have no CI or merge loop and the same task worker owns merge', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8');
  const development = readFileSync('docs/DEVELOPMENT.md', 'utf8');
  const agents = readFileSync('AGENTS.md', 'utf8');

  assert.match(ci, /branches: \[main\]/);
  assert.doesNotMatch(ci, /branches: \[develop, main\]|branches: \[develop\]/);
  assert.doesNotMatch(ci, /merge-ready:|request-rescue:/);
  assert.equal(existsSync('.github/workflows/develop-merge.yml'), false);
  assert.doesNotMatch(deploy, /develop-merge\.yml|queue-recovery:|merge-continuation:|rescue_mode:|merge_cursor:/);
  assert.match(deploy, /push:\s*\n\s*branches: \[develop, main\]/);
  assert.match(development, /develop PRではGitHub CIを起動しない/);
  assert.match(development, /同じ実装WORKがexact current headを`develop`へmerge/);
  assert.match(agents, /No develop PR CI, merge queue, Ready handoff, or automatic repair loop exists/);
});
