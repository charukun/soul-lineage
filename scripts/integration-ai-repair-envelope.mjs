import assert from 'node:assert/strict';
import { REPOSITORY } from './integration-rescue-policy.mjs';
import { DEV_FEEDBACK_CONSTRAINTS } from './dev-feedback-policy.mjs';

const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const compact = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 800);

export const AI_REPAIR_CONSTRAINTS = Object.freeze([
  're-read current GitHub PR, exact head and develop before editing',
  'repair the existing PR branch only; do not create a second Integration queue',
  'do not clear integration holds, review objections or human-required decisions',
  'preserve exact-head, review, thread, check, browser and Production gates',
  'run repository fast validation before returning the PR to Integration',
  'no force push and no main or Production changes',
  ...DEV_FEEDBACK_CONSTRAINTS,
]);

export function aiRepairEnvelope({ repository = REPOSITORY, pr, branch, head, develop, repairKind, reason,
  attempt = 0, maxAttempts = 0, source = 'integration-rescue', deep = false } = {}) {
  assert.equal(repository, REPOSITORY, 'AI_REPAIR_REPOSITORY_MISMATCH');
  assert.ok(Number.isSafeInteger(Number(pr)) && Number(pr) > 0, 'AI_REPAIR_PR_REQUIRED');
  assert.ok(typeof branch === 'string' && branch.trim() && !/^(?:main|develop|production|prod)$/i.test(branch), 'AI_REPAIR_BRANCH_REQUIRED');
  assert.ok(sha(head), 'AI_REPAIR_HEAD_REQUIRED');
  assert.ok(sha(develop), 'AI_REPAIR_DEVELOP_REQUIRED');
  assert.ok(typeof repairKind === 'string' && repairKind.trim(), 'AI_REPAIR_KIND_REQUIRED');
  assert.ok(compact(reason), 'AI_REPAIR_REASON_REQUIRED');
  const current = Number(attempt) || 0, max = Number(maxAttempts) || 0;
  assert.ok(Number.isSafeInteger(current) && current >= 0, 'AI_REPAIR_ATTEMPT_INVALID');
  assert.ok(Number.isSafeInteger(max) && max >= 0 && (max === 0 || current <= max), 'AI_REPAIR_MAX_ATTEMPT_INVALID');
  return {
    schema: 1,
    repository,
    pr: Number(pr),
    branch: branch.trim(),
    head,
    develop,
    repairKind: repairKind.trim(),
    reason: compact(reason),
    attempt: current,
    maxAttempts: max,
    source: compact(source) || 'integration-rescue',
    deep: Boolean(deep),
    constraints: [...AI_REPAIR_CONSTRAINTS],
  };
}

export function aiRepairEnvelopeMarker(envelope) {
  const verified = aiRepairEnvelope(envelope);
  return `<!-- rinne-ai-repair:v1\n${JSON.stringify(verified)}\n-->`;
}

export function parseAiRepairEnvelope(body = '') {
  const match = String(body).match(/<!-- rinne-ai-repair:v1\n([^\n]+)\n-->/);
  if (!match) return null;
  try { return aiRepairEnvelope(JSON.parse(match[1])); }
  catch { return null; }
}
