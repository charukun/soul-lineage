import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client, fastGate, recoverCancelledCi, recoveryReady } from './integration.mjs';
import { dependencies } from './integration-policy.mjs';
import { manualReason, REPOSITORY, STATE_BRANCH, STATE_FILE } from './integration-rescue-policy.mjs';
import { contentSupersessionProof, flowPressure, quarantineDecision, staleReadyCandidate } from './integration-flow-control.mjs';

export const RESCUE_RUNTIME_TARGET = Object.freeze({
  maxConcurrency: 6,
  maxEvaluations: 24,
  scanMinMs: 60_000,
  queueStallMs: 300_000,
  retryMs: 120_000,
});

export function exactDevelopAncestor(comparison, head, develop) {
  return comparison?.base_commit?.sha === head && comparison?.merge_base_commit?.sha === head &&
    comparison?.head_commit?.sha === develop && ['ahead', 'identical'].includes(comparison?.status) &&
    Number.isSafeInteger(comparison?.ahead_by) && comparison.ahead_by >= 0;
}

export function rescueRuntimeAudit(state, develop) {
  if (!state || state.schema !== 1 || state.repository !== REPOSITORY) {
    return { ok: false, pending: true, reason: 'Rescue state unavailable', expected: RESCUE_RUNTIME_TARGET, actual: null, mismatches: [] };
  }
  const actual = Object.fromEntries(Object.keys(RESCUE_RUNTIME_TARGET).map(key => [key, state.config?.[key] ?? null]));
  const mismatches = Object.entries(RESCUE_RUNTIME_TARGET).filter(([key, value]) => actual[key] !== value)
    .map(([key, expected]) => ({ key, expected, actual: actual[key] }));
  const observedDevelop = state.coordinator?.develop || null;
  if (observedDevelop !== develop) {
    return { ok: false, pending: true, reason: 'Waiting for Rescue coordinator on current develop', expected: RESCUE_RUNTIME_TARGET, actual, mismatches, observedDevelop };
  }
  return { ok: mismatches.length === 0, pending: false,
    reason: mismatches.length ? `Runtime config drift: ${mismatches.map(item => `${item.key}=${item.actual}`).join(', ')}` : 'Runtime config matches throughput v2',
    expected: RESCUE_RUNTIME_TARGET, actual, mismatches, observedDevelop };
}

async function readRescueState(c) {
  try {
    const file = await c.api('GET', `${c.root}/contents/${STATE_FILE}?ref=${encodeURIComponent(STATE_BRANCH)}`);
    if (file.encoding !== 'base64' || !file.content) return null;
    return JSON.parse(Buffer.from(file.content, 'base64').toString('utf8'));
  } catch (error) {
    if (/HTTP 404\b/.test(error.message)) return null;
    throw error;
  }
}

async function recordRuntimeAudit(c, develop, audit) {
  const state = audit.pending ? 'pending' : audit.ok ? 'success' : 'failure';
  const description = audit.pending ? 'Waiting for Rescue runtime config on current develop' : audit.ok
    ? 'Rescue runtime: 6 workers / 24 eval / 60s scan / 5m stall / 2m retry'
    : `Rescue runtime config drift: ${audit.mismatches.slice(0, 2).map(item => item.key).join(', ')}`;
  await c.api('POST', `${c.root}/statuses/${develop}`, {
    state,
    context: 'integration-rescue/config',
    description,
    target_url: `https://github.com/${REPOSITORY}/actions/workflows/deploy.yml`,
  });
}

async function closeSuperseded(c, pr, develop, description) {
  const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  if (fresh.head.sha !== pr.head.sha || branch.commit.sha !== develop || manualReason(fresh)) return false;
  await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
    state: 'success', context: 'integration/queue', description, target_url: fresh.html_url,
  });
  await c.api('PATCH', `${c.root}/pulls/${pr.number}`, { state: 'closed' });
  return true;
}

async function retireExactSuperseded(c, pr, develop) {
  const comparison = await c.api('GET', `${c.root}/compare/${pr.head.sha}...${develop}`);
  if (!exactDevelopAncestor(comparison, pr.head.sha, develop)) return false;
  return closeSuperseded(c, pr, develop, 'SUPERSEDED: exact PR head is already contained in develop');
}

