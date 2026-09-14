import assert from 'node:assert/strict';
import { fastGate } from './integration.mjs';
import { conflictScope } from './integration-rescue-policy.mjs';
import { planIntegrationTrain } from './integration-flow-control.mjs';

export const DEFAULT_PARALLEL_PREFLIGHT = 6;
export const MAX_PARALLEL_PREFLIGHT = 6;

function positiveInt(value, fallback = DEFAULT_PARALLEL_PREFLIGHT) {
  const parsed = Number(value ?? fallback);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_PARALLEL_PREFLIGHT) {
    throw new Error(`Invalid Integration preflight concurrency: expected 1..${MAX_PARALLEL_PREFLIGHT}`);
  }
  return parsed;
}

export async function mapWithConcurrency(items, limit, worker) {
  assert.ok(Array.isArray(items), 'PARALLEL_PREFLIGHT_ITEMS_REQUIRED');
  assert.equal(typeof worker, 'function', 'PARALLEL_PREFLIGHT_WORKER_REQUIRED');
  const concurrency = positiveInt(limit);
  if (!items.length) return [];
  const results = new Array(items.length);
  let cursor = 0;
  async function run() {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await worker(items[index], index) };
      } catch (error) {
        results[index] = { status: 'rejected', reason: error };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => run()));
  return results;
}

async function warmCandidate(c, repository, develop, snapshot) {
  const pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`, null, { cache: true });
  if (pr.state !== 'open' || pr.draft || pr.base?.ref !== 'develop' || pr.head?.repo?.full_name !== repository) {
    return { pr: snapshot.number, head: pr.head?.sha || snapshot.head?.sha || null, skipped: true, reason: 'not a same-repository Ready develop PR' };
  }
  const [files, reviews, checksPassed, ownDiff] = await Promise.all([
    c.pages(`/pulls/${pr.number}/files`, undefined, { maxPages: 30, cache: true }),
    c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10, cache: true }),
    fastGate(c, pr, { cache: true }),
    c.api('GET', `${c.root}/compare/${develop}...${pr.head.sha}`, null, { cache: true }),
  ]);
  const paths = files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
  return {
    pr: pr.number,
    head: pr.head.sha,
    title: pr.title,
    body: pr.body || '',
    prSnapshot: pr,
    checksPassed,
    reviewCount: reviews.length,
    mergeBase: ownDiff?.merge_base_commit?.sha || null,
    scope: conflictScope(paths, pr.body || ''),
  };
}

export async function primeParallelIntegrationPreflight(c, repository, options = {}) {
  const started = Date.now();
  const concurrency = positiveInt(options.concurrency);
  const maxCandidates = Math.max(concurrency, Number(options.maxCandidates || concurrency));
  const develop = (await c.api('GET', `${c.root}/branches/develop`, null, { cache: true })).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10, cache: true });
  const candidates = open.filter(pr => !pr.draft && pr.base?.ref === 'develop' && pr.head?.repo?.full_name === repository).slice(0, maxCandidates);
  if (candidates.length < 2) return {
    enabled: false,
    reason: 'fewer than two same-repository Ready PRs',
    concurrency,
    develop,
    candidates: candidates.map(pr => pr.number),
    warmed: [],
    failed: [],
    batch: [],
    durationMs: Date.now() - started,
  };

  const settled = await mapWithConcurrency(candidates, concurrency, snapshot => warmCandidate(c, repository, develop, snapshot));
  const warmed = settled.filter(item => item.status === 'fulfilled' && !item.value?.skipped).map(item => item.value);
  const failed = settled.flatMap((item, index) => item.status === 'rejected'
    ? [{ pr: candidates[index].number, reason: item.reason?.message || String(item.reason) }]
    : item.value?.skipped ? [{ pr: item.value.pr, reason: item.value.reason }] : []);
  const scopeByPr = new Map(warmed.map(item => [item.pr, item.scope]));
  const trainItems = warmed.map(item => ({ ...item.prSnapshot, number: item.pr, body: item.body }));
  const batch = planIntegrationTrain(trainItems, scopeByPr, { max: concurrency }).selected.map(item => item.number);
  return {
    enabled: true,
    concurrency,
    develop,
    candidates: candidates.map(pr => pr.number),
    warmed: warmed.map(item => ({ pr: item.pr, head: item.head, checksPassed: item.checksPassed, reviewCount: item.reviewCount, mergeBase: item.mergeBase, scope: item.scope })),
    failed,
    batch,
    durationMs: Date.now() - started,
  };
}
