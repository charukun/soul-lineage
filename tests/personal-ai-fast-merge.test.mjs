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
  assert.doesNotMatch(ci, /workflow_id: 'deploy\.yml'[\s\S]{0,400}Request Integration/);

  assert.match(development, /Integration という工程自体を通常経路に置かない/);
  assert.match(development, /single-writer merge lane/);
  assert.doesNotMatch(development, /READY_FOR_INTEGRATION.*で終了/);

  assert.match(agents, /A separate human\/Chat Integration handoff is not part of the normal path/);
  assert.match(agents, /serialized expected-head merge to `develop`/);
});
