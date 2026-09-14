import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { graph, closure } from './workspaces.mjs';
import { dependencies } from './integration-policy.mjs';
import {
  adaptiveFlowTuning,
  deliveryLatencyMetrics,
  quarantineDecision,
} from './integration-flow-control.mjs';
import {
  REPOSITORY,
  RETURNED,
  TERMINAL,
  rescueConfig,
  manualReason,
  detectReason,
  conflictScope,
  transition,
  failure,
  recoverStale,
  planWave,
  event,
} from './integration-rescue-policy.mjs';
import {
  rescueClient,
  RescueStore,
  pullEvidence,
  comparison,
  browserRepairFor,
  contractFingerprint,
} from './integration-rescue-store.mjs';

export function workspaceConsumers(root = process.cwd()) {
  const nodes = graph(root);
  const result = {};
  for (const node of nodes.values()) {
    if (node.group !== 'packages') continue;
    result[node.dir] = [...nodes.values()]
      .filter(consumer => closure(nodes, consumer.name).has(node.name))
      .map(consumer => consumer.dir);
  }
  return result;
}

function mergeObserved(state, observation, now) {
  const { record, excluded } = observation;
  const previous = state.records[record.pr];
  if (previous?.lease || RETURNED.has(previous?.state) || previous?.state === 'FAILED_MANUAL') return;

  const next = {
    ...previous,
    ...record,
    attempt: previous?.attempt || 0,
    maxAttempts: state.config.maxAttempts,
    implementationStartedAt: previous?.implementationStartedAt || record.implementationStartedAt || null,
    readyAt: previous?.readyAt || record.readyAt || new Date(now).toISOString(),
    detectedAt: previous?.detectedAt || new Date(now).toISOString(),
    failures: previous?.failures || [],
    state: previous?.state || 'DETECTED',
    nextAttemptAt: previous?.nextAttemptAt || null,
  };
  state.records[record.pr] = next;
  if (!previous) event(state, next, 'DETECTED', `Detected ${record.reason}`, now);
  if (excluded) failure(state, next, excluded, now, true);
}

function observedRecord(record) {
  return {
    state: record.state,
    headSha: record.headSha,
    pushedSha: record.pushedSha,
    stagedSha: record.stagedSha,
  };
}

function recordOpenDelivery(state, pr, now) {
  state.flowControl.deliveries ||= {};
  const key = String(pr.number);
  const old = state.flowControl.deliveries[key] || {};
  state.flowControl.deliveries[key] = {
    ...old,
    pr: pr.number,
    head: pr.head.sha,
    title: String(pr.title || '').slice(0, 160),
    implementationStartedAt: old.implementationStartedAt || pr.created_at || null,
    readyAt: old.readyAt || new Date(now).toISOString(),
    updatedAt: new Date(now).toISOString(),
  };
}

function recordMergedDelivery(state, pr, now) {
  state.flowControl.deliveries ||= {};
  const key = String(pr.number);
  const old = state.flowControl.deliveries[key] || {};
  state.flowControl.deliveries[key] = {
    ...old,
    pr: pr.number,
    head: pr.head?.sha || old.head || null,
    title: String(pr.title || old.title || '').slice(0, 160),
    implementationStartedAt: old.implementationStartedAt || pr.created_at || null,
    readyAt: old.readyAt || null,
    mergedAt: pr.merged_at || old.mergedAt || null,
    mergeCommit: pr.merge_commit_sha || old.mergeCommit || null,
    updatedAt: new Date(now).toISOString(),
  };
}

