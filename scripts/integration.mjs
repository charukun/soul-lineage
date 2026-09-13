import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { contextName, dependencies, eligibility } from './integration-policy.mjs';
import { integrationRescueReason } from './integration-rescue-policy.mjs';

export const queueContext = 'integration/queue';
export const trustedReviewContext = 'integration/trusted-review';
export const validationEvents = ['pull_request', 'pull_request_review'];
export const trustedReviewPrefix = 'Trusted Integration Review: exact head ';
export const maxReadyEvaluationsPerRun = 12;
export const maxMergesPerRun = 8;
export const defaultIntegrationBudgetMs = 6 * 60 * 1000;
const trustedReviewReason = 'automation/deployment change requires approval of this head by a maintainer';
const retryableServerStatuses = new Set([500, 502, 503, 504]);

function routeName(path) {
  return String(path)
    .replace(/[0-9a-f]{40}/ig, ':sha')
    .replace(/\/runs\/\d+/g, '/runs/:id')
    .replace(/\/pulls\/\d+/g, '/pulls/:id')
    .replace(/\/commits\/[^/?]+/g, '/commits/:ref')
    .replace(/([?&]page=)\d+/g, '$1:page');
}

function numericHeader(response, name) {
  const raw = response?.headers?.get?.(name);
  if (raw === null || raw === undefined || raw === '') return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function retryDelayMs(response, attempt) {
  const retryAfter = numericHeader(response, 'retry-after');
  if (retryAfter !== null && retryAfter >= 0) return retryAfter * 1000;
  const remaining = numericHeader(response, 'x-ratelimit-remaining');
  const reset = numericHeader(response, 'x-ratelimit-reset');
  if (remaining === 0 && reset !== null) return Math.max(1000, reset * 1000 - Date.now() + 250);
  return Math.min(8000, 1000 * (2 ** attempt));
}

export function client(repository, token, request = fetch, options = {}) {
  assert.match(repository, /^[\w.-]+\/[\w.-]+$/);
  const root = `/repos/${repository}`;
  const cache = new Map();
  const wait = options.wait || delay;
  const requestTimeoutMs = Number(options.requestTimeoutMs || 15000);
  const diagnosticsPath = options.diagnosticsPath || process.env.INTEGRATION_DIAGNOSTICS_PATH || null;
  const telemetry = {
    startedAt: new Date().toISOString(),
    heartbeatAt: new Date().toISOString(),
    phase: 'init',
    currentPr: null,
    requests: 0,
    cacheHits: 0,
    retries: 0,
    throttleResponses: 0,
    timeoutResponses: 0,
    rateRemaining: null,
    rateReset: null,
    routes: {},
    lastRequest: null,
  };

  function persist() {
    if (!diagnosticsPath) return;
    try {
      mkdirSync(resolve(diagnosticsPath, '..'), { recursive: true });
      writeFileSync(diagnosticsPath, JSON.stringify({ ...telemetry, elapsedMs: Date.now() - Date.parse(telemetry.startedAt) }, null, 2));
    } catch {
      // Diagnostics must never change Integration safety behavior.
    }
  }

  function mark(phase, currentPr = null) {
    telemetry.phase = phase;
    telemetry.currentPr = currentPr;
    telemetry.heartbeatAt = new Date().toISOString();
    persist();
  }

  async function api(method, path, body, apiOptions = {}) {
    const cacheable = method === 'GET' && apiOptions.cache === true;
    const cacheKey = cacheable ? `${method} ${path}` : null;
    if (cacheKey && cache.has(cacheKey)) {
      telemetry.cacheHits++;
      telemetry.heartbeatAt = new Date().toISOString();
      persist();
      return cache.get(cacheKey);
    }

    const maxAttempts = Number(apiOptions.maxAttempts || 3);
    let lastError;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const route = routeName(path);
      telemetry.requests++;
      telemetry.routes[route] = (telemetry.routes[route] || 0) + 1;
      telemetry.lastRequest = `${method} ${route}`;
      telemetry.heartbeatAt = new Date().toISOString();
      persist();
      let response;
      try {
        response = await request(`https://api.github.com${path}`, {
          method,
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
          ...(body ? { body: JSON.stringify(body) } : {}),
          signal: AbortSignal.timeout(Number(apiOptions.timeoutMs || requestTimeoutMs)),
        });
      } catch (error) {
        lastError = error;
        if (error?.name === 'TimeoutError' || error?.name === 'AbortError') telemetry.timeoutResponses++;
        if (attempt + 1 >= maxAttempts) throw error;
        telemetry.retries++;
        persist();
        await wait(Math.min(8000, 1000 * (2 ** attempt)));
        continue;
      }

      const remaining = numericHeader(response, 'x-ratelimit-remaining');
      const reset = numericHeader(response, 'x-ratelimit-reset');
      if (remaining !== null) telemetry.rateRemaining = remaining;
      if (reset !== null) telemetry.rateReset = new Date(reset * 1000).toISOString();
      if (response.ok) {
        const data = response.status === 204 ? null : await response.json();
        if (cacheKey) cache.set(cacheKey, data);
        telemetry.heartbeatAt = new Date().toISOString();
        persist();
        return data;
      }

      let errorDetail = '';
      try {
        const copy = typeof response.clone === 'function' ? response.clone() : response;
        const payload = await copy.text();
        errorDetail = payload.slice(0, 500);
      } catch {
        // Some test doubles expose only json(); status/headers are still sufficient.
      }
      const secondary = response.status === 403 && /secondary rate limit|abuse detection/i.test(errorDetail);
      const hasRetryAfter = response.headers?.get?.('retry-after') !== null && response.headers?.get?.('retry-after') !== undefined;
      const throttled = response.status === 429 || secondary ||
        (response.status === 403 && (hasRetryAfter || remaining === 0));
      if (throttled) telemetry.throttleResponses++;
      const retryable = throttled || retryableServerStatuses.has(response.status);
      lastError = new Error(`GitHub ${method} ${path}: HTTP ${response.status}${secondary ? ' (secondary rate limit)' : ''}`);
      if (!retryable || attempt + 1 >= maxAttempts) {
        persist();
        throw lastError;
      }
      const waitMs = retryDelayMs(response, attempt);
      // A long primary-rate-limit window cannot be solved inside the 10 minute job.
      // Fail closed with diagnostics instead of hammering the API or sleeping past the job timeout.
      if (waitMs > 60000) {
        persist();
        throw new Error(`${lastError.message}; rate-limit retry window ${waitMs}ms exceeds Integration request budget`);
      }
      telemetry.retries++;
      persist();
      await wait(waitMs);
    }
    throw lastError;
  }

  async function pages(path, key, pageOptions = {}) {
    const all = [];
    const maxPages = Number(pageOptions.maxPages || 10);
    for (let page = 1; page <= maxPages; page++) {
      const pagePath = `${root}${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`;
      const data = await api('GET', pagePath, null, { cache: pageOptions.cache === true, timeoutMs: pageOptions.timeoutMs });
      const values = key ? data[key] : data;
      assert.ok(Array.isArray(values));
      all.push(...values);
      if (values.length < 100) return all;
    }
    throw new Error(`Pagination limit (${maxPages} pages): ${path}`);
  }

  function metrics() {
    return { ...telemetry, routes: { ...telemetry.routes }, elapsedMs: Date.now() - Date.parse(telemetry.startedAt) };
  }

  return { api, pages, root, mark, metrics };
}

