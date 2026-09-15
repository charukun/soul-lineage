import assert from 'node:assert/strict';
import { onBrowserFailure, onDevelopBrowserSuccess, onPrBrowserSuccess, parseRepairState, replaceRepairState, linkedIssueNumber, DEFAULT_MAX_ATTEMPTS, currentPrRepair } from './browser-repair-state.mjs';
import { normalizeNotificationLocale, notificationHeadline } from './notification-copy.mjs';
import { DEV_FEEDBACK_RULES } from './dev-feedback-policy.mjs';

const repository = process.env.GITHUB_REPOSITORY;
const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
let scope = process.env.REPAIR_SCOPE;
const conclusion = process.env.REPAIR_CONCLUSION;
let headSha = process.env.REPAIR_HEAD_SHA;
const prNumber = Number(process.env.REPAIR_PR_NUMBER || 0) || null;
let repairIssueNumber = Number(process.env.REPAIR_ISSUE_NUMBER || 0) || null;
const runUrl = process.env.REPAIR_RUN_URL;
const artifact = process.env.REPAIR_ARTIFACT || 'browser-verification';
const verifiedDevelopEvidence = process.env.REPAIR_VERIFIED === 'true';
const notificationLocale = normalizeNotificationLocale(process.env.NOTIFY_LOCALE || 'ja');
assert.ok(token && repository && scope && conclusion && headSha && runUrl);
assert.ok(['pr', 'develop'].includes(scope));
assert.ok(['success', 'failure'].includes(conclusion));

async function api(method, path, body) {
  const response = await fetch(`https://api.github.com/repos/${repository}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
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
async function ancestorOfCurrent(sha) {
  if (!/^[0-9a-f]{40}$/.test(sha || '') || sha === headSha) return false;
  const comparison = await api('GET', `/compare/${sha}...${headSha}`);
  return comparison?.base_commit?.sha === sha && comparison?.merge_base_commit?.sha === sha && comparison?.head_commit?.sha === headSha && ['ahead', 'identical'].includes(comparison?.status);
}
async function retireOlderDevelopTickets(protectedIssueNumber = null) {
  if (scope !== 'develop') return [];
  const issues = await api('GET', '/issues?state=open&per_page=100&sort=updated&direction=desc');
  const retired = [];
  for (const candidate of issues) {
    if (candidate.pull_request || candidate.number === protectedIssueNumber) continue;
    const state = parseRepairState(candidate.body || '');
    if (!state || state.scope !== 'develop' || state.state === 'working' || state.createdFromSha === headSha) continue;
    if (!await ancestorOfCurrent(state.createdFromSha)) continue;
    const now = new Date().toISOString();
    const next = conclusion === 'success'
      ? { ...state, state: 'verified', verifiedAt: now, verifiedBySha: headSha }
      : { ...state, state: 'superseded', supersededAt: now, supersededBySha: headSha };
    await api('PATCH', `/issues/${candidate.number}`, { body: replaceRepairState(candidate.body || '', next), state: 'closed' });
    await api('POST', `/issues/${candidate.number}/comments`, { body: `<!-- browser-repair-generation:${headSha} -->\nA newer develop verification at \`${headSha}\` ${conclusion === 'success' ? 'verified the descendant baseline' : 'superseded this older failure generation'}.` });
    retired.push(candidate.number);
  }
  return retired;
}
async function commentOnce(number, body, marker) {
  if (!number) return;
  const comments = await api('GET', `/issues/${number}/comments?per_page=100`);
  if (comments.some(comment => (comment.body || '').includes(marker))) return;
  await api('POST', `/issues/${number}/comments`, { body: `${marker}\n${body}` });
}
async function currentDevelopContainingMergedPr(pr, testedHead) {
  if (!pr?.merged_at || pr.head?.sha !== testedHead || pr.base?.ref !== 'develop' || !/^[0-9a-f]{40}$/.test(pr.merge_commit_sha || '')) return null;
  const branch = await api('GET', '/branches/develop');
  const current = branch?.commit?.sha;
  if (!/^[0-9a-f]{40}$/.test(current || '')) return null;
  if (current === pr.merge_commit_sha) return current;
  const comparison = await api('GET', `/compare/${pr.merge_commit_sha}...${current}`);
  const contains = comparison?.merge_base_commit?.sha === pr.merge_commit_sha && comparison?.head_commit?.sha === current && ['ahead', 'identical'].includes(comparison?.status);
  return contains ? current : null;
}
async function finalizeReadyDevelopRepairFromDelivery() {
  if (scope !== 'develop' || conclusion !== 'success' || verifiedDevelopEvidence) return false;
  const candidates = repairIssueNumber
    ? [await getIssue(repairIssueNumber)].filter(Boolean)
    : (await api('GET', '/issues?state=open&per_page=100&sort=updated&direction=desc')).filter(issue => !issue.pull_request);
  const verified = [];
  for (const candidate of candidates) {
    const state = parseRepairState(candidate.body || '');
    if (!state || state.scope !== 'develop' || state.state !== 'ready-for-integration') continue;
    const repairHead = state.repairPrHead || state.headSha;
    const mergedIntoCurrent = repairHead === headSha || await ancestorOfCurrent(repairHead);
    if (!mergedIntoCurrent) continue;
    const next = onDevelopBrowserSuccess(state, {
      headSha,
      runUrl,
      artifact,
      lastConclusion: conclusion,
      verificationMode: 'repair-pr-browser+dev-delivery',
      verifiedBySha: headSha,
    });
    await api('PATCH', `/issues/${candidate.number}`, { body: replaceRepairState(candidate.body || '', next), state: 'closed' });
    const marker = `<!-- browser-repair-delivery:${headSha} -->`;
    await commentOnce(candidate.number,
      `${notificationHeadline('BROWSER_VERIFIED', notificationLocale)}\nRepair PR browser verification was already green, and the repaired head is now contained in publicly verified DEV \`${headSha}\`. State: **verified**.`, marker);
    verified.push(candidate.number);
  }
  if (verified.length) {
    console.log(JSON.stringify({ action: 'verified-by-repair-pr-browser-and-dev-delivery', issues: verified, headSha }, null, 2));
    return true;
  }
  console.log(JSON.stringify({ action: 'noop-dev-delivery-without-ready-repair', headSha, artifact }));
  return false;
}

