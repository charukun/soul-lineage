import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './integration.mjs';
import { dependencies } from './integration-policy.mjs';
import { reconcileStack } from './integration-queue-recovery.mjs';

export const DEFAULT_REPAIR_LIMIT = 4;
const TRUSTED = new Set(['OWNER', 'MEMBER', 'COLLABORATOR']);

export function repairValidationMatrix(results = []) {
  return results
    .filter(item => item?.state === 'merged-forward' && Number.isSafeInteger(Number(item.pr)) &&
      /^[0-9a-f]{40}$/i.test(item.sha || '') && /^[0-9a-f]{40}$/i.test(item.develop || ''))
    .map(item => ({ pr: Number(item.pr), head: item.sha, base: item.develop }));
}

function fastRepairCandidate(pr, repository) {
  return pr?.state === 'open' && !pr.draft && pr.base?.ref === 'develop' &&
    pr.base?.repo?.full_name === repository && pr.head?.repo?.full_name === repository &&
    TRUSTED.has(pr.author_association) && dependencies(pr.body || '').length > 0;
}

export async function repairReadyStacks(c, repository, { limit = DEFAULT_REPAIR_LIMIT, reconcile = reconcileStack } = {}) {
  const startedAt = new Date().toISOString();
  const develop = (await c.api('GET', `${c.root}/branches/develop`)).commit.sha;
  const open = await c.pages('/pulls?state=open&base=develop&sort=created&direction=asc', undefined, { maxPages: 6 });
  const candidates = open.filter(pr => fastRepairCandidate(pr, repository)).slice(0, limit);
  const results = [];

  for (const snapshot of candidates) {
    try {
      const [pr, branch] = await Promise.all([
        c.api('GET', `${c.root}/pulls/${snapshot.number}`),
        c.api('GET', `${c.root}/branches/develop`),
      ]);
      if (!fastRepairCandidate(pr, repository) || pr.head.sha !== snapshot.head.sha) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'PR_CHANGED_BEFORE_FAST_REPAIR' });
        continue;
      }
      if (branch.commit.sha !== develop) {
        results.push({ pr: snapshot.number, state: 'changed', reason: 'DEVELOP_CHANGED_BEFORE_FAST_REPAIR' });
        break;
      }
      const outcome = await reconcile(c, pr, develop, { write: true });
      results.push({ pr: pr.number, ...outcome });
    } catch (error) {
      results.push({ pr: snapshot.number, state: 'error', reason: error.message });
    }
  }

  return {
    mode: 'FAST_REPAIR',
    startedAt,
    finishedAt: new Date().toISOString(),
    develop,
    evaluated: candidates.length,
    results,
    matrix: repairValidationMatrix(results),
  };
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.equal(repository, 'charukun/soul-lineage', 'FAST_REPAIR_REPOSITORY_MISMATCH');
  assert.equal(process.env.GITHUB_REF, 'refs/heads/develop', 'FAST_REPAIR_TRUSTED_DEVELOP_ONLY');
  assert.ok(token, 'GH_TOKEN is required');

  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-repair-api.json',
  });
  const report = await repairReadyStacks(c, repository, {
    limit: Number(process.env.INTEGRATION_REPAIR_LIMIT || DEFAULT_REPAIR_LIMIT),
  });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/integration-repair.json', JSON.stringify({ ...report, api: c.metrics() }, null, 2));

  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_has_work=${report.matrix.length > 0}\n`);
    appendFileSync(process.env.GITHUB_OUTPUT, `stack_matrix=${JSON.stringify({ include: report.matrix })}\n`);
  }
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
