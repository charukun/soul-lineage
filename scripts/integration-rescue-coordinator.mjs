import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { graph, closure } from './workspaces.mjs';
import { dependencies } from './integration-policy.mjs';
import { REPOSITORY, ACTIVE, RETURNED, TERMINAL, rescueConfig, manualReason, detectReason, conflictScope, transition, failure, recoverStale, planWave, event } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore, pullEvidence, comparison, browserRepairFor, contractFingerprint } from './integration-rescue-store.mjs';

export function workspaceConsumers(root = process.cwd()) {
  const nodes = graph(root), result = {};
  for (const n of nodes.values()) {
    if (n.group !== 'packages') continue;
    result[n.dir] = [...nodes.values()].filter(consumer => closure(nodes, consumer.name).has(n.name)).map(consumer => consumer.dir);
  }
  return result;
}
function mergeObserved(state, observation, now) {
  const { record, excluded } = observation;
  const previous = state.records[record.pr];
  // A worker owns its mutable progress. Coordinator must not clobber it with earlier API observations.
  if (previous?.lease || RETURNED.has(previous?.state)) return;
  if (previous?.state === 'FAILED_MANUAL') return; // explicit human intervention on GitHub required
  const next = { ...previous, ...record, attempt: previous?.attempt || 0, maxAttempts: state.config.maxAttempts,
    detectedAt: previous?.detectedAt || new Date(now).toISOString(), failures: previous?.failures || [],
    state: previous?.state || 'DETECTED', nextAttemptAt: previous?.nextAttemptAt || null };
  state.records[record.pr] = next;
  if (!previous) event(state, next, 'DETECTED', `Detected ${record.reason}`, now);
  if (excluded) failure(state, next, excluded, now, true);
}
export async function coordinate(c, store, { now = Date.now(), runId, runAttempt = 1, consumers = {}, configured = true, scan = true } = {}) {
  const initial = (await store.initialize()).state;
  // Coalesce event bursts across runs; leave REST capacity for live leases and normal Integration.
  const remaining = c.metrics?.().rateRemaining;
  if (now - Date.parse(initial.coordinator?.heartbeatAt || 0) < store.config.scanMinMs ||
      (remaining != null && remaining < store.config.apiReserve)) {
    return { state: initial, result: [], errors: [{ reason: 'RESCUE_SCAN_COALESCED_OR_API_RESERVED' }], develop: initial.coordinator?.develop };
  }
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  const develop = branch.commit.sha;
  const all = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const live = new Map(all.map(pr => [pr.number, pr]));
  const issues = await c.pages('/issues?state=open&sort=updated&direction=desc', undefined, { maxPages: 3 });
  const runStates = {};
  for (const run of new Set(Object.values(initial.records).filter(r => r.lease).map(r => r.runId))) {
    runStates[run] = (await c.api('GET', `${c.root}/actions/runs/${run}`)).status;
  }
  const lifecycle = [];
  for (const r of Object.values(initial.records).filter(r => !r.lease && !TERMINAL.has(r.state) && (!live.has(r.pr) || live.get(r.pr).draft)).slice(0, 4)) {
    const pr = live.get(r.pr) || await c.api('GET', `${c.root}/pulls/${r.pr}`);
    lifecycle.push({ pr, expectedId: r.rescueId, excluded: manualReason(pr) });
  }
  for (const r of Object.values(initial.records).filter(r => RETURNED.has(r.state) || r.state === 'MERGED').slice(0, 8)) {
    const pr = live.get(r.pr) || await c.api('GET', `${c.root}/pulls/${r.pr}`);
    let timedOut = false;
    if (r.state === 'AWAITING_PUSH') timedOut = now - Date.parse(r.stagedAt) > 2 * 3600000;
    else if (RETURNED.has(r.state) && !r.pendingIntegration && !pr.merged && !pr.merged_at && now - Date.parse(r.integrationRequestedAt || r.returnedAt) > store.config.queueStallMs) timedOut = true;
    lifecycle.push({ pr, expectedId: r.rescueId, excluded: manualReason(pr), timedOut });
  }
  const candidates = all.filter(pr => !pr.draft && (!initial.records[pr.number] || !initial.records[pr.number].lease && !RETURNED.has(initial.records[pr.number].state) && !TERMINAL.has(initial.records[pr.number].state)));
  const start = initial.cursor < candidates.length ? initial.cursor : 0;
  const selected = scan ? candidates.slice(start, start + store.config.maxEvaluations) : [];
  const observations = [], errors = [];
  for (const pr of selected) {
    try {
      if ((c.metrics?.().requests || 0) >= store.config.maxRequests - 20 ||
          (c.metrics?.().rateRemaining != null && c.metrics().rateRemaining < store.config.apiReserve)) { errors.push({ pr: pr.number, reason: 'RESCUE_API_BUDGET_DEFERRED' }); break; }
      const excludedCheap = manualReason(pr);
      const evidence = excludedCheap ? { pr } : await pullEvidence(c, pr.number, { detailed: true });
      const excluded = excludedCheap || manualReason(evidence.pr, evidence);
      const previous = initial.records[pr.number];
      if (excluded) {
        observations.push({ excluded, record: { pr: pr.number, title: pr.title, branch: pr.head.ref, headSha: pr.head.sha, developSha: develop,
          scope: conflictScope([], pr.body, consumers), dependencies: [], changes: 0, reason: excluded } });
        continue;
      }
      const fresh = evidence.pr;
      const own = await comparison(c, develop, fresh.head.sha);
      const base = await comparison(c, own.mergeBase, develop);
      const statuses = await c.pages(`/commits/${fresh.head.sha}/statuses`, undefined, { maxPages: 3 });
      const queue = statuses.find(s => s.context === 'integration/queue');
      const reason = detectReason({ pr: fresh, queue, mergeBase: own.mergeBase, develop, baseChanges: base.files, previous, now, config: store.config });
      if (!reason && !previous) continue;
      const deps = dependencies(fresh.body || '');
      const browserRepair = browserRepairFor(fresh, issues);
      const mergedDependencies = [];
      let depError = null;
      for (const n of deps) {
        const dep = live.get(n) || await c.api('GET', `${c.root}/pulls/${n}`);
        if (n === fresh.number) { depError = 'DEPENDENCY_CYCLE'; break; }
        if (dep.base?.ref !== 'develop' || dep.base?.repo?.full_name !== REPOSITORY || (dep.state === 'closed' && !dep.merged_at && !dep.merged)) { depError = 'INVALID_DEPENDENCY_TARGET'; break; }
        if (dep.merged_at || dep.merged) mergedDependencies.push(n);
      }
      observations.push({ excluded: depError || browserRepair?.manual, record: { pr: fresh.number, title: fresh.title, detail: (fresh.body || '').split('\n')[1]?.slice(0, 240),
        branch: fresh.head.ref, headSha: fresh.head.sha, developSha: develop, mergeBaseSha: own.mergeBase,
        contractFingerprint: contractFingerprint(fresh),
        scope: conflictScope(evidence.files.flatMap(f => [f.filename, f.previous_filename].filter(Boolean)), fresh.body, consumers), baseChanges: base.files,
        dependencies: deps, mergedDependencies, browserRepair: browserRepair?.blocked ? browserRepair.issue : null, changes: fresh.additions + fresh.deletions,
        repair: fresh.labels.some(l => l.name === 'integration:repair'), reason: reason || previous.reason,
        mode: ['QUEUE_PENDING', 'ORPHAN_READY', 'INTEGRATION_TRANSIENT', 'DEPENDENCY_WAIT'].includes(reason) && own.mergeBase === develop && fresh.mergeable === true ? 'reevaluate' : 'reconcile' } });
    } catch (error) { errors.push({ pr: pr.number, reason: error.message }); if (/BUDGET|rate.limit/.test(error.message)) break; }
  }
  const result = await store.mutate(state => {
    state.config = store.config;
    recoverStale(state, runStates, now);
    for (const { pr, expectedId, excluded, timedOut } of lifecycle) {
      const r = state.records[pr.number]; if (!r || r.rescueId !== expectedId) continue;
      if (pr.merged || pr.merged_at) {
        if (!['MERGED', 'DEV'].includes(r.state)) {
          r.mergedAt = pr.merged_at || new Date(now).toISOString(); r.mergeCommit = pr.merge_commit_sha;
          transition(state, r, 'MERGED', 'Normal Integration merged this PR into develop', now);
        }
      } else if (pr.state === 'closed') transition(state, r, 'CLOSED', 'PR closed without merge', now);
      else if (excluded) failure(state, r, excluded, now, true);
      else if (pr.head.sha !== r.headSha && pr.head.sha !== r.pushedSha) {
        failure(state, r, 'HEAD_CHANGED_AFTER_RESCUE', now);
      }
      else if (timedOut && !r.lease) failure(state, r, r.state === 'AWAITING_PUSH' ? 'WORK_PUSH_RELAY_STALLED' : 'INTEGRATION_RETURN_STALLED', now);
    }
    for (const obs of observations) mergeObserved(state, obs, now);
    // Detect dependency cycles even when the participants are in different scan windows.
    const visiting = new Set(), visited = new Set();
    function visit(n, chain = []) {
      if (visiting.has(n)) { for (const p of chain.slice(chain.indexOf(n))) { const r = state.records[p]; if (r && !r.lease && !TERMINAL.has(r.state)) failure(state, r, 'DEPENDENCY_CYCLE', now, true); } return; }
      if (visited.has(n)) return;
      visiting.add(n);
      for (const p of state.records[n]?.dependencies || []) if (!state.records[n]?.mergedDependencies?.includes(p)) visit(p, [...chain, n]);
      visiting.delete(n); visited.add(n);
    }
    Object.keys(state.records).map(Number).forEach(n => visit(n));
    state.cursor = start + selected.length < candidates.length ? start + selected.length : 0;
    state.coordinator = { runId: String(runId), heartbeatAt: new Date(now).toISOString(), develop, configured,
      phase: configured ? 'observing' : 'CONFIGURATION_REQUIRED', errors,
      backend: 'actions-no-api + chatgpt-work-push',
      configurationReason: configured ? null : 'Rescue explicitly disabled; no worker started' };
    // A fresh PR API snapshot is mandatory before each claim, including retry/next-wave records.
    const freshIds = new Set(observations.filter(o => !o.excluded).map(o => o.record.pr));
    const deferred = [];
    for (const r of Object.values(state.records)) if (!freshIds.has(r.pr) && ['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE'].includes(r.state)) {
      deferred.push([r, r.nextAttemptAt]); r.nextAttemptAt = new Date(now + 1).toISOString();
    }
    const workers = configured && scan ? planWave(state, { runId, now, id: `wave-${runId}-${runAttempt}` }) : [];
    for (const [r, previous] of deferred) r.nextAttemptAt = previous;
    // Keep active/blocked/manual records; expire only old completed history.
    for (const [pr, r] of Object.entries(state.records)) if (['MERGED', 'DEV', 'CLOSED'].includes(r.state) && now - Date.parse(r.updatedAt) > 7 * 86400000) delete state.records[pr];
    return workers;
  });
  return { ...result, errors, develop };
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('RESCUE_TRUSTED_DEVELOP_ONLY');
  const config = rescueConfig(process.env), c = rescueClient(process.env.GH_TOKEN, config), store = new RescueStore(c, config);
  const report = await coordinate(c, store, { runId: process.env.GITHUB_RUN_ID, runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    configured: process.env.RESCUE_CONFIGURED === 'true', consumers: workspaceConsumers(), scan: process.env.RESCUE_OBSERVE_ONLY !== 'true' });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/rescue-coordinator.json', JSON.stringify({ workers: report.result, errors: report.errors, api: c.metrics() }, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${JSON.stringify({ include: report.result })}\nhas_workers=${report.result.length > 0}\nmax_parallel=${config.maxConcurrency}\n`);
  console.log(JSON.stringify({ workers: report.result.length, scannedErrors: report.errors, configured: report.state.coordinator.configured }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
