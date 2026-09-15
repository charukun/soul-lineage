import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseDeepRepairIssue } from './integration-deep-repair-lookup.mjs';

const FINALIZABLE_STATES = new Set(['pending', 'working', 'ready-for-integration', 'completed']);
const DEEP_REPAIR_CONTEXT = 'integration/deep-repair';

function validSha(value) {
  return typeof value === 'string' && /^[0-9a-f]{40}$/i.test(value);
}

function marker(state) {
  return `<!-- integration-deep-repair:v1\n${JSON.stringify(state)}\n-->`;
}

function replaceMarker(body, state) {
  const pattern = /<!-- integration-deep-repair:v1\n[^\n]+\n-->/;
  assert.match(String(body || ''), pattern, 'DEEP_REPAIR_MARKER_REQUIRED');
  return String(body).replace(pattern, marker(state));
}

function normalizeMerges(merges = []) {
  const result = new Map();
  for (const item of merges) {
    const pr = Number(item?.pr);
    if (!Number.isSafeInteger(pr) || pr <= 0 || !validSha(item?.head) || !validSha(item?.merge)) continue;
    result.set(pr, { pr, head: item.head, merge: item.merge });
  }
  return result;
}

function issueMatchesMergedPr(issue, mergedByPr) {
  if (!issue || issue.pull_request || issue.state === 'closed') return false;
  const state = parseDeepRepairIssue(issue.body);
  return Boolean(state && mergedByPr.has(Number(state.pr)));
}

async function discoverOpenDeepRepairIssues(c, repository, mergedByPr) {
  const query = `repo:${repository} is:issue is:open in:body "integration-deep-repair:v1"`;
  const encoded = encodeURIComponent(query);
  const [search, recent] = await Promise.all([
    c.api('GET', `/search/issues?q=${encoded}&per_page=100`),
    c.api('GET', `${c.root}/issues?state=open&sort=updated&direction=desc&per_page=100`),
  ]);
  assert.ok(search?.incomplete_results === false && Array.isArray(search.items) && Number.isSafeInteger(search.total_count),
    'INCOMPLETE_DEEP_REPAIR_FINALIZATION_SEARCH');
  assert.ok(Array.isArray(recent), 'INVALID_DEEP_REPAIR_FINALIZATION_RECENT_ISSUES');

  let searched = search.items;
  if (search.total_count > search.items.length) {
    searched = await c.pages(`/search/issues?q=${encoded}&per_page=100`, 'items', { maxPages: 10 });
    assert.ok(Array.isArray(searched) && searched.length >= search.total_count,
      'INCOMPLETE_DEEP_REPAIR_FINALIZATION_PAGINATION');
  }

  const numbers = new Set();
  for (const issue of [...searched, ...recent]) {
    if (issueMatchesMergedPr(issue, mergedByPr)) numbers.add(Number(issue.number));
  }
  return Promise.all([...numbers].map(number => {
    assert.ok(Number.isSafeInteger(number) && number > 0, 'INVALID_DEEP_REPAIR_FINALIZATION_ISSUE_NUMBER');
    return c.api('GET', `${c.root}/issues/${number}`);
  }));
}

export async function finalizeMergedDeepRepairs(c, {
  repository,
  merges,
  completedAt = new Date().toISOString(),
} = {}) {
  assert.match(repository || '', /^[\w.-]+\/[\w.-]+$/, 'DEEP_REPAIR_FINALIZATION_REPOSITORY_REQUIRED');
  const mergedByPr = normalizeMerges(merges);
  const result = { finalized: [], skipped: [], errors: [] };
  if (!mergedByPr.size) return result;

  const issues = await discoverOpenDeepRepairIssues(c, repository, mergedByPr);
  for (const issue of issues) {
    try {
      if (!issueMatchesMergedPr(issue, mergedByPr)) continue;
      const state = parseDeepRepairIssue(issue.body);
      const merged = mergedByPr.get(Number(state.pr));
      if (!FINALIZABLE_STATES.has(state.state)) {
        result.skipped.push({ issue: issue.number, pr: state.pr, state: state.state });
        continue;
      }

      const finalState = {
        ...state,
        state: 'completed',
        repairHead: merged.head,
        mergeCommit: merged.merge,
        completedAt: state.completedAt || completedAt,
      };
      const receipt = `<!-- integration-verified:${merged.merge} -->`;
      let body = replaceMarker(issue.body, finalState);
      if (!body.includes(receipt)) {
        body += `\n\n${receipt}\nIntegration verified: PR #${merged.pr} merged into develop as \`${merged.merge}\` with final head \`${merged.head}\`. Deep Repair source repair is complete; browser and DEV delivery remain separate results.\n`;
      }

      await c.api('PATCH', `${c.root}/issues/${issue.number}`, {
        body,
        state: 'closed',
        state_reason: 'completed',
      });

      let statusUpdated = true;
      try {
        await c.api('POST', `${c.root}/statuses/${state.head}`, {
          state: 'success',
          context: DEEP_REPAIR_CONTEXT,
          description: `Deep Repair completed by merged PR #${merged.pr}`,
          target_url: issue.html_url,
        });
      } catch (error) {
        statusUpdated = false;
        result.errors.push({ issue: issue.number, pr: state.pr, stage: 'status', error: error.message });
      }
      result.finalized.push({ issue: issue.number, pr: state.pr, sourceHead: state.head,
        repairHead: merged.head, mergeCommit: merged.merge, statusUpdated });
    } catch (error) {
      result.errors.push({ issue: issue?.number || null, stage: 'issue', error: error.message });
    }
  }
  return result;
}

export async function main() {
  const repository = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  const reportPath = process.argv[2] || '.deploy-state/integration.json';
  assert.match(repository || '', /^[\w.-]+\/[\w.-]+$/);
  assert.ok(token, 'GH_TOKEN is required');
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const { client } = await import('./integration.mjs');
  const c = client(repository, token, fetch, {
    diagnosticsPath: process.env.INTEGRATION_DIAGNOSTICS_PATH || '.deploy-state/integration-finalization-api.json',
  });
  const result = await finalizeMergedDeepRepairs(c, { repository, merges: report.merged || [] });
  mkdirSync('.deploy-state', { recursive: true });
  writeFileSync('.deploy-state/deep-repair-finalization.json', JSON.stringify(result, null, 2));
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