if (await finalizeReadyDevelopRepairFromDelivery()) process.exit(0);
if (scope === 'develop' && conclusion === 'success' && !verifiedDevelopEvidence) process.exit(0);

const sourcePr = await associatedPr();
let promotedFromPrHead = null;
if (scope === 'pr' && !currentPrRepair(sourcePr, headSha)) {
  const currentDevelop = await currentDevelopContainingMergedPr(sourcePr, headSha);
  if (!currentDevelop) {
    console.log(JSON.stringify({ action: 'noop-stale-pr-result', pr: prNumber, headSha }));
    process.exit(0);
  }

  if (conclusion === 'success') {
    const linked = linkedIssueNumber(sourcePr?.body || '');
    const linkedIssue = await getIssue(linked);
    const linkedState = linkedIssue ? parseRepairState(linkedIssue.body || '') : null;
    if (!linkedIssue || linkedState?.scope !== 'develop') {
      console.log(JSON.stringify({ action: 'noop-stale-pr-success', pr: prNumber, headSha, currentDevelop }));
      process.exit(0);
    }
    const next = onPrBrowserSuccess(linkedState, {
      headSha: currentDevelop,
      repairPrHead: headSha,
      runUrl,
      artifact,
      sourcePr: sourcePr.number,
      lastConclusion: conclusion,
    });
    await api('PATCH', `/issues/${linkedIssue.number}`, { body: replaceRepairState(linkedIssue.body || '', next), state: 'open' });
    const marker = `<!-- browser-repair-run:${process.env.GITHUB_RUN_ID || headSha}:${conclusion} -->`;
    await commentOnce(sourcePr.number, `${notificationHeadline('BROWSER_VERIFIED', notificationLocale)}\nPost-merge browser verification succeeded. Repair ticket #${linkedIssue.number} is **ready-for-integration** and will close when the repaired head is confirmed in published DEV.\n\nArtifacts: \`${artifact}\` · ${runUrl}`, marker);
    await commentOnce(linkedIssue.number, `${notificationHeadline('BROWSER_VERIFIED', notificationLocale)}\nRepair PR browser verification succeeded after merge into \`${currentDevelop}\`. State: **ready-for-integration** until DEV publication/source verification confirms the repaired head.`, marker);
    console.log(JSON.stringify({ action: 'late-merged-repair-success', issue: linkedIssue.number, state: next, currentDevelop }, null, 2));
    process.exit(0);
  }

  promotedFromPrHead = headSha;
  scope = 'develop';
  headSha = currentDevelop;
  repairIssueNumber ||= linkedIssueNumber(sourcePr?.body || '');
}