export function currentChecks(checks = []) {
  const latest = new Map();
  const ordered = [...checks].sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  for (const check of ordered) {
    if (check.name === 'Request Integration') continue;
    const app = check.app?.id ?? check.app?.slug ?? 'unknown';
    const key = `${app}:${check.name}`;
    if (!latest.has(key)) latest.set(key, check);
  }
  return [...latest.values()];
}

export async function fastGate(c, pr, options = {}) {
  const cache = options.cache === true;
  const runs = await c.pages(`/actions/workflows/ci.yml/runs?head_sha=${pr.head.sha}`, 'workflow_runs', { maxPages: 3, cache });
  const matching = runs.filter(r => r.head_sha === pr.head.sha && r.head_branch === pr.head.ref &&
    r.head_repository?.full_name === pr.head.repo.full_name && validationEvents.includes(r.event));
  matching.sort((a, b) => b.id - a.id);
  if (!matching.length) return false;
  const run = matching[0];
  const artifacts = await c.pages(`/actions/runs/${run.id}/artifacts`, 'artifacts', { maxPages: 3, cache });
  if (!artifacts.some(a => a.name === `pr-fast-${pr.number}-${pr.head.sha}` && !a.expired)) return false;
  const jobs = await c.pages(`/actions/runs/${run.id}/jobs?filter=latest`, 'jobs', { maxPages: 3, cache });
  const gate = jobs.find(j => j.name === 'Validate and build');
  if (gate?.status !== 'completed' || gate.conclusion !== 'success') return false;
  const checks = currentChecks(await c.pages(`/commits/${pr.head.sha}/check-runs?filter=latest`, 'check_runs', { maxPages: 3, cache }));
  const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10, cache });
  const latestStatuses = new Map();
  for (const status of statuses) if (!latestStatuses.has(status.context)) latestStatuses.set(status.context, status);
  // Dispatch has no role in code validation. Superseded check runs from the same
  // app/name are ignored; otherwise a cancelled run replaced by a successful run
  // can strand a Ready PR forever on the same immutable head.
  return checks.every(x => x.status === 'completed' && ['success', 'neutral', 'skipped'].includes(x.conclusion)) &&
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

