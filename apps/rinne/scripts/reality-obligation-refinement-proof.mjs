import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { mutationNames, runMutation } from './reality-obligation-refinement-model.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(here, '..');
const modelPath = path.join(here, 'reality-obligation-refinement-model.mjs');
const testPath = path.join(appRoot, 'tests', 'reality-obligation-refinement.test.mjs');
const proofPath = fileURLToPath(import.meta.url);
const outputPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.join(appRoot, 'docs', 'evidence', 'RRP_OBLIGATION_REFINEMENT_20260917.json');

function hash(content) {
  return createHash('sha256').update(content).digest('hex');
}

const testRun = spawnSync(process.execPath, ['--test', testPath], { encoding: 'utf8' });
if (testRun.status !== 0) {
  process.stderr.write(testRun.stdout ?? '');
  process.stderr.write(testRun.stderr ?? '');
  process.exit(testRun.status ?? 1);
}

const mutations = Object.fromEntries(mutationNames.map((name) => [name, runMutation(name)]));
if (Object.values(mutations).some((killed) => !killed)) {
  throw new Error('one or more mutation witnesses did not reproduce');
}

const files = {};
for (const [label, filePath] of Object.entries({ model: modelPath, test: testPath, proof: proofPath })) {
  const content = await readFile(filePath, 'utf8');
  files[label] = { path: path.relative(appRoot, filePath).replaceAll('\\', '/'), sha256: hash(content) };
}

const passedMatch = testRun.stdout.match(/# pass (\d+)/);
const failedMatch = testRun.stdout.match(/# fail (\d+)/);
const evidence = {
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  classification: 'B-bounded-executable-evidence',
  focusedTests: {
    passed: passedMatch ? Number(passedMatch[1]) : null,
    failed: failedMatch ? Number(failedMatch[1]) : null,
  },
  mutations,
  files,
  boundaries: [
    'Finite deterministic witnesses only; not unbounded model checking.',
    'The halting-reduction argument is documented theory, not established by this executable suite.',
    'Translation validation is exhaustive only over the bounded worlds supplied to the toy validator.',
    'Evidence authenticity, sink exclusivity, policy completeness, clocks, network failure and production cryptography remain outside this toy model.',
  ],
};

await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
