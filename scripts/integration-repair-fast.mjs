import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './integration.mjs';
import { dependencies, reviewDecision } from './integration-policy.mjs';

export const DEFAULT_REPAIR_LIMIT = 4;
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const REPAIRABLE_MERGE_STATES = new Set(['clean', 'unstable', 'has_hooks', 'behind']);
const HOLD_LABELS = new Set(['integration:hold', 'integration:manual', 'do-not-merge']);

export function repairValidationMatrix(results = []) {
  return results
    .filter(item => item?.state === 'merged-forward' && Number.isSafeInteger(Number(item.pr)) &&
      /^[0-9a-f]{40}$/i.test(item.sha || '') && /^[0-9a-f]{40}$/i.test(item.develop || ''))
    .map(item => ({ pr: Number(item.pr), head: item.sha, base: item.develop }));
}

export function fastRepairCandidate(pr, repository) {
  return pr?.state === 'open' && !pr.draft && pr.base?.ref === 'develop' &&
    pr.base?.repo?.full_name === repository && pr.head?.repo?.full_name === repository &&
    TRUSTED.has(pr.author_association) && dependencies(pr.body || '').length > 0;
}

function explicitHold(pr) {
  const labels = (pr.labels || []).map(label => label.name);
  return labels.some(label => HOLD_LABELS.has(label)) || /^Integration-Hold:\s*\S+/im.test(pr.body || '');
}

async function unresolvedThreads(c, pr) {
  let cursor = null;
  do {
    const [owner, name] = pr.base.repo.full_name.split('/');
    const data = await c.api('POST', '/graphql', {
      query: `query($owner:String!,$name:String!,$number:Int!,$cursor:String){repository(owner:$owner,name:$name){pullRequest(number:$number){reviewThreads(first:100,after:$cursor){nodes{isResolved}pageInfo{hasNextPage endCursor}}}}}`,
      variables: { owner, name, number: pr.number, cursor },
    });
    if (data.errors) throw new Error('FAST_REPAIR_REVIEW_THREADS_UNAVAILABLE');
    const threads = data.data?.repository?.pullRequest?.reviewThreads;
    if (!threads) throw new Error('FAST_REPAIR_REVIEW_THREADS_UNAVAILABLE');
    if (threads.nodes.some(thread => !thread.isResolved)) return true;
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);
  return false;
}

export async function reconcileStackFast(c, expected, develop, { repository = 'charukun/soul-lineage' } = {}) {
  if (!fastRepairCandidate(expected, repository)) return { state: 'not-stacked' };
  const deps = dependencies(expected.body || '');
  const depStates = await Promise.all(deps.map(number => c.api('GET', `${c.root}/pulls/${number}`)));
  if (!depStates.every(dep => (dep.merged || dep.merged_at) && dep.base?.ref === 'develop' && dep.base?.repo?.full_name === repository)) {
    return { state: 'dependency-wait' };
  }

  const pr = await c.api('GET', `${c.root}/pulls/${expected.number}`);
  if (!fastRepairCandidate(pr, repository) || pr.head.sha !== expected.head.sha || explicitHold(pr)) return { state: 'safety-hold' };
  if (pr.mergeable !== true || !REPAIRABLE_MERGE_STATES.has(pr.mergeable_state)) return { state: 'safety-hold' };
  const reviews = await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10 });
  if (reviewDecision(reviews, pr.head.sha).rejected || await unresolvedThreads(c, pr)) return { state: 'safety-hold' };

  const [before, branch] = await Promise.all([
    c.api('GET', `${c.root}/pulls/${pr.number}`),
    c.api('GET', `${c.root}/branches/develop`),
  ]);
  if (before.head.sha !== pr.head.sha || branch.commit.sha !== develop || explicitHold(before)) return { state: 'changed' };

  try {
    const result = await c.api('POST', `${c.root}/merges`, {
      base: pr.head.ref,
      head: develop,
      commit_message: `Merge develop into ${pr.head.ref} after dependencies ${deps.map(number => `#${number}`).join(', ')}`,
    });
    if (!result) return { state: 'already-current' };
    if (!/^[0-9a-f]{40}$/.test(result.sha || '')) throw new Error('FAST_REPAIR_RESULT_INVALID');
    const after = await c.api('GET', `${c.root}/pulls/${pr.number}`);
    if (!fastRepairCandidate(after, repository) || explicitHold(after) || after.body !== pr.body || after.head.ref !== pr.head.ref) {
      return { state: 'changed', reason: 'PR_CHANGED_AFTER_FAST_REPAIR' };
    }
    if (after.head.sha !== result.sha) {
      // The PR representation can lag a successful merge. Confirm the actual ref
      // only when it still reports our original head; never accept a third writer.
      if (after.head.sha !== pr.head.sha) return { state: 'changed', reason: 'FAST_REPAIR_HEAD_NOT_OBSERVED' };
      const refPath = pr.head.ref.split('/').map(encodeURIComponent).join('/');
      const ref = await c.api('GET', `${c.root}/git/ref/heads/${refPath}`);
      if (ref.object?.type !== 'commit' || ref.object.sha !== result.sha) {
        return { state: 'changed', reason: 'FAST_REPAIR_HEAD_NOT_OBSERVED' };
      }
    }
    return { state: 'merged-forward', sha: result.sha, previousHead: pr.head.sha, develop, dependencies: deps };
  } catch (error) {
    if (/HTTP 409\b/.test(error.message)) return { state: 'conflict', reason: 'STACK_RECONCILE_CONFLICT' };
    throw error;
  }
}

export async function repairReadyStacks(c, repository, { limit = DEFAULT_REPAIR_LIMIT, reconcile = reconcileStackFast } = {}) {
  const startedAt = new Date().toISOString();
  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const candidates = open.filter(pr => fastRepairCandidate(pr, repository)).slice(0, limit);
  const results = [];

  for (const snapshot of candidates) {
    try {
      const [pr, branch] = await Promise.all([
        c.api('GET', `${c.root}/pulls/${snapshot.number}`),
        c.api('GET', `${c.root}/branches/develop`),
      ]);
      if (!fastRepairCandidate(pr, repository) || pr.head.sha !== snapshot.head.sha) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'PR_CHANGED_BEFORE_FAST_REPAIR' });
        continue;
      }
      if (branch.commit.sha !== develop) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'DEVELOP_CHANGED_BEFORE_FAST_REPAIR' });
        break;
      }
      const outcome = await reconcile(c, pr, develop, { repository });
      results.push({ pr: pr.number, ...outcome });
    } catch (error) {
      results.push({ pr: snapshot.number, state: 'error', reason: error.message });
    }
  }

  return {
    mode: 'FAST_REPAIR',
    startedAt,
    finishedAt: new Date().toISOString(),
    develop,
    evaluated: candidates.length,
    results,
    matrix: repairValidationMatrix(results),
  };
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.equal(repository, 'charukun/soul-lineage', 'FAST_REPAIR_REPOSITORY_MISMATCH');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'FAST_REPAIR_TRUSTED_DEVELOP_ONLY');
  assert.ok(token, 'GH_TOKEN is required');

  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-repair-api.json',
  });
  const report = await repairReadyStacks(c, repository, {
    limit: Number(process.env.INTEGRATION_REPAIR_LIMIT || DEFAULT_REPAIR_LIMIT),
  });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/integration-repair.json', JSON.stringify({ ...report, api: c.metrics() }, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_has_work=${report.matrix.length > 0}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_matrix=${JSON.stringify({ include: report.matrix })}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