function syntheticTrustedReview(pr) {
  return {
    id: Number.MAX_SAFE_INTEGER,
    user: { login: 'github-actions[bot]' },
    state: 'APPROVED',
    commit_id: pr.head.sha,
    author_association: 'NONE',
    body: `${trustedReviewPrefix}${pr.head.sha} authorized by trusted develop Integration commit status`,
  };
}

export async function reviewsWithTrustedStatus(c, pr, reviews, options = {}) {
  if (reviews.some(review => review.state === 'APPROVED' && review.commit_id === pr.head.sha &&
      review.user?.login === 'github-actions[bot]' && (review.body || '').startsWith(`${trustedReviewPrefix}${pr.head.sha}`))) return reviews;
  const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 10, cache: options.cache === true });
  const status = statuses.find(item => item.context === trustedReviewContext);
  return status?.state === 'success' ? [...reviews, syntheticTrustedReview(pr)] : reviews;
}

export async function ensureTrustedReview(c, pr) {
  const body = `${trustedReviewPrefix}${pr.head.sha} passed same-repository ownership, Ready-state, dependency, review-thread and current fast-gate checks. Final merge eligibility is re-evaluated immediately after this authorization.`;
  try {
    await c.api('POST', `${c.root}/pulls/${pr.number}/reviews`, {
      commit_id: pr.head.sha,
      event: 'APPROVE',
      body,
    });
    return c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10 });
  } catch (error) {
    // Some repositories disable GitHub Actions approval creation. GitHub returns 422
    // even though the trusted develop workflow itself has already established every
    // other merge prerequisite. Preserve an exact-head, auditable commit status instead.
    if (!/HTTP 422\b/.test(error.message)) throw error;
    await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
      state: 'success',
      context: trustedReviewContext,
      description: `Trusted Integration exact-head authorization ${pr.head.sha.slice(0, 12)}`,
    });
    return reviewsWithTrustedStatus(c, pr, await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10 }));
  }
}

function cheapHoldReason(pr, repository, recovery) {
  if (pr.state !== 'open' || pr.draft || pr.base.ref !== 'develop') return 'not a Ready develop PR';
  if (pr.head.repo?.full_name !== repository || !['OWNER', 'MEMBER', 'COLLABORATOR'].includes(pr.author_association)) return 'external contribution requires Integration review';
  const labels = (pr.labels || []).map(x => x.name);
  if (labels.some(x => ['integration:hold', 'integration:manual', 'do-not-merge'].includes(x)) || /^Integration-Hold:\s*\S+/im.test(pr.body || '')) return 'explicit Integration hold';
  if (recovery && !labels.includes('integration:repair')) return 'previous final develop gate failed; repair first';
  return null;
}

