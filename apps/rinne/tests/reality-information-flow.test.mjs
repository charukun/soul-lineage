import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deterministicLeakage,
  currentPeerProjection,
  leastPublicPeerProjection,
  sparseSecretState,
  acceptRejectOracle,
  adaptiveBinarySearchTranscript,
  lowEntropyDigest,
  dictionaryRecover,
  branchLengthTranscript,
  timingTranscript,
  idealPredicateProofTranscript,
  rawValidatorTranscript,
  disclosureCount,
  canPlainVerifierDecideFromTranscript,
  permittedPredicate,
  intransitiveRelease,
  directTransitiveLeak,
  composeObservations,
} from '../scripts/reality-information-flow-model.mjs';

const eight = [...Array(8).keys()];

test('current-style peer projection leaks all low-entropy seed bits while public-minimized projection leaks none', () => {
  const current = deterministicLeakage(eight, seed => currentPeerProjection(sparseSecretState(seed)));
  const minimized = deterministicLeakage(eight, seed => leastPublicPeerProjection(sparseSecretState(seed)));
  assert.equal(current.leakedBits, 3);
  assert.equal(current.transcriptClasses, 8);
  assert.equal(minimized.leakedBits, 0);
  assert.equal(minimized.transcriptClasses, 1);
});

test('a one-shot accept/reject oracle leaks a secret predicate bit even when payload state is omitted', () => {
  const result = deterministicLeakage([false, true], secret => acceptRejectOracle(secret, true));
  assert.equal(result.leakedBits, 1);
  assert.equal(result.transcriptClasses, 2);
});

test('adaptive yes/no queries compose to recover a 3-bit secret', () => {
  const result = deterministicLeakage(eight, adaptiveBinarySearchTranscript);
  assert.equal(result.leakedBits, 3);
  assert.equal(result.transcriptClasses, 8);
  assert.ok(result.buckets.every(bucket => bucket.secrets.length === 1));
});

test('low-entropy SHA-256 commitment is dictionary-recoverable and is not confidentiality', () => {
  for (const secret of eight) assert.equal(dictionaryRecover(lowEntropyDigest(secret), eight), secret);
});

test('message length can leak a branch bit and a sufficiently coarse fixed bucket can hide this bounded witness', () => {
  const raw = deterministicLeakage([false, true], secret => branchLengthTranscript(secret));
  const padded = deterministicLeakage([false, true], secret => branchLengthTranscript(secret, { bucket: 512 }));
  assert.equal(raw.leakedBits, 1);
  assert.equal(padded.leakedBits, 0);
});

test('response timing can leak a branch bit even when lengths are hidden', () => {
  const variable = deterministicLeakage([false, true], secret => timingTranscript(secret));
  const constant = deterministicLeakage([false, true], secret => timingTranscript(secret, { constantTime: true }));
  assert.equal(variable.leakedBits, 1);
  assert.equal(constant.leakedBits, 0);
});

test('plaintext semantic validation disclosure grows with replica count', () => {
  assert.equal(disclosureCount({ replicas: 1 }), 1);
  assert.equal(disclosureCount({ replicas: 3 }), 3);
  assert.equal(disclosureCount({ replicas: 4 }), 4);
  assert.equal(disclosureCount({ replicas: 4, trustedAuthority: true }), 1);
});

test('hash-only transcript cannot validate a secret-dependent predicate when two validity classes share a transcript', () => {
  const hiddenTranscript = () => ({ commitmentClass: 'opaque' });
  assert.equal(canPlainVerifierDecideFromTranscript(eight, hiddenTranscript, permittedPredicate), false);
});

test('raw witness permits validation but discloses the entire 3-bit witness', () => {
  assert.equal(canPlainVerifierDecideFromTranscript(eight, rawValidatorTranscript, permittedPredicate), true);
  const leakage = deterministicLeakage(eight, rawValidatorTranscript);
  assert.equal(leakage.leakedBits, 3);
});

test('ideal predicate-proof abstraction reveals only the authorized decision partition, not the witness inside each partition', () => {
  assert.equal(canPlainVerifierDecideFromTranscript(eight, idealPredicateProofTranscript, permittedPredicate), true);
  const leakage = deterministicLeakage(eight, idealPredicateProofTranscript);
  assert.equal(leakage.leakedBits, 1);
  assert.equal(leakage.transcriptClasses, 2);
  assert.deepEqual(leakage.buckets.map(row => row.secrets.length).sort(), [4, 4]);
});

test('authorized decision itself is unavoidable declassification when it differs across secrets', () => {
  const result = deterministicLeakage(eight, secret => ({ verdict: permittedPredicate(secret) }));
  assert.equal(result.leakedBits, 1);
});

test('intransitive release keeps raw witness from guest while naive transitive forwarding leaks it', () => {
  for (const secret of eight) {
    assert.equal('witness' in intransitiveRelease(secret).guest, false);
    assert.equal(directTransitiveLeak(secret).guest.witness, secret);
  }
});

test('composition must be analyzed over the full transcript rather than per-message labels', () => {
  const result = deterministicLeakage(eight, secret => composeObservations(secret, [
    s => ({ le4: s < 4 }),
    s => ({ le2mod4: (s % 4) < 2 }),
    s => ({ parity: s % 2 === 0 }),
  ]));
  assert.equal(result.transcriptClasses, 8);
  assert.equal(result.leakedBits, 3);
});

test('host-authoritative confidentiality from the host is impossible in a model where the host receives the secret witness', () => {
  const leakage = deterministicLeakage(eight, secret => ({ hostState: { secret } }));
  assert.equal(leakage.leakedBits, 3);
});

test('guest can have zero witness leakage within a fixed authorized verdict class', () => {
  const lowSecrets = [0, 1, 2, 3];
  const highSecrets = [4, 5, 6, 7];
  assert.equal(deterministicLeakage(lowSecrets, secret => intransitiveRelease(secret).guest).leakedBits, 0);
  assert.equal(deterministicLeakage(highSecrets, secret => intransitiveRelease(secret).guest).leakedBits, 0);
});
