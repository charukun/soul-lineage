import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { aiRepairEnvelope, aiRepairEnvelopeMarker, parseAiRepairEnvelope } from '../scripts/integration-ai-repair-envelope.mjs';

const head = 'a'.repeat(40), develop = 'b'.repeat(40);

test('AI repair handoff pins repository, existing PR branch, exact head and develop with safety constraints', () => {
  const envelope = aiRepairEnvelope({
    pr: 260,
    branch: 'feat/motion-database-finalization',
    head,
    develop,
    repairKind: 'control',
    reason: 'FAILED_MANUAL:CONTROL_OR_CONTRACT_RECONCILIATION',
    attempt: 1,
    maxAttempts: 2,
    source: 'integration-rescue-work',
  });
  assert.equal(envelope.repository, 'charukun/soul-lineage');
  assert.equal(envelope.pr, 260);
  assert.equal(envelope.head, head);
  assert.equal(envelope.develop, develop);
  assert.equal(envelope.repairKind, 'control');
  assert.ok(envelope.constraints.some(item => /existing PR branch only/i.test(item)));
  assert.ok(envelope.constraints.some(item => /do not clear integration holds/i.test(item)));
  assert.ok(envelope.constraints.some(item => /no force push/i.test(item)));
  assert.deepEqual(parseAiRepairEnvelope(aiRepairEnvelopeMarker(envelope)), envelope);
});

test('AI repair handoff rejects stale-looking or unsafe coordinates instead of manufacturing a task', () => {
  assert.throws(() => aiRepairEnvelope({ pr: 1, branch: 'develop', head, develop, repairKind: 'control', reason: 'x' }), /BRANCH_REQUIRED/);
  assert.throws(() => aiRepairEnvelope({ pr: 1, branch: 'feat/x', head: 'short', develop, repairKind: 'control', reason: 'x' }), /HEAD_REQUIRED/);
  assert.throws(() => aiRepairEnvelope({ pr: 1, branch: 'feat/x', head, develop: 'short', repairKind: 'control', reason: 'x' }), /DEVELOP_REQUIRED/);
  assert.equal(parseAiRepairEnvelope('<!-- rinne-ai-repair:v1\n{"schema":1}\n-->'), null);
});

test('queue-recovery evidence import stays independent from PULSE runtime files', () => {
  const store = readFileSync('scripts/integration-rescue-store.mjs', 'utf8');
  assert.doesNotMatch(store, /^import .*integration-rescue-pulse\.mjs/m);
  assert.match(store, /await import\('\.\/integration-rescue-pulse\.mjs'\)/);
});

test('queue-recovery module loads from the same scripts-only checkout used by the scan job', async () => {
  const root = mkdtempSync(join(tmpdir(), 'rinne-queue-recovery-'));
  try {
    cpSync('scripts', join(root, 'scripts'), { recursive: true });
    await import(`${pathToFileURL(join(root, 'scripts/integration-queue-recovery.mjs')).href}?test=${Date.now()}`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('repair worker can write the statuses used by return and AI repair signaling', () => {
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const worker = rescue.match(/\n  worker:\n[\s\S]*?\n  return:/)?.[0] || '';
  assert.match(worker, /permissions:[\s\S]*?statuses: write/);
  assert.match(worker, /integration-rescue-return\.mjs/);
});

test('Integration and Rescue keep AI as a bounded repair consumer without paid model execution in the control plane', () => {
  const controller = readFileSync('.github/workflows/integration-controller.yml', 'utf8');
  const rescue = readFileSync('.github/workflows/integration-rescue.yml', 'utf8');
  const returns = readFileSync('scripts/integration-rescue-return.mjs', 'utf8');
  const quarantine = readFileSync('scripts/integration-quarantine-signal.mjs', 'utf8');
  assert.match(returns, /aiRepairEnvelopeMarker/);
  assert.match(quarantine, /aiRepairEnvelopeMarker/);
  assert.doesNotMatch(`${controller}\n${rescue}`, /OPENAI_API_KEY|openai\/codex-action|RINNE_CODEX_MODEL/);
});
