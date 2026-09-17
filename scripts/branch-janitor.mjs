import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { client } from './integration.mjs';

export const DEFAULT_DELETE_LIMIT = 30;
const SHORT_LIVED_PREFIXES = [
  'chore/', 'ci/', 'cleanup/', 'docs/', 'fix/', 'perf/', 'refactor/', 'task/', 'work/',
];
const RESERVED_BRANCHES = new Set(['develop', 'main', 'gh-pages', 'production']);
const gitSha = value => typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);

export function shortLivedBranch(name = '') {
  return SHORT_LIVED_PREFIXES.some(prefix => name.startsWith(prefix));
}

export function branchCandidate(branch, { defaultBranch, openHeads = new Set() } = {}) {
  const name = branch?.name || '';
  if (!name || !gitSha(branch?.commit?.sha)) return { eligible: false, reason: 'invalid-branch' };
  if (RESERVED_BRANCHES.has(name) || name === defaultBranch) return { eligible: false, reason: 'reserved-branch' };
  if (branch.protected) return { eligible: false, reason: 'protected-branch' };
  if (openHeads.has(name)) return { eligible: false, reason: 'open-pr-head' };
  if (!shortLivedBranch(name)) return { eligible: false, reason: 'non-short-lived-prefix' };
  return { eligible: true, reason: 'candidate' };
}

export async function containedInDevelop(c, branchSha, developSha) {
  const comparison = await c.api('GET', `${c.root}/compare/${branchSha}...${developSha}`);
  return comparison?.merge_base_commit?.sha === branchSha;
}

function branchUrlReferenced(body = '', branch = '') {
  if (!branch) return false;
  const escaped = branch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:blob|tree)/${escaped}(?:/|\\b)`, 'i').test(body);
}

async function pullsForBranch(c, owner, branch, state) {
  const encoded = encodeURIComponent(`${owner}:${branch}`);
  return c.pages(`/pulls?state=${state}&head=${encoded}&per_page=100`, undefined, { maxPages: 3 });
}

async function mergedPrProof(c, owner, branch) {
  const pulls = await pullsForBranch(c, owner, branch, 'closed');
  const merged = pulls.filter(pr => Boolean(pr.merged_at));
  if (merged.length === 0) return { ok: false, reason: 'no-merged-pr-proof' };
  if (merged.some(pr => branchUrlReferenced(pr.body || '', branch))) {
    return { ok: false, reason: 'branch-linked-evidence-in-pr-body' };
  }
  return { ok: true, mergedPrs: merged.map(pr => pr.number) };
}

async function openPrForBranch(c, owner, branch) {
  return (await pullsForBranch(c, owner, branch, 'open')).length > 0;
}

export async function cleanMergedBranches(c, repository, { apply = false, limit = DEFAULT_DELETE_LIMIT } = {}) {
  const startedAt = new Date().toISOString();
  const repo = await c.api('GET', c.root);
  const [developBranch, branches, openPulls] = await Promise.all([
    c.api('GET', `${c.root}/branches/develop`),
    c.pages('/branches?per_page=100', undefined, { maxPages: 20 }),
    c.pages('/pulls?state=open&per_page=100', undefined, { maxPages: 20 }),
  ]);
  const develop = developBranch.commit.sha;
  const owner = repository.split('/')[0];
  const openHeads = new Set(openPulls.filter(pr => pr.head?.repo?.full_name === repository).map(pr => pr.head.ref));
  const report = {
    mode: apply ? 'BRANCH_JANITOR_APPLY' : 'BRANCH_JANITOR_DRY_RUN',
    startedAt,
    develop,
    defaultBranch: repo.default_branch,
    examined: branches.length,
    candidates: [],
    deleted: [],
    skipped: [],
  };

  for (const branch of branches) {
    if (report.deleted.length >= limit) break;
    const candidate = branchCandidate(branch, { defaultBranch: repo.default_branch, openHeads });
    if (!candidate.eligible) {
      report.skipped.push({ branch: branch.name, reason: candidate.reason });
      continue;
    }

    let contained = false;
    try {
      contained = await containedInDevelop(c, branch.commit.sha, develop);
    } catch (error) {
      report.skipped.push({ branch: branch.name, reason: `comparison-error:${error.message}` });
      continue;
    }
    if (!contained) {
      report.skipped.push({ branch: branch.name, reason: 'not-contained-in-develop' });
      continue;
    }

    const proof = await mergedPrProof(c, owner, branch.name);
    if (!proof.ok) {
      report.skipped.push({ branch: branch.name, reason: proof.reason });
      continue;
    }

    report.candidates.push({ branch: branch.name, sha: branch.commit.sha, mergedPrs: proof.mergedPrs });
    if (!apply) continue;

    const refPath = branch.name.split('/').map(encodeURIComponent).join('/');
    const [currentDevelop, ref, hasOpenPr, currentProof] = await Promise.all([
      c.api('GET', `${c.root}/branches/develop`),
      c.api('GET', `${c.root}/git/ref/heads/${refPath}`),
      openPrForBranch(c, owner, branch.name),
      mergedPrProof(c, owner, branch.name),
    ]);
    if (hasOpenPr) {
      report.skipped.push({ branch: branch.name, reason: 'open-pr-head-at-delete' });
      continue;
    }
    if (!currentProof.ok) {
      report.skipped.push({ branch: branch.name, reason: `proof-changed-at-delete:${currentProof.reason}` });
      continue;
    }
    if (ref?.object?.type !== 'commit' || ref.object.sha !== branch.commit.sha) {
      report.skipped.push({ branch: branch.name, reason: 'branch-moved-at-delete' });
      continue;
    }
    if (!await containedInDevelop(c, ref.object.sha, currentDevelop.commit.sha)) {
      report.skipped.push({ branch: branch.name, reason: 'no-longer-contained-at-delete' });
      continue;
    }
    await c.api('DELETE', `${c.root}/git/refs/heads/${refPath}`);
    report.deleted.push({ branch: branch.name, sha: ref.object.sha, mergedPrs: currentProof.mergedPrs });
  }

  report.finishedAt = new Date().toISOString();
  return report;
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  assert.equal(repository, 'charukun/soul-lineage', 'BRANCH_JANITOR_REPOSITORY_MISMATCH');
  assert.ok(token, 'GH_TOKEN is required');
  const apply = /^(1|true|yes)$/i.test(process.env.BRANCH_JANITOR_APPLY || 'false');
  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/branch-janitor-api.json',
  });
  const report = await cleanMergedBranches(c, repository, {
    apply,
    limit: Number(process.env.BRANCH_JANITOR_LIMIT || DEFAULT_DELETE_LIMIT),
  });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync(resolve('.deploy-state/branch-janitor.json'), JSON.stringify({ ...report, api: c.metrics() }, null, 2));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
