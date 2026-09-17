import { createHash } from 'node:crypto';

export const Verdict = Object.freeze({
  ALLOW: 'ALLOW',
  DENY: 'DENY',
  ESCALATE: 'ESCALATE',
});

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
}

export function traceDependencies(action, samples) {
  const reads = new Set();
  for (const sample of samples) {
    const traced = new Proxy(sample, {
      get(target, key, receiver) {
        if (typeof key === 'string') reads.add(key);
        return Reflect.get(target, key, receiver);
      },
    });
    action(traced);
  }
  return [...reads].sort();
}

export function branchSensitiveRule(state) {
  if (state.level > 10) {
    return state.stock > 0 && state.curse === false;
  }
  return state.stock > 0;
}

export function traceCompletenessCounterexample() {
  const observed = traceDependencies(branchSensitiveRule, [{ level: 2, stock: 1, curse: false }]);
  const adversarialWorld = { level: 20, stock: 1, curse: true };
  return {
    observed,
    missing: !observed.includes('curse'),
    adversarialWorld,
    trueDecision: branchSensitiveRule(adversarialWorld),
  };
}

function evalCondition(condition, evidence) {
  if (!Object.prototype.hasOwnProperty.call(evidence, condition.field)) return 'missing';
  const actual = evidence[condition.field];
  switch (condition.op) {
    case 'eq': return actual === condition.value;
    case 'gt': return actual > condition.value;
    default: throw new Error(`unsupported condition op: ${condition.op}`);
  }
}

export const policyRegistryV2 = Object.freeze({
  version: 'policy-registry:v2',
  effects: {
    'inventory.claim': {
      conditions: [
        { field: 'stock', op: 'gt', value: 0 },
        { field: 'curse', op: 'eq', value: false },
      ],
      oracles: [{ name: 'ownership', minEpoch: 7 }],
    },
    'lineage.append': {
      conditions: [{ field: 'lineageOpen', op: 'eq', value: true }],
      oracles: [],
    },
  },
});

export const policyRegistryV3 = Object.freeze({
  version: 'policy-registry:v3',
  effects: {
    ...policyRegistryV2.effects,
    'inventory.claim': {
      conditions: [
        ...policyRegistryV2.effects['inventory.claim'].conditions,
        { field: 'age', op: 'gt', value: 6 },
      ],
      oracles: policyRegistryV2.effects['inventory.claim'].oracles,
    },
  },
});

export function policyArtifactRoot(registry, oracleContracts = {}, gatewayVersion = 'gateway:v1') {
  return sha256({ registry, oracleContracts, gatewayVersion });
}

export function callerSourceRoot(sourceText) {
  return sha256(sourceText);
}

export function semanticRootCoverageCounterexample() {
  const callerSource = 'claimItem(world) => inventory.claim(world.itemId)';
  return {
    callerRootBefore: callerSourceRoot(callerSource),
    callerRootAfter: callerSourceRoot(callerSource),
    policyRootBefore: policyArtifactRoot(policyRegistryV2),
    policyRootAfter: policyArtifactRoot(policyRegistryV3),
  };
}

export function verifySinkOwnedPolicy({ effect, evidence = {}, oracleProofs = {}, policyRoot }, registry = policyRegistryV2) {
  const expectedRoot = policyArtifactRoot(registry);
  if (policyRoot !== expectedRoot) {
    return { verdict: Verdict.DENY, reason: 'policy-root-mismatch' };
  }

  const policy = registry.effects[effect];
  if (!policy) return { verdict: Verdict.DENY, reason: 'unknown-effect' };

  for (const condition of policy.conditions) {
    const result = evalCondition(condition, evidence);
    if (result === 'missing') return { verdict: Verdict.ESCALATE, reason: `missing-evidence:${condition.field}` };
    if (!result) return { verdict: Verdict.DENY, reason: `predicate-false:${condition.field}` };
  }

  for (const oracle of policy.oracles) {
    const proof = oracleProofs[oracle.name];
    if (!proof) return { verdict: Verdict.ESCALATE, reason: `missing-oracle:${oracle.name}` };
    if (!proof.fresh || proof.epoch < oracle.minEpoch) {
      return { verdict: Verdict.ESCALATE, reason: `stale-oracle:${oracle.name}` };
    }
  }

  return { verdict: Verdict.ALLOW, reason: 'sink-policy-satisfied' };
}

export function verifyCallerDefinedManifest({ manifest, evidence = {} }) {
  for (const condition of manifest.conditions ?? []) {
    const result = evalCondition(condition, evidence);
    if (result === 'missing') return { verdict: Verdict.ESCALATE, reason: `missing-evidence:${condition.field}` };
    if (!result) return { verdict: Verdict.DENY, reason: `predicate-false:${condition.field}` };
  }
  return { verdict: Verdict.ALLOW, reason: 'caller-manifest-satisfied' };
}

