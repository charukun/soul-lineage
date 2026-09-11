import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { contextName, dependencies, eligibility } from './integration-policy.mjs';

export const queueContext = 'integration/queue';
export const validationEvents = ['pull_request', 'pull_request_review'];

export function client(repository, token, request = fetch) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  const root = `/repos/${repository}`;
  async function api(method, path, body) {
    const response = await request(`https://api.github.com${path}`, { method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`GitHub ${method} ${path}: HTTP ${response.status}`);
    return response.status === 204 ? null : response.json();
  }
  async function pages(path, key) {
    const all = [];
    for (let page = 1; page <= 100; page++) {
      const data = await api('GET', `${root}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const values = key ? data[key] : data; assert.ok(Array.isArray(values)); all.push(...values);
      if (values.length < 100) return all;
    }
    throw new Error(`Pagination limit: ${path}`);
  }
  return { api, pages, root };
}
export async function fastGate(c, pr) {
  const runs = await c.pages(`/actions/workflows/ci.yml/runs?head_sha=${pr.head.sha}`, 'workflow_runs');
  const matching = runs.filter(r => r.head_sha === pr.head.sha && r.head_branch === pr.head.ref &&
    r.head_repository?.full_name === pr.head.repo.full_name && validationEvents.includes(r.event));
  matching.sort((a, b) => b.id - a.id);
  if (!matching.length) return false;
  const run = matching[0];
  const artifacts = await c.pages(`/actions/runs/${run.id}/artifacts`, 'artifacts');
  if (!artifacts.some(a => a.name === `pr-fast-${pr.number}-${pr.head.sha}` && !a.expired)) return false;
  const jobs = await c.pages(`/actions/runs/${run.id}/jobs?filter=latest`, 'jobs');
  const gate = jobs.find(j => j.name === 'Validate and build');
  if (gate?.status !== 'completed' || gate.conclusion !== 'success') return false;
  const checks = await c.pages(`/commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs');
  const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`);
  const latestStatuses = new Map();
  for (const status of statuses) if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
  // Dispatch has no role in code validation. Do not deadlock on our own request job.
  return checks.filter(x => x.name !== 'Request Integration').every(x => x.status === 'completed' && ['success', 'neutral', 'skipped'].includes(x.conclusion)) &&
    [...latestStatuses.values()].filter(x => ![contextName, queueContext].includes(x.context)).every(x => x.state === 'success');
}
async function threads(c, pr) {
  let cursor = null;
  do {
    const [owner, name] = pr.base.repo.full_name.split('/');
    const data = await c.api('POST', '/graphql', { query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}`, variables: { owner, name, number: pr.number, cursor } });
    if (data.errors) throw new Error('Cannot establish review thread state');
    const result = data.data.repository.pullRequest.reviewThreads;
    if (result.nodes.some(x => !x.isResolved)) return true;
    cursor = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
  } while (cursor);
  return false;
}
export async function integrate(c, repository, wait = delay) {
  const report = { startedAt: new Date().toISOString(), merged: [], held: [] };
  const branch = () => c.api('GET', `${c.root}/branches/develop`);
  const current = await branch(); let expected = current.commit.sha;
  const statuses = await c.pages(`/commits/${expected}/statuses`);
  const previous = statuses.find(x => x.context === contextName);
  const recovery = previous && previous.state !== 'success';
  const baselinePending = !previous;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc');
  const pending = open.filter(p => !p.draft);
  // Snapshot all Ready PRs; revisit dependencies after predecessors merge. Bound API work.
  for (let pass = 0; pass < 3 && pending.length && report.merged.length < 8; pass++) {
    if (baselinePending) {
      report.held.push(...pending.map(p => ({ pr: p.number, reason: 'Current develop needs its first final verification before additional merges' })));
      break;
    }
    let progress = false;
    for (const snapshot of [...pending]) {
      if (report.merged.length >= 8) break;
      try {
        let pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
        // GitHub recomputes mergeability after each predecessor merge. Allow that
        // asynchronous calculation to settle without dropping the only wakeup.
        for (let attempt = 0; pr.mergeable === null && attempt < 3; attempt++) {
          await wait(1000);
          pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
        }
        if (pr.state !== 'open') { pending.splice(pending.indexOf(snapshot), 1); continue; }
        const deps = dependencies(pr.body || '');
        const depStates = await Promise.all(deps.map(n => c.api('GET', `${c.root}/pulls/${n}`)));
        const files = (await c.pages(`/pulls/${pr.number}/files`)).flatMap(f => [f.filename, f.previous_filename].filter(Boolean));
        const [reviews, unresolved, checksPassed] = await Promise.all([
          c.pages(`/pulls/${pr.number}/reviews`), threads(c, pr), fastGate(c, pr),
        ]);
        // Compare the PR merge-base (not the live base ref) with today's develop.
        const ownDiff = await c.api('GET', `${c.root}/compare/${expected}...${pr.head.sha}`);
        const base = ownDiff.merge_base_commit.sha;
        const comparison = base === expected ? { files: [] } : await c.api('GET', `${c.root}/compare/${base}...${expected}`);
        if (comparison.files?.length >= 300) throw new Error('Large base comparison needs manual Integration review');
        const reason = eligibility({ pr, repository, files, reviews, unresolved,
          dependenciesMerged: depStates.every(p => p.merged && p.base.ref === 'develop' && p.base.repo.full_name === repository),
          checksPassed, baseChanges: (comparison.files || []).flatMap(f => [f.filename, f.previous_filename].filter(Boolean)), recovery });
        report.held = report.held.filter(x => x.pr !== pr.number);
        if (reason) { report.held.push({ pr: pr.number, reason }); continue; }
        if ((await branch()).commit.sha !== expected) throw new Error('develop moved outside this Integration batch');
        // Re-read every mutable PR criterion immediately before merge. A moved head, hold,
        // new review or check is never covered by the earlier snapshot.
        const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
        if (fresh.head.sha !== pr.head.sha || fresh.body !== pr.body || JSON.stringify(fresh.labels) !== JSON.stringify(pr.labels) || fresh.draft || fresh.state !== 'open' || fresh.base.ref !== 'develop') throw new Error('PR changed during Integration; retry on its next event');
        const freshReviews = await c.pages(`/pulls/${pr.number}/reviews`);
        if (JSON.stringify(freshReviews) !== JSON.stringify(reviews) || await threads(c, fresh) || !await fastGate(c, fresh)) throw new Error('Checks/reviews changed before merge');
        const merged = await c.api('PUT', `${c.root}/pulls/${pr.number}/merge`, { sha: pr.head.sha, merge_method: 'merge' });
        assert.equal(merged.merged, true, 'GitHub did not merge the PR');
        expected = merged.sha; report.merged.push({ pr: pr.number, head: pr.head.sha, merge: merged.sha });
        report.held = report.held.filter(x => x.pr !== pr.number);
        pending.splice(pending.indexOf(snapshot), 1); progress = true;
        if ((await branch()).commit.sha !== expected) throw new Error('Concurrent develop update after merge; stop this batch');
      } catch (error) {
        report.held = report.held.filter(x => x.pr !== snapshot.number);
        report.held.push({ pr: snapshot.number, reason: error.message });
        // An unexpected base movement ends the batch, while final verification still covers latest develop.
        if (/develop.*(moved|update)/i.test(error.message)) { pending.length = 0; break; }
      }
    }
    if (!progress) break;
  }
  // A successful repair/baseline must wake the queue again. Previously recovery
  // returned retry=false, leaving Ready PRs stranded even after a successful retry.
  // No progress + an already successful baseline stops: holds cannot self-loop.
  report.retry = pending.length > 0 && (baselinePending || recovery || report.merged.length > 0);
  report.sha = (await branch()).commit.sha;
  const finalStatuses = await c.pages(`/commits/${report.sha}/statuses`);
  report.verified = finalStatuses.find(x => x.context === contextName)?.state === 'success';
  return report;
}
export async function recordQueue(c, report, targetUrl) {
  for (const item of [...report.held, ...report.merged]) {
    const pr = await c.api('GET', `${c.root}/pulls/${item.pr}`);
    const merged = Boolean(item.merge);
    const status = { context: queueContext, state: merged ? 'success' : 'pending',
      description: (merged ? `Merged into develop: ${item.merge.slice(0, 12)}; see DEV result` : `Held: ${item.reason}`).slice(0, 140),
      target_url: targetUrl };
    const previous = (await c.pages(`/commits/${pr.head.sha}/statuses`)).find(x => x.context === queueContext);
    if (previous?.state !== status.state || previous?.description !== status.description)
      await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, status);
  }
}
async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'Integration only runs on develop');
  assert.ok(process.env.GH_TOKEN, 'Missing scoped Actions token');
  const c = client(repository, process.env.GH_TOKEN);
  const report = await integrate(c, repository);
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/integration.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await recordQueue(c, report, `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`);
  if (!report.verified) await c.api('POST', `${c.root}/statuses/${report.sha}`, {
    state: 'pending', context: contextName, description: 'Affected fast checks, DEV deployment and public HTTP/source verification',
    target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
  });
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${report.sha}\nverify=${!report.verified}\nretry=${report.retry}\n`);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
    `## Integration\nFinal develop: ${report.sha}\n\nMerged: ${report.merged.map(x => `#${x.pr}`).join(', ') || 'none'}\n\n` +
    report.held.map(x => `- #${x.pr}: ${x.reason}\n`).join('') + (report.verified ? '\nAlready verified; no duplicate build or deploy.\n' : ''));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
