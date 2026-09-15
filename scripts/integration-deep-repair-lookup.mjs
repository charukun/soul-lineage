import assert from 'node:assert/strict';

export const deepRepairSchema = 1;

export function parseDeepRepairIssue(body = '') {
  const match = String(body).match(/<!-- integration-deep-repair:v1\n([^\n]+)\n-->/);
  if (!match) return null;
  try {
    const state = JSON.parse(match[1]);
    if (state?.schema !== deepRepairSchema || !state.sourceKey || !state.head || !state.pr) return null;
    return state;
  } catch { return null; }
}

function rank(issue) {
  const state = parseDeepRepairIssue(issue.body);
  if (!['pending', 'working'].includes(state.state) || state.attempt >= state.maxAttempts) return 0;
  if (issue.state === 'closed') return 3;
  return state.state === 'working' ? 1 : 2;
}

// Search scales with one source head, not the repository's lifetime PR/Issue count.
// Status receipts and one recent open page cover search-index propagation delay.
export async function findDeepRepairIssue(c, { repository, pr }) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  assert.match(pr.head.sha, /^[0-9a-f]{40}$/i);
  const sourceKey = `pr:${pr.number}:head:${pr.head.sha}`;
  const exact = issue => {
    const state = parseDeepRepairIssue(issue?.body);
    return !issue?.pull_request && state?.sourceKey === sourceKey &&
      state.head === pr.head.sha && state.pr === pr.number;
  };
  const query = `repo:${repository} is:issue in:body "${pr.head.sha}" "integration-deep-repair:v1"`;
  const [search, statuses, recent] = await Promise.all([
    c.api('GET', `/search/issues?q=${encodeURIComponent(query)}&per_page=100`),
    c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10 }),
    c.api('GET', `${c.root}/issues?state=open&sort=created&direction=desc&per_page=100`),
  ]);
  assert.ok(search.incomplete_results === false && Array.isArray(search.items) &&
    Number.isSafeInteger(search.total_count) && search.total_count === search.items.length,
  'INCOMPLETE_DEEP_REPAIR_SEARCH');
  assert.ok(Array.isArray(recent), 'INVALID_DEEP_REPAIR_RECENT_ISSUES');
  const numbers = new Set(search.items.filter(exact).map(issue => issue.number));
  for (const issue of recent.filter(exact)) numbers.add(issue.number);
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
  // An older human-required/exhausted generation must not be hidden by a duplicate pending ticket.
  return current.filter(exact).sort((a, b) => rank(a) - rank(b) || a.number - b.number)[0] || null;
}
