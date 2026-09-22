import { createHash, createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';

export const canonical = value => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('finite JSON only');
};
export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
const copy = value => structuredClone(value);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9][\w:./-]{0,119}$/.test(value);

function deterministicPrivateKey(label) {
  const seed = createHash('sha256').update(`RRP-ACCOUNTABILITY-TEST-ONLY:${label}`).digest();
  return createPrivateKey({ key: Buffer.concat([Buffer.from('302e020100300506032b657004220420', 'hex'), seed]), format: 'der', type: 'pkcs8' });
}
export function fixtureIdentity(label) {
  const privateKey = deterministicPrivateKey(label);
  const publicKey = createPublicKey(privateKey);
  const keyDer = publicKey.export({ format: 'der', type: 'spki' });
  const keyId = sha256(keyDer.toString('hex'));
  return Object.freeze({
    label, keyId, publicKey,
    sign(body) { return { body: copy(body), signature: sign(null, Buffer.from(canonical(body)), privateKey).toString('hex') }; },
  });
}
export function verifySigned(signed, publicKey) {
  try { return Boolean(signed?.body && typeof signed.signature === 'string' && verify(null, Buffer.from(canonical(signed.body)), publicKey, Buffer.from(signed.signature, 'hex'))); }
  catch { return false; }
}

export const GENESIS = sha256({ type: 'accountability-genesis-v1' });
export function checkpoint({ worldId = 'world', signer, previous = null, event, hostAlias = 'host' }) {
  if (!signer || !validId(worldId) || !validId(hostAlias)) throw new Error('invalid checkpoint identity');
  const seq = previous ? previous.body.seq + 1 : 1;
  const parent = previous ? previous.body.root : GENESIS;
  const unsigned = { version: 1, worldId, hostAlias, hostKey: signer.keyId, seq, parent, eventHash: sha256(event) };
  const root = sha256(unsigned);
  return signer.sign({ ...unsigned, root });
}
export function verifyCheckpoint(signed, { publicKey, expectedKeyId, previous = null } = {}) {
  if (!verifySigned(signed, publicKey)) return false;
  const body = signed.body;
  if (body.version !== 1 || body.hostKey !== expectedKeyId || !validId(body.worldId) || !validId(body.hostAlias) ||
      !Number.isSafeInteger(body.seq) || body.seq < 1 || typeof body.parent !== 'string' || typeof body.eventHash !== 'string') return false;
  const { root, ...unsigned } = body;
  if (sha256(unsigned) !== root) return false;
  if (previous) {
    if (body.worldId !== previous.body.worldId || body.hostKey !== previous.body.hostKey || body.hostAlias !== previous.body.hostAlias) return false;
    if (body.seq !== previous.body.seq + 1 || body.parent !== previous.body.root) return false;
  } else if (body.seq !== 1 || body.parent !== GENESIS) return false;
  return true;
}
export function verifyHistory(history, identity) {
  if (!Array.isArray(history) || history.length === 0) return false;
  for (let i = 0; i < history.length; i++) if (!verifyCheckpoint(history[i], { publicKey: identity.publicKey, expectedKeyId: identity.keyId, previous: i ? history[i - 1] : null })) return false;
  return true;
}
export function forkHistories({ signer = fixtureIdentity('host'), worldId = 'world' } = {}) {
  const base = checkpoint({ worldId, signer, event: { type: 'born', id: 'p:1' } });
  const left = checkpoint({ worldId, signer, previous: base, event: { type: 'reward', item: 'sword', owner: 'alice' } });
  const right = checkpoint({ worldId, signer, previous: base, event: { type: 'reward', item: 'sword', owner: 'bob' } });
  return { signer, base, left: [base, left], right: [base, right] };
}
export function firstForkEvidence(left, right) {
  const limit = Math.min(left.length, right.length);
  for (let i = 0; i < limit; i++) {
    const a = left[i], b = right[i];
    if (a.body.root === b.body.root) continue;
    const samePrincipal = a.body.worldId === b.body.worldId && a.body.hostKey === b.body.hostKey && a.body.hostAlias === b.body.hostAlias;
    const samePosition = a.body.seq === b.body.seq && a.body.parent === b.body.parent;
    return samePrincipal && samePosition ? { type: 'equivocation', left: a, right: b } : null;
  }
  return null;
}
export function compatibleFinalizedHistories(histories) {
  for (let i = 0; i < histories.length; i++) for (let j = i + 1; j < histories.length; j++) if (firstForkEvidence(histories[i], histories[j])) return false;
  return true;
}

export class GossipWitness {
  constructor() { this.latest = new Map(); this.evidence = []; }
  observe(history) {
    if (!history?.length) return { ok: false, reason: 'empty' };
    const tail = history.at(-1).body, key = `${tail.worldId}:${tail.hostKey}`;
    const prior = this.latest.get(key);
    if (prior) {
      const proof = firstForkEvidence(prior.history, history);
      if (proof) { this.evidence.push(proof); return { ok: false, reason: 'equivocation', proof }; }
      if (tail.seq < prior.tail.seq) return { ok: false, reason: 'rollback', expectedAtLeast: prior.tail.seq };
      if (tail.seq === prior.tail.seq && tail.root !== prior.tail.root) return { ok: false, reason: 'split-view' };
      if (tail.seq > prior.tail.seq && !history.some(row => row.body.root === prior.tail.root)) return { ok: false, reason: 'not-an-extension' };
    }
    this.latest.set(key, { tail: copy(tail), history: copy(history) });
    return { ok: true };
  }
  latestSeq(worldId, hostKey) { return this.latest.get(`${worldId}:${hostKey}`)?.tail.seq ?? 0; }
}

