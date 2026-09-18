import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Ready exact-head CI enters the serialized develop merge guard without a dispatch handoff', () => {
  const ci = readFileSync('.github/workflows/ci.yml', 'utf8');
  const development = readFileSync('docs/DEVELOPMENT.md', 'utf8');
  const agents = readFileSync('AGENTS.md', 'utf8');

  assert.match(ci, /merge-ready:/);
  assert.match(ci, /uses: \.\/\.github\/workflows\/integration-controller\.yml/);
  assert.match(ci, /needs\.build\.result == 'success' \|\| needs\.build\.result == 'failure'/);
  assert.doesNotMatch(ci, /integration-request:/);
  assert.doesNotMatch(ci, /integration-controller\.yml/);

  assert.match(development, /Ready exact-head の検証成功後/);
  assert.match(development, /single-writer merge lane/);
  assert.doesNotMatch(development, /READY_FOR_INTEGRATION/);

  assert.doesNotMatch(agents, /Integration \/ merge \/ DEV publication|READY_FOR_INTEGRATION/);
  assert.match(agents, /serialized expected-head merge to `develop`/);
});