const retired = await retireOlderDevelopTickets(repairIssueNumber);
const sourcePrBody = sourcePr?.body || '';
let issue = scope === 'pr' ? await getIssue(linkedIssueNumber(sourcePrBody)) : await getIssue(repairIssueNumber);
let existingState = issue ? parseRepairState(issue.body || '') : null;
const sourceKey = existingState?.sourceKey || (scope === 'pr' ? `pr:${sourcePr?.number || prNumber}` : `develop:${headSha}`);
if (!issue) issue = await findIssue(sourceKey);
if (issue) existingState = parseRepairState(issue.body || '');

const baseState = existingState || { schema: 1, scope, sourceKey, state: 'pending', attempt: 0, maxAttempts: DEFAULT_MAX_ATTEMPTS, sourcePr: sourcePr?.number || prNumber, createdFromSha: headSha };
const details = {
  headSha,
  runUrl,
  artifact,
  sourcePr: sourcePr?.number || prNumber,
  lastConclusion: conclusion,
  ...(promotedFromPrHead ? { promotedFromPrHead } : {}),
};
let nextState = baseState;
if (conclusion === 'failure') nextState = onBrowserFailure(baseState, details);
else if (scope === 'develop') nextState = onDevelopBrowserSuccess(baseState, details);
else nextState = onPrBrowserSuccess(baseState, details);

if (!issue && conclusion === 'success') {
  console.log(JSON.stringify({ action: 'noop-success', sourceKey, retired, state: nextState }, null, 2));
  process.exit(0);
}

const titleSubject = scope === 'pr' ? `PR #${sourcePr?.number || prNumber}` : `develop ${headSha.slice(0, 12)}`;
const human = nextState.state === 'human-required';
const summary = [
  '# Browser self-healing ticket','',`Source: ${titleSubject}`,`Run: ${runUrl}`,`Artifacts: ${artifact}`,sourcePr ? `Related PR: #${sourcePr.number}` : null,
  promotedFromPrHead ? `Promoted from merged PR browser failure: \`${promotedFromPrHead}\`` : null,'',
  human ? '**Automatic repair stopped: human review is required.**' : 'This issue is the machine-readable handoff for ChatGPT Work browser self-repair.','',
  'Work must claim the ticket by changing `state` from `pending` to `working` and incrementing `attempt` before editing code. It must not touch main/Production.',
  '', DEV_FEEDBACK_RULES,
].filter(Boolean).join('\n');
const body = replaceRepairState(issue?.body || summary, nextState);
const issueStage = ['verified', 'ready-for-integration'].includes(nextState.state) ? 'BROWSER_VERIFIED' : 'FAILED';
const issueTitle = `${notificationHeadline(issueStage, notificationLocale)} · Browser verification: ${titleSubject}`;
if (!issue) issue = await api('POST', '/issues', { title: issueTitle, body });
else issue = await api('PATCH', `/issues/${issue.number}`, { title: issueTitle, body, state: nextState.state === 'verified' ? 'closed' : 'open' });

const runMarker = `<!-- browser-repair-run:${process.env.GITHUB_RUN_ID || headSha}:${conclusion} -->`;
const visibleHeadline = notificationHeadline(conclusion === 'failure' ? 'FAILED' : 'BROWSER_VERIFIED', notificationLocale);
if (sourcePr) {
  const stateText = nextState.state === 'verified' ? 'verified' : nextState.state === 'ready-for-integration' ? 'browser-fixed; returning to Integration' : nextState.state;
  const prefix = promotedFromPrHead ? `Post-merge PR browser failure was promoted to current develop \`${headSha}\`. ` : '';
  await commentOnce(sourcePr.number, `${visibleHeadline}\n${prefix}Browser verification **${conclusion}**. Repair ticket #${issue.number} is now **${stateText}**.\n\nArtifacts: \`${artifact}\` · ${runUrl}`, runMarker);
}
await commentOnce(issue.number, `${visibleHeadline}\nBrowser verification **${conclusion}** for \`${headSha}\`. State: **${nextState.state}**.\n\n${runUrl}`, runMarker);
console.log(JSON.stringify({ issue: issue.number, sourceKey, retired, state: nextState, promotedFromPrHead }, null, 2));
