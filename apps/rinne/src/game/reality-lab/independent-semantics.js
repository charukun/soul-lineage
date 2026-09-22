import { RECONSTRUCTION_EVIDENCE, canonical, clone } from './independent-shared.js';

function normalizeResources(resources) {
  const ids = new Set();
  return resources.map(resource => {
    const id = String(resource?.id ?? '');
    if (!id) throw new Error('resource id required');
    if (ids.has(id)) throw new Error(`duplicate resource id: ${id}`);
    ids.add(id);
    switch (resource.type) {
      case 'bounded-counter':
        if (!Number.isInteger(resource.min) || !Number.isInteger(resource.max) || resource.min > resource.max) throw new Error('invalid bounded-counter');
        return { id, type: resource.type, min: resource.min, max: resource.max };
      case 'grow-only-set':
      case 'unique-register':
      case 'single-use-token':
        return { id, type: resource.type };
      default:
        throw new Error(`unsupported resource type: ${resource.type}`);
    }
  });
}

function normalizeEffect(resource, effect) {
  if (!effect || typeof effect !== 'object') throw new Error(`effect required for ${resource.id}`);
  switch (resource.type) {
    case 'bounded-counter':
      if (!Number.isInteger(effect.delta)) throw new Error(`bounded-counter only supports integer delta: ${resource.id}`);
      if (Object.keys(effect).some(key => key !== 'delta')) throw new Error(`unsupported bounded-counter effect: ${resource.id}`);
      return { delta: effect.delta };
    case 'grow-only-set':
      if (!Object.hasOwn(effect, 'add') || Object.keys(effect).some(key => key !== 'add')) throw new Error(`grow-only-set only supports add: ${resource.id}`);
      return { add: clone(effect.add) };
    case 'unique-register':
      if (!Object.hasOwn(effect, 'assign') || Object.keys(effect).some(key => key !== 'assign')) throw new Error(`unique-register only supports assign: ${resource.id}`);
      return { assign: clone(effect.assign) };
    case 'single-use-token':
      if (effect.consume !== true || Object.keys(effect).some(key => key !== 'consume')) throw new Error(`single-use-token only supports consume=true: ${resource.id}`);
      return { consume: true };
    default:
      throw new Error('unsupported resource');
  }
}

function pairWitness(resource, left, right) {
  if (!left || !right) return null;
  if (resource.type === 'grow-only-set') return null;
  if (resource.type === 'single-use-token') return left.consume && right.consume ? { resourceId: resource.id, reason: 'double-consume' } : null;
  if (resource.type === 'unique-register') {
    return canonical(left.assign) === canonical(right.assign) ? null : { resourceId: resource.id, reason: 'different-unique-assignment', left: left.assign, right: right.assign };
  }
  if (resource.type === 'bounded-counter') {
    for (let base = resource.min; base <= resource.max; base += 1) {
      const a = base + left.delta;
      const b = base + right.delta;
      const merged = base + left.delta + right.delta;
      const individuallyValid = a >= resource.min && a <= resource.max && b >= resource.min && b <= resource.max;
      const mergedValid = merged >= resource.min && merged <= resource.max;
      if (individuallyValid && !mergedValid) return { resourceId: resource.id, reason: 'bounded-counter-merge', base, merged };
    }
  }
  return null;
}

export function compileDeclaredInvariantKernel({ resources = [], operations = [] } = {}) {
  const normalizedResources = normalizeResources(resources);
  const resourceMap = new Map(normalizedResources.map(resource => [resource.id, resource]));
  const operationIds = new Set();
  const normalizedOperations = operations.map(operation => {
    const id = String(operation?.id ?? '');
    if (!id) throw new Error('operation id required');
    if (operationIds.has(id)) throw new Error(`duplicate operation id: ${id}`);
    operationIds.add(id);
    const effects = {};
    for (const [resourceId, effect] of Object.entries(operation.effects ?? {})) {
      const resource = resourceMap.get(resourceId);
      if (!resource) throw new Error(`unknown resource: ${resourceId}`);
      effects[resourceId] = normalizeEffect(resource, effect);
    }
    return { id, effects };
  });

  const conflicts = [];
  const safePairs = [];
  for (let i = 0; i < normalizedOperations.length; i += 1) {
    for (let j = i; j < normalizedOperations.length; j += 1) {
      const left = normalizedOperations[i];
      const right = normalizedOperations[j];
      const shared = Object.keys(left.effects).filter(id => Object.hasOwn(right.effects, id));
      const witnesses = shared.map(resourceId => pairWitness(resourceMap.get(resourceId), left.effects[resourceId], right.effects[resourceId])).filter(Boolean);
      const pair = { left: left.id, right: right.id, sameDefinitionConcurrent: i === j, shared, witnesses };
      if (witnesses.length) conflicts.push(pair); else safePairs.push(pair);
    }
  }

  return {
    resources: normalizedResources,
    operations: normalizedOperations,
    conflicts,
    safePairs,
    scope: 'finite declared effect grammar only; not a general I-confluence decision procedure',
  };
}