function selectEvaluationWindow(items, limit, cursorInput = process.env.INTEGRATION_EVALUATION_CURSOR) {
  if (!items.length) return { start: 0, selected: [], deferred: [], nextCursor: null };
  const parsed = Number(cursorInput ?? 0);
  const start = Number.isSafeInteger(parsed) && parsed >= 0 && parsed < items.length ? parsed : 0;
  const selected = items.slice(start, start + limit);
  const nextIndex = start + selected.length;
  const nextCursor = nextIndex < items.length ? nextIndex : null;
  return { start, selected, deferred: nextCursor === null ? [] : items.slice(nextCursor), nextCursor };
}

export async function integrate(c, repository, wait = delay, options = {}) {
  const startedMs = Date.now();
  const timeBudgetMs = Number(options.timeBudgetMs || process.env.INTEGRATION_TIME_BUDGET_MS || defaultIntegrationBudgetMs);
  const report = { startedAt: new Date(startedMs).toISOString(), merged: [], held: [], trustedReviewed: [], deferred: [], budgetExhausted: false, evaluationCursor: 0, nextCursor: null, retryCursor: 0 };
  const branch = () => c.api('GET', `${c.root}/branches/develop`);
  c.mark?.('baseline');
  const current = await branch(); let expected = current.commit.sha;
  const statuses = await c.pages(`/commits/${expected}/statuses`, undefined, { maxPages: 10, cache: true });
  const previous = statuses.find(x => x.context === contextName);
  const recovery = previous && previous.state !== 'success';
  const baselinePending = !previous;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10 });
  const ready = open.filter(p => !p.draft);

  const expensive = [];
  for (const snapshot of ready) {
    const reason = cheapHoldReason(snapshot, repository, recovery);
    if (reason) report.held.push({ pr: snapshot.number, head: snapshot.head?.sha || null, reason });
    else expensive.push(snapshot);
  }
  const window = selectEvaluationWindow(expensive, Number(options.maxReadyEvaluationsPerRun || maxReadyEvaluationsPerRun), options.evaluationCursor);
  report.evaluationCursor = window.start;
  report.nextCursor = window.nextCursor;
  const pending = [...window.selected];
  report.deferred.push(...window.deferred.map(p => ({ pr: p.number, head: p.head?.sha || null, reason: 'deferred to next bounded Integration scan' })));

  // Snapshot Ready PRs; revisit dependencies after predecessors merge. Bound API work.
  outer: for (let pass = 0; pass < 3 && pending.length && report.merged.length < maxMergesPerRun; pass++) {
    if (baselinePending) {
      report.held.push(...pending.map(p => ({ pr: p.number, head: p.head?.sha || null, reason: 'Current develop needs its first final verification before additional merges' })));
      break;
    }
    let progress = false;
    for (const snapshot of [...pending]) {
      if (report.merged.length >= maxMergesPerRun) break;
      if (Date.now() - startedMs >= timeBudgetMs) {
        report.budgetExhausted = true;
        report.nextCursor = null;
        for (const item of pending) {
          if (!report.deferred.some(x => x.pr === item.number)) report.deferred.push({ pr: item.number, head: item.head?.sha || null, reason: 'deferred by Integration time budget; wait for the next external wakeup' });
        }
        break outer;
      }
      c.mark?.('evaluate-ready-pr', snapshot.number);
      try {
        let pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
        // GitHub recomputes mergeability after each predecessor merge. Allow that
        // asynchronous calculation to settle without dropping the only wakeup.
        for (let attempt = 0; pr.mergeable === null && attempt < 3; attempt++) {
          await wait(1000);
          pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
        }
        if (pr.state !== 'open') { pending.splice(pending.indexOf(snapshot), 1); continue; }
        const quickReason = cheapHoldReason(pr, repository, recovery);
        if (quickReason) {
          report.held = report.held.filter(x => x.pr !== pr.number);
          report.held.push({ pr: pr.number, head: pr.head.sha, reason: quickReason });
          continue;
        }
        const deps = dependencies(pr.body || '');
        const depStates = await Promise.all(deps.map(n => c.api('GET', `${c.root}/pulls/${n}`)));
        const files = (await c.pages(`/pulls/${pr.number}/files`, undefined, { maxPages: 30, cache: true })).flatMap(f => [f.filename, f.previous_filename].filter(Boolean));
        let reviews = await reviewsWithTrustedStatus(c, pr, await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10, cache: true }), { cache: true });
        const [unresolved, checksPassed] = await Promise.all([threads(c, pr), fastGate(c, pr, { cache: true })]);
        // Compare the PR merge-base (not the live base ref) with today's develop.
        const ownDiff = await c.api('GET', `${c.root}/compare/${expected}...${pr.head.sha}`, null, { cache: true });
        const base = ownDiff.merge_base_commit.sha;
        const comparison = base === expected ? { files: [] } : await c.api('GET', `${c.root}/compare/${base}...${expected}`, null, { cache: true });
        if (comparison.files?.length >= 300) throw new Error('Large base comparison needs manual Integration review');
        const criteria = () => ({ pr, repository, files, reviews, unresolved,
          dependenciesMerged: depStates.every(p => p.merged && p.base.ref === 'develop' && p.base.repo.full_name === repository),
          checksPassed, baseChanges: (comparison.files || []).flatMap(f => [f.filename, f.previous_filename].filter(Boolean)), recovery });
        let reason = eligibility(criteria());
        if (reason === trustedReviewReason) {
          reviews = await ensureTrustedReview(c, pr);
          report.trustedReviewed.push({ pr: pr.number, head: pr.head.sha });
          reason = eligibility(criteria());
        }
        report.held = report.held.filter(x => x.pr !== pr.number);
        if (reason) { report.held.push({ pr: pr.number, head: pr.head.sha, reason }); continue; }
        if ((await branch()).commit.sha !== expected) throw new Error('develop moved outside this Integration batch');
        // Re-read every mutable PR criterion immediately before merge. A moved head, hold,
        // new review or check is never covered by the earlier snapshot. These calls intentionally
        // bypass the run-local cache.
        c.mark?.('final-safety-gate', pr.number);
        const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
        if (fresh.head.sha !== pr.head.sha || fresh.body !== pr.body || JSON.stringify(fresh.labels) !== JSON.stringify(pr.labels) || fresh.draft || fresh.state !== 'open' || fresh.base.ref !== 'develop') throw new Error('PR changed during Integration; retry on its next event');
        const freshReviews = await reviewsWithTrustedStatus(c, fresh, await c.pages(`/pulls/${pr.number}/reviews`, undefined, { maxPages: 10 }));
        if (JSON.stringify(freshReviews) !== JSON.stringify(reviews) || await threads(c, fresh) || !await fastGate(c, fresh)) throw new Error('Checks/reviews changed before merge');
        const merged = await c.api('PUT', `${c.root}/pulls/${pr.number}/merge`, { sha: pr.head.sha, merge_method: 'merge' });
        assert.equal(merged.merged, true, 'GitHub did not merge the PR');
        expected = merged.sha; report.merged.push({ pr: pr.number, head: pr.head.sha, merge: merged.sha });
        report.held = report.held.filter(x => x.pr !== pr.number);
        pending.splice(pending.indexOf(snapshot), 1); progress = true;
        if ((await branch()).commit.sha !== expected) throw new Error('Concurrent develop update after merge; stop this batch');
      } catch (error) {
        report.held = report.held.filter(x => x.pr !== snapshot.number);
        report.held.push({ pr: snapshot.number, head: snapshot.head?.sha || null, reason: error.message });
        // An unexpected base movement ends the batch, while final verification still covers latest develop.
        if (/develop.*(moved|update)/i.test(error.message)) { pending.length = 0; break; }
      }
    }
    if (!progress) break;
  }
  // A successful repair/baseline must wake the queue again. Count-bounded scans use
  // a cursor so a large static set is visited exactly once instead of self-looping.
  const recoveryHeld = recovery && report.held.some(item => item.reason === 'previous final develop gate failed; repair first');
  const countContinuation = report.nextCursor !== null && !report.budgetExhausted;
  report.retry = countContinuation || recoveryHeld || (pending.length > 0 && (baselinePending || recovery || report.merged.length > 0));
  report.retryCursor = (report.merged.length > 0 || baselinePending || recovery) ? 0 : (report.nextCursor ?? 0);
  c.mark?.('final-develop-status');
  report.sha = (await branch()).commit.sha;
  const finalStatuses = await c.pages(`/commits/${report.sha}/statuses`, undefined, { maxPages: 10 });
  report.verified = finalStatuses.find(x => x.context === contextName)?.state === 'success';
  report.finishedAt = new Date().toISOString();
  for (const item of [...report.held, ...report.deferred]) item.rescueReason = integrationRescueReason(item.reason);
  report.durationMs = Date.now() - startedMs;
  return report;
}

