import assert from 'node:assert/strict';
import { onBrowserFailure, onDevelopBrowserSuccess, onPrBrowserSuccess, parseRepairState, replaceRepairState, linkedIssueNumber, DEFAULT_MAX_ATTEMPTS, currentPrRepair } from './browser-repair-state.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
const [owner, repo] = repository.split('/');
const scope = process.env.REPAIR_SCOPE;
const conclusion = process.env.REPAIR_CONCLUSION;
const headSha = process.env.REPAIR_HEAD_SHA;
const prNumber = Number(process.env.REPAIR_PR_NUMBER || 0) || null;
const runUrl = process.env.REPAIR_RUN_URL;
const artifact = process.env.REPAIR_ARTIFACT || 'browser-verification';
assert.ok(token && repository && scope && conclusion && headSha && runUrl);
assert.ok(['pr', 'develop'].includes(scope));
assert.ok(['success', 'failure'].includes(conclusion));

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.status === 204 ? null : response.json();
}

async function associatedPr() {
  if (prNumber) return api('GET', `/pulls/${prNumber}`);
  if (scope !== 'develop') return null;
  const prs = await api('GET', `/commits/${headSha}/pulls?per_page=100`);
  const merged = prs.filter(pr => pr.merged_at && pr.base?.ref === 'develop').sort((a, b) => new Date(b.merged_at) - new Date(a.merged_at));
  return merged.find(pr => linkedIssueNumber(pr.body || '')) || merged[0] || null;
}

async function getIssue(number) {
  if (!number) return null;
  const issue = await api('GET', `/issues/${number}`);
  return issue.pull_request ? null : issue;
}

async function findIssue(sourceKey) {
  const issues = await api('GET', '/issues?state=all&per_page=100&sort=updated&direction=desc');
  return issues.find(issue => !issue.pull_request && parseRepairState(issue.body || '')?.sourceKey === sourceKey) || null;
}

async function commentOnce(number, body, marker) {
  if (!number) return;
  const comments = await api('GET', `/issues/${number}/comments?per_page=100`);
  if (comments.some(comment => (comment.body || '').includes(marker))) return;
  await api('POST', `/issues/${number}/comments`, { body: `${marker}\n${body}` });
}

const sourcePr = await associatedPr();
if (scope === 'pr' && !currentPrRepair(sourcePr, headSha)) {
  console.log(JSON.stringify({ action: 'noop-stale-pr-result', pr: prNumber, headSha }));
  process.exit(0);
}
const sourcePrBody = sourcePr?.body || '';
let issue = await getIssue(linkedIssueNumber(sourcePrBody));
let existingState = issue ? parseRepairState(issue.body || '') : null;
const sourceKey = existingState?.sourceKey || (scope === 'pr' ? `pr:${sourcePr?.number || prNumber}` : `develop:${headSha}`);
if (!issue) issue = await findIssue(sourceKey);
if (issue) existingState = parseRepairState(issue.body || '');

const baseState = existingState || {
  schema: 1,
  scope,
  sourceKey,
  state: 'pending',
  attempt: 0,
  maxAttempts: DEFAULT_MAX_ATTEMPTS,
  sourcePr: sourcePr?.number || prNumber,
  createdFromSha: headSha,
};
const details = { headSha, runUrl, artifact, sourcePr: sourcePr?.number || prNumber, lastConclusion: conclusion };
let nextState = baseState;
if (conclusion === 'failure') nextState = onBrowserFailure(baseState, details);
else if (scope === 'develop') nextState = onDevelopBrowserSuccess(baseState, details);
else nextState = onPrBrowserSuccess(baseState, details);

if (!issue && conclusion === 'success') {
  console.log(JSON.stringify({ action: 'noop-success', sourceKey, state: nextState }, null, 2));
  process.exit(0);
}

const titleSubject = scope === 'pr' ? `PR #${sourcePr?.number || prNumber}` : `develop ${headSha.slice(0, 12)}`;
const human = nextState.state === 'human-required';
const summary = [
  '# Browser self-healing ticket',
  '',
  `Source: ${titleSubject}`,
  `Run: ${runUrl}`,
  `Artifacts: ${artifact}`,
  sourcePr ? `Related PR: #${sourcePr.number}` : null,
  '',
  human ? '**Automatic repair stopped: human review is required.**' : 'This issue is the machine-readable handoff for ChatGPT Work browser self-repair.',
  '',
  'Work must claim the ticket by changing `state` from `pending` to `working` and incrementing `attempt` before editing code. It must not touch main/Production.',
].filter(Boolean).join('\n');
const body = replaceRepairState(issue?.body || summary, nextState);
if (!issue) {
  issue = await api('POST', '/issues', { title: `[AUTO-REPAIR] Browser verification: ${titleSubject}`, body });
} else {
  issue = await api('PATCH', `/issues/${issue.number}`, { body, state: nextState.state === 'verified' ? 'closed' : 'open' });
}

const runMarker = `<!-- browser-repair-run:${process.env.GITHUB_RUN_ID || headSha}:${conclusion} -->`;
if (sourcePr) {
  const stateText = nextState.state === 'verified' ? 'verified' : nextState.state === 'ready-for-integration' ? 'browser-fixed; returning to Integration' : nextState.state;
  await commentOnce(sourcePr.number,
    `Browser verification **${conclusion}**. Repair ticket #${issue.number} is now **${stateText}**.\n\nArtifacts: \`${artifact}\` · ${runUrl}`,
    runMarker);
}
await commentOnce(issue.number,
  `Browser verification **${conclusion}** for \`${headSha}\`. State: **${nextState.state}**.\n\n${runUrl}`,
  runMarker);

console.log(JSON.stringify({ issue: issue.number, sourceKey, state: nextState }, null, 2));
