import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './integration.mjs';

export const automaticPublisherTitle = 'DEV Publisher (automatic)';
export const publicationWakeContext = 'integration/publisher-wake';
const activeStates = ['queued', 'in_progress', 'waiting', 'requested', 'pending'];
const terminalPublisherConclusions = new Set(['success', 'failure']);
const recoveryReceipt = 'DEV/PULSE publication recovery requested; public verification pending';

export function isAutomaticPublisher(run) {
  return run.head_branch === 'develop' &&
    (run.event === 'push' ||
      (run.event === 'workflow_dispatch' && run.display_title === automaticPublisherTitle));
}

export async function requestDevelopPublication(c, report, { targetUrl } = {}) {
  assert.equal(report.mode, 'FAST_LANE');
  assert.ok(Array.isArray(report.merged));
  const branch = await c.api('GET', `${c.root}/branches/develop`);
  const sha = branch.commit.sha;
  assert.match(sha, /^[0-9a-f]{40}$/);
  const statuses = await c.pages(`/commits/${sha}/statuses`, undefined, { maxPages: 3 });
  const status = context => statuses.find(item => item.context === context);
  const wake = status(publicationWakeContext);
  const publicVerified = status('integration/develop')?.state === 'success' &&
    status('ops-board/public')?.state === 'success';

  // Public verification is authoritative. A failed request receipt is also terminal here:
  // repair owns that failure rather than an idle scan creating an unbounded retry loop.
  if (!report.merged.length && (publicVerified || wake?.state === 'failure')) {
    return { state: 'already-requested-or-published', sha };
  }

  const record = (state, description) => c.api('POST', `${c.root}/statuses/${sha}`, {
    state, context: publicationWakeContext, description,
    ...(targetUrl ? { target_url: targetUrl } : {}),
  });
  try {
    const groups = await Promise.all(activeStates.map(state =>
      c.pages(`/actions/workflows/deploy.yml/runs?branch=develop&status=${state}`, 'workflow_runs', { maxPages: 3 })));
    const active = [...new Map(groups.flat().map(run => [run.id, run])).values()]
      .filter(run => activeStates.includes(run.status) && isAutomaticPublisher(run));
    const cancelled = [];
    for (const run of active.filter(item => item.head_sha !== sha)) {
      try {
        await c.api('POST', `${c.root}/actions/runs/${run.id}/cancel`);
        cancelled.push(run.id);
      } catch (error) {
        if (!/HTTP (409|422)\b/.test(error.message)) throw error;
      }
    }
    const existing = active.find(run => run.head_sha === sha);
    if (existing) {
      await record('success', `DEV/PULSE publisher ${existing.id} already active; public verification pending`);
      return { state: 'already-active', sha, run: existing.id, cancelled };
    }

    // A wake receipt proves only that dispatch was attempted. For an idle pass, require a real
    // exact-SHA publisher run (active above, or completed here) before suppressing recovery.
    // One orphaned receipt gets one bounded recovery dispatch; a second orphan is left visible
    // for Integration repair instead of retrying forever.
    let recoveringOrphan = false;
    if (!report.merged.length && wake) {
      const completed = await c.pages(
        '/actions/workflows/deploy.yml/runs?branch=develop&status=completed',
        'workflow_runs', { maxPages: 3 });
      const terminalPublisher = completed.find(run => run.head_sha === sha &&
        run.status === 'completed' && isAutomaticPublisher(run) &&
        terminalPublisherConclusions.has(run.conclusion));
      if (terminalPublisher || wake.description === recoveryReceipt) {
        return { state: 'already-requested-or-published', sha };
      }
      recoveringOrphan = true;
    }

    await record('pending', recoveringOrphan
      ? 'Recovering missing DEV/PULSE publisher; this is not public verification'
      : 'Requesting DEV/PULSE publication; this is not public verification');
    await c.api('POST', `${c.root}/actions/workflows/deploy.yml/dispatches`, {
      ref: 'develop', inputs: { publish_only: 'true', automatic_publish: 'true' },
    });
    await record('success', recoveringOrphan
      ? recoveryReceipt
      : 'DEV/PULSE publication requested; public verification pending');
    return { state: 'requested', sha, cancelled };
  } catch (error) {
    await record('failure', 'DEV/PULSE publication request failed; inspect Integration run').catch(() => {});
    throw error;
  }
}

async function main() {
  const reportPath = process.argv[2];
  assert.ok(reportPath, 'Fast Lane report path is required');
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.ok(token, 'GH_TOKEN is required');
  const repository = process.env.GITHUB_REPOSITORY;
  const c = client(repository, token);
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const targetUrl = `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`;
  try {
    report.publication = await requestDevelopPublication(c, report, { targetUrl });
    process.stdout.write(`${JSON.stringify(report.publication)}\n`);
  } catch (error) {
    report.publication = { state: 'failed', error: error.message };
    throw error;
  } finally {
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error); process.exitCode = 1; });
}
