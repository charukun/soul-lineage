import { createHash } from 'node:crypto';

export const log2 = value => Math.log(value) / Math.log(2);

export function shannonEntropy(probabilities) {
  return probabilities.reduce((sum, p) => p > 0 ? sum - p * log2(p) : sum, 0);
}

export function deterministicLeakage(secretDomain, observe) {
  if (!Array.isArray(secretDomain) || secretDomain.length === 0) throw new Error('secret domain required');
  const buckets = new Map();
  for (const secret of secretDomain) {
    const transcript = JSON.stringify(observe(secret));
    const bucket = buckets.get(transcript) || [];
    bucket.push(secret);
    buckets.set(transcript, bucket);
  }
  const priorEntropy = log2(secretDomain.length);
  let posteriorEntropy = 0;
  for (const bucket of buckets.values()) {
    const p = bucket.length / secretDomain.length;
    posteriorEntropy += p * log2(bucket.length);
  }
  return {
    priorEntropy,
    posteriorEntropy,
    leakedBits: priorEntropy - posteriorEntropy,
    transcriptClasses: buckets.size,
    buckets: [...buckets.entries()].map(([transcript, secrets]) => ({ transcript, secrets })),
  };
}

export function currentPeerProjection(state) {
  return {
    id: state.id,
    name: state.name,
    seed: state.seed,
    birthVillageId: state.birthVillageId,
    ageYears: state.ageYears,
    zone: state.zone,
    position: state.position,
    equipment: state.equipment,
  };
}

export function leastPublicPeerProjection(state) {
  return {
    id: state.id,
    name: state.name,
    ageYears: state.ageYears,
    zone: state.zone,
    position: state.position,
    equipment: state.equipment,
  };
}

export function sparseSecretState(secret, overrides = {}) {
  return {
    id: 'p:1',
    name: '旅人',
    seed: secret,
    birthVillageId: 'village-a',
    ageYears: 20,
    zone: 'village',
    position: { x: 1, z: 2 },
    equipment: { weapon: 'sword', armor: 'light', shield: false },
    ...overrides,
  };
}

export function acceptRejectOracle(secret, guess) {
  return secret === guess ? 'accepted' : 'rejected';
}

export function adaptiveBinarySearchTranscript(secret, low = 0, high = 7) {
  const transcript = [];
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    const answer = secret <= mid;
    transcript.push({ mid, answer });
    if (answer) high = mid;
    else low = mid + 1;
  }
  return transcript;
}

export function lowEntropyDigest(secret) {
  return createHash('sha256').update(String(secret)).digest('hex');
}

export function dictionaryRecover(digest, candidateDomain) {
  const matches = candidateDomain.filter(candidate => lowEntropyDigest(candidate) === digest);
  return matches.length === 1 ? matches[0] : null;
}

export function lengthTranscript(secret, { base = 80, perSecretByte = 11, bucket = 0 } = {}) {
  const raw = base + String(secret).length * perSecretByte;
  const visibleLength = bucket > 0 ? Math.ceil(raw / bucket) * bucket : raw;
  return { visibleLength };
}

export function branchLengthTranscript(secret, { small = 120, large = 260, bucket = 0 } = {}) {
  const raw = secret ? large : small;
  return { visibleLength: bucket > 0 ? Math.ceil(raw / bucket) * bucket : raw };
}

export function timingTranscript(secret, { constantTime = false } = {}) {
  return { responseTick: constantTime ? 10 : (secret ? 10 : 4) };
}

export function permittedPredicate(secret) {
  return secret >= 4;
}

export function idealPredicateProofTranscript(secret) {
  return { statement: 'secret>=4', verdict: permittedPredicate(secret), proofClass: 'ideal-zk-abstraction' };
}

export function rawValidatorTranscript(secret) {
  return { witness: secret, statement: 'secret>=4', verdict: permittedPredicate(secret) };
}

export function disclosureCount({ replicas, receivesPlaintext = true, trustedAuthority = false }) {
  if (!Number.isInteger(replicas) || replicas < 1) throw new Error('replicas must be positive integer');
  if (trustedAuthority) return 1;
  return receivesPlaintext ? replicas : 0;
}

export function canPlainVerifierDecideFromTranscript(secretDomain, transcriptOf, predicate = permittedPredicate) {
  const decisions = new Map();
  for (const secret of secretDomain) {
    const key = JSON.stringify(transcriptOf(secret));
    const expected = predicate(secret);
    if (decisions.has(key) && decisions.get(key) !== expected) return false;
    decisions.set(key, expected);
  }
  return true;
}

export function intransitiveRelease(secret) {
  // Host sees witness; validator is permitted to derive only the verdict; guest sees only verdict.
  const validator = { witness: secret, verdict: permittedPredicate(secret) };
  const guest = { verdict: validator.verdict };
  return { host: { witness: secret }, validator, guest };
}

export function directTransitiveLeak(secret) {
  // A naive pipeline forwards the validator's full object to the guest.
  const validator = { witness: secret, verdict: permittedPredicate(secret) };
  return { guest: { ...validator } };
}

export function composeObservations(secret, observers) {
  return observers.map(observe => observe(secret));
}
