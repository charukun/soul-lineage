import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  client,
  ensureTrustedReview,
  isValidationRun,
  queueContext,
  reviewsWithTrustedStatus,
  validationRuns,
} from './integration.mjs';
import { dependencies, eligibility } from './integration-policy.mjs';

export const maxFastLaneMerges = 24;
const trustedReviewReason = 'automation/deployment change requires approval of this head by a maintainer';

function labels(pr) {
  return (pr.labels || []).map(item => item.name);
}

function priority(pr) {
  const values = labels(pr);
  if (values.includes('integration:repair')) return 0;
  if (values.includes('integration:priority')) return 1;
  return 2;
}

function cheapHoldReason(pr, repository) {
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'develop') return 'not a Ready develop PR';
  if (pr.head.repo?.full_name !== repository || !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association)) {
    return 'external contribution requires Integration review';
  }
  if (labels(pr).some(value => ['integration:hold', 'integration:manual', 'do-not-merge'].includes(value)) ||
      /^Integration-Hold:\s*\S+/im.test(pr.body || '')) return 'explicit Integration hold';
  return null;
}

async function unresolvedThreads(c, pr) {
  const [owner, name] = pr.base.repo.full_name.split('/');
  let cursor = null;
  do {
    const data = await c.api('POST', '/graphql', {
      query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}`,
      variables: { owner, name, number: pr.number, cursor },
    });
    if (data.errors) throw new Error('Cannot establish review thread state');
    const result = data.data.repository.pullRequest.reviewThreads;
    if (result.nodes.some(thread => !thread.isResolved)) return true;
    cursor = result.pageInfo.hasNextPage ? result.pageInfo.endCursor : null;
  } while (cursor);
  return false;
}

export async function exactHeadFastGate(c, pr, options = {}) {
  const cache = options.cache === true;
  const runs = await validationRuns(c, pr, { cache });
  const run = runs.find(isValidationRun);
  if (!run) return false;
  const [artifacts, jobs] = await Promise.all([
    c.pages(`/actions/runs/${run.id}/artifacts`, 'artifacts', { maxPages: 3, cache }),
    c.pages(`/actions/runs/${run.id}/jobs?filter=latest`, 'jobs', { maxPages: 3, cache }),
  ]);
  const artifact = artifacts.some(item => item.name === `pr-fast-${pr.number}-${pr.head.sha}` && !item.expired);
  const build = jobs.find(job => job.name === 'Validate and build');
  return artifact && build?.status === 'completed' && build.conclusion === 'success';
}

async function queueStatus(c, item, state, description, targetUrl) {
  if (!item?.head?.sha) return;
  await c.api('POST', `${c.root}/statuses/${item.head.sha}`, {
    state,
    context: queueContext,
    description: String(description).slice(0, 140),
    ...(targetUrl ? { target_url: targetUrl } : {}),
  });
}

async function dependencyState(c, pr) {
  const numbers = dependencies(pr.body || '');
  const values = await Promise.all(numbers.map(number => c.api('GET', `${c.root}/pulls/${number}`)));
  return values.every(item => item.merged && item.base.ref === 'develop' && item.base.repo.full_name === pr.base.repo.full_name);
}

async function settleMergeability(c, pr, wait) {
  let current = pr;
  for (let attempt = 0; current.mergeable === null && attempt < 3; attempt++) {
    await wait(500);
    current = await c.api('GET', `${c.root}/pulls/${pr.number}`);
  }
  return current;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function integrateFastLane(c, repository, options = {}) {
  const wait = options.wait || sleep;
  const maxMerges = Number(options.maxMerges || maxFastLaneMerges);
  const targetUrl = options.targetUrl || null;
  const report = {
    mode: 'FAST_LANE',
    startedAt: new Date().toISOString(),
    merged: [],
    held: [],
    evaluated: 0,
    browserBlocking: false,
    developHealthBlocking: false,
  };

  const branch = () => c.api('GET', `${c.root}/branches/develop`);
  let expected = (await branch()).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10 });
  const ready = open.filter(pr => !pr.draft).sort((a, b) => priority(a) - priority(b) ||
    String(a.created_at || '').localeCompare(String(b.created_at || '')) || a.number - b.number);

  for (const snapshot of ready) {
    if (report.merged.length >= maxMerges) break;
    report.evaluated++;
    try {
      let pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
      pr = await settleMergeability(c, pr, wait);
      const quick = cheapHoldReason(pr, repository);
      if (quick) {
        report.held.push({ pr: pr.number, head: pr.head?.sha || null, reason: quick });
        await queueStatus(c, pr, 'pending', quick, targetUrl);
        continue;
      }

      const [files, dependencyMerged, unresolved, checksPassed] = await Promise.all([
        c.pages(`/pulls/${pr.number}/files`, undefined, { maxPages: 30, cache: true }).then(items => items.flatMap(file => [file.filename, file.previous_filename].filter(Boolean))),
        dependencyState(c, pr),
        unresolvedThreads(c, pr),
        exactHeadFastGate(c, pr, { cache: true }),
      ]);
      let reviews = await reviewsWithTrustedStatus(c, pr,
        await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10, cache: true }), { cache: true });

      const ownDiff = await c.api('GET', `${c.root}/compare/${expected}...${pr.head.sha}`, null, { cache: true });
      const base = ownDiff.merge_base_commit.sha;
      const comparison = base === expected ? { files: [] } : await c.api('GET', `${c.root}/compare/${base}...${expected}`, null, { cache: true });
      if ((comparison.files || []).length >= 300) throw new Error('Large base comparison needs manual Integration review');
      const criteria = () => ({
        pr,
        repository,
        files,
        reviews,
        unresolved,
        dependenciesMerged: dependencyMerged,
        checksPassed,
        baseChanges: (comparison.files || []).flatMap(file => [file.filename, file.previous_filename].filter(Boolean)),
        recovery: false,
      });

      let reason = eligibility(criteria());
      if (reason === trustedReviewReason) {
        reviews = await ensureTrustedReview(c, pr);
        reason = eligibility(criteria());
      }
      if (reason) {
        report.held.push({ pr: pr.number, head: pr.head.sha, reason });
        await queueStatus(c, pr, 'pending', reason, targetUrl);
        continue;
      }

      if ((await branch()).commit.sha !== expected) throw new Error('develop moved outside this Fast Lane batch');
      const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
      if (fresh.head.sha !== pr.head.sha || fresh.body !== pr.body || JSON.stringify(fresh.labels) !== JSON.stringify(pr.labels) ||
          fresh.state !== 'open' || fresh.draft || fresh.base.ref !== 'develop') {
        throw new Error('PR changed during Fast Lane evaluation; retry on next wake');
      }
      const freshReviews = await reviewsWithTrustedStatus(c, fresh,
        await c.pages(`/pulls/${fresh.number}/reviews`, undefined, { maxPages: 10 }));
      if (await unresolvedThreads(c, fresh) || !await exactHeadFastGate(c, fresh)) {
        throw new Error('current exact-head fast check/review changed before merge');
      }
      const freshCriteria = { ...criteria(), pr: fresh, reviews: freshReviews };
      const freshReason = eligibility(freshCriteria);
      if (freshReason) throw new Error(freshReason);

      const merged = await c.api('PUT', `${c.root}/pulls/${fresh.number}/merge`, {
        sha: fresh.head.sha,
        merge_method: 'merge',
      });
      assert.equal(merged.merged, true, 'GitHub did not merge the PR');
      expected = merged.sha;
      report.merged.push({ pr: fresh.number, head: fresh.head.sha, merge: merged.sha });
      await queueStatus(c, fresh, 'success', `Merged by Integration Fast Lane as ${merged.sha.slice(0, 12)}`, targetUrl);
      if ((await branch()).commit.sha !== expected) throw new Error('Concurrent develop update after Fast Lane merge');
    } catch (error) {
      report.held.push({ pr: snapshot.number, head: snapshot.head?.sha || null, reason: error.message });
      await queueStatus(c, snapshot, 'pending', error.message, targetUrl).catch(() => {});
      if (/develop.*(moved|update)/i.test(error.message)) break;
    }
  }

  report.sha = (await branch()).commit.sha;
  report.remaining = Math.max(0, ready.length - report.merged.length - report.held.length);
  report.retry = report.remaining > 0;
  report.finishedAt = new Date().toISOString();
  return report;
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.match(repository || '', /^[\w.-]+\/[\w.-]+$/);
  assert.ok(token, 'GH_TOKEN is required');
  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-diagnostics.json',
  });
  const runUrl = process.env.GITHUB_RUN_ID
    ? `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : null;
  const report = await integrateFastLane(c, repository, { targetUrl: runUrl });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/integration.json', JSON.stringify(report, null, 2));
  const output = process.env.GITHUB_OUTPUT;
  if (output) {
    appendFileSync(output, `sha=${report.sha}\n`);
    appendFileSync(output, `verify=false\n`);
    appendFileSync(output, `retry=${report.retry}\n`);
    appendFileSync(output, `cursor=0\n`);
    appendFileSync(output, `merged_count=${report.merged.length}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
