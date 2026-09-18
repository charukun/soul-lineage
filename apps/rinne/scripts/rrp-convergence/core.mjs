import { createHash } from 'node:crypto';

export const clone = value => structuredClone(value);
export function canonical(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  throw new TypeError('unsupported canonical value');
}
export const digest = value => createHash('sha256').update(canonical(value)).digest('hex');
export const bytes = value => new TextEncoder().encode(JSON.stringify(value)).byteLength;

function operationBody(event) {
  const { seq: _seq, ...body } = event;
  return body;
}
export const operationDigest = event => digest(operationBody(event));

export function lineageRecord(life) {
  return {
    generation: life.generation,
    name: life.name,
    age: Math.floor(life.ageYears),
    birthVillageId: life.birthVillageId,
    returnedHome: life.returns > 0,
    memento: null,
    defeats: life.defeats,
    equipment: clone(life.equipment),
    experiences: clone(life.experiences),
    skills: [...life.knownSkills],
  };
}

export function lifePatch(life) {
  // Recovery-relevant actor state at a protected boundary. It is deliberately
  // larger than lineageRecord because future rebirth depends on seed/homelands
  // and the next life must not be reconstructed from a stale provisional copy.
  return {
    id: life.id,
    name: life.name,
    seed: life.seed,
    generation: life.generation,
    ended: life.ended,
    phase: life.phase,
    birthVillageId: life.birthVillageId,
    homelands: [...life.homelands],
    lineage: clone(life.lineage),
    ageSeconds: life.ageSeconds,
    ageYears: life.ageYears,
    returns: life.returns,
    defeats: life.defeats,
    equipment: clone(life.equipment),
    experiences: clone(life.experiences),
    knownSkills: [...life.knownSkills],
  };
}

export function actorRecoveryState(life) {
  // A new participant can be absent from an older provisional checkpoint. Birth
  // therefore carries one actor's complete initial serialized shape.
  return clone(life);
}

export function terminalLifePatch(life) {
  // The lineage prefix is already represented by previous canon events. Do not
  // resend it at every life boundary; appendKernel preserves that prefix.
  const patch = lifePatch(life);
  delete patch.lineage;
  return patch;
}

export function rebirthRecoveryState(life) {
  // Rebirth carries the new actor's runtime initialization, but the new lineage
  // is derived from previous lineage + the one terminal record in this event.
  const actor = actorRecoveryState(life);
  delete actor.lineage;
  return actor;
}

export function emptyKernel({ worldId, ownerId, epoch = 1 }) {
  if (typeof worldId !== 'string' || typeof ownerId !== 'string' || !Number.isSafeInteger(epoch) || epoch < 1) throw Error('invalid empty kernel');
  return { worldId, ownerId, epoch, seq: 0, root: 'genesis', roots: [], players: {}, rebirthOps: {}, opDigests: {}, history: [] };
}

export function syntheticLife(playerId, generation = 1) {
  const skills = ['basic.fist', 'basic.sword', 'basic.balance'];
  return {
    schemaVersion: 2,
    id: `${playerId}:${generation}`,
    name: `旅人${playerId}`,
    seed: 1000 + generation + playerId.length,
    generation,
    phase: 'living',
    zone: 'village',
    front: 0,
    ended: false,
    birthVillageId: 'village-a',
    homelands: generation > 1 ? ['village-a'] : [],
    ageSeconds: 1200,
    ageYears: 20,
    position: { x: generation * 1.25, z: -generation * 0.75 },
    yaw: 1.2,
    moving: false,
    hp: 91,
    maxHp: 100,
    stamina: 82,
    staminaCap: 96,
    equipment: { weapon: 'sword', armor: 'light', shield: false },
    knownSkills: [...skills],
    skillWeights: { jo: { 'basic.fist': 100, 'basic.sword': 40 }, ha: {}, kyu: {} },
    experiences: { train: { count: 4, score: 3.31, last: 1195 }, return: { count: 1, score: 1, last: 900 } },
    experienceRecent: { train: 1195 },
    pendingDiscoveries: [],
    activity: null,
    combat: null,
    defeats: 7,
    returns: generation > 1 ? 1 : 0,
    history: [],
    lineage: generation > 1 ? [{ generation: generation - 1, name: `旅人${playerId}`, age: 100, birthVillageId: 'village-a', returnedHome: true, memento: null, defeats: 9, equipment: { weapon: 'sword', armor: 'light', shield: false }, experiences: {}, skills }] : [],
    events: [],
  };
}

export function syntheticWorld(players = 30) {
  const rows = {};
  for (let i = 0; i < players; i++) {
    const id = i === 0 ? 'owner' : `p${i}`;
    rows[id] = { token: `resume-${id}-${'x'.repeat(18)}`, portDwell: 0, life: syntheticLife(id) };
  }
  return {
    version: 1,
    worldId: 'world-a',
    ownerId: 'owner',
    epoch: 1,
    tick: 1000,
    worldSeconds: 50,
    clockRate: 1,
    players: rows,
    fronts: {
      0: { stage: 0, cleared: false, elapsed: 12.3, enemies: Array.from({ length: 6 }, (_, i) => ({ id: `e${i}`, hp: 30 - i, x: i * 0.7, z: -i, cooldown: 0.5 + i / 10 })) },
    },
    rebirthOps: {},
  };
}
