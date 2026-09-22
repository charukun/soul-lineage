import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { semanticEvidence } from './rrp-evolution/examples.mjs';
import { explore, crashCuts } from './rrp-evolution/exploration.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testFile = 'tests/reality-semantic-evolution.test.mjs';
const modelFiles = readdirSync(resolve(app, 'scripts/rrp-evolution')).filter(x => x.endsWith('.mjs'))
  .map(name => `scripts/rrp-evolution/${name}`);
const files = [...modelFiles, 'scripts/reality-semantic-evolution-proof.mjs', testFile].sort();
const mutations = {
  'missing-row': 'cutover waits for every materialized row',
  'skip-catchup': 'copy completion is not tail completion',
  'late-copy': 'a delayed duplicate base-copy',
  'duplicate-delta': 'a duplicate delta callback',
  'forget-receipts': 'operation identity survives schema change',
  units: 'new-unit writes are decoded once',
  'old-writer': 'a queued old writer after the cut',
  'reinterpret-history': 'original record is judged by original rules',
  'unchecked-range': 'a valid source integer need not fit',
};
function tests(mutation = 'none') {
  const child = spawnSync(process.execPath, ['--test', resolve(app, testFile)], {
    encoding: 'utf8', timeout: 30000, env: { ...process.env, RRP_EVOLUTION_MUTATION: mutation },
  });
  const text = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return { exit: child.status, error: child.error?.message ?? null,
    passed: Number(text.match(/# pass (\d+)/)?.[1] ?? 0), failed: Number(text.match(/# fail (\d+)/)?.[1] ?? 0),
    invariantFailure: text.includes('INVARIANT:'),
    failures: [...text.matchAll(/^not ok \d+ - (.+)$/gm)].map(x => x[1]) };
}
const focused = tests();
const negativeControls = Object.entries(mutations).map(([name, expectedTest]) => {
  const result = tests(name);
  return { mutation: name, ...result, killed: result.exit !== 0 && result.failed > 0 && !result.error &&
    result.invariantFailure && result.failures.some(test => test.startsWith(expectedTest)) };
});
const syntax = files.map(file => {
  const child = spawnSync(process.execPath, ['--check', resolve(app, file)], { encoding: 'utf8', timeout: 10000 });
  return { file, pass: child.status === 0, error: child.error?.message ?? (child.stderr.trim() || null) };
});
const imports = file => [...readFileSync(resolve(app, file), 'utf8').matchAll(/from ['"]([^'"]+)['"]/g)].map(x => x[1]);
const ownerImports = imports('scripts/rrp-evolution/cutover.mjs');
const oracleImports = imports('scripts/rrp-evolution/oracle.mjs');
const architecture = { pass: ownerImports.every(x => x === './finite.mjs') && oracleImports.length === 0,
  ownerImports, oracleImports,
  scope: 'Structural module dependency inspection plus pure local-input test; not a formal information-flow proof or original full-repository architecture runner.' };
const spaces = [explore(), explore({ seed: 'snapshot-plus-tail' })];
const crashPositions = crashCuts();
const algebra = semanticEvidence();
const report = {
  format: 'rrp-semantic-evolution-evidence-v1',
  startDevelop: 'd293f9a0f3fa00bd58c025457bfd03e32a7a9994',
  classification: 'B: executable finite evidence; conditional A arguments are in THEORY_SEMANTIC_EVOLUTION.md',
  environment: { node: process.version, platform: process.platform, arch: process.arch,
    workspace: 'isolated repository-like authoring workspace; no full checkout' },
  focused, negativeControls, syntax, architecture, algebra, spaces, crashPositions,
  sourceHashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(readFileSync(resolve(app, file))).digest('hex')])),
  notExecuted: ['context:plan / npm ci / repository-wide gates: no checkout; normal git failed GitHub DNS',
    'Node 24 validation', 'original reality-architecture-proof.mjs', 'browser/WebRTC/device tests',
    'runtime game migration or production schema change', 'unbounded refinement or liveness proof'],
};
report.pass = focused.exit === 0 && focused.passed >= 30 && negativeControls.every(x => x.killed) &&
  syntax.every(x => x.pass) && architecture.pass && algebra.forward.pass && !algebra.backward.pass &&
  !algebra.lossyMerge.pass && algebra.preservingMerge.pass && !algebra.retentionAfterNewRule.pass &&
  spaces.every(x => x.passWithinExploredStates) && crashPositions.pass;
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, focused, mutations: negativeControls.map(({ mutation, killed, failed }) => ({ mutation, killed, failed })),
  spaces: spaces.map(({ seed, states, transitions, completedDepth, cutoff, activatedStates, passWithinExploredStates }) =>
    ({ seed, states, transitions, completedDepth, cutoff, activatedStates, passWithinExploredStates })),
  crashPositions, syntaxPass: syntax.every(x => x.pass), architecture }, null, 2));
if (!report.pass) process.exitCode = 1;
