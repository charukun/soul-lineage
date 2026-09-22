import assert from 'node:assert/strict';

export const deepRepairSchema = 1;

export function parseDeepRepairIssue(body = '') {
  const match = String(body).match(/<!-- integration-deep-repair:v1\n([^\n]+)\n-->/);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    const pr = Number(state?.pr);
    if (state?.schema !== deepRepairSchema || !Number.isSafeInteger(pr) || pr <= 0 ||
        !/^[0-9a-f]{40}$/i.test(state?.head || '') || state.sourceKey !== `pr:${pr}:head:${state.head}`) return null;
    return state;
  } catch { return null; }
}

function hardTerminal(issue) {
  const state = parseDeepRepairIssue(issue?.body);
  return Boolean(state && (state.state === 'human-required' || state.state === 'completed' || state.attempt >= state.maxAttempts));
}

function exactRank(issue) {
  const state = parseDeepRepairIssue(issue.body);
  if (hardTerminal(issue)) return 0;
  if (issue.state === 'closed') return 4;
  if (state.state === 'working') return 1;
  if (state.state === 'pending') return 2;
  return 3;
}

// Search scales with one source PR repair incident, not repository lifetime history.
// Exact-head status receipts and one recent open page cover search-index propagation delay.
export async function findDeepRepairIssue(c, { repository, pr }) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  assert.match(pr.head.sha, /^[0-9a-f]{40}$/i);
  const sourceKey = `pr:${pr.number}:head:${pr.head.sha}`;
  const samePr = issue => {
    const state = parseDeepRepairIssue(issue?.body);
    return !issue?.pull_request && state?.pr === pr.number;
  };
  const exact = issue => {
    const state = parseDeepRepairIssue(issue?.body);
    return samePr(issue) && state?.sourceKey === sourceKey && state.head === pr.head.sha;
  };
  const query = `repo:${repository} is:issue is:open in:body "pr:${pr.number}:head:" "integration-deep-repair:v1"`;
  const [search, statuses, recent] = await Promise.all([
    c.api('GET', `/search/issues?q=${encodeURIComponent(query)}&per_page=100`),
    c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10 }),
    c.api('GET', `${c.root}/issues?state=open&sort=created&direction=desc&per_page=100`),
  ]);
  assert.ok(search.incomplete_results === false && Array.isArray(search.items) &&
    Number.isSafeInteger(search.total_count) && search.total_count === search.items.length,
  'INCOMPLETE_DEEP_REPAIR_SEARCH');
  assert.ok(Array.isArray(recent), 'INVALID_DEEP_REPAIR_RECENT_ISSUES');
  const numbers = new Set(search.items.filter(samePr).map(issue => issue.number));
  for (const issue of recent.filter(samePr)) numbers.add(issue.number);
  const receipt = statuses.find(item => item.context === 'integration/deep-repair');
  const prefix = `https://github.com/${repository}/issues/`;
  if (receipt?.target_url?.startsWith(prefix)) {
    const value = receipt.target_url.slice(prefix.length);
    if (/^[1-9]\d*$/.test(value)) numbers.add(Number(value));
  }
  const current = await Promise.all([...numbers].map(number => {
    assert.ok(Number.isSafeInteger(number) && number > 0, 'INVALID_DEEP_REPAIR_ISSUE_NUMBER');
    return c.api('GET', `${c.root}/issues/${number}`);
  }));
  const candidates = current.filter(samePr);

  // Never auto-clear a still-open human-required/exhausted incident just because the source head moved.
  const protectedIncident = candidates
    .filter(issue => issue.state !== 'closed' && hardTerminal(issue))
    .sort((a, b) => b.number - a.number)[0];
  if (protectedIncident) return protectedIncident;

  const exactIssue = candidates.filter(exact)
    .sort((a, b) => exactRank(a) - exactRank(b) || b.number - a.number)[0];
  if (exactIssue) return exactIssue;

  // A head change is a new exact-head generation inside the same open PR repair incident.
  return candidates.filter(issue => issue.state !== 'closed').sort((a, b) => b.number - a.number)[0] || null;
}
