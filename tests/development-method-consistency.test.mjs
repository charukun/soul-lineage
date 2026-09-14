import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

async function text(path) {
  return readFile(new URL(`../${path}`, import.meta.url), 'utf8');
}

test('Code Health is embedded in the trusted develop control plane rather than a develop-only schedule', async () => {
  const rescue = await text('.github/workflows/integration-rescue.yml');
  await assert.rejects(text('.github/workflows/code-health.yml'), /ENOENT/);
  assert.match(rescue, /name: Code Health maintenance/);
  assert.doesNotMatch(rescue, /\bschedule:/);
  assert.match(rescue, /72\*60\*60\*1000/);
  assert.doesNotMatch(rescue, /uses: \.\/\.github\/workflows\/code-health\.yml/);
  assert.match(rescue, /MAX_RESCUE_CONCURRENCY: \$\{\{ vars\.MAX_RESCUE_CONCURRENCY \|\| '4' \}\}/);
  assert.doesNotMatch(rescue, /MAX_RESCUE_CONCURRENCY_V2/);
});

test('Dispatcher is a no-Platform-API Work handoff in workflow and agent policy', async () => {
  const [workflow, agents] = await Promise.all([
    text('.github/workflows/rinne-dispatch.yml'),
    text('AGENTS.md'),
  ]);
  assert.match(workflow, /RINNE Dispatch Handoff/);
  assert.doesNotMatch(workflow, /openai\/codex-action|OPENAI_API_KEY/);
  assert.match(agents, /configured ChatGPT Work GitHub PR event task owns implementation/);
  assert.doesNotMatch(agents, /workflow owns the isolated Codex implementation/);
});

test('Execution policy has a versioned Project Source precedence contract', async () => {
  const policy = await text('docs/RINNE_PROJECT_EXECUTION_POLICY.md');
  assert.match(policy, /Policy-Version: `2026-09-14-async-handoff-v2`/);
  assert.match(policy, /READY_FOR_INTEGRATION/);
  assert.match(policy, /INTEGRATED/);
  assert.match(policy, /DEV_DEPLOYED/);
  assert.match(policy, /通常Chat \/ WORK全体に常駐heartbeat daemon/);
});
