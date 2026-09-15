import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('DEV publisher wake is driven by exact live pending ownership rather than fragile job outputs', () => {
  const workflow = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const handoff = workflow.split('  publisher-handoff:')[1];
  assert.ok(handoff, 'publisher-handoff job must exist');
  assert.match(handoff, /if: needs\.integrate\.result == 'success'/);
  assert.doesNotMatch(handoff, /needs\.integrate\.outputs\.(verify|merged_count)/);
  assert.match(handoff, /statuses: read/);
  assert.match(handoff, /listCommitStatusesForRef/);
  assert.match(handoff, /status\.context === 'integration\/develop'/);
  assert.match(handoff, /latest\?\.state !== 'pending'/);
  assert.match(handoff, /latest\.target_url !== controllerUrl/);
  assert.match(handoff, /publish_only: 'true'/);
});
