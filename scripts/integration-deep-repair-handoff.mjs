import assert from 'node:assert/strict';
import { aiRepairEnvelope, aiRepairEnvelopeMarker } from './integration-ai-repair-envelope.mjs';
import { reviewDecision } from './integration-policy.mjs';

const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const HOLD_LABELS = new Set(['integration:hold', 'integration:manual', 'do-not-merge']);
export const deepRepairStatus = 'integration/deep-repair';
export const deepRepairSchema = 1;
export const deepRepairMaxAttempts = 2;

function labels(pr) {
  return (pr?.labels || []).map(label => label.name);
}

function explicitHold(pr) {
  return labels(pr).some(label => HOLD_LABELS.has(label)) || /^Integration-Hold:\s*\S+/im.test(pr?.body || '');
}

export function deepRepairSafety({ pr, repository, dependenciesMerged, unresolved, reviews = [] }) {
  if (!pr || pr.state !== 'open' || pr.draft || pr.base?.ref !== 'develop') return 'not a Ready develop PR';
  if (pr.base?.repo?.full_name !== repository || pr.head?.repo?.full_name !== repository || !TRUSTED.has(pr.author_association)) {
    return 'external or untrusted PR';
  }
  if (explicitHold(pr)) return 'explicit Integration hold';
  if (!dependenciesMerged) return 'dependency PR is not merged into develop';
  const review = reviewDecision(reviews, pr.head.sha);
  if (review.rejected || unresolved) return 'unresolved review or requested changes';
  return null;
}

export function deepRepairIssueState({ pr, develop, reason, repairKind = 'semantic' }) {
  const sourceKey = `pr:${pr.number}:head:${pr.head.sha}`;
  return {
    schema: deepRepairSchema,
    sourceKey,
    state: 'pending',
    attempt: 0,
    maxAttempts: deepRepairMaxAttempts,
    pr: pr.number,
    branch: pr.head.ref,
    head: pr.head.sha,
    develop,
    repairKind,
    reason: String(reason || '').replace(/\s+/g, ' ').trim().slice(0, 800),
  };
}

export function deepRepairIssueMarker(state) {
  return `<!-- integration-deep-repair:v1\n${JSON.stringify(state)}\n-->`;
}

export function parseDeepRepairIssue(body = '') {
  const match = String(body).match(/<!-- integration-deep-repair:v1\n([^\n]+)\n-->/);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    if (state?.schema !== deepRepairSchema || !state.sourceKey || !state.head || !state.pr) return null;
    return state;
  } catch {
    return null;
  }
}

export async function signalDeepRepair(c, { pr, repository, develop, reason, repairKind = 'semantic', dependenciesMerged,
  unresolved, reviews = [] }) {
  const blocked = deepRepairSafety({ pr, repository, dependenciesMerged, unresolved, reviews });
  if (blocked) return { signaled: false, blocked };
  assert.match(develop || '', /^[0-9a-f]{40}$/i, 'DEEP_REPAIR_DEVELOP_REQUIRED');
  assert.match(pr.head.sha || '', /^[0-9a-f]{40}$/i, 'DEEP_REPAIR_HEAD_REQUIRED');

  const state = deepRepairIssueState({ pr, develop, reason, repairKind });
  const marker = deepRepairIssueMarker(state);
  const openIssues = await c.pages('/issues?state=open&sort=created&direction=desc&per_page=100', undefined, { maxPages: 3 });
  let issue = openIssues.find(item => !item.pull_request && String(item.body || '').includes(`\"sourceKey\":\"${state.sourceKey}\"`));

  if (!issue) {
    const envelope = aiRepairEnvelope({
      pr: pr.number,
      branch: pr.head.ref,
      head: pr.head.sha,
      develop,
      repairKind,
      reason,
      attempt: 0,
      maxAttempts: deepRepairMaxAttempts,
      source: 'integration-fast-lane',
      deep: true,
    });
    issue = await c.api('POST', `${c.root}/issues`, {
      title: `Deep Repair #${pr.number} ${pr.head.sha.slice(0, 12)}`,
      body: `${marker}\n${aiRepairEnvelopeMarker(envelope)}\nAI_DEEP_REPAIR_REQUIRED\n\nFast Lane found a current exact-head conflict that cannot be repaired mechanically.\n\nPR: ${pr.html_url}\nDevelop: \`${develop}\`\nReason: ${state.reason}\n\nChatGPT Work must re-read current GitHub state before claiming this issue. Repair the existing PR branch only, preserve both sides where compatible, fast-validate, and return the new exact head to the same Fast Lane. Do not clear holds/review objections or change main/Production.`,
    });
  }

  await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
    state: 'pending',
    context: deepRepairStatus,
    description: 'Exact-head conflict handed to AI Deep Repair',
    target_url: issue.html_url || pr.html_url,
  });

  return { signaled: true, issue: issue.number, url: issue.html_url, sourceKey: state.sourceKey };
}