export function incompleteManifestCounterexample() {
  const evidence = { stock: 1, curse: true };
  const manifest = { effect: 'inventory.claim', conditions: [{ field: 'stock', op: 'gt', value: 0 }] };
  return {
    unsafeCallerVerdict: verifyCallerDefinedManifest({ manifest, evidence }),
    safeSinkVerdict: verifySinkOwnedPolicy({
      effect: 'inventory.claim',
      evidence,
      oracleProofs: { ownership: { epoch: 7, fresh: true } },
      policyRoot: policyArtifactRoot(policyRegistryV2),
    }),
  };
}

export function annotationMismatchCounterexample() {
  const declaredEffects = ['inventory.claim'];
  const actualEffects = ['inventory.claim', 'lineage.append'];
  return {
    declaredEffects,
    actualEffects,
    undeclared: actualEffects.filter((effect) => !declaredEffects.includes(effect)),
  };
}

export function attenuateEffects(parentAllowed, requested) {
  const parent = new Set(parentAllowed);
  return requested.filter((effect) => parent.has(effect));
}

export function createEffectGateway({
  allowedEffects,
  evidence,
  oracleProofs,
  registry = policyRegistryV2,
  policyRoot = policyArtifactRoot(registry),
  events = [],
  mutation = null,
}) {
  const allowed = new Set(allowedEffects);

  const perform = (effect) => {
    if (mutation !== 'nested-authority-amplification' && !allowed.has(effect)) {
      return { verdict: Verdict.DENY, reason: 'effect-not-in-capability' };
    }

    const result = verifySinkOwnedPolicy({ effect, evidence, oracleProofs, policyRoot }, registry);
    if (result.verdict === Verdict.ALLOW) events.push(effect);
    return result;
  };

  const child = (requested) => createEffectGateway({
    allowedEffects: mutation === 'nested-authority-amplification'
      ? requested
      : attenuateEffects([...allowed], requested),
    evidence,
    oracleProofs,
    registry,
    policyRoot,
    events,
    mutation,
  });

  return { perform, child, events, allowedEffects: [...allowed].sort() };
}

export function nestedHookCounterexample({ mutation = null } = {}) {
  const gateway = createEffectGateway({
    allowedEffects: ['inventory.claim'],
    evidence: { stock: 1, curse: false, lineageOpen: true },
    oracleProofs: { ownership: { epoch: 7, fresh: true } },
    mutation,
  });

  const claim = gateway.perform('inventory.claim');
  const hookGateway = gateway.child(['lineage.append']);
  const hook = hookGateway.perform('lineage.append');
  return { claim, hook, events: gateway.events };
}

export function oracleFreshnessCounterexample() {
  const common = {
    effect: 'inventory.claim',
    evidence: { stock: 1, curse: false },
    policyRoot: policyArtifactRoot(policyRegistryV2),
  };
  return {
    missing: verifySinkOwnedPolicy({ ...common, oracleProofs: {} }),
    stale: verifySinkOwnedPolicy({ ...common, oracleProofs: { ownership: { epoch: 6, fresh: true } } }),
    fresh: verifySinkOwnedPolicy({ ...common, oracleProofs: { ownership: { epoch: 7, fresh: true } } }),
  };
}

export function createProtectedSink({ exposeRaw = false } = {}) {
  const events = [];
  const rawCommit = (effect) => {
    events.push(effect);
    return { committed: true, effect };
  };
  return {
    events,
    rawCommit: exposeRaw ? rawCommit : undefined,
    commitAfterGateway(effect, gatewayResult) {
      if (gatewayResult.verdict !== Verdict.ALLOW) return { committed: false, effect };
      return rawCommit(effect);
    },
  };
}

export function completeMediationCounterexample() {
  const safeSink = createProtectedSink();
  const unsafeSink = createProtectedSink({ exposeRaw: true });
  unsafeSink.rawCommit('lineage.append');
  return {
    safeRawExposed: typeof safeSink.rawCommit === 'function',
    unsafeRawExposed: typeof unsafeSink.rawCommit === 'function',
    unsafeEvents: unsafeSink.events,
  };
}

export function interpretPolicyDsl(node, world) {
  if (node.all) return node.all.every((child) => interpretPolicyDsl(child, world));
  if (node.eq) return world[node.eq.field] === node.eq.value;
  if (node.gt) return world[node.gt.field] > node.gt.value;
  throw new Error('invalid policy DSL node');
}

