import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client, fastGate, maxReadyEvaluationsPerRun } from './integration.mjs';
import { dependencies, reviewDecision } from './integration-policy.mjs';
import { conflictScope, REPOSITORY, rescueConfig } from './integration-rescue-policy.mjs';
import { pullEvidence, RescueStore } from './integration-rescue-store.mjs';
import { buildReconciliationPlan } from './integration-reconciliation-plan.mjs';

async function mapLimit(items, limit, task) {
  const values = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      values[index] = await task(items[index], index);
    }
  });
  await Promise.all(workers);
  return values;
}

function recordMap(state) {
  return new Map(Object.values(state?.records || {}).map(record => [Number(record.pr), record]));
}

async function preflightForPr(c, snapshot) {
  try {
    const evidence = await pullEvidence(c, snapshot.number, { detailed: true });
    if (evidence.pr.head.sha !== snapshot.head?.sha) return [snapshot.number, { error: 'HEAD_CHANGED_DURING_PREFLIGHT' }];
    const checksPassed = await fastGate(c, evidence.pr, { cache: true });
    const decision = reviewDecision(evidence.reviews, evidence.pr.head.sha);
    const paths = evidence.files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean));
    return [snapshot.number, {
      pr: evidence.pr,
      scope: conflictScope(paths, evidence.pr.body || ''),
      files: paths,
      checksPassed,
      reviewRejected: decision.rejected,
      reviewApproved: decision.approved,
      unresolved: evidence.unresolved,
      mergeable: evidence.pr.mergeable,
      mergeableState: evidence.pr.mergeable_state,
    }];
  } catch (error) {
    return [snapshot.number, { error: `PREFLIGHT: ${error.message}` }];
  }
}

function persistedPlan(plan) {
  return {
    schema: plan.schema,
    repository: plan.repository,
    develop: plan.develop,
    generatedAt: plan.generatedAt,
    pressure: plan.pressure,
    counts: plan.counts,
    writer: plan.writer,
    writerOrder: plan.writerOrder,
    trains: plan.trains,
    repair: plan.repair,
    active: plan.active,
    validating: plan.validating,
    blocked: plan.blocked,
    deferred: plan.deferred,
    wakeAgain: plan.wakeAgain,
    actionableIdle: plan.actionableIdle,
    evaluated: plan.evaluated,
    totalReady: plan.totalReady,
    concurrency: plan.concurrency,
  };
}

export async function persistReconciliationPlan(c, plan) {
  const store = new RescueStore(c, rescueConfig(process.env));
  await store.initialize();
  const view = persistedPlan(plan);
  await store.mutate(state => {
    state.flowControl ||= {};
    state.flowControl.reconciliation = view;
    return view;
  });
  return view;
}

export async function collectReconciliationPlan(c, repository = REPOSITORY, options = {}) {
  const open = options.open || await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10 });
  const ready = open.filter(pr => !pr.draft && pr.base?.ref === 'develop');
  const maxEvaluations = Math.max(1, Math.min(24, Number(options.maxEvaluations || maxReadyEvaluationsPerRun)));
  const selected = ready.slice(0, maxEvaluations);
  const deferred = ready.slice(maxEvaluations).map(pr => ({ pr: pr.number, head: pr.head?.sha || null, reason: 'deferred by reconciliation evaluation budget' }));
  const concurrency = Math.max(1, Math.min(6, Number(options.concurrency || 6)));

  let state = options.state || null;
  if (!state && options.readRescueState !== false) {
    try {
      const store = new RescueStore(c, rescueConfig(process.env));
      state = (await store.read()).state;
    } catch {
      state = null;
    }
  }
  const records = recordMap(state);
  const preflightRows = await mapLimit(selected, concurrency, snapshot => preflightForPr(c, snapshot));
  const preflightByPr = new Map(preflightRows);
  const currentReady = selected.map(snapshot => preflightByPr.get(snapshot.number)?.pr || snapshot);
  const scopeByPr = new Map(currentReady.map(pr => [pr.number, preflightByPr.get(pr.number)?.scope || records.get(pr.number)?.scope]).filter(([, scope]) => scope?.files?.length));

  const dependencyNumbers = new Set();
  for (const pr of currentReady) {
    try { for (const number of dependencies(pr.body || '')) dependencyNumbers.add(number); }
    catch { /* planner records invalid dependency syntax as blocked */ }
  }
  const openByNumber = new Map(open.map(pr => [Number(pr.number), pr]));
  const dependencyRows = await mapLimit([...dependencyNumbers], concurrency, async number => {
    const snapshot = openByNumber.get(Number(number));
    if (snapshot) return [Number(number), { merged: false, state: snapshot.state || 'open' }];
    try {
      const pr = await c.api('GET', `${c.root}/pulls/${number}`, null, { cache: true });
      return [Number(number), { merged: Boolean(pr.merged || pr.merged_at), state: pr.state || null, base: pr.base?.ref || null }];
    } catch (error) {
      return [Number(number), { merged: false, state: 'unknown', error: error.message }];
    }
  });

  const plan = buildReconciliationPlan({
    ready: currentReady,
    scopeByPr,
    dependencyStateByPr: new Map(dependencyRows),
    recordsByPr: records,
    preflightByPr,
    requirePreflight: true,
    deferred,
    maxTrainSize: options.maxTrainSize || state?.flowControl?.tuning?.trainSize || 5,
    now: options.now || Date.now(),
  });
  const develop = options.develop || (await c.api('GET', `${c.root}/branches/develop`, null, { cache: true })).commit.sha;
  return {
    ...plan,
    repository,
    develop,
    evaluated: selected.length,
    totalReady: ready.length,
    concurrency,
  };
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('RECONCILIATION_TRUSTED_DEVELOP_ONLY');
  if (!process.env.GH_TOKEN) throw new Error('Missing scoped Actions token');
  const mode = process.argv[2] || 'plan';
  const output = process.argv[3] || '.deploy-state/integration-reconciliation.json';
  if (mode !== 'plan') throw new Error('usage: integration-reconciliation.mjs plan [output.json]');
  const c = client(REPOSITORY, process.env.GH_TOKEN, fetch, { diagnosticsPath: process.env.INTEGRATION_RECONCILIATION_DIAGNOSTICS_PATH || null });
  const plan = await collectReconciliationPlan(c, REPOSITORY, {
    concurrency: Number(process.env.INTEGRATION_PREFLIGHT_CONCURRENCY || 6),
    maxEvaluations: Number(process.env.INTEGRATION_MAX_EVALUATIONS || maxReadyEvaluationsPerRun),
  });
  if (process.env.INTEGRATION_RECONCILIATION_PERSIST === 'true') await persistReconciliationPlan(c, plan);
  mkdirSync(resolve(output, '..'), { recursive: true });
  writeFileSync(output, JSON.stringify(plan, null, 2));
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
    `mode=${plan.pressure.mode}\nactionable=${plan.wakeAgain}\nactionable_idle=${plan.actionableIdle}\nwriter_count=${plan.counts.writer}\nrepair_count=${plan.counts.repair}\nactive_count=${plan.counts.active}\nvalidating_count=${plan.counts.validating}\ntrain_count=${plan.counts.trains}\nready_count=${plan.totalReady}\n`);
  console.log(JSON.stringify(plan, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
