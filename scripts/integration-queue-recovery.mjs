import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client, fastGate, recoverCancelledCi, recoveryReady } from './integration.mjs';
import { manualReason, REPOSITORY } from './integration-rescue-policy.mjs';

// The existing external watchdog dispatches deploy.yml rescue_mode=scan. This
// observer recovers delivery events without claiming a Rescue worker or merging.
export async function recoverQueue(c, { now = Date.now(), limit = 12, budgetMs = 150000 } = {}) {
  const started = Date.now();
  const report = { checked: [], ciRecovery: [], wake: [], errors: [], dispatched: false };
  const all = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const ready = all.filter(pr => !manualReason(pr));
  // A time-based window gives queues larger than one API budget a fair scan
  // without adding another task database or requiring a self-dispatch loop.
  const windows = Math.max(1, Math.ceil(ready.length / limit));
  const start = (Math.floor(now / 600000) % windows) * limit;
  for (const snapshot of ready.slice(start, start + limit)) {
    if (Date.now() - started > budgetMs || (c.metrics?.().requests || 0) > 140 ||
        (c.metrics?.().rateRemaining != null && c.metrics().rateRemaining < 200)) break;
    try {
      const pr = await c.api('GET', `${c.root}/pulls/${snapshot.number}`);
      report.checked.push(pr.number);
      if (manualReason(pr) || pr.mergeable !== true) continue;
      if (await fastGate(c, pr)) {
        const statuses = await c.pages(`/commits/${pr.head.sha}/statuses`, undefined, { maxPages: 3 });
        const queue = statuses.find(s => s.context === 'integration/queue');
        // Known semantic/review holds are not missed CI events. Integration owns
        // their disposition; this observer never clears or rewrites them.
        const missed = !queue || /fast gate|another check|cancelled.*CI|develop verification is running|deferred|time budget|HTTP (429|5\d\d)/i.test(queue.description || '');
        if (missed && await recoveryReady(c, pr)) report.wake.push({ pr: pr.number, head: pr.head.sha });
      } else {
        const recovery = await recoverCancelledCi(c, pr);
        if (recovery.state !== 'unchanged') report.ciRecovery.push({ pr: pr.number, head: pr.head.sha, ...recovery });
      }
    } catch (error) { report.errors.push({ pr: snapshot.number, reason: error.message }); }
  }
  if (report.wake.length) {
    // One standard Integration scan; gates are re-read there before any merge.
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
