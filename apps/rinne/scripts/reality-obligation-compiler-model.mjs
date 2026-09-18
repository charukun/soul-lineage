import { createHash, createHmac } from 'node:crypto';

const clone = value => structuredClone(value);
export const canonical = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('finite JSON with safe integers only');
};
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
const mac = (key, value) => createHmac('sha256', key).update(canonical(value)).digest('hex');
const subsets = fields => Array.from({ length: 1 << fields.length }, (_, mask) =>
  fields.filter((_, index) => mask & (1 << index))).sort((a,b) => a.length - b.length || canonical(a).localeCompare(canonical(b)));
const projection = (world, fields) => Object.fromEntries(fields.map(field => [field, world[field]]));

// A sufficient evidence field set must distinguish every safe world from every unsafe world.
export function minimumEvidenceFields(worlds, fields, predicate) {
  const safe = worlds.filter(predicate), unsafe = worlds.filter(world => !predicate(world));
  for (const chosen of subsets(fields)) {
    let ok = true;
    for (const left of safe) for (const right of unsafe) {
      if (canonical(projection(left, chosen)) === canonical(projection(right, chosen))) ok = false;
    }
    if (ok) return { fields: chosen, width: chosen.length, safe: safe.length, unsafe: unsafe.length };
  }
  return null;
}

// Reduction witness: one safe all-zero world plus one unsafe world per universe element.
// Field j differs on unsafe element u iff set_j contains u. Sufficient fields are exactly set covers.
export function setCoverAsEvidence(universe, sets) {
  const fields = sets.map((_, index) => `set:${index}`);
  const safe = Object.fromEntries(fields.map(field => [field, 0]));
  const worlds = [{ ...safe, label: true }];
  for (const element of universe) {
    const row = { label: false };
    sets.forEach((set, index) => { row[`set:${index}`] = set.includes(element) ? 1 : 0; });
    worlds.push(row);
  }
  const result = minimumEvidenceFields(worlds, fields, world => world.label === true);
  return { ...result, selectedSets: result?.fields.map(field => Number(field.split(':')[1])) ?? [] };
}

// Exact deterministic one-way equality: Alice's summary must be injective. Otherwise x != y collide,
// and Bob choosing x receives the same summary on EQ(x,x) and EQ(y,x).
export function oneWayEqualityLowerBound({ inputBits, summaryBits }) {
  if (!Number.isInteger(inputBits) || inputBits < 1 || !Number.isInteger(summaryBits) || summaryBits < 0) throw new Error('invalid bits');
  const inputs = 2 ** inputBits, summaries = 2 ** summaryBits;
  return {
    inputBits, summaryBits, inputs, summaries,
    exactPossible: summaries >= inputs,
    witness: summaries < inputs ? 'pigeonhole collision makes one equal and one unequal input indistinguishable to Bob' : null,
  };
}

export function negativeFactFromSilence({ receivedClaims = [], mutation = 'none' } = {}) {
  // Local history is identical whether no remote claimant exists or a claimant message is merely delayed.
  const compatibleWorlds = [
    { remoteClaimExists: false, receivedClaims: clone(receivedClaims) },
    { remoteClaimExists: true, receivedClaims: clone(receivedClaims) },
  ];
  const authorize = mutation === 'silence-is-absence' ? receivedClaims.length === 0 : false;
  return { authorize, compatibleWorlds, safe: !authorize || compatibleWorlds.every(world => !world.remoteClaimExists) };
}

export function createRegistryAuthority(secret = 'registry-test-secret') {
  let epoch = 1;
  let claims = [];
  const issueSnapshot = () => {
    const body = { epoch, claims: [...claims].sort() };
    return { body, signature: mac(secret, body) };
  };
  return {
    claim(id) { if (!claims.includes(id)) claims.push(id); epoch++; return issueSnapshot(); },
    release(id) { claims = claims.filter(row => row !== id); epoch++; return issueSnapshot(); },
    snapshot: issueSnapshot,
    verify(snapshot) { return snapshot?.signature === mac(secret, snapshot.body); },
  };
}
export function verifyAbsenceProof(snapshot, id, authority, currentEpoch) {
  return authority.verify(snapshot) && snapshot.body.epoch === currentEpoch && !snapshot.body.claims.includes(id);
}

// Tiny Macaroon-like attenuation model. This is not a production credential implementation.

