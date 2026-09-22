#!/usr/bin/env node
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { REPOSITORY, GAMES, json, loadContext, appendRecord, appendReceipt, checkHistoryChanges, evaluateMergeGate, historyForProblem } from './lib/contract.mjs';
import { captureProbe, compareReports } from './lib/probes.mjs';
import { discoverActiveExperiments } from './lib/validation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
function parse(args) {
  const positionals = [], flags = {};
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith('--')) { positionals.push(args[i]); continue; }
    const key = args[i].slice(2);
    if (!['base', 'head', 'ref', 'seeds', 'out', 'snapshot', 'pr', 'offset'].includes(key) || Object.hasOwn(flags, key) || !args[i + 1] || args[i + 1].startsWith('--')) throw Error(`Invalid option: ${args[i]}`);
    flags[key] = args[++i];
  }
  return { positionals, flags };
}
async function github(path) {
  const response = await fetch(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
    headers: { Accept: 'application/vnd.github+json', ...(process.env.GH_TOKEN ? { Authorization: `Bearer ${process.env.GH_TOKEN}` } : {}) },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw Error(`GitHub read failed (${response.status}): ${path}; use current Connector JSON with --snapshot, never invent a passing status.`);
  return response.json();
}
async function liveGate(flags) {
  if (!/^[1-9][0-9]*$/.test(flags.pr || '') || !/^[0-9a-f]{40}$/.test(flags.head || '') || !/^[0-9a-f]{40}$/.test(flags.base || '')) throw Error('gate requires --pr <number> --head <exact SHA> --base <exact develop SHA>');
  const fetchedAt = new Date().toISOString();
  const pr = await github(`pulls/${flags.pr}`);
  const statusResponse = await github(`commits/${flags.head}/status`);
  const focused = statusResponse.statuses.find(s => s.context === 'astra/focused-validation');
  const runId = focused?.target_url?.match(new RegExp(`^https://github\\.com/${REPOSITORY}/actions/runs/([0-9]+)$`))?.[1];
  if (!runId) throw Error('No merge-owning validation run found');
  const run = await github(`actions/runs/${runId}`);
  const reviews = await github(`pulls/${flags.pr}/reviews?per_page=100`);
  if (reviews.length >= 100 || statusResponse.total_count > statusResponse.statuses.length) throw Error('Complete paginated reviews/statuses with Connector; a partial read cannot authorize merge');
  const dependencyIds = [...(pr.body || '').matchAll(/depends on\s*:?\s*#([0-9]+)/gi)].map(m => m[1]);
  if (dependencyIds.length > 10) throw Error('Resolve blocking dependencies through Connector');
  const blockingDependencies = [];
  for (const id of dependencyIds) if (!(await github(`pulls/${id}`)).merged) blockingDependencies.push(Number(id));
  const comparison = await github(`compare/${flags.base}...${flags.head}`);
  // Re-read mutable coordinates last; any changed head invalidates the earlier evidence.
  const latestPr = await github(`pulls/${flags.pr}`), develop = await github('branches/develop');
  if (latestPr.updated_at !== pr.updated_at) throw Error('PR changed during read; obtain a new snapshot');
  return { fetchedAt, expected: { headSha: flags.head, developSha: flags.base }, pr: latestPr, develop, comparison, run, statusResponse, reviews, blockingDependencies };
}
async function main() {
  const { positionals: [command, first, second], flags } = parse(process.argv.slice(2));
  let result;
  if (command === 'context') result = loadContext(root, first);
  else if (command === 'lookup') {
    if (!second) throw Error('lookup requires game and exact problemKey');
    const offset = Number(flags.offset || 0);
    if (!Number.isSafeInteger(offset) || offset < 0) throw Error('invalid history offset');
    const matches = historyForProblem(root, first, second);
    result = { total: matches.length, nextOffset: offset + 8 < matches.length ? offset + 8 : null, entries: matches.slice(offset, offset + 8) };
  }
  else if (command === 'active') result = { active: discoverActiveExperiments(root,{baseRef:flags.base,headRef:flags.head||'HEAD'}) };
  else if (command === 'check') {
    result = { games: Object.keys(GAMES).map(game => loadContext(root, game).game), history: flags.base ? checkHistoryChanges(root, flags.base, flags.head || 'HEAD') : 'structure-only', status: 'passed' };
  } else if (command === 'probe') result = await captureProbe(root, first, { ref: flags.ref || 'HEAD', seeds: flags.seeds ? flags.seeds.split(',').map(Number) : undefined });
  else if (command === 'compare') {
    if (!first || !second) throw Error('compare requires before.json and after.json');
    result = compareReports(json(resolve(first)), json(resolve(second)));
  } else if (command === 'record') {
    if (!first) throw Error('record requires an experiment JSON file');
    result = appendRecord(root, json(resolve(first)));
  } else if (command === 'receipt') {
    if (!first) throw Error('receipt requires a receipt JSON file');
    result = appendReceipt(root, json(resolve(first)));
  } else if (command === 'gate') {
    const snapshot = flags.snapshot ? json(resolve(flags.snapshot)) : await liveGate(flags);
    result = evaluateMergeGate(snapshot);
    if (!result.eligible) process.exitCode = 2;
  } else throw Error('Usage: node .autonomous/cli.mjs context <village|kuumetsu|rinne> | lookup <game> <problemKey> [--offset N] | active --base <ref> [--head <ref>] | check [--base <ref>] | probe <game> [--ref <ref>] [--seeds 11,30,49] [--out file] | compare before.json after.json | record experiment.json | receipt receipt.json | gate --pr N --head SHA --base SHA [--snapshot live.json]');
  const output = JSON.stringify(result, null, 2) + '\n';
  if (flags.out) { const path = resolve(flags.out); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, output); }
  else process.stdout.write(output);
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
