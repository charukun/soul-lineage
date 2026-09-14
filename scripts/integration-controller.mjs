import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { client, integrate, recordQueue } from './integration.mjs';
import { consolidateControlPlanePrs } from './integration-control-consolidation.mjs';
import { controlPlaneScopeForPr } from './integration-control-plane.mjs';

export const AUTO_CONTROL_LABEL = 'integration:control-plane';
export const AUTO_RECOVERY_LABEL = 'integration:repair';

async function labelTrustedControlPlane(c, repository) {
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 10 });
  const labeled = [];
  for (const pr of open.filter(item => !item.draft && item.head?.repo?.full_name === repository && ['OWNER','MEMBER','COLLABORATOR'].includes(item.author_association))) {
    try {
      const scope = await controlPlaneScopeForPr(c, pr.number, { cache: true });
      if (!scope.trusted) continue;
      const labels = new Set((pr.labels || []).map(label => label.name));
      const add = [AUTO_CONTROL_LABEL, AUTO_RECOVERY_LABEL].filter(label => !labels.has(label));
      if (add.length) await c.api('POST', `${c.root}/issues/${pr.number}/labels`, { labels: add });
      labeled.push({ pr: pr.number, head: pr.head.sha, files: scope.files.length, labels: add });
    } catch (error) {
      labeled.push({ pr: pr.number, head: pr.head.sha, error: error.message });
    }
  }
  return labeled;
}

export async function runController(c, repository, options = {}) {
  const consolidation = await consolidateControlPlanePrs(c).catch(error => ({ closed: [], held: [{ reason: error.message }] }));
  const autoControl = await labelTrustedControlPlane(c, repository);
  const report = await integrate(c, repository, options.wait, options);
  report.autoControlPlane = autoControl;
  report.controlPlaneConsolidation = consolidation;
  return report;
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'Integration controller only runs on develop');
  assert.equal(repository, 'charukun/soul-lineage');
  assert.ok(process.env.GH_TOKEN, 'Missing scoped Actions token');
  const diagnosticsPath = process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-diagnostics.json';
  const c = client(repository, process.env.GH_TOKEN, fetch, { diagnosticsPath });
  let report = { startedAt: new Date().toISOString(), merged: [], held: [], trustedReviewed: [], deferred: [], autoControlPlane: [], controlPlaneConsolidation: { closed: [], held: [] } };
  let thrown = null;
  try {
    report = await runController(c, repository, {
      timeBudgetMs: Number(process.env.INTEGRATION_TIME_BUDGET_MS || 360000),
      evaluationCursor: process.env.INTEGRATION_EVALUATION_CURSOR,
    });
    await recordQueue(c, report, `https://github.com/${repository}/actions/runs/${process.env.GITHUB_RUN_ID}`);
    if (!report.verified && !report.verificationPending) await c.api('POST', `${c.root}/statuses/${report.sha}`, {
      state: 'pending', context: 'integration/develop', description: 'DEV Publisher owns deploy, HTTP/source and focused browser verification',
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
      `## Integration Controller\nFinal develop: ${report.sha || 'unknown'}\n\nMerged: ${(report.merged || []).map(x => `#${x.pr}`).join(', ') || 'none'}\n\n` +
      `Auto control-plane: ${(report.autoControlPlane || []).filter(x => !x.error).map(x => `#${x.pr}`).join(', ') || 'none'}\n\n` +
      `Consolidated control PRs: ${(report.controlPlaneConsolidation?.closed || []).map(x => `#${x.old}→#${x.replacement}`).join(', ') || 'none'}\n\n` +
      `API requests: ${report.api?.requests ?? 'n/a'}; duration: ${report.durationMs ?? report.api?.elapsedMs ?? 'n/a'} ms\n` +
      (thrown ? `\nError: ${thrown.message}\n` : ''));
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT,
      `sha=${report.sha || ''}\nverify=${!report.verified && !report.verificationPending}\nretry=${Boolean(report.retry)}\ncursor=${report.retryCursor ?? 0}\nmerged_count=${report.merged?.length || 0}\n`);
  }
  if (thrown) throw thrown;
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
