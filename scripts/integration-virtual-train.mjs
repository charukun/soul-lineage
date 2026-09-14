import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPOSITORY, manualReason, rescueConfig } from './integration-rescue-policy.mjs';
import { rescueClient, RescueStore } from './integration-rescue-store.mjs';
import { fastGate, recoveryReady } from './integration.mjs';
import {
  adaptiveFlowTuning,
  deliveryLatencyMetrics,
  planIntegrationTrain,
  quarantineDecision,
} from './integration-flow-control.mjs';

const sha = value => typeof value === 'string' && /^[0-9a-f]{40}$/.test(value);
const safeRef = value => String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').slice(0, 80);
const TRAIN_PREFIX = 'automation/integration-train-';

export async function virtualTrainCandidates(c, state, develop, { max = 5, inspect = 8 } = {}) {
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const scopeByPr = new Map(Object.values(state?.records || {})
    .filter(record => record.scope?.files?.length)
    .map(record => [Number(record.pr), record.scope]));
  const eligible = [];

  for (const snapshot of open) {
    if (eligible.length >= inspect) break;
    const record = state?.records?.[snapshot.number];
    if (
      snapshot.draft ||
      snapshot.head?.repo?.full_name !== REPOSITORY ||
      manualReason(snapshot) ||
      quarantineDecision(record).quarantined
    ) continue;

    const pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
    if (pr.head.sha !== snapshot.head.sha) continue;
    if (!await recoveryReady(c, pr)) continue;
    if (!await fastGate(c, pr, { cache: true })) continue;
    eligible.push(pr);
  }

  return planIntegrationTrain(eligible, scopeByPr, { max }).selected;
}

export async function cleanupVirtualTrain(c, branch) {
  if (!branch?.startsWith(TRAIN_PREFIX)) return false;
  try {
    await c.api('DELETE', `${c.root}/git/refs/heads/${branch}`);
    return true;
  } catch (error) {
    if (/HTTP 404\b/.test(error.message)) return false;
    throw error;
  }
}