export async function coordinate(c, store, {
  now = Date.now(),
  runId,
  runAttempt = 1,
  consumers = {},
  configured = true,
  scan = true,
} = {}) {
  const initial = (await store.initialize()).state;
  const remaining = c.metrics?.().rateRemaining;
  if (
    now - Date.parse(initial.coordinator?.heartbeatAt || 0) < store.config.scanMinMs ||
    (remaining != null && remaining < store.config.apiReserve)
  ) {
    return {
      state: initial,
      result: [],
      errors: [{ reason: 'RESCUE_SCAN_COALESCED_OR_API_RESERVED' }],
      develop: initial.coordinator?.develop,
      tuning: initial.flowControl?.tuning || null,
    };
  }

  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const all = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const closed = scan
    ? await c.api('GET', `${c.root}/pulls?state=closed&base=develop&sort=updated&direction=desc&per_page=40&page=1`)
    : [];
  const recentlyMerged = (Array.isArray(closed) ? closed : [])
    .filter(pr => pr.merged_at || pr.merged)
    .slice(0, 40);

  const historical = Object.values(initial.records || {});
  const deliveryHistory = Object.values(initial.flowControl?.deliveries || {});
  const latency = deliveryLatencyMetrics(deliveryHistory.length ? deliveryHistory : historical);
  const failedRecords = historical.filter(record => quarantineDecision(record).failures > 0).length;
  const failureRate = failedRecords / Math.max(1, historical.length);
  const recoverableManual = historical.filter(record =>
    record.state === 'FAILED_MANUAL' && record.workRepair?.status !== 'human-required').length;
  const tuning = adaptiveFlowTuning({
    ready: all.filter(pr => !pr.draft).length,
    recoverableManual,
    latency,
    failureRate,
    rateRemaining: c.metrics?.().rateRemaining,
  });

  const live = new Map(all.map(pr => [pr.number, pr]));
  const issues = await c.pages('/issues?state=open&sort=updated&direction=desc', undefined, { maxPages: 3 });
  const runStates = {};
  for (const run of new Set(historical.filter(record => record.lease).map(record => record.runId))) {
    runStates[run] = (await c.api('GET', `${c.root}/actions/runs/${run}`)).status;
  }

  const lifecycle = [];
  for (const record of historical
    .filter(record => !record.lease && (
      (!TERMINAL.has(record.state) && (!live.has(record.pr) || live.get(record.pr).draft)) ||
      (record.state === 'FAILED_MANUAL' && !live.has(record.pr))))
    .slice(0, 4)) {
    const pr = live.get(record.pr) || await c.api('GET', `${c.root}/pulls/${record.pr}`);
    lifecycle.push({
      pr,
      expectedId: record.rescueId,
      observed: observedRecord(record),
      excluded: manualReason(pr),
    });
  }

  for (const record of historical
    .filter(record => RETURNED.has(record.state) || record.state === 'MERGED')
    .slice(0, 8)) {
    const pr = live.get(record.pr) || await c.api('GET', `${c.root}/pulls/${record.pr}`);
    let timedOut = false;
    if (record.state === 'AWAITING_PUSH') {
      timedOut = now - Date.parse(record.stagedAt) > 2 * 3600000;
    } else if (
      RETURNED.has(record.state) &&
      !record.pendingIntegration &&
      !pr.merged &&
      !pr.merged_at &&
      now - Date.parse(record.integrationRequestedAt || record.returnedAt) > store.config.queueStallMs
    ) {
      timedOut = true;
    }
    lifecycle.push({
      pr,
      expectedId: record.rescueId,
      observed: observedRecord(record),
      excluded: manualReason(pr),
      timedOut,
    });
  }

  const candidates = all.filter(pr =>
    !pr.draft && (
      !initial.records[pr.number] ||
      (!initial.records[pr.number].lease &&
       !RETURNED.has(initial.records[pr.number].state) &&
       !TERMINAL.has(initial.records[pr.number].state))));
  const start = initial.cursor < candidates.length ? initial.cursor : 0;
  const selected = scan ? candidates.slice(start, start + tuning.maxEvaluations) : [];
  const observations = [];
  const errors = [];

  for (const pr of selected) {
    try {
      if (
        (c.metrics?.().requests || 0) >= store.config.maxRequests - 20 ||
        (c.metrics?.().rateRemaining != null && c.metrics().rateRemaining < store.config.apiReserve)
      ) {
        errors.push({ pr: pr.number, reason: 'RESCUE_API_BUDGET_DEFERRED' });
        break;
      }

      const excludedCheap = manualReason(pr);
      const evidence = excludedCheap ? { pr } : await pullEvidence(c, pr.number, { detailed: true });
      const excluded = excludedCheap || manualReason(evidence.pr, evidence);
      const previous = initial.records[pr.number];
      if (excluded) {
        observations.push({
          excluded,
          record: {
            pr: pr.number,
            title: pr.title,
            branch: pr.head.ref,
            headSha: pr.head.sha,
            developSha: develop,
            implementationStartedAt: previous?.implementationStartedAt || pr.created_at || null,
            readyAt: previous?.readyAt || new Date(now).toISOString(),
            scope: conflictScope([], pr.body, consumers),
            dependencies: [],
            changes: 0,
            reason: excluded,
          },
        });
        continue;
      }

      const fresh = evidence.pr;
      const own = await comparison(c, develop, fresh.head.sha);
      const base = await comparison(c, own.mergeBase, develop);
      const statuses = await c.pages(`/commits/${fresh.head.sha}/statuses`, undefined, { maxPages: 3 });
      const queue = statuses.find(status => status.context === 'integration/queue');
      const reason = detectReason({
        pr: fresh,
        queue,
        mergeBase: own.mergeBase,
        develop,
        baseChanges: base.files,
        previous,
        now,
        config: store.config,
      });
      if (!reason && !previous) continue;

      const deps = dependencies(fresh.body || '');
      const browserRepair = browserRepairFor(fresh, issues);
      const mergedDependencies = [];
      let depError = null;
      for (const number of deps) {
        const dependency = live.get(number) || await c.api('GET', `${c.root}/pulls/${number}`);
        if (number === fresh.number) {
          depError = 'DEPENDENCY_CYCLE';
          break;
        }
        if (
          dependency.base?.ref !== 'develop' ||
          dependency.base?.repo?.full_name !== REPOSITORY ||
          (dependency.state === 'closed' && !dependency.merged_at && !dependency.merged)
        ) {
          depError = 'INVALID_DEPENDENCY_TARGET';
          break;
        }
        if (dependency.merged_at || dependency.merged) mergedDependencies.push(number);
      }

      observations.push({
        excluded: depError || browserRepair?.manual,
        record: {
          pr: fresh.number,
          title: fresh.title,
          detail: (fresh.body || '').split('\n')[1]?.slice(0, 240),
          branch: fresh.head.ref,
          headSha: fresh.head.sha,
          developSha: develop,
          mergeBaseSha: own.mergeBase,
          implementationStartedAt: previous?.implementationStartedAt || fresh.created_at || null,
          readyAt: previous?.readyAt || new Date(now).toISOString(),
          contractFingerprint: contractFingerprint(fresh),
          scope: conflictScope(
            evidence.files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)),
            fresh.body,
            consumers,
          ),
          baseChanges: base.files,
          dependencies: deps,
          mergedDependencies,
          browserRepair: browserRepair?.blocked ? browserRepair.issue : null,
          changes: fresh.additions + fresh.deletions,
          repair: fresh.labels.some(label => label.name === 'integration:repair'),
          reason: reason || previous.reason,
          mode: ['QUEUE_PENDING', 'ORPHAN_READY', 'INTEGRATION_TRANSIENT', 'DEPENDENCY_WAIT'].includes(reason) &&
            own.mergeBase === develop && fresh.mergeable === true
            ? 'reevaluate'
            : 'reconcile',
        },
      });
    } catch (error) {
      errors.push({ pr: pr.number, reason: error.message });
      if (/BUDGET|rate.limit/.test(error.message)) break;
    }
  }

  const result = await store.mutate(state => {
    state.config = {
      ...store.config,
      maxConcurrency: tuning.rescueConcurrency,
      maxEvaluations: tuning.maxEvaluations,
    };
    state.flowControl ||= {};
    state.flowControl.tuning = {
      ...tuning,
      latency,
      failureRate,
      updatedAt: new Date(now).toISOString(),
    };
    state.flowControl.deliveries ||= {};

    if (scan) {
      for (const pr of all.filter(pr => !pr.draft)) recordOpenDelivery(state, pr, now);
      for (const pr of recentlyMerged) recordMergedDelivery(state, pr, now);
    }

    recoverStale(state, runStates, now);
    for (const { pr, expectedId, observed, excluded, timedOut } of lifecycle) {
      const record = state.records[pr.number];
      if (!record || record.rescueId !== expectedId) continue;
      if (Object.entries(observed).some(([key, value]) => record[key] !== value)) continue;

      if (pr.merged || pr.merged_at) {
        if (!['MERGED', 'DEV'].includes(record.state)) {
          record.mergedAt = pr.merged_at || new Date(now).toISOString();
          record.mergeCommit = pr.merge_commit_sha;
          transition(state, record, 'MERGED', 'Normal Integration merged this PR into develop', now);
        }
      } else if (pr.state === 'closed') {
        transition(state, record, 'CLOSED', 'PR closed without merge', now);
      } else if (excluded) {
        failure(state, record, excluded, now, true);
      } else if (
        pr.head.sha !== record.headSha &&
        pr.head.sha !== record.pushedSha &&
        !(record.state === 'AWAITING_PUSH' && pr.head.sha === record.stagedSha)
      ) {
        failure(state, record, 'HEAD_CHANGED_AFTER_RESCUE', now);
      } else if (
        timedOut &&
        !record.lease &&
        !(record.pushLease && now - Date.parse(record.pushLease.at) <= 600000)
      ) {
        failure(
          state,
          record,
          record.state === 'AWAITING_PUSH' ? 'WORK_PUSH_RELAY_STALLED' : 'INTEGRATION_RETURN_STALLED',
          now,
        );
      }
    }

    for (const observation of observations) mergeObserved(state, observation, now);

    const visiting = new Set();
    const visited = new Set();
    function visit(number, chain = []) {
      if (visiting.has(number)) {
        for (const participant of chain.slice(chain.indexOf(number))) {
          const record = state.records[participant];
          if (record && !record.lease && !TERMINAL.has(record.state)) {
            failure(state, record, 'DEPENDENCY_CYCLE', now, true);
          }
        }
        return;
      }
      if (visited.has(number)) return;
      visiting.add(number);
      for (const dependency of state.records[number]?.dependencies || []) {
        if (!state.records[number]?.mergedDependencies?.includes(dependency)) {
          visit(dependency, [...chain, number]);
        }
      }
      visiting.delete(number);
      visited.add(number);
    }
    Object.keys(state.records).map(Number).forEach(number => visit(number));

    state.cursor = start + selected.length < candidates.length ? start + selected.length : 0;
    state.coordinator = {
      runId: String(runId),
      heartbeatAt: new Date(now).toISOString(),
      develop,
      configured,
      phase: configured ? 'observing' : 'CONFIGURATION_REQUIRED',
      errors,
      backend: 'actions-no-api + chatgpt-work-push',
      configurationReason: configured ? null : 'Rescue explicitly disabled; no worker started',
    };

    const freshIds = new Set(observations.filter(observation => !observation.excluded).map(observation => observation.record.pr));
    const deferred = [];
    for (const record of Object.values(state.records)) {
      if (
        !freshIds.has(record.pr) &&
        ['DETECTED', 'QUEUED', 'BLOCKED_BY_RESCUE', 'FAILED_RETRYABLE'].includes(record.state)
      ) {
        deferred.push([record, record.nextAttemptAt]);
        record.nextAttemptAt = new Date(now + 1).toISOString();
      }
    }

    const workers = configured && scan
      ? planWave(state, { runId, now, id: `wave-${runId}-${runAttempt}` })
      : [];
    for (const [record, previous] of deferred) record.nextAttemptAt = previous;
    return workers;
  });

  return { ...result, errors, develop, tuning };
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') {
    throw new Error('RESCUE_TRUSTED_DEVELOP_ONLY');
  }

  const config = rescueConfig(process.env);
  const c = rescueClient(process.env.GH_TOKEN, config);
  const store = new RescueStore(c, config);
  const report = await coordinate(c, store, {
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    configured: process.env.RESCUE_CONFIGURED === 'true',
    consumers: workspaceConsumers(),
    scan: process.env.RESCUE_OBSERVE_ONLY !== 'true',
  });

  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/rescue-coordinator.json', JSON.stringify({
    workers: report.result,
    errors: report.errors,
    tuning: report.tuning,
    api: c.metrics(),
  }, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT,
      `matrix=${JSON.stringify({ include: report.result })}\nhas_workers=${report.result.length > 0}\nmax_parallel=${report.state.config.maxConcurrency}\n`);
  }
  console.log(JSON.stringify({
    workers: report.result.length,
    scannedErrors: report.errors,
    configured: report.state.coordinator.configured,
    tuning: report.tuning,
  }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();