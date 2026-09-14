import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client, fastGate, recoverCancelledCi, recoveryReady } from './integration.mjs';
import { manualReason, REPOSITORY, STATE_BRANCH, STATE_FILE } from './integration-rescue-policy.mjs';

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
    target_url: `https://github.com/${REPOSITORY}/actions/workflows/integration-controller.yml`,
  });
}

async function retireExactSuperseded(c, pr, develop) {
  const comparison = await c.api('GET', `${c.root}/compare/${pr.head.sha}...${develop}`);
  if (!exactDevelopAncestor(comparison, pr.head.sha, develop)) return false;
  const fresh = await c.api('GET', `${c.root}/pulls/${pr.number}`);
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  if (fresh.head.sha !== pr.head.sha || branch.commit.sha !== develop || manualReason(fresh)) return false;
  await c.api('POST', `${c.root}/statuses/${pr.head.sha}`, {
    state: 'success',
    context: 'integration/queue',
    description: 'SUPERSEDED: exact PR head is already contained in develop',
    target_url: fresh.html_url,
  });
  await c.api('PATCH', `${c.root}/pulls/${pr.number}`, { state: 'closed' });
  return true;
}

// The external watchdog dispatches Integration Controller with rescue_mode=scan.
// This observer recovers delivery events without claiming a Rescue worker or merging.
export async function recoverQueue(c, { now = Date.now(), limit = 24, budgetMs = 150000 } = {}) {
  const started = Date.now();
  const report = { checked: [], ciRecovery: [], wake: [], superseded: [], errors: [], dispatched: false, configAudit: null };
  let develop = null;
  try {
    develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  } catch (error) {
    report.errors.push({ pr: null, reason: `DEVELOP_SNAPSHOT: ${error.message}` });
  }
  const all = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const ready = all.filter(pr => !manualReason(pr));
  const windows = Math.max(1, Math.ceil(ready.length / limit));
  const start = (Math.floor(now / 600000) % windows) * limit;
  for (const snapshot of ready.slice(start, start + limit)) {
    if (Date.now() - started > budgetMs || (c.metrics?.().requests || 0) > 140 ||
        (c.metrics?.().rateRemaining != null && c.metrics().rateRemaining < 200)) break;
    try {
      const pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
      report.checked.push(pr.number);
      if (manualReason(pr)) continue;
      if (develop && await retireExactSuperseded(c, pr, develop)) {
        report.superseded.push({ pr: pr.number, head: pr.head.sha, develop });
        continue;
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
      report.configAudit = rescueRuntimeAudit(await readRescueState(c), develop);
      await recordRuntimeAudit(c, develop, report.configAudit);
    } catch (error) {
      report.errors.push({ pr: null, reason: `RESCUE_CONFIG_AUDIT: ${error.message}` });
    }
  } else {
    report.configAudit = { ok: false, pending: true, reason: 'Current develop snapshot unavailable; audit deferred', expected: RESCUE_RUNTIME_TARGET, actual: null, mismatches: [] };
  }
  if (report.wake.length) {
    await c.api('POST', `${c.root}/actions/workflows/integration-controller.yml/dispatches`, { ref: 'develop' });
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
