import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './integration.mjs';
import { dependencies, reviewDecision, scope } from './integration-policy.mjs';
import { comparison as completeComparison } from './integration-rescue-store.mjs';

export const DEFAULT_REFRESH_LIMIT = 4;
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);
const REPAIRABLE_MERGE_STATES = new Set(['clean', 'unstable', 'has_hooks', 'behind']);
const HOLD_LABELS = new Set(['integration:hold', 'integration:manual', 'do-not-merge']);
const gitSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);

export function staleReadyValidationMatrix(results = []) {
  return results
    .filter(item => item?.state === 'merged-forward' && Number.isSafeInteger(Number(item.pr)) &&
      gitSha(item.sha) && gitSha(item.develop))
    .map(item => ({ pr: Number(item.pr), head: item.sha, base: item.develop }));
}

export function staleReadyCandidate(pr, repository) {
  if (!(pr?.state === 'open' && !pr.draft && pr.base?.ref === 'develop' &&
      pr.base?.repo?.full_name === repository && pr.head?.repo?.full_name === repository &&
      TRUSTED.has(pr.author_association))) return false;
  try {
    return dependencies(pr.body || '').length === 0;
  } catch {
    return false;
  }
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
    if (data.errors) throw new Error('STALE_REFRESH_REVIEW_THREADS_UNAVAILABLE');
    const threads = data.data?.repository?.pullRequest?.reviewThreads;
    if (!threads) throw new Error('STALE_REFRESH_REVIEW_THREADS_UNAVAILABLE');
    if (threads.nodes.some(thread => !thread.isResolved)) return true;
    cursor = threads.pageInfo.hasNextPage ? threads.pageInfo.endCursor : null;
  } while (cursor);
  return false;
}

export async function baseDrift(c, pr, develop) {
  const own = await c.api('GET', `${c.root}/compare/${develop}...${pr.head.sha}`);
  const base = own.merge_base_commit?.sha;
  if (!gitSha(base)) throw new Error('INCOMPLETE_BASE_COMPARISON');
  if (base === develop) return { base, current: true, overlap: false, prFiles: [], baseChanges: [] };

  const [files, comparison] = await Promise.all([
    c.pages(`/pulls/${pr.number}/files`, undefined, { maxPages: 30 }),
    completeComparison(c, base, develop),
  ]);
  const prFiles = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
  const changedScopes = new Set(comparison.files.map(scope));
  return {
    base,
    current: false,
    overlap: prFiles.some(path => changedScopes.has(scope(path))),
    prFiles,
    baseChanges: comparison.files,
  };
}