export function gossipRound(clientHistories, edges) {
  const detected = [];
  for (const [a, b] of edges) {
    const proof = firstForkEvidence(clientHistories[a], clientHistories[b]);
    if (proof) detected.push({ a, b, proof });
  }
  return detected;
}

export class CosigningNotary {
  constructor(identity = fixtureIdentity('notary')) { this.identity = identity; this.last = new Map(); }
  cosign(signedCheckpoint, hostIdentity) {
    if (!verifyCheckpoint(signedCheckpoint, { publicKey: hostIdentity.publicKey, expectedKeyId: hostIdentity.keyId,
      previous: null })) {
      return { ok: false, reason: 'need-history' };
    }
    return this.observeHistory([signedCheckpoint], hostIdentity);
  }
  observeHistory(history, hostIdentity) {
    if (!verifyHistory(history, hostIdentity)) return { ok: false, reason: 'invalid-history' };
    const tail = history.at(-1).body, key = `${tail.worldId}:${tail.hostKey}`;
    const prior = this.last.get(key);
    if (prior) {
      const proof = firstForkEvidence(prior.history, history);
      if (proof) return { ok: false, reason: 'equivocation', proof };
      if (tail.seq < prior.tail.seq || (tail.seq > prior.tail.seq && !history.some(row => row.body.root === prior.tail.root))) return { ok: false, reason: 'rollback-or-nonextension' };
    }
    const receiptBody = { type: 'notary', worldId: tail.worldId, hostKey: tail.hostKey, seq: tail.seq, root: tail.root };
    const receipt = this.identity.sign(receiptBody);
    this.last.set(key, { history: copy(history), tail: copy(tail) });
    return { ok: true, receipt };
  }
}

export function localRollbackIndistinguishability({ history, restoredLength }) {
  const restored = copy(history.slice(0, restoredLength));
  return { restored, localState: { lastCheckpoint: restored.at(-1) },
    statement: 'A verifier whose entire persistent state is restored with the history has no local bit saying a later checkpoint once existed.' };
}
export function witnessRejectsRollback(witness, history) {
  const tail = history.at(-1).body;
  const latest = witness.latestSeq(tail.worldId, tail.hostKey);
  return latest > tail.seq;
}

export function repairDerivedProjection(corrupted, retainedHistory) {
  if (!retainedHistory?.length) return { status: 'ambiguous', projection: corrupted };
  const tail = retainedHistory.at(-1).body;
  return { status: 'repaired', projection: { worldId: tail.worldId, seq: tail.seq, root: tail.root } };
}
export function chooseAuthoritativeFork(histories) {
  if (!histories.length) return { status: 'none' };
  if (!compatibleFinalizedHistories(histories)) return { status: 'ambiguous-fork' };
  return { status: 'compatible', history: histories.reduce((best, row) => row.length > best.length ? row : best, histories[0]) };
}

export function hostKeySplitCounterexample() {
  const leftHost = fixtureIdentity('host-key-left'), rightHost = fixtureIdentity('host-key-right');
  const left = [checkpoint({ signer: leftHost, worldId: 'w', hostAlias: 'same-display-name', event: { side: 'left' } })];
  const right = [checkpoint({ signer: rightHost, worldId: 'w', hostAlias: 'same-display-name', event: { side: 'right' } })];
  return { left, right, locallyValid: verifyHistory(left, leftHost) && verifyHistory(right, rightHost),
    crossKeyEquivocationProof: firstForkEvidence(left, right) };
}

export function irreversibleObservationCounterexample() {
  const { signer, left, right } = forkHistories();
  const observed = { alice: left.at(-1).body.eventHash, bob: right.at(-1).body.eventHash };
  const proof = firstForkEvidence(left, right);
  return { signer, proof, observedBeforeDetection: observed, observationErasedByDetection: false };
}

export function finitePrefixEventualDetection(prefixEdges, futureEdges) {
  return {
    prefix: copy(prefixEdges),
    extensionDetects: copy([...prefixEdges, ...futureEdges]),
    extensionNeverConnects: copy(prefixEdges),
    decidableFromPrefix: false,
  };
}

export function classifyGuarantees() {
  return Object.freeze({
    semanticPrecondition: 'single-trace-safety/prevent-inline',
    nonEquivocation: 'hyperproperty/compare-observers-or-consensus',
    antiRollback: 'state-continuity/requires-nonrollback-anchor',
    eventualDetection: 'liveness/requires-eventual-contact',
    projectionRecovery: 'self-stabilizing-with-retained-anchor',
  });
}

export function longestForkIsNotAuthority(left, right) {
  const chosen = left.length >= right.length ? left : right;
  return { chosen, safeToChoose: compatibleFinalizedHistories([left, right]), reason: 'Length does not establish authority when one signer can extend either fork.' };
}

export function allUndirectedEdges(nodes) {
  const edges = [];
  for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) edges.push([nodes[i], nodes[j]]);
  return edges;
}
export function enumerateOneRoundGossipGraphs(clientHistories) {
  const nodes = Object.keys(clientHistories).sort(), edges = allUndirectedEdges(nodes);
  if (edges.length > 20) throw new Error('bounded enumerator only');
  let graphs = 0, detect = 0, silent = 0;
  for (let mask = 0; mask < 2 ** edges.length; mask++) {
    const selected = edges.filter((_, bit) => mask & (1 << bit));
    graphs++;
    if (gossipRound(clientHistories, selected).length) detect++; else silent++;
  }
  return { nodes, edgeCount: edges.length, graphs, detect, silent };
}

export class SessionOnlyMonitor {
  constructor() { this.witness = new GossipWitness(); }
  observe(history) { return this.witness.observe(history); }
}
