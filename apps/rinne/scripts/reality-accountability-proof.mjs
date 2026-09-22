import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { enumerateOneRoundGossipGraphs, forkHistories, hostKeySplitCounterexample, classifyGuarantees } from './reality-accountability-model.mjs';

const scripts = dirname(fileURLToPath(import.meta.url));
const app = resolve(scripts, '..');
const testFile = resolve(app, 'tests/reality-accountability.test.mjs');
const sources = [
  'scripts/reality-accountability-model.mjs',
  'scripts/reality-accountability-proof.mjs',
  'tests/reality-accountability.test.mjs',
];
const child = spawnSync(process.execPath, ['--test', testFile], { encoding: 'utf8', timeout: 30000 });
const output = `${child.stdout ?? ''}\n${child.stderr ?? ''}`;
const focused = {
  exit: child.status,
  passed: Number(output.match(/# pass (\d+)/)?.[1] ?? 0),
  failed: Number(output.match(/# fail (\d+)/)?.[1] ?? 0),
  tests: Number(output.match(/# tests (\d+)/)?.[1] ?? 0),
  failures: [...output.matchAll(/^not ok \d+ - (.+)$/gm)].map(match => match[1]),
};
const syntax = Object.fromEntries(sources.map(file => {
  const row = spawnSync(process.execPath, ['--check', resolve(app, file)], { encoding: 'utf8', timeout: 10000 });
  return [file, { pass: row.status === 0, error: (row.stderr || '').trim() }];
}));
const { left, right } = forkHistories();
const graphEnumeration = enumerateOneRoundGossipGraphs({ a:left, b:left, c:right, d:right });
const keySplit = hostKeySplitCounterexample();
const sourceHashes = Object.fromEntries(sources.map(file => [file, createHash('sha256').update(readFileSync(resolve(app, file))).digest('hex')]));
const report = {
  version: 'rrp-accountability-hyperproperty-v1',
  baseDevelopAtStart: 'ccae8251e7b9c687f8e4a8cef375af465ed63124',
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  classification: 'B bounded executable evidence plus separately documented A/delegated arguments',
  focused,
  syntax,
  graphEnumeration,
  keySplit: { locallyValid: keySplit.locallyValid, crossKeyEquivocationProof: keySplit.crossKeyEquivocationProof },
  guaranteeClasses: classifyGuarantees(),
  sourceHashes,
  pass: focused.exit === 0 && focused.failed === 0 && focused.passed === 15 && Object.values(syntax).every(row => row.pass) &&
    graphEnumeration.graphs === 64 && graphEnumeration.detect === 60 && graphEnumeration.silent === 4 && keySplit.crossKeyEquivocationProof === null,
  limits: [
    'Fixed toy Ed25519 identities; no production PKI, key rotation or hardware attestation.',
    'Four-client one-round graph enumeration is exhaustive only for that bounded topology.',
    'Hash-chain checkpoints model append-only accountability but are not RFC 9162 Certificate Transparency.',
    'No Byzantine consensus, gameplay validity proof, WebRTC benchmark or browser persistence guarantee is implemented.',
    'Eventual fork detection assumes retained evidence plus eventual cross-fork communication to an honest comparator.',
  ],
};
const target = process.argv[2];
if (target) writeFileSync(resolve(target), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