export function compilePolicyDsl(node, { dropLastConjunct = false } = {}) {
  if (node.all) {
    const children = node.all.map((child) => compilePolicyDsl(child));
    return { all: dropLastConjunct ? children.slice(0, -1) : children };
  }
  if (node.eq) return { eq: { ...node.eq } };
  if (node.gt) return { gt: { ...node.gt } };
  throw new Error('invalid policy DSL node');
}

export function validateTranslation(source, target, worlds) {
  const mismatches = [];
  for (const world of worlds) {
    const sourceResult = interpretPolicyDsl(source, world);
    const targetResult = interpretPolicyDsl(target, world);
    if (sourceResult !== targetResult) mismatches.push({ world, sourceResult, targetResult });
  }
  return { valid: mismatches.length === 0, mismatches };
}

export function translationValidationCounterexample() {
  const source = {
    all: [
      { gt: { field: 'stock', value: 0 } },
      { eq: { field: 'curse', value: false } },
    ],
  };
  const buggy = compilePolicyDsl(source, { dropLastConjunct: true });
  const worlds = [
    { stock: 0, curse: false },
    { stock: 1, curse: false },
    { stock: 1, curse: true },
  ];
  return { source, buggy, validation: validateTranslation(source, buggy, worlds) };
}

export function scopedRightAllows(right, effect, args = {}) {
  if (!right || right.effect !== effect) return false;
  for (const [key, value] of Object.entries(right.constraints ?? {})) {
    if (args[key] !== value) return false;
  }
  return true;
}

export function effectNameScopeCounterexample() {
  const parent = {
    effect: 'life.rebirth',
    constraints: { playerId: 'p1', lifeId: 'p1:2' },
  };
  const attempt = {
    effect: 'life.rebirth',
    args: { playerId: 'p2', lifeId: 'p2:7' },
  };
  return {
    parent,
    attempt,
    nameOnlyAllows: parent.effect === attempt.effect,
    scopedAllows: scopedRightAllows(parent, attempt.effect, attempt.args),
  };
}

export function verifyPolicyGeneration({ presentedRoot, presentedEpoch }, { activeRoot, activeEpoch }) {
  if (presentedEpoch !== activeEpoch) return { verdict: Verdict.DENY, reason: 'policy-epoch-mismatch' };
  if (presentedRoot !== activeRoot) return { verdict: Verdict.DENY, reason: 'policy-root-mismatch' };
  return { verdict: Verdict.ALLOW, reason: 'active-policy-generation' };
}

export function policyRollbackCounterexample() {
  const evidence = { stock: 1, curse: false, age: 3 };
  const oracleProofs = { ownership: { epoch: 7, fresh: true } };
  const oldRoot = policyArtifactRoot(policyRegistryV2);
  const newRoot = policyArtifactRoot(policyRegistryV3);
  const oldPolicyVerdict = verifySinkOwnedPolicy({
    effect: 'inventory.claim', evidence, oracleProofs, policyRoot: oldRoot,
  }, policyRegistryV2);
  const newPolicyVerdict = verifySinkOwnedPolicy({
    effect: 'inventory.claim', evidence, oracleProofs, policyRoot: newRoot,
  }, policyRegistryV3);
  const generationFence = verifyPolicyGeneration(
    { presentedRoot: oldRoot, presentedEpoch: 2 },
    { activeRoot: newRoot, activeEpoch: 3 },
  );
  return { oldRoot, newRoot, oldPolicyVerdict, newPolicyVerdict, generationFence };
}

export function createVersionedClaimSink() {
  const state = { stock: 1, curse: false, version: 1, commits: 0 };
  function prepare() {
    const verdict = state.stock > 0 && state.curse === false ? Verdict.ALLOW : Verdict.DENY;
    return { verdict, version: state.version, policyRoot: policyArtifactRoot(policyRegistryV2) };
  }
  function consumeElsewhere() {
    if (state.stock > 0) state.stock -= 1;
    state.version += 1;
  }
  function naiveCommit(permit) {
    if (permit.verdict !== Verdict.ALLOW) return false;
    state.commits += 1;
    return true;
  }
  function fencedCommit(permit) {
    if (permit.verdict !== Verdict.ALLOW || permit.version !== state.version) return false;
    if (state.stock <= 0 || state.curse !== false) return false;
    state.stock -= 1;
    state.version += 1;
    state.commits += 1;
    return true;
  }
  return { state, prepare, consumeElsewhere, naiveCommit, fencedCommit };
}