export async function recordQueue(c, report, targetUrl) {
  c.mark?.('record-queue-status');
  for (const item of [...report.held, ...report.merged]) {
    const merged = Boolean(item.merge);
    let head = item.head;
    if (!merged) {
      const pr = await c.api('GET', `${c.root}/pulls/${item.pr}`);
      head = pr.head.sha;
    } else if (!head) {
      const pr = await c.api('GET', `${c.root}/pulls/${item.pr}`);
      head = pr.head.sha;
    }
    const status = { context: queueContext, state: merged ? 'success' : 'pending',
      description: (merged ? `Merged into develop: ${item.merge.slice(0, 12)}; see DEV result` : `Held: ${item.reason}`).slice(0, 140),
      target_url: targetUrl };
    const previous = (await c.pages(`/commits/${head}/statuses`, undefined, { maxPages: 10 })).find(x => x.context === queueContext);
    if (previous?.state !== status.state || previous?.description !== status.description)
      await c.api('POST', `${c.root}/statuses/${head}`, status);
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'Integration only runs on develop');
  assert.ok(process.env.GH_TOKEN, 'Missing scoped Actions token');
  const diagnosticsPath = process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-diagnostics.json';
  const c = client(repository, process.env.GH_TOKEN, fetch, { diagnosticsPath });
  let report = { startedAt: new Date().toISOString(), merged: [], held: [], trustedReviewed: [], deferred: [] };
  let thrown = null;
  try {
    report = await integrate(c, repository);
    await recordQueue(c, report, `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`);
    if (!report.verified) await c.api('POST', `${c.root}/statuses/${report.sha}`, {
      state: 'pending', context: contextName, description: 'Affected fast checks, DEV deployment and public HTTP/source verification',
      target_url: `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`,
    });
  } catch (error) {
    thrown = error;
    report.error = error?.stack || error?.message || String(error);
  } finally {
    c.mark?.(thrown ? 'failed' : 'complete');
    report.api = c.metrics?.() || null;
    mkdirSync('.deploy-state', { recursive: true });
    writeFileSync('.deploy-state/integration.json', JSON.stringify(report, null, 2));
    writeFileSync(diagnosticsPath, JSON.stringify({ report, api: report.api }, null, 2));
    console.log(JSON.stringify(report, null, 2));
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `## Integration\nFinal develop: ${report.sha || 'unknown'}\n\nMerged: ${(report.merged || []).map(x => `#${x.pr}`).join(', ') || 'none'}\n\n` +
      `Trusted reviewed: ${(report.trustedReviewed || []).map(x => `#${x.pr}`).join(', ') || 'none'}\n\n` +
      `API requests: ${report.api?.requests ?? 'n/a'}; cache hits: ${report.api?.cacheHits ?? 'n/a'}; retries: ${report.api?.retries ?? 'n/a'}; throttles: ${report.api?.throttleResponses ?? 'n/a'}\n\n` +
      `Duration: ${report.durationMs ?? report.api?.elapsedMs ?? 'n/a'} ms; deferred: ${(report.deferred || []).length}; phase: ${report.api?.phase || 'unknown'}; cursor: ${report.evaluationCursor ?? 0} -> ${report.retryCursor ?? 0}\n\n` +
      (report.held || []).map(x => `- #${x.pr}: ${x.reason}\n`).join('') + (report.verified ? '\nAlready verified; no duplicate build or deploy.\n' : '') +
      (thrown ? `\nError: ${thrown.message}\n` : ''));
  }
  if (thrown) throw thrown;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `sha=${report.sha}\nverify=${!report.verified}\nretry=${report.retry}\ncursor=${report.retryCursor ?? 0}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