export async function cleanupOrphanedVirtualTrains(c, { limit = 8 } = {}) {
  let refs;
  try {
    refs = await c.api('GET', `${c.root}/git/matching-refs/heads/${TRAIN_PREFIX}`);
  } catch (error) {
    if (/HTTP 404\b/.test(error.message)) return [];
    throw error;
  }
  if (!Array.isArray(refs)) return [];

  const removed = [];
  for (const ref of refs.slice(0, limit)) {
    const branch = String(ref?.ref || '').replace(/^refs\/heads\//, '');
    if (!branch.startsWith(TRAIN_PREFIX)) continue;
    if (await cleanupVirtualTrain(c, branch)) removed.push(branch);
  }
  return removed;
}

export async function buildVirtualTrain(c, state, develop, {
  runId = Date.now(),
  max = 5,
  keepRef = false,
} = {}) {
  if (!sha(develop)) throw new Error('VIRTUAL_TRAIN_DEVELOP_SHA_REQUIRED');
  const candidates = await virtualTrainCandidates(c, state, develop, { max });
  if (candidates.length < 2) {
    return {
      status: 'skipped',
      reason: 'fewer than two safe independent candidates',
      base: develop,
      candidates: candidates.map(pr => ({ pr: pr.number, head: pr.head.sha })),
    };
  }

  const branch = `${TRAIN_PREFIX}${safeRef(runId)}-${develop.slice(0, 8)}`;
  const ref = `refs/heads/${branch}`;
  let current = develop;
  let created = false;
  const merged = [];

  try {
    await c.api('POST', `${c.root}/git/refs`, { ref, sha: develop });
    created = true;

    for (const pr of candidates) {
      const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
      const liveDevelop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
      if (fresh.head.sha !== pr.head.sha || liveDevelop !== develop) {
        return {
          status: 'stale',
          base: develop,
          branch,
          candidates: merged,
          reason: 'develop or candidate head changed during virtual train',
        };
      }

      try {
        const result = await c.api('POST', `${c.root}/merges`, {
          base: branch,
          head: pr.head.sha,
          commit_message: `Virtual Integration Train: #${pr.number} @ ${pr.head.sha}`,
        });
        if (result?.sha) current = result.sha;
        merged.push({ pr: pr.number, head: pr.head.sha, synthetic: current });
      } catch (error) {
        if (/HTTP 409\b/.test(error.message)) {
          return {
            status: 'conflict',
            base: develop,
            branch,
            candidates: merged,
            failed: { pr: pr.number, head: pr.head.sha },
            reason: 'virtual merge conflict',
          };
        }
        throw error;
      }
    }

    const commit = await c.api('GET', `${c.root}/git/commits/${current}`);
    if (commit?.sha !== current || !sha(commit.tree?.sha)) throw new Error('VIRTUAL_TRAIN_COMMIT_INVALID');
    return {
      status: 'assembled',
      base: develop,
      branch,
      candidates: merged,
      syntheticCommit: current,
      syntheticTree: commit.tree.sha,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    if (created && keepRef) await cleanupVirtualTrain(c, branch).catch(() => {});
    throw error;
  } finally {
    if (created && !keepRef) await cleanupVirtualTrain(c, branch).catch(() => {});
  }
}

export async function recordVirtualTrain(store, proof, now = Date.now()) {
  await store.mutate(state => {
    state.flowControl ||= {};
    state.flowControl.trainProof = { ...proof, recordedAt: new Date(now).toISOString() };
  });
  return proof;
}

export async function planVirtualTrain(c, store, { runId = Date.now() } = {}) {
  await cleanupOrphanedVirtualTrains(c).catch(error => console.warn(`Virtual Train orphan cleanup skipped: ${error.message}`));

  const { state } = await store.read();
  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const records = Object.values(state?.records || {});
  const deliveries = Object.values(state?.flowControl?.deliveries || {});
  const fallbackLatency = deliveryLatencyMetrics(deliveries.length ? deliveries : records);
  const failureRate = records.filter(record => (record.failures || []).length).length / Math.max(1, records.length);
  const tuning = state.flowControl?.tuning?.pressure?.mode
    ? state.flowControl.tuning
    : adaptiveFlowTuning({
        ready: records.filter(record => !['DEV', 'CLOSED'].includes(record.state)).length,
        latency: fallbackLatency,
        failureRate,
        rateRemaining: c.metrics?.().rateRemaining,
      });

  if (tuning.pressure.mode === 'NORMAL') {
    return { status: 'skipped', reason: 'normal queue pressure', base: develop, candidates: [], tuning };
  }

  const proof = await buildVirtualTrain(c, state, develop, {
    runId,
    max: tuning.trainSize,
    keepRef: true,
  });
  return { ...proof, tuning };
}

export async function finalizeVirtualTrain(c, store, proof, { fast, browser, now = Date.now() } = {}) {
  let result = { ...proof, fast, browser };
  const liveDevelop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;

  if (proof.status === 'assembled' && proof.base === liveDevelop && fast === 'success' && browser === 'success') {
    result = { ...result, status: 'validated', validatedAt: new Date(now).toISOString() };
  } else if (proof.status === 'assembled') {
    result = {
      ...result,
      status: proof.base === liveDevelop ? 'failed-validation' : 'stale',
      validatedAt: new Date(now).toISOString(),
    };
  }

  await recordVirtualTrain(store, result, now);
  if (proof.branch) await cleanupVirtualTrain(c, proof.branch).catch(() => {});
  return result;
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') {
    throw new Error('VIRTUAL_TRAIN_TRUSTED_DEVELOP_ONLY');
  }

  const config = rescueConfig(process.env);
  const c = rescueClient(process.env.GH_TOKEN, config);
  const store = new RescueStore(c, config);
  const mode = process.argv[2];
  const file = process.argv[3] || '.deploy-state/virtual-train.json';
  mkdirSync(resolve(file, '..'), { recursive: true });

  if (mode === 'plan') {
    const proof = await planVirtualTrain(c, store, { runId: process.env.GITHUB_RUN_ID });
    writeFileSync(file, JSON.stringify(proof, null, 2));
    if (process.env.GITHUB_OUTPUT) {
      writeFileSync(process.env.GITHUB_OUTPUT,
        `has_train=${proof.status === 'assembled'}\nbranch=${proof.branch || ''}\ncommit=${proof.syntheticCommit || ''}\nbase=${proof.base || ''}\n`,
        { flag: 'a' });
    }
    console.log(JSON.stringify(proof));
    return;
  }

  if (mode === 'finalize') {
    const proof = JSON.parse(readFileSync(file, 'utf8'));
    const result = await finalizeVirtualTrain(c, store, proof, {
      fast: process.env.TRAIN_FAST,
      browser: process.env.TRAIN_BROWSER,
    });
    writeFileSync(file, JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
    return;
  }

  throw new Error('usage: integration-virtual-train.mjs <plan|finalize> <proof.json>');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();