export function staleAbsenceFreshnessCounterexample() {
  const authority = createRegistryAuthority();
  const old = authority.snapshot();
  const newer = authority.claim('unique:sword');
  // A node that has not received newer epoch information can still validate old as authentic/current-to-itself.
  const locallyAccepted = verifyAbsenceProof(old, 'unique:sword', authority, old.body.epoch);
  return { oldEpoch: old.body.epoch, newEpoch: newer.body.epoch, locallyAccepted, globallyAbsentNow: false,
    pass: locallyAccepted && newer.body.claims.includes('unique:sword') };
}

export function createCapabilityIssuer(rootKey = 'capability-test-root') {
  let epoch = 1;
  const issue = ({ id, resource, holder, nonce }) => {
    const root = { id, resource, holder, nonce, issuedEpoch: epoch };
    return { root, caveats: [], signature: mac(rootKey, root) };
  };
  const attenuate = (token, caveat) => ({
    root: clone(token.root), caveats: [...token.caveats, clone(caveat)],
    signature: mac(token.signature, caveat),
  });
  const verifyChain = token => {
    let signature = mac(rootKey, token.root);
    for (const caveat of token.caveats) signature = mac(signature, caveat);
    return signature === token.signature;
  };
  return {
    issue, attenuate, verifyChain,
    revokeAll() { epoch++; return epoch; },
    get epoch() { return epoch; },
  };
}

export function createCapabilitySink({ issuer, mutation = 'none' }) {
  const spent = new Set();
  let knownEpoch = issuer.epoch;
  return {
    learnEpoch(epoch) { knownEpoch = Math.max(knownEpoch, epoch); },
    consume(token, context = {}) {
      if (!issuer.verifyChain(token)) return { ok: false, reason: 'bad-chain' };
      if (mutation !== 'ignore-revocation' && token.root.issuedEpoch !== knownEpoch) return { ok: false, reason: 'revoked-generation' };
      for (const caveat of token.caveats) {
        if (caveat.kind === 'holder' && context.holder !== caveat.value) return { ok: false, reason: 'holder-caveat' };
        if (caveat.kind === 'resource' && token.root.resource !== caveat.value) return { ok: false, reason: 'resource-caveat' };
        if (caveat.kind === 'maxAmount' && Number(context.amount ?? 0) > caveat.value) return { ok: false, reason: 'amount-caveat' };
        if (!['holder','resource','maxAmount'].includes(caveat.kind)) return { ok: false, reason: 'unknown-caveat' };
      }
      if (mutation !== 'bearer-is-linear' && spent.has(token.root.nonce)) return { ok: false, reason: 'replay' };
      spent.add(token.root.nonce);
      return { ok: true, resource: token.root.resource, nonce: token.root.nonce };
    },
    snapshot() { return { knownEpoch, spent: [...spent].sort() }; },
  };
}

export function leaseDecision({ localClock, expiry, maxClockError = null }) {
  if (!Number.isFinite(localClock) || !Number.isFinite(expiry)) throw new Error('invalid clock');
  if (maxClockError === null) return { decision: 'unknown', reason: 'no bounded relation to authority time' };
  if (!Number.isFinite(maxClockError) || maxClockError < 0) throw new Error('invalid clock error');
  if (localClock + maxClockError < expiry) return { decision: 'definitely-valid' };
  if (localClock - maxClockError >= expiry) return { decision: 'definitely-expired' };
  return { decision: 'uncertain', reason: 'clock-error window' };
}

export function createDomain(name, secret = `${name}-test-secret`) {
  let version = 0;
  let value = 0;
  const prepared = new Map();
  const applied = new Set();
  return {
    name,
    prepare(txid, delta) {
      const body = { domain: name, txid, delta, version };
      const receipt = { body, signature: mac(secret, body) };
      prepared.set(txid, clone(receipt));
      return receipt;
    },
    verify(receipt) { return receipt?.signature === mac(secret, receipt.body) && receipt.body.domain === name; },
    apply(commitCertificate, mutation = 'none') {
      const own = commitCertificate?.receipts?.find(row => row.body.domain === name);
      if (!own || !this.verify(own)) return { ok: false, reason: 'missing-own-prepare' };
      const preparedOwn = prepared.get(own.body.txid);
      if (!preparedOwn || canonical(preparedOwn) !== canonical(own)) return { ok: false, reason: 'not-locally-prepared' };
      if (mutation !== 'local-commit-is-global') {
        if (!commitCertificate.atomic || commitCertificate.txid !== own.body.txid || new Set(commitCertificate.receipts.map(r => r.body.domain)).size !== 2) {
          return { ok: false, reason: 'missing-joint-certificate' };
        }
      }
      if (mutation !== 'ignore-prepared-version' && version !== own.body.version) return { ok: false, reason: 'stale-prepare-version' };
      if (applied.has(own.body.txid)) return { ok: true, replay: true, value };
      value += own.body.delta; version++; applied.add(own.body.txid);
      return { ok: true, value };
    },
    mutate(delta) { value += delta; version++; },
    snapshot() { return { name, version, value, prepared: [...prepared.keys()], applied: [...applied].sort() }; },
  };
}

