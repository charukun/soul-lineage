import assert from 'node:assert/strict';
import { controlPlaneScope } from './integration-control-plane.mjs';

export const WAKE_CONTEXT = 'integration/wakeup';
const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'pending', 'requested']);
const CONTROL_WORKFLOWS = new Set(['Deploy DEV and PROD']);

export function activeControlRuns(runs = [], currentRunId = null) {
  return runs.filter(run => CONTROL_WORKFLOWS.has(run?.name) && run?.head_branch === 'develop' &&
    ACTIVE.has(run.status) && String(run.id) !== String(currentRunId || ''));
}

export function requestDecision({ runs = [], currentRunId = null, control = false } = {}) {
  const active = activeControlRuns(runs, currentRunId);
  return { action: active.length ? 'coalesce' : 'dispatch', active: active.map(run => run.id), control };
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const prNumber = Number(process.env.PR_NUMBER || 0);
  const expectedHead = process.env.HEAD_SHA;
  assert.equal(repository, 'charukun/soul-lineage');
  assert.ok(token && prNumber && /^[0-9a-f]{40}$/.test(expectedHead || ''));
  const root = `https://api.github.com/repos/${repository}`;
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  const api = async (method, path, body) => {
    const response = await fetch(`${root}${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
    return response.status === 204 ? null : response.json();
  };
  const pr = await api('GET', `/pulls/${prNumber}`);
  if (pr.state !== 'open' || pr.draft || pr.base?.ref !== 'develop' || pr.head?.sha !== expectedHead ||
      pr.head?.repo?.full_name !== repository || !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association)) {
    console.log(JSON.stringify({ action: 'noop-stale-or-untrusted', pr: prNumber }));
    return;
  }
  const changed = [];
  for (let page = 1; page <= 10; page++) {
    const values = await api('GET', `/pulls/${prNumber}/files?per_page=100&page=${page}`);
    changed.push(...values.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)));
    if (values.length < 100) break;
    if (page === 10) throw new Error('CONTROL_PLANE_FILE_PAGE_LIMIT');
  }
  const scope = controlPlaneScope(changed);
  const labels = new Set((pr.labels || []).map(label => label.name));
  if (scope.trusted) {
    const add = ['integration:control-plane', 'integration:repair'].filter(label => !labels.has(label));
    if (add.length) await api('POST', `/issues/${prNumber}/labels`, { labels: add });
  }
  const branch = await api('GET', '/branches/develop');
  const develop = branch.commit.sha;
  const runs = await api('GET', '/actions/workflows/deploy.yml/runs?branch=develop&per_page=100');
  const decision = requestDecision({ runs: runs.workflow_runs || [], currentRunId: process.env.GITHUB_RUN_ID, control: scope.trusted });
  if (decision.action === 'coalesce') {
    const active = decision.active[0];
    await api('POST', `/statuses/${develop}`, {
      state: 'pending', context: WAKE_CONTEXT,
      description: `Ready queue changed; coalesced behind active gateway run ${active}`.slice(0, 140),
      target_url: `https://github.com/${repository}/actions/runs/${active}`,
    });
  } else {
    await api('POST', '/actions/workflows/deploy.yml/dispatches', { ref: 'develop' });
    await api('POST', `/statuses/${develop}`, {
      state: 'success', context: WAKE_CONTEXT,
      description: 'Integration gateway dispatched for latest Ready queue',
      target_url: `https://github.com/${repository}/actions/workflows/deploy.yml`,
    });
  }
  console.log(JSON.stringify({ ...decision, pr: prNumber, head: expectedHead, develop, scope }, null, 2));
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