export function stalePermitCounterexample() {
  const naive = createVersionedClaimSink();
  const naivePermit = naive.prepare();
  naive.consumeElsewhere();
  const naiveCommitted = naive.naiveCommit(naivePermit);

  const safe = createVersionedClaimSink();
  const safePermit = safe.prepare();
  safe.consumeElsewhere();
  const safeCommitted = safe.fencedCommit(safePermit);
  return {
    naiveCommitted,
    naiveState: { ...naive.state },
    safeCommitted,
    safeState: { ...safe.state },
  };
}

export function ioPrimitiveSemanticGapCounterexample() {
  const replaceable = { semanticEffect: 'presence.position', ioPrimitive: 'storage.write', protected: false };
  const irreversible = { semanticEffect: 'lineage.rebirth', ioPrimitive: 'storage.write', protected: true };
  return {
    replaceable,
    irreversible,
    samePrimitive: replaceable.ioPrimitive === irreversible.ioPrimitive,
    differentProtection: replaceable.protected !== irreversible.protected,
  };
}

export function ambientAuthorityCounterexample() {
  const storage = new Map();
  const ambientWrite = (key, value) => storage.set(key, value);
  const protectedWrapper = Object.freeze({
    commit(key, value, authorized) {
      if (!authorized) return false;
      ambientWrite(key, value);
      return true;
    },
  });
  const wrapperExposesAmbientWrite = Object.values(protectedWrapper).includes(ambientWrite);
  ambientWrite('coop-v2:world-1', 'forged-envelope');
  return {
    wrapperExposesAmbientWrite,
    ambientBypassSucceeded: storage.get('coop-v2:world-1') === 'forged-envelope',
  };
}

export function runMutation(name) {
  switch (name) {
    case 'trace-is-complete': {
      const witness = traceCompletenessCounterexample();
      return witness.missing && witness.trueDecision === false;
    }
    case 'annotation-is-authority': {
      const mismatch = annotationMismatchCounterexample();
      return mismatch.undeclared.length > 0;
    }
    case 'manifest-defines-policy': {
      const witness = incompleteManifestCounterexample();
      return witness.unsafeCallerVerdict.verdict === Verdict.ALLOW
        && witness.safeSinkVerdict.verdict !== Verdict.ALLOW;
    }
    case 'nested-authority-amplification': {
      const witness = nestedHookCounterexample({ mutation: 'nested-authority-amplification' });
      return witness.hook.verdict === Verdict.ALLOW && witness.events.includes('lineage.append');
    }
    case 'caller-root-is-policy-root': {
      const witness = semanticRootCoverageCounterexample();
      return witness.callerRootBefore === witness.callerRootAfter
        && witness.policyRootBefore !== witness.policyRootAfter;
    }
    case 'undeclared-oracle-is-local-fact': {
      const witness = oracleFreshnessCounterexample();
      return witness.missing.verdict === Verdict.ESCALATE
        && witness.fresh.verdict === Verdict.ALLOW;
    }
    case 'skip-translation-validation': {
      const witness = translationValidationCounterexample();
      return witness.validation.valid === false && witness.validation.mismatches.length > 0;
    }
    case 'effect-sink-not-exclusive': {
      const witness = completeMediationCounterexample();
      return witness.unsafeRawExposed && witness.unsafeEvents.includes('lineage.append');
    }
    case 'effect-name-is-authority': {
      const witness = effectNameScopeCounterexample();
      return witness.nameOnlyAllows && !witness.scopedAllows;
    }
    case 'policy-root-is-fresh': {
      const witness = policyRollbackCounterexample();
      return witness.oldPolicyVerdict.verdict === Verdict.ALLOW
        && witness.newPolicyVerdict.verdict === Verdict.DENY
        && witness.generationFence.verdict === Verdict.DENY;
    }
    case 'permit-outlives-state': {
      const witness = stalePermitCounterexample();
      return witness.naiveCommitted && !witness.safeCommitted;
    }
    case 'io-primitive-is-policy-key': {
      const witness = ioPrimitiveSemanticGapCounterexample();
      return witness.samePrimitive && witness.differentProtection;
    }
    case 'wrapper-hides-ambient-authority': {
      const witness = ambientAuthorityCounterexample();
      return !witness.wrapperExposesAmbientWrite && witness.ambientBypassSucceeded;
    }
    default:
      throw new Error(`unknown mutation: ${name}`);
  }
}

export const mutationNames = Object.freeze([
  'trace-is-complete',
  'annotation-is-authority',
  'manifest-defines-policy',
  'nested-authority-amplification',
  'caller-root-is-policy-root',
  'undeclared-oracle-is-local-fact',
  'skip-translation-validation',
  'effect-sink-not-exclusive',
  'effect-name-is-authority',
  'policy-root-is-fresh',
  'permit-outlives-state',
  'io-primitive-is-policy-key',
  'wrapper-hides-ambient-authority',
]);