export function joinCommitCertificate(txid, receipts, domains) {
  if (!Array.isArray(receipts) || receipts.length !== domains.length) return null;
  const names = new Set();
  for (const domain of domains) {
    const receipt = receipts.find(row => row.body.domain === domain.name);
    if (!receipt || receipt.body.txid !== txid || !domain.verify(receipt)) return null;
    names.add(receipt.body.domain);
  }
  if (names.size !== domains.length) return null;
  return { txid, atomic: true, receipts: clone(receipts), root: digest({ txid, receipts }) };
}

export function createRuleAuthority(secret = 'rule-test-secret') {
  let currentRuleRoot = null;
  const signManifest = manifest => {
    const root = digest(manifest);
    currentRuleRoot = root;
    return { manifest: clone(manifest), root, signature: mac(secret, { root }) };
  };
  return {
    signManifest,
    verify(signed) { return signed?.root === digest(signed.manifest) && signed.signature === mac(secret, { root: signed.root }); },
    get currentRuleRoot() { return currentRuleRoot; },
  };
}

export function evaluateManifestPredicate(manifest, evidence) {
  for (const requirement of manifest.requires) {
    if (!Object.hasOwn(evidence, requirement.field)) return false;
    const value = evidence[requirement.field];
    if (requirement.op === 'gt' && !(value > requirement.value)) return false;
    if (requirement.op === 'eq' && value !== requirement.value) return false;
    if (!['gt','eq'].includes(requirement.op)) return false;
  }
  return true;
}

export function verifyObligation({ signedManifest, evidence, authority, mutation = 'none' }) {
  if (!authority.verify(signedManifest)) return { ok: false, reason: 'bad-manifest-signature' };
  if (mutation !== 'ignore-rule-root' && signedManifest.root !== authority.currentRuleRoot) return { ok: false, reason: 'stale-rule-root' };
  if (mutation === 'signed-is-complete') return { ok: true, reason: 'signature-only-mutation' };
  if (!evaluateManifestPredicate(signedManifest.manifest, evidence)) return { ok: false, reason: 'predicate-not-proven' };
  return { ok: true, obligationRoot: signedManifest.root };
}

export function hiddenRuleOracle(world) {
  return world.stock > 0 && world.curse === false;
}

export function signedIncompleteManifestCounterexample() {
  const authority = createRuleAuthority();
  const signed = authority.signManifest({ action: 'claim', requires: [{ field: 'stock', op: 'gt', value: 0 }] });
  const world = { stock: 1, curse: true };
  const verifier = verifyObligation({ signedManifest: signed, evidence: { stock: 1 }, authority });
  return { verifier, oracleSafe: hiddenRuleOracle(world), pass: verifier.ok && !hiddenRuleOracle(world) };
}

export function completeManifestRepair() {
  const authority = createRuleAuthority();
  const signed = authority.signManifest({ action: 'claim', requires: [
    { field: 'stock', op: 'gt', value: 0 }, { field: 'curse', op: 'eq', value: false },
  ] });
  const unsafe = verifyObligation({ signedManifest: signed, evidence: { stock: 1, curse: true }, authority });
  const safe = verifyObligation({ signedManifest: signed, evidence: { stock: 1, curse: false }, authority });
  return { pass: !unsafe.ok && safe.ok, unsafe, safe };
}

export function staleRuleReplay(mutation = 'none') {
  const authority = createRuleAuthority();
  const old = authority.signManifest({ action: 'claim', requires: [{ field: 'stock', op: 'gt', value: 0 }] });
  authority.signManifest({ action: 'claim', requires: [{ field: 'stock', op: 'gt', value: 0 }, { field: 'curse', op: 'eq', value: false }] });
  return verifyObligation({ signedManifest: old, evidence: { stock: 1 }, authority, mutation });
}

export function sagaIrreversibilityWitness() {
  const trace = [];
  trace.push('consume-unique-token');
  trace.push('publish-lineage-notification');
  // Compensation can add a new token and a retraction notice, but cannot make external observers
  // never have observed the prior irreversible notification.
  trace.push('compensate-token');
  trace.push('publish-retraction');
  return {
    trace,
    atomicHistoryRestored: false,
    compensatedBusinessState: true,
    reason: 'compensation is a new history, not erasure of an already observed irreversible effect',
  };
}
