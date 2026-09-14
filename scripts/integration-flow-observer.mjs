import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { adaptiveFlowTuning, deliveryLatencyMetrics } from './integration-flow-control.mjs';
import { refreshFailureKnowledge } from './integration-failure-knowledge.mjs';
import { REPOSITORY, rescueConfig } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore } from './integration-rescue-store.mjs';
import { workRepairEligibility } from './integration-rescue-work-repair-policy.mjs';
import { deriveWorkRepairWake } from './integration-rescue-work-wake.mjs';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function observeFlow(c, store, now = Date.now()) {
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const ready = open.filter(pr => !pr.draft);
  const closed = await c.api('GET', `${c.root}/pulls?state=closed&base=develop&sort=updated&direction=desc&per_page=40&page=1`);
  const merged = (Array.isArray(closed) ? closed : []).filter(pr => pr.merged_at || pr.merged).slice(0, 40);
  const snapshot = await store.initialize();
  const records = Object.values(snapshot.state?.records || {});
  const deliveries = Object.values(snapshot.state?.flowControl?.deliveries || {});
  const latency = deliveryLatencyMetrics(deliveries.length ? deliveries : records);
  const relevant = records.filter(record => {
    const updated = Date.parse(record.updatedAt || record.detectedAt || 0);
    return !Number.isFinite(updated) || now - updated < DAY_MS || !['DEV','CLOSED'].includes(record.state);
  });
  const recentlyFailed = relevant.filter(record => (record.failures || []).some(failure => {
    const at = Date.parse(failure.at || 0);
    return Number.isFinite(at) && now - at < DAY_MS;
  }));
  const failureRate = recentlyFailed.length / Math.max(1, relevant.length);
  const recoverableManual = records.filter(record => record.state === 'FAILED_MANUAL' && workRepairEligibility(record).eligible).length;
  const tuning = adaptiveFlowTuning({
    ready: ready.length,
    recoverableManual,
    latency,
    failureRate,
    rateRemaining: c.metrics?.().rateRemaining,
  });

  const mutation = await store.mutate(state => {
    state.flowControl ||= {};
    state.flowControl.deliveries ||= {};
    state.flowControl.tuning = { ...tuning, latency, failureRate, updatedAt: new Date(now).toISOString() };
    for (const pr of ready) {
      const key = String(pr.number), old = state.flowControl.deliveries[key] || {};
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
    for (const pr of merged) {
      const key = String(pr.number), old = state.flowControl.deliveries[key] || {};
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
    const wake = deriveWorkRepairWake(state, now);
    state.flowControl.workRepairWake = { ...wake, updatedAt: new Date(now).toISOString() };
    refreshFailureKnowledge(state, now);
    return { tuning: state.flowControl.tuning, knowledge: state.failureKnowledge, workRepairWake: state.flowControl.workRepairWake };
  });

  return {
    ready: ready.length,
    recoverableManual,
    tuning: mutation.result.tuning,
    workRepairWake: mutation.result.workRepairWake,
    fingerprints: Object.keys(mutation.result.knowledge?.fingerprints || {}).length,
  };
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('FLOW_OBSERVER_TRUSTED_DEVELOP_ONLY');
  const config = rescueConfig(process.env), c = rescueClient(process.env.GH_TOKEN, config), store = new RescueStore(c, config);
  const report = await observeFlow(c, store);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `max_parallel=${report.tuning.rescueConcurrency}\nmax_evaluations=${report.tuning.maxEvaluations}\ntrain_size=${report.tuning.trainSize}\nmode=${report.tuning.pressure.mode}\nwork_repair_wake=${report.workRepairWake?.wakeRequired === true}\n`);
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
