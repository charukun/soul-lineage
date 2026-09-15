import { RaidHost } from '@soul/network/raid-host';

export const AUTO_BATTLE_STEP = 1 / 30;
export const AUTO_BATTLE_IDS = Object.freeze({
  demonPeer: 'visual-review-demon',
  humanPeer: 'visual-review-human',
  demonPlayer: 'visual-review-demon-player',
  humanPlayer: 'visual-review-human-player',
});

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function actorState(player, core) {
  return {
    id: core?.id ?? player?.playerId ?? '',
    name: player?.name ?? '',
    x: Number(core?.x ?? player?.x ?? 0),
    z: Number(core?.z ?? player?.z ?? 0),
    yaw: Number(core?.yaw ?? 0),
    hp: Number(player?.hp ?? core?.hp ?? 0),
    maxhp: Number(player?.maxhp ?? core?.maxhp ?? 1),
    dead: Boolean(core?.dead || Number(player?.hp ?? 1) <= 0),
    weapon: core?.weapon ?? null,
    attack: core?.attack ?? null,
    progress: Number(core?.progress ?? 0),
    guarding: Boolean(core?.guarding),
    combatReady: Boolean(core?.combatReady),
    stun: Number(core?.stun ?? 0),
    skill: core?.skill ?? null,
  };
}

export function createTidebreakBattleSession({
  villageId = 'visual-review-lab',
  demonName = '魔物側',
  humanName = '人間側',
} = {}) {
  const storage = memoryStorage();
  let elapsed = 0;
  const host = new RaidHost({
    villageId,
    storage,
    now: () => Math.round(elapsed * 1000),
  });
  const ids = AUTO_BATTLE_IDS;

  host.join(ids.demonPeer, {
    type: 'join', role: 'demon', playerId: ids.demonPlayer, name: demonName,
  });
  host.join(ids.humanPeer, {
    type: 'join', role: 'human', playerId: ids.humanPlayer, name: humanName,
  });
  host.input(ids.demonPeer, { type: 'state', x: -1.45, z: 0 });
  host.input(ids.humanPeer, { type: 'state', x: 1.45, z: 0 });

  let snapshot = host.tick(0);
  let lastCoreState = host.battle?.core?.state?.() ?? null;
  let sourceVersion = host.battle?.core?.sourceVersion ?? 'Tidebreak';

  function current() {
    const liveCore = host.battle?.core;
    if (liveCore?.state) {
      lastCoreState = liveCore.state();
      sourceVersion = liveCore.sourceVersion || sourceVersion;
    }
    const players = snapshot?.players || {};
    return {
      time: Number(snapshot?.battle?.time ?? elapsed),
      active: Boolean(snapshot?.battle),
      finished: Boolean(snapshot?.battle?.finished),
      winner: snapshot?.battle?.winner ?? null,
      sourceVersion,
      hero: actorState(players[ids.demonPeer], lastCoreState?.hero),
      enemy: actorState(players[ids.humanPeer], lastCoreState?.enemy),
      contacts: lastCoreState?.contacts || [],
      stats: lastCoreState?.stats || null,
    };
  }

  function step(dt = AUTO_BATTLE_STEP) {
    const safeDt = Math.max(0, Math.min(1 / 15, Number(dt) || 0));
    const previousCore = host.battle?.core;
    elapsed += safeDt;
    snapshot = host.tick(safeDt);
    const core = host.battle?.core || previousCore;
    if (core?.state) {
      lastCoreState = core.state();
      sourceVersion = core.sourceVersion || sourceVersion;
    }
    return current();
  }

  return { state: current, step };
}