async function treeEntries(c, commitSha) {
  const commit = await c.api('GET', `${c.root}/git/commits/${commitSha}`);
  if (commit?.sha !== commitSha || !/^[0-9a-f]{40}$/.test(commit.tree?.sha || '')) throw new Error('SUPERSESSION_TREE_COMMIT_INVALID');
  const tree = await c.api('GET', `${c.root}/git/trees/${commit.tree.sha}?recursive=1`);
  if (tree?.sha !== commit.tree.sha || tree.truncated !== false || !Array.isArray(tree.tree)) throw new Error('SUPERSESSION_TREE_INCOMPLETE');
  const entries = new Map();
  for (const item of tree.tree) if (item.type !== 'tree') entries.set(item.path, `${item.mode}:${item.type}:${item.sha}`);
  return entries;
}

export async function retireContentSuperseded(c, pr, develop) {
  const files = await c.pages(`/pulls/${pr.number}/files`, undefined, { maxPages: 4 });
  if (!files.length || files.length !== pr.changed_files || files.length > 120) return false;
  const paths = [...new Set(files.flatMap(file => [file.filename, file.previous_filename].filter(Boolean)))];
  const [headEntries, developEntries] = await Promise.all([treeEntries(c, pr.head.sha), treeEntries(c, develop)]);
  const proof = contentSupersessionProof(paths, headEntries, developEntries);
  if (!proof.equivalent) return false;
  return closeSuperseded(c, pr, develop, `SUPERSEDED: ${paths.length} touched paths exactly match current develop`);
}

export async function reconcileStack(c, pr, develop) {
  const deps = dependencies(pr.body || '');
  if (!deps.length || pr.head.repo?.full_name !== REPOSITORY || pr.base?.ref !== 'develop') return { state:'not-stacked' };
  const depStates = await Promise.all(deps.map(number => c.api('GET', `${c.root}/pulls/${number}`)));
  if (!depStates.every(dep => (dep.merged || dep.merged_at) && dep.base?.ref === 'develop' && dep.base?.repo?.full_name === REPOSITORY)) return { state:'dependency-wait' };
  if (!await recoveryReady(c, pr)) return { state:'safety-hold' };
  const before = await c.api('GET', `${c.root}/pulls/${pr.number}`);
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  if (before.head.sha !== pr.head.sha || branch.commit.sha !== develop) return { state:'changed' };
  try {
    const result = await c.api('POST', `${c.root}/merges`, {
      base: pr.head.ref,
      head: develop,
      commit_message: `Merge develop into ${pr.head.ref} after dependencies ${deps.map(number => `#${number}`).join(', ')} merged`,
    });
    if (!result) return { state:'already-current' };
    if (!/^[0-9a-f]{40}$/.test(result.sha || '')) throw new Error('STACK_RECONCILE_RESULT_INVALID');
    return { state:'merged-forward', sha:result.sha, previousHead:pr.head.sha, develop, dependencies:deps };
  } catch (error) {
    if (/HTTP 409\b/.test(error.message)) return { state:'conflict', reason:'STACK_RECONCILE_CONFLICT' };
    throw error;
  }
}

function quarantineSet(state) {
  return new Set(Object.values(state?.records || {}).filter(record => quarantineDecision(record).quarantined).map(record => Number(record.pr)));
}

