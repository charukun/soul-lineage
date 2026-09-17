import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const testFile = resolve(here, 'reality-obligation-compiler.test.mjs');
const modelFile = resolve(here, 'reality-obligation-compiler-model.mjs');
function run(mutation = 'none') {
  const child = spawnSync(process.execPath, ['--test', testFile], {
    encoding: 'utf8', env: { ...process.env, RRP_MUTATION: mutation }, timeout: 30000,
  });
  const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
  return {
    mutation, exit: child.status, error: child.error?.message ?? null,
    passed: Number(output.match(/# pass (\d+)/)?.[1] ?? 0),
    failed: Number(output.match(/# fail (\d+)/)?.[1] ?? 0),
    invariantFailure: output.includes('INVARIANT:'),
    failures: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]),
  };
}
const focused = run();
const mutations = ['silence-is-absence','bearer-is-linear','ignore-revocation','local-commit-is-global','ignore-prepared-version','ignore-rule-root','signed-is-complete']
  .map(mutation => { const result = run(mutation); return { ...result, killed: result.exit !== 0 && result.failed > 0 && result.invariantFailure }; });
const files = [modelFile, testFile, fileURLToPath(import.meta.url)];
const sourceHashes = Object.fromEntries(files.map(file => [basename(file), createHash('sha256').update(readFileSync(file)).digest('hex')]));
const report = {
  version: 'rrp-obligation-compiler-evidence-v1',
  environment: { node: process.version, platform: process.platform, runner: 'dependency-free isolated research model' },
  focused, mutations, sourceHashes,
  pass: focused.exit === 0 && focused.failed === 0 && mutations.every(row => row.killed),
  classification: 'B bounded executable counterexamples and mutation sensitivity; A/F arguments are documented separately.',
  notClaims: ['not a production authorization system','not a cross-domain transaction implementation','not a cryptographic proof of manifest completeness','not an unbounded model check','not a performance benchmark'],
};
if (process.argv[2]) writeFileSync(resolve(process.argv[2]), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ pass: report.pass, focused, mutations: mutations.map(({ mutation, killed, failed, failures }) => ({ mutation, killed, failed, failures })), sourceHashes }, null, 2));
if (!report.pass) process.exitCode = 1;