export function causalObservationHorizon({ edges = [], source, observer, causalComplete = false } = {}) {
  if (!causalComplete) return { usable: false, reason: 'causal graph completeness is an explicit assumption' };
  const nodes = new Set([source, observer]);
  for (const edge of edges) {
    if (!Number.isFinite(edge.minDelayMs) || edge.minDelayMs < 0) throw new Error('minDelayMs must be a sound nonnegative lower bound');
    nodes.add(edge.from); nodes.add(edge.to);
  }
  const distance = Object.fromEntries([...nodes].map(node => [node, Infinity]));
  distance[source] = 0;
  const unvisited = new Set(nodes);
  while (unvisited.size) {
    let current = null;
    for (const node of unvisited) if (current === null || distance[node] < distance[current]) current = node;
    if (current === null || distance[current] === Infinity) break;
    unvisited.delete(current);
    for (const edge of edges.filter(edge => edge.from === current)) {
      distance[edge.to] = Math.min(distance[edge.to], distance[current] + edge.minDelayMs);
    }
  }
  return {
    usable: true,
    earliestInfluenceMs: distance[observer],
    deferBeforeMs: distance[observer],
    condition: 'safe only if every path capable of changing this observer output is present and every minDelayMs bound is sound',
  };
}

export function speculationBoundary({ errorBound, boundaryMargin, rollbackable, irreversible = false } = {}) {
  if (![errorBound, boundaryMargin].every(Number.isFinite) || errorBound < 0 || boundaryMargin < 0) throw new Error('bounds must be finite and nonnegative');
  const safe = Boolean(rollbackable) && !irreversible && errorBound < boundaryMargin;
  return {
    safe,
    headroom: boundaryMargin - errorBound,
    condition: 'a classical prediction bound, not Heisenberg uncertainty; reconcile before the bound reaches a discrete/irreversible decision boundary',
  };
}

export function clientDisappearanceKnowledgeCounterexample() {
  return {
    evidence: RECONSTRUCTION_EVIDENCE.THEOREM,
    histories: [
      { server: 'committed', reply: 'lost', clientObservation: 'timeout' },
      { server: 'not-committed', reply: 'none', clientObservation: 'timeout' },
    ],
    indistinguishableToClient: true,
    conclusion: 'without later communication or an external witness, a disappeared client cannot know from the timeout alone whether its operation committed',
  };
}

export function compositionCounterexample() {
  return {
    evidence: RECONSTRUCTION_EVIDENCE.THEOREM,
    individuallySafe: ['election chooses one leader per epoch', 'commit preserves a parent chain inside one generation', 'handoff fences one source generation'],
    missingSharedInvariant: 'commit acceptance must bind the active generation/transition certificate',
    counterexample: 'a leader elected safely in epoch e can accept a generation-g write after a separately safe g→g+1 handoff unless the commit rule rejects that stale generation',
    conclusion: 'component safety predicates do not compose by conjunction alone',
  };
}

export function fairArchitectureBaselines() {
  const commonFreedom = {
    semanticSplit: true,
    batching: true,
    interestManagement: true,
    adaptiveTopology: true,
    irreversibleOnlyStrongPath: true,
  };
  return [
    { id: 'canon-only-raft-hybrid', ...commonFreedom, strongPlane: 'Raft/replicated log', weakPlane: 'CRDT/causal or local projection', realtime: 'authoritative prediction/rollback/state sync' },
    { id: 'vr-chain-hybrid', ...commonFreedom, strongPlane: 'Viewstamped Replication or Chain Replication with a membership service', weakPlane: 'eventual/causal', realtime: 'snapshot/state sync' },
    { id: 'paxos-family-hybrid', ...commonFreedom, strongPlane: 'Paxos/Flexible/EPaxos chosen by conflict and latency assumptions', weakPlane: 'CRDT/causal', realtime: 'rollback/state sync' },
    { id: 'peer-canon-candidate', ...commonFreedom, strongPlane: 'custom peer crash protocol only if infrastructure constraints justify its proof burden', weakPlane: 'CRDT/causal', realtime: 'peer-host prediction/rollback' },
  ];
}

export function runIndependentCounterexamples() {
  const client = clientDisappearanceKnowledgeCounterexample();
  const composition = compositionCounterexample();
  const horizon = causalObservationHorizon({
    source: 'A', observer: 'C', causalComplete: true,
    edges: [{ from: 'A', to: 'B', minDelayMs: 40 }, { from: 'B', to: 'C', minDelayMs: 30 }, { from: 'A', to: 'C', minDelayMs: 100 }],
  });
  const speculation = speculationBoundary({ errorBound: 0.2, boundaryMargin: 0.5, rollbackable: true });
  return {
    pass: client.indistinguishableToClient && composition.missingSharedInvariant && horizon.earliestInfluenceMs === 70 && speculation.safe,
    client,
    composition,
    horizon,
    speculation,
    baselines: fairArchitectureBaselines(),
  };
}
