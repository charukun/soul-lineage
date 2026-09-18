import { actorRecoveryState, canonical, clone, digest, emptyKernel, lifePatch, lineageRecord, operationDigest } from './core.mjs';

function ensureEventShape(event) {
  if (!event || !Number.isSafeInteger(event.seq) || event.seq < 1 || typeof event.type !== 'string' || typeof event.opId !== 'string') throw Error('invalid event');
}

export function genesisKernel(world) {
  const players = {};
  const history = [];
  let seq = 0;
  for (const [playerId, row] of Object.entries(world.players).sort(([a], [b]) => a.localeCompare(b))) {
    const life = lifePatch(row.life);
    const event = { seq: ++seq, type: 'birth', opId: `birth:${life.id}`, playerId, life, actor: actorRecoveryState(row.life), epoch: world.epoch };
    history.push(event);
    players[playerId] = { life: actorRecoveryState(row.life), sealed: false };
  }
  const roots = [];
  let root = 'genesis';
  for (const event of history) { root = digest({ previous: root, event }); roots.push(root); }
  return { worldId: world.worldId, ownerId: world.ownerId, epoch: world.epoch, seq, root, roots, players, rebirthOps: {}, opDigests: Object.fromEntries(history.map(event => [event.opId, operationDigest(event)])), history };
}

export function appendKernel(kernel, rawEvent, mutation = 'none') {
  const next = clone(kernel);
  const event = clone(rawEvent);
  ensureEventShape(event);
  next.opDigests ??= Object.fromEntries(next.history.map(row => [row.opId, operationDigest(row)]));
  const opHash = operationDigest(event);
  if (Object.hasOwn(next.opDigests, event.opId)) {
    if (next.opDigests[event.opId] !== opHash) throw Error('operation id conflict');
    return next;
  }
  if (event.seq !== next.seq + 1) throw Error('non-contiguous canon sequence');
  if (mutation !== 'ignore-epoch' && event.epoch !== next.epoch && event.type !== 'epoch-acquire') throw Error('stale epoch');
  if (event.type === 'epoch-acquire') {
    if (event.fromEpoch !== next.epoch || event.toEpoch !== next.epoch + 1) throw Error('invalid epoch transition');
    next.epoch = event.toEpoch;
  } else if (event.type === 'birth') {
    if (next.players[event.playerId]) throw Error('duplicate player birth');
    if (event.life.generation !== 1 || event.life.id !== `${event.playerId}:1`) throw Error('invalid birth identity');
    if (!event.actor || canonical(lifePatch(event.actor)) !== canonical(event.life)) throw Error('birth recovery state mismatch');
    next.players[event.playerId] = { life: clone(event.actor), sealed: Boolean(event.life.ended) };
  } else if (event.type === 'life-seal') {
    const row = next.players[event.playerId];
    if (!row || row.life.id !== event.lifeId || row.sealed) throw Error('invalid life seal');
    if (!event.patch?.ended || event.patch.id !== event.lifeId || event.record.generation !== event.patch.generation) throw Error('invalid terminal patch');
    if (Object.hasOwn(event.patch, 'lineage')) throw Error('terminal patch must not repeat lineage prefix');
    if (mutation === 'drop-rebirth-deps') {
      delete event.patch.seed;
      event.patch.homelands = [];
    }
    const merged = { ...clone(row.life), ...clone(event.patch), lineage: clone(row.life.lineage) };
    if (canonical(lineageRecord(merged)) !== canonical(event.record)) throw Error('lineage record mismatch');
    row.life = merged; row.sealed = true;
  } else if (event.type === 'rebirth') {
    const row = next.players[event.playerId];
    if (!row || !row.sealed || row.life.id !== event.previousLifeId) throw Error('predecessor not sealed');
    const prior = next.rebirthOps[event.previousLifeId];
    if (prior && canonical(prior) !== canonical(event.intent)) throw Error('rebirth op conflict');
    if (!event.actor || Object.hasOwn(event.actor, 'lineage') || event.actor.id !== event.resultLifeId || event.actor.generation !== row.life.generation + 1) throw Error('invalid rebirth recovery state');
    const rebuilt = { ...clone(event.actor), lineage: [...clone(row.life.lineage), clone(event.record)] };
    if (rebuilt.id !== event.resultLifeId || rebuilt.generation !== row.life.generation + 1) throw Error('invalid rebirth identity');
    if (mutation !== 'forget-rebirth-op') next.rebirthOps[event.previousLifeId] = clone(event.intent);
    row.life = rebuilt; row.sealed = false;
  } else throw Error('unknown canon event');
  next.seq = event.seq;
  next.history.push(event);
  if (mutation !== 'drop-compaction-dedupe') next.opDigests[event.opId] = opHash;
  const previous = next.root;
  next.root = digest({ previous, event });
  next.roots[event.seq - 1] = next.root;
  return next;
}