export async function reconcileNonOverlappingReady(c, expected, develop, { repository = 'charukun/soul-lineage' } = {}) {
  if (!staleReadyCandidate(expected, repository)) return { state: 'not-candidate' };
  const pr = await c.api('GET', `${c.root}/pulls/${expected.number}`);
  if (!staleReadyCandidate(pr, repository) || pr.head.sha !== expected.head.sha || explicitHold(pr)) return { state: 'safety-hold' };

  const drift = await baseDrift(c, pr, develop);
  if (drift.current) return { state: 'already-current', base: drift.base, develop };
  if (drift.overlap) return { state: 'semantic-overlap', base: drift.base, develop };
  if (pr.mergeable !== true || !REPAIRABLE_MERGE_STATES.has(pr.mergeable_state)) return { state: 'safety-hold' };

  const reviews = await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10 });
  if (reviewDecision(reviews, pr.head.sha).rejected || await unresolvedThreads(c, pr)) return { state: 'safety-hold' };

  const [before, branch] = await Promise.all([
    c.api('GET', `${c.root}/pulls/${pr.number}`),
    c.api('GET', `${c.root}/branches/develop`),
  ]);
  if (!staleReadyCandidate(before, repository) || before.head.sha !== pr.head.sha || branch.commit.sha !== develop ||
      before.body !== pr.body || explicitHold(before)) return { state: 'changed' };

  try {
    const result = await c.api('POST', `${c.root}/merges`, {
      base: pr.head.ref,
      head: develop,
      commit_message: `Merge develop into ${pr.head.ref} after non-overlapping develop drift`,
    });
    if (!result) return { state: 'already-current', base: drift.base, develop };
    if (!gitSha(result.sha)) throw new Error('STALE_REFRESH_RESULT_INVALID');

    const after = await c.api('GET', `${c.root}/pulls/${pr.number}`);
    if (!staleReadyCandidate(after, repository) || explicitHold(after) || after.body !== pr.body || after.head.ref !== pr.head.ref) {
      return { state: 'changed', reason: 'PR_CHANGED_AFTER_STALE_REFRESH' };
    }
    if (after.head.sha !== result.sha) {
      if (after.head.sha !== pr.head.sha) return { state: 'changed', reason: 'STALE_REFRESH_HEAD_NOT_OBSERVED' };
      const refPath = pr.head.ref.split('/').map(encodeURIComponent).join('/');
      const ref = await c.api('GET', `${c.root}/git/ref/heads/${refPath}`);
      if (ref.object?.type !== 'commit' || ref.object.sha !== result.sha) {
        return { state: 'changed', reason: 'STALE_REFRESH_HEAD_NOT_OBSERVED' };
      }
    }
    return {
      state: 'merged-forward',
      sha: result.sha,
      previousHead: pr.head.sha,
      base: drift.base,
      develop,
      reason: 'non-overlapping-base-refresh',
    };
  } catch (error) {
    if (/HTTP 409\b/.test(error.message)) return { state: 'conflict', reason: 'STALE_REFRESH_CONFLICT' };
    throw error;
  }
}

export async function refreshStaleReady(c, repository, { limit = DEFAULT_REFRESH_LIMIT, reconcile = reconcileNonOverlappingReady } = {}) {
  const startedAt = new Date().toISOString();
  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10 });
  const candidates = open.filter(pr => staleReadyCandidate(pr, repository));
  const results = [];
  let evaluated = 0;
  let refreshed = 0;

  for (const snapshot of candidates) {
    if (refreshed >= limit) break;
    evaluated++;
    try {
      const [pr, branch] = await Promise.all([
        c.api('GET', `${c.root}/pulls/${snapshot.number}`),
        c.api('GET', `${c.root}/branches/develop`),
      ]);
      if (!staleReadyCandidate(pr, repository) || pr.head.sha !== snapshot.head.sha) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'PR_CHANGED_BEFORE_STALE_REFRESH' });
        continue;
      }
      if (branch.commit.sha !== develop) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'DEVELOP_CHANGED_BEFORE_STALE_REFRESH' });
        break;
      }
      const outcome = await reconcile(c, pr, develop, { repository });
      results.push({ pr: pr.number, ...outcome });
      if (outcome?.state === 'merged-forward') refreshed++;
    } catch (error) {
      results.push({ pr: snapshot.number, state: 'error', reason: error.message });
    }
  }

  return {
    mode: 'STALE_READY_REFRESH',
    startedAt,
    finishedAt: new Date().toISOString(),
    develop,
    evaluated,
    refreshed,
    results,
    matrix: staleReadyValidationMatrix(results),
  };
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.equal(repository, 'charukun/soul-lineage', 'STALE_REFRESH_REPOSITORY_MISMATCH');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'STALE_REFRESH_TRUSTED_DEVELOP_ONLY');
  assert.ok(token, 'GH_TOKEN is required');

  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-stale-refresh-api.json',
  });
  const report = await refreshStaleReady(c, repository, {
    limit: Number(process.env.INTEGRATION_STALE_REFRESH_LIMIT || DEFAULT_REFRESH_LIMIT),
  });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/integration-stale-refresh.json', JSON.stringify({ ...report, api: c.metrics() }, null, 2));
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `has_work=${report.refreshed > 0}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `refreshed=${report.refreshed}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `validation_has_work=${report.matrix.length > 0}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `validation_matrix=${JSON.stringify({ include: report.matrix })}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
