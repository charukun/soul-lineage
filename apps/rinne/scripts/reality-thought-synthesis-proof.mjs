import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const testFile = resolve(here, '../tests/reality-thought-synthesis.test.mjs');
const modelFile = resolve(here, 'reality-thought-synthesis-model.mjs');
function run(mutation = 'none') {
  const child = spawnSync(process.execPath, ['--test', testFile], {
    encoding: 'utf8', timeout: 15000, env: { ...process.env, RRP_THOUGHT_MUTATION: mutation },
  });
  const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return { mutation, exit: child.status, error: child.error?.message ?? null,
    pass: Number(output.match(/# pass (\d+)/)?.[1] ?? 0), fail: Number(output.match(/# fail (\d+)/)?.[1] ?? 0),
    invariantFailure: output.includes('INVARIANT:'),
    failures: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]) };
}
const focused = run();
const mutationNames = ['existential-knowledge', 'duplicate-transfer', 'pairwise-as-global', 'ignore-rely', 'trust-underapprox'];
const mutations = mutationNames.map(name => {
  const row = run(name);
  return { ...row, killed: row.exit !== 0 && row.fail > 0 && row.invariantFailure && !row.error };
});
const sourceHashes = Object.fromEntries([modelFile, testFile, fileURLToPath(import.meta.url)].map(file => [basename(file),
  createHash('sha256').update(readFileSync(file)).digest('hex')]));
const result = {
  version: 'rrp-thought-synthesis-evidence-v1',
  base: '4a3a328e143f92e5c5f297d6d6bac453e4627f36',
  environment: { node: process.version, platform: process.platform, runner: 'dependency-free isolated research model' },
  focused: { exit: focused.exit, error: focused.error, pass: focused.pass, fail: focused.fail },
  mutations: mutations.map(({ mutation, killed, pass, fail, failures }) => ({ mutation, killed, pass, fail, failures })),
  boundedModels: {
    epistemicWorlds: 3,
    minimalDecisionEvidenceWorlds: 16,
    evolvedDecisionEvidenceWorlds: 32,
    relationTriangleTuples: 6,
    quotaSpendCasesExample: 9,
    note: 'Fixed finite counterexamples and enumerations only; no unbounded state-space or composition theorem is claimed.'
  },
  sourceHashes,
  classification: 'B: bounded executable evidence. Known epistemic/abstract-interpretation/compositionality/escrow results are delegated A only under their published premises. Runtime benefit remains E/F.',
  notExecuted: ['full repository checkout/context:plan/npm ci/fast validation', 'browser or WebRTC/device measurements',
    'machine-checked refinement to the Rinne runtime', 'unbounded epistemic or compositional state-space'],
};
result.pass = focused.exit === 0 && mutations.every(row => row.killed);
const outputPath = process.argv[2];
if (outputPath) writeFileSync(resolve(outputPath), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify(result, null, 2));
if (!result.pass) process.exitCode = 1;