export function createProtectedSnapshot(kernel, provisionalWorld = null, mutation = 'none') {
  const canonicalProjection = protectedProjectionFromKernel(kernel);
  const projection = mutation === 'compact-from-provisional' && provisionalWorld
    ? protectedProjectionFromWorld(provisionalWorld, kernel)
    : canonicalProjection;
  const body = {
    format: 1,
    baseSeq: kernel.seq,
    baseRoot: kernel.root,
    worldId: kernel.worldId,
    ownerId: kernel.ownerId,
    epoch: projection.epoch,
    players: clone(projection.players),
    rebirthOps: clone(projection.rebirthOps),
    opDigests: mutation === 'drop-compaction-dedupe' ? {} : clone(kernel.opDigests ?? {}),
  };
  return { ...body, snapshotRoot: digest(body) };
}

export function recoverProtectedSnapshot(rawSnapshot, suffixEvents = [], mutation = 'none') {
  if (!rawSnapshot || rawSnapshot.format !== 1 || !Number.isSafeInteger(rawSnapshot.baseSeq) || rawSnapshot.baseSeq < 0 ||
      typeof rawSnapshot.baseRoot !== 'string' || typeof rawSnapshot.snapshotRoot !== 'string') throw Error('invalid protected snapshot');
  const { snapshotRoot, ...body } = rawSnapshot;
  if (digest(body) !== snapshotRoot) throw Error('protected snapshot integrity mismatch');
  let kernel = {
    worldId: body.worldId,
    ownerId: body.ownerId,
    epoch: body.epoch,
    seq: body.baseSeq,
    root: body.baseRoot,
    roots: [],
    players: Object.fromEntries(Object.entries(body.players ?? {}).map(([id, row]) => [id, { life: clone(row.life), sealed: Boolean(row.sealed) }])),
    rebirthOps: clone(body.rebirthOps ?? {}),
    opDigests: clone(body.opDigests ?? {}),
    history: [],
  };
  for (const event of suffixEvents) {
    if (event.seq <= body.baseSeq) continue;
    kernel = appendKernel(kernel, event, mutation);
  }
  return kernel;
}

export function compactProtectedJournal(journal, uptoSeq = journal.seq, provisionalWorld = null, mutation = 'none') {
  const prefix = replayProtectedJournal(journal, uptoSeq);
  const protectedSnapshot = createProtectedSnapshot(prefix, provisionalWorld, mutation);
  const suffix = journal.history.filter(event => event.seq > uptoSeq).map(clone);
  return { protectedSnapshot, suffix };
}

export function protectedProjectionFromKernel(kernel) {
  return {
    worldId: kernel.worldId,
    ownerId: kernel.ownerId,
    epoch: kernel.epoch,
    seq: kernel.seq,
    players: Object.fromEntries(Object.entries(kernel.players).sort(([a], [b]) => a.localeCompare(b)).map(([id, row]) => [id, {
      life: lifePatch(row.life),
      sealed: row.sealed,
    }])),
    rebirthOps: clone(kernel.rebirthOps),
  };
}

export function snapshot(world, kernel) {
  return { baseSeq: kernel.seq, baseRoot: kernel.root, world: clone(world) };
}

export function replayProtectedJournal(journal, uptoSeq = journal.seq) {
  if (!journal || !Number.isSafeInteger(uptoSeq) || uptoSeq < 0 || uptoSeq > journal.seq) throw Error('bad journal prefix');
  const first = journal.history.find(event => event.type !== 'epoch-acquire');
  const initialEpoch = first?.epoch ?? 1;
  let replayed = emptyKernel({ worldId: journal.worldId, ownerId: journal.ownerId, epoch: initialEpoch });
  for (const event of journal.history) {
    if (event.seq > uptoSeq) break;
    replayed = appendKernel(replayed, event);
    const expected = journal.roots[event.seq - 1];
    if (expected && replayed.root !== expected) throw Error('journal root mismatch');
  }
  if (replayed.seq !== uptoSeq) throw Error('journal prefix incomplete');
  return replayed;
}

function overlayProtected(world, kernel, mutation = 'none') {
  world.players ??= {};
  if (mutation !== 'trust-snapshot-protected') {
    for (const id of Object.keys(world.players)) if (!kernel.players[id]) delete world.players[id];
  }
  for (const [id, canonicalRow] of Object.entries(kernel.players)) {
    let row = world.players[id];
    if (!row) row = world.players[id] = { token: null, portDwell: 0, life: clone(canonicalRow.life) };
    if (mutation !== 'trust-snapshot-protected') {
      const current = row.life && typeof row.life === 'object' ? row.life : {};
      // A generation change needs the full creation-state from the journal; for
      // the same incarnation retain snapshot-only provisional fields and overlay
      // only protected semantics.
      row.life = current.id && current.id === canonicalRow.life.id
        ? { ...current, ...lifePatch(canonicalRow.life) }
        : clone(canonicalRow.life);
    }
  }
  if (mutation !== 'trust-snapshot-protected') world.rebirthOps = clone(kernel.rebirthOps);
  world.epoch = kernel.epoch;
  return world;
}

export function recoverSnapshot(rawSnapshot, journal, mutation = 'none') {
  if (!rawSnapshot || !Number.isSafeInteger(rawSnapshot.baseSeq) || rawSnapshot.baseSeq < 0 || rawSnapshot.baseSeq > journal.seq) throw Error('bad snapshot');
  const bySeq = new Map([[0, 'genesis']]);
  for (const entry of journal.history) bySeq.set(entry.seq, journal.roots[entry.seq - 1]);
  if (mutation !== 'ignore-snapshot-root' && bySeq.get(rawSnapshot.baseSeq) !== rawSnapshot.baseRoot) throw Error('snapshot not bound to canon prefix');
  const prefix = replayProtectedJournal(journal, rawSnapshot.baseSeq);
  if (mutation !== 'ignore-snapshot-root' && prefix.root !== rawSnapshot.baseRoot) throw Error('snapshot prefix root mismatch');
  // Snapshot contents are only provisional material. Rebuild the protected plane
  // from the strong journal itself; otherwise a valid prefix label on stale or
  // corrupted protected fields would make the checkpoint authoritative by accident.
  const finalKernel = replayProtectedJournal(journal, journal.seq);
  return overlayProtected(clone(rawSnapshot.world), finalKernel, mutation);
}

export function protectedProjectionFromWorld(world, journal) {
  return {
    worldId: world.worldId,
    ownerId: world.ownerId,
    epoch: world.epoch,
    seq: journal.seq,
    players: Object.fromEntries(Object.entries(world.players).sort(([a], [b]) => a.localeCompare(b)).map(([id, row]) => {
      const kernelRow = journal.players[id];
      return [id, { life: lifePatch(row.life), sealed: Boolean(kernelRow?.sealed) }];
    })),
    rebirthOps: clone(world.rebirthOps ?? {}),
  };
}