export async function recoverQueue(c, { now = Date.now(), limit = 24, budgetMs = 150000 } = {}) {
  const started = Date.now();
  const report = { checked: [], ciRecovery: [], wake: [], superseded: [], semanticSuperseded: [], stackReconciled: [], quarantine: [], staleReview: [], errors: [], dispatched: false, configAudit: null, flowControl: null };
  let develop = null;
  try { develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha; }
  catch (error) { report.errors.push({ pr: null, reason: `DEVELOP_SNAPSHOT: ${error.message}` }); }
  const state = await readRescueState(c).catch(error => { report.errors.push({ pr:null, reason:`RESCUE_STATE: ${error.message}` }); return null; });
  const quarantined = quarantineSet(state);
  const all = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const ready = all.filter(pr => !manualReason(pr));
  report.flowControl = flowPressure({ ready: ready.length });
  const windows = Math.max(1, Math.ceil(ready.length / limit));
  const start = report.flowControl.mode === 'BURN_DOWN' ? 0 : (Math.floor(now / 600000) % windows) * limit;
  let semanticBudget = 4, stackBudget = 4;
  for (const snapshot of ready.slice(start, start + limit)) {
    if (Date.now() - started > budgetMs || (c.metrics?.().requests || 0) > 140 ||
        (c.metrics?.().rateRemaining != null && c.metrics().rateRemaining < 200)) break;
    try {
      let pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
      report.checked.push(pr.number);
      if (manualReason(pr)) continue;
      if (develop && await retireExactSuperseded(c, pr, develop)) {
        report.superseded.push({ pr: pr.number, head: pr.head.sha, develop }); continue;
      }
      const stale = staleReadyCandidate(pr, now);
      if (stale) report.staleReview.push({ pr: pr.number, head: pr.head.sha, createdAt: pr.created_at || null, reason: 'STALE_READY_AI_REVIEW_CANDIDATE' });
      if (develop && stale && semanticBudget > 0) {
        semanticBudget--;
        if (await retireContentSuperseded(c, pr, develop)) {
          report.semanticSuperseded.push({ pr:pr.number, head:pr.head.sha, develop }); continue;
        }
      }
      if (quarantined.has(Number(pr.number))) {
        const decision = quarantineDecision(state?.records?.[pr.number]);
        report.quarantine.push({ pr:pr.number, head:pr.head.sha, reason:decision.reason });
        await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
          state:'pending', context:'integration/quarantine',
          description:'QUARANTINE: repeated failures isolated from normal Integration train; AI deep repair owns recovery',
          target_url:pr.html_url,
        });
        continue;
      }
      if (develop && stackBudget > 0 && dependencies(pr.body || '').length) {
        stackBudget--;
        const reconciled = await reconcileStack(c, pr, develop);
        if (reconciled.state === 'merged-forward') {
          report.stackReconciled.push({ pr:pr.number, ...reconciled });
          continue; // synchronize event owns exact-head CI for the new head.
        }
        if (reconciled.state === 'conflict') report.errors.push({ pr:pr.number, reason:reconciled.reason });
        pr = await c.api('GET', `${c.root}/pulls/${pr.number}`);
      }
      if (pr.mergeable !== true) continue;
      if (await fastGate(c, pr)) {
        const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 3 });
        const queue = statuses.find(s => s.context === 'integration/queue');
        const missed = !queue || /fast gate|another check|cancelled.*CI|develop verification is running|deferred|time budget|HTTP (429|5\d\d)/i.test(queue.description || '');
        if (missed && await recoveryReady(c, pr)) report.wake.push({ pr: pr.number, head: pr.head.sha });
      } else {
        const recovery = await recoverCancelledCi(c, pr);
        if (recovery.state !== 'unchanged') report.ciRecovery.push({ pr: pr.number, head: pr.head.sha, ...recovery });
      }
    } catch (error) { report.errors.push({ pr: snapshot.number, reason: error.message }); }
  }
  if (develop) {
    try {
      report.configAudit = rescueRuntimeAudit(state, develop);
      await recordRuntimeAudit(c, develop, report.configAudit);
    } catch (error) { report.errors.push({ pr: null, reason: `RESCUE_CONFIG_AUDIT: ${error.message}` }); }
  } else report.configAudit = { ok:false, pending:true, reason:'Current develop snapshot unavailable; audit deferred', expected:RESCUE_RUNTIME_TARGET, actual:null, mismatches:[] };
  if (report.wake.length) {
    await c.api('POST', `${c.root}/actions/workflows/deploy.yml/dispatches`, { ref: 'develop' });
    report.dispatched = true;
  }
  return report;
}

async function main() {
  if (process.env.GITHUB_REPOSITORY !== REPOSITORY || process.env.GITHUB_REF !== 'refs/heads/develop') throw new Error('QUEUE_RECOVERY_TRUSTED_DEVELOP_ONLY');
  if (!process.env.GH_TOKEN) throw new Error('Missing scoped Actions token');
  const c = client(REPOSITORY, process.env.GH_TOKEN);
  const report = await recoverQueue(c);
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/queue-recovery.json', JSON.stringify({ ...report, api: c.metrics() }, null, 2));
  console.log(JSON.stringify(report, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();