import { checksum, peerId, random, STEP_MS } from './config.js';

const PERIOD = 480;
const coordinate = phase => (phase <= PERIOD / 2 ? phase : PERIOD - phase) / 20 - 6;
export function makeWorld(config) {
  const rng = random(config.seed);
  const make = (id, cell, kind) => ({ id, cell, kind, phase: Math.floor(rng() * PERIOD), initialPhase: 0, speed: 1 + Math.floor(rng() * 3), z: Math.round((rng() * 12 - 6) * 20) / 20, lastTick: 0 });
  const players = Array.from({ length: config.peers }, (_, i) => make(peerId(i), config.layout === 'dense' ? 0 : i % 3, 'player'));
  const npcs = Array.from({ length: 18 }, (_, i) => make(`n${i}`, Math.floor(i / 6), 'npc'));
  for (const a of [...players, ...npcs]) a.initialPhase = a.phase;
  return { tick: 0, players, npcs, materialized: [true, true, true], updates: 0, collapses: 0 };
}
export function advanceActor(actor, tick) {
  actor.phase = (actor.phase + (tick - actor.lastTick) * actor.speed) % PERIOD;
  actor.lastTick = tick;
}
export function actorState(actor) {
  return { id: actor.id, cell: actor.cell, x: actor.cell * 240 + coordinate(actor.phase), z: actor.z, state: actor.kind, hp: 100 };
}
export function stepWorld(world, mode, alive, scenario) {
  world.tick += 1;
  if (scenario === 'collapse') {
    const t = world.tick * STEP_MS;
    world.players.at(-1).cell = t >= 6000 && t < 10000 || t >= 14000 ? 2 : 0;
  }
  for (const a of world.players) { advanceActor(a, world.tick); world.updates += 1; }
  for (let cell = 0; cell < 3; cell += 1) {
    const observed = world.players.some(p => p.cell === cell && alive.has(p.id));
    const active = mode !== 'cells' || observed;
    if (active && !world.materialized[cell]) world.collapses += 1;
    world.materialized[cell] = active;
    if (active) for (const a of world.npcs.filter(n => n.cell === cell)) { advanceActor(a, world.tick); world.updates += 1; }
  }
}
export function visibleActors(world, alive) {
  return [...world.players.filter(p => alive.has(p.id)), ...world.npcs.filter(n => world.materialized[n.cell])].map(actorState);
}
export function snapshotWorld(world) {
  return { tick: world.tick, players: structuredClone(world.players), npcs: structuredClone(world.npcs), materialized: [...world.materialized] };
}
export function restoreWorld(world, snapshot) {
  Object.assign(world, structuredClone(snapshot));
}
export function worldRoot(world) {
  // A cold cell can be queried without mutating the live model or counting fictional simulation work.
  const actors = [...world.players, ...world.npcs].map(a => {
    const copy = { ...a }; advanceActor(copy, world.tick); return actorState(copy);
  });
  return checksum({ tick: world.tick, actors });
}
export function verifyCollapse(world) {
  return world.npcs.every(a => {
    const fast = { ...a }; advanceActor(fast, world.tick);
    const slow = { ...a, phase: a.initialPhase, lastTick: 0 };
    for (let tick = 1; tick <= world.tick; tick += 1) { slow.phase = (slow.phase + slow.speed) % PERIOD; slow.lastTick = tick; }
    return checksum(actorState(fast)) === checksum(actorState(slow));
  });
}
