import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { explore, seededFaults } from './rrp-reconstruction/exploration.mjs';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const files = ['tests/reality-reconstruction.test.mjs', 'tests/reality-reconstruction-semantics.test.mjs'];
function tests(mutation = 'none') {
  const child = spawnSync(process.execPath, ['--test', ...files.map(file => resolve(app, file))], {
    encoding: 'utf8', env: { ...process.env, RRP_MUTATION: mutation }, timeout: 30000,
  });
  const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return { exit: child.status, error: child.error?.message ?? null,
    passed: Number(output.match(/# pass (\d+)/)?.[1] ?? 0), failed: Number(output.match(/# fail (\d+)/)?.[1] ?? 0),
    invariantFailure: output.includes('INVARIANT:'),
    failures: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]) };
}
function architectureBoundary() {
  const module = name => readFileSync(resolve(app, `scripts/rrp-reconstruction/${name}.mjs`), 'utf8');
  const imports = name => [...module(name).matchAll(/from ['"]([^'"]+)['"]/g)].map(match => match[1]);
  const replicaImports = imports('replica'), oracleImports = imports('oracle');
  const pass = replicaImports.every(path => ['./encoding.mjs', './semantics.mjs'].includes(path)) &&
    oracleImports.every(path => path === './encoding.mjs') && !module('replica').includes('globalThis');
  return { pass, replicaImports, oracleImports,
    scope: 'Structural dependency audit plus local-input behavioral test, not a full language information-flow proof.' };
}
const focused = tests();
const mutations = ['quorum', 'fence', 'dedupe', 'parent', 'recovery', 'generation'].map(mutation => {
  const result = tests(mutation);
  return { mutation, killed: result.exit !== 0 && result.failed > 0 && result.invariantFailure && !result.error, ...result };
});
const spaces = [explore(), explore({ seed: 'recovery', maxDepth: 6, maxStates: 1600 })];
const schedules = seededFaults();
const architecture = architectureBoundary();
const sourceFiles = [...readdirSync(resolve(app, 'scripts/rrp-reconstruction')).filter(file => file.endsWith('.mjs'))
  .map(file => `scripts/rrp-reconstruction/${file}`), 'scripts/reality-reconstruction-proof.mjs', ...files];
const sourceHashes = Object.fromEntries(sourceFiles.sort().map(file => [file, createHash('sha256').update(readFileSync(resolve(app, file))).digest('hex')]));
const report = {
  version: 'rrp-independent-evidence-v1', base: '97d6c5015f2241f97646c5aa1df386478c26d8ba',
  environment: { node: process.version, platform: process.platform, runner: 'dependency-free fetched-file workspace; no full checkout' },
  focused, mutations, spaces, schedules, architecture, sourceHashes,
  pass: focused.exit === 0 && mutations.every(row => row.killed) && spaces.every(row => row.passWithinExploredStates) && schedules.pass && architecture.pass,
  classification: 'B: bounded executable evidence. A conditional arguments are documented separately. No saturation or production-certification claim.',
  notExecuted: ['npm ci / context:plan / full-repository fast validation: no checkout and git DNS unavailable',
    'legacy reality-architecture-proof.mjs: not substituted for this independent runner',
    'Node 24 validation', 'browser synthetic/WebRTC/physical devices', 'unbounded composition proof',
    'live voting-membership reconfiguration: explicitly unsupported by this reference model'],
};
const output = process.argv[2];
if (output) writeFileSync(resolve(output), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, focused, mutations: mutations.map(({ mutation, killed, failed }) => ({ mutation, killed, failed })),
  spaces: spaces.map(({ seed, states, transitions, completedDepth, cutoff, passWithinExploredStates }) => ({ seed, states, transitions, completedDepth, cutoff, passWithinExploredStates })),
  schedules, architecture, evidence: output ? relative(process.cwd(), resolve(output)) : null }, null, 2));
if (!report.pass) process.exitCode = 1;
