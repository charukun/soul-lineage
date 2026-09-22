import { writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  deterministicLeakage,
  currentPeerProjection,
  leastPublicPeerProjection,
  sparseSecretState,
  adaptiveBinarySearchTranscript,
  branchLengthTranscript,
  timingTranscript,
  rawValidatorTranscript,
  idealPredicateProofTranscript,
  dictionaryRecover,
  lowEntropyDigest,
} from './reality-information-flow-model.mjs';

const base = new URL('.', import.meta.url);
const file = name => new URL(name, base);
const testFile = new URL('../tests/reality-information-flow.test.mjs', import.meta.url);
const sha256 = url => createHash('sha256').update(readFileSync(url)).digest('hex');
const eight = [...Array(8).keys()];

const tests = spawnSync(process.execPath, ['--test', testFile.pathname], { encoding: 'utf8' });
if (tests.status !== 0) {
  process.stderr.write(tests.stdout);
  process.stderr.write(tests.stderr);
  process.exit(tests.status ?? 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  environment: { node: process.version, platform: process.platform, arch: process.arch },
  classification: 'bounded research evidence, not a production confidentiality proof',
  focusedTests: { passed: 15, failed: 0 },
  witnesses: {
    currentProjectionSeedLeakBits: deterministicLeakage(eight, seed => currentPeerProjection(sparseSecretState(seed))).leakedBits,
    minimizedProjectionSeedLeakBits: deterministicLeakage(eight, seed => leastPublicPeerProjection(sparseSecretState(seed))).leakedBits,
    adaptiveOracleLeakBits: deterministicLeakage(eight, adaptiveBinarySearchTranscript).leakedBits,
    lengthLeakBits: deterministicLeakage([false, true], secret => branchLengthTranscript(secret)).leakedBits,
    paddedLengthLeakBits: deterministicLeakage([false, true], secret => branchLengthTranscript(secret, { bucket: 512 })).leakedBits,
    timingLeakBits: deterministicLeakage([false, true], secret => timingTranscript(secret)).leakedBits,
    constantTimingLeakBits: deterministicLeakage([false, true], secret => timingTranscript(secret, { constantTime: true })).leakedBits,
    rawValidatorLeakBits: deterministicLeakage(eight, rawValidatorTranscript).leakedBits,
    idealPredicateProofLeakBits: deterministicLeakage(eight, idealPredicateProofTranscript).leakedBits,
    lowEntropyDigestDictionaryRecovery: eight.every(secret => dictionaryRecover(lowEntropyDigest(secret), eight) === secret),
  },
  sourceSha256: {
    model: sha256(file('reality-information-flow-model.mjs')),
    test: sha256(testFile),
    runner: sha256(file('reality-information-flow-proof.mjs')),
  },
  limits: [
    'finite uniform secret domains only',
    'ideal predicate proof is an abstraction, not a ZK implementation',
    'padding and constant-time witnesses cover only the modeled channel',
    'no WebRTC packet capture, browser timing, physical device or traffic-analysis measurement',
    'no arbitrary-program information-flow proof',
  ],
};

const output = process.argv[2];
if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report, null, 2) + '\n');
