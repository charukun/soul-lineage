export const CHARACTER_RUNTIME_CONTRACT_VERSION = 1;

export const CHARACTER_RUNTIME_STATES = Object.freeze({
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  DASH: 'dash',
  REST: 'rest',
  COMBAT_IDLE: 'combat-idle',
  ATTACK: 'attack',
  HIT: 'hit',
  DEATH: 'death'
});

export const CHARACTER_RUNTIME_STATE_IDS = Object.freeze(Object.values(CHARACTER_RUNTIME_STATES));

const DEFAULT_FALLBACKS = Object.freeze({
  [CHARACTER_RUNTIME_STATES.DASH]: Object.freeze([CHARACTER_RUNTIME_STATES.RUN, CHARACTER_RUNTIME_STATES.WALK, CHARACTER_RUNTIME_STATES.IDLE]),
  [CHARACTER_RUNTIME_STATES.REST]: Object.freeze([CHARACTER_RUNTIME_STATES.IDLE]),
  [CHARACTER_RUNTIME_STATES.COMBAT_IDLE]: Object.freeze([CHARACTER_RUNTIME_STATES.IDLE]),
  [CHARACTER_RUNTIME_STATES.ATTACK]: Object.freeze([CHARACTER_RUNTIME_STATES.COMBAT_IDLE, CHARACTER_RUNTIME_STATES.IDLE]),
  [CHARACTER_RUNTIME_STATES.HIT]: Object.freeze([CHARACTER_RUNTIME_STATES.COMBAT_IDLE, CHARACTER_RUNTIME_STATES.IDLE]),
  [CHARACTER_RUNTIME_STATES.DEATH]: Object.freeze([CHARACTER_RUNTIME_STATES.IDLE])
});

const AXES = new Set(['x', '-x', 'y', '-y', 'z', '-z']);
const FORMATS = new Set(['glb', 'gltf', 'vrm', 'procedural']);

function assertNonEmpty(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw new TypeError(`${field} must be a non-empty string`);
  return value.trim();
}

function freezeRecord(value = {}) {
  return Object.freeze({ ...value });
}

function normalizeGeometry(geometry = {}) {
  const upAxis = geometry.upAxis || 'y';
  const forwardAxis = geometry.forwardAxis || '-z';
  if (!AXES.has(upAxis) || !AXES.has(forwardAxis) || upAxis.replace('-', '') === forwardAxis.replace('-', '')) {
    throw new TypeError('character runtime axes must be valid and orthogonal');
  }
  const collider = Object.freeze({
    shape: geometry.collider?.shape || 'capsule',
    radiusRatio: Number.isFinite(geometry.collider?.radiusRatio) ? geometry.collider.radiusRatio : 0.24,
    heightRatio: Number.isFinite(geometry.collider?.heightRatio) ? geometry.collider.heightRatio : 0.9
  });
  if (collider.shape !== 'capsule' || collider.radiusRatio <= 0 || collider.heightRatio <= 0) {
    throw new TypeError('character runtime collider must be a positive capsule ratio');
  }
  return Object.freeze({
    upAxis,
    forwardAxis,
    origin: geometry.origin || 'feet',
    scaleMode: geometry.scaleMode || 'native',
    collider,
    sockets: Object.freeze({
      weapon: geometry.sockets?.weapon || 'rightHand',
      offhand: geometry.sockets?.offhand || 'leftHand',
      head: geometry.sockets?.head || 'head'
    })
  });
}

function normalizeMotionMap(motion = {}) {
  const normalized = {};
  for (const state of CHARACTER_RUNTIME_STATE_IDS) {
    const token = motion[state];
    if (token == null) continue;
    normalized[state] = assertNonEmpty(token, `motion.${state}`);
  }
  if (!normalized[CHARACTER_RUNTIME_STATES.IDLE]) throw new TypeError('character runtime adapter requires an idle motion route');
  return Object.freeze(normalized);
}

function normalizeFallbacks(fallbacks = {}) {
  const normalized = {};
  for (const state of CHARACTER_RUNTIME_STATE_IDS) {
    const configured = fallbacks[state];
    const requested = Array.isArray(configured) ? configured : DEFAULT_FALLBACKS[state] || [];
    normalized[state] = Object.freeze(requested.filter(candidate => CHARACTER_RUNTIME_STATE_IDS.includes(candidate)));
  }
  return Object.freeze(normalized);
}

export function resolveCharacterRuntimeState(input = {}) {
  if (input.dead) return CHARACTER_RUNTIME_STATES.DEATH;
  if (input.hit) return CHARACTER_RUNTIME_STATES.HIT;
  if (input.attacking) return CHARACTER_RUNTIME_STATES.ATTACK;
  if (input.resting) return CHARACTER_RUNTIME_STATES.REST;
  if (input.dashing) return CHARACTER_RUNTIME_STATES.DASH;
  if (input.moving) {
    const speed = Math.max(0, Number(input.speed) || 0);
    const runThreshold = Math.max(0, Number(input.runThreshold) || 3);
    return speed >= runThreshold ? CHARACTER_RUNTIME_STATES.RUN : CHARACTER_RUNTIME_STATES.WALK;
  }
  if (input.combat) return CHARACTER_RUNTIME_STATES.COMBAT_IDLE;
  return CHARACTER_RUNTIME_STATES.IDLE;
}

export function isCharacterLocomotionState(state) {
  return state === CHARACTER_RUNTIME_STATES.WALK || state === CHARACTER_RUNTIME_STATES.RUN || state === CHARACTER_RUNTIME_STATES.DASH;
}

export function isCharacterCombatState(state) {
  return state === CHARACTER_RUNTIME_STATES.COMBAT_IDLE || state === CHARACTER_RUNTIME_STATES.ATTACK || state === CHARACTER_RUNTIME_STATES.HIT;
}

export function createCharacterRuntimeAdapter(config = {}) {
  const id = assertNonEmpty(config.id, 'id');
  const family = assertNonEmpty(config.family, 'family');
  const rigFamily = assertNonEmpty(config.rigFamily, 'rigFamily');
  const format = assertNonEmpty(config.format, 'format').toLowerCase();
  if (!FORMATS.has(format)) throw new TypeError(`unsupported character runtime format: ${format}`);
  const asset = Object.freeze({
    id: assertNonEmpty(config.asset?.id || family, 'asset.id'),
    url: typeof config.asset?.url === 'string' && config.asset.url.trim() ? config.asset.url.trim() : null,
    provenance: freezeRecord(config.asset?.provenance)
  });
  const geometry = normalizeGeometry(config.geometry);
  const motion = normalizeMotionMap(config.motion);
  const fallbacks = normalizeFallbacks(config.fallbacks);

  function resolveMotion(requestedState) {
    const state = CHARACTER_RUNTIME_STATE_IDS.includes(requestedState) ? requestedState : CHARACTER_RUNTIME_STATES.IDLE;
    if (motion[state]) return Object.freeze({ requestedState: state, resolvedState: state, route: motion[state], fallback: false });
    const queue = [...fallbacks[state]];
    const visited = new Set([state]);
    while (queue.length) {
      const candidate = queue.shift();
      if (visited.has(candidate)) continue;
      visited.add(candidate);
      if (motion[candidate]) return Object.freeze({ requestedState: state, resolvedState: candidate, route: motion[candidate], fallback: true });
      queue.push(...(fallbacks[candidate] || []));
    }
    return Object.freeze({ requestedState: state, resolvedState: CHARACTER_RUNTIME_STATES.IDLE, route: motion[CHARACTER_RUNTIME_STATES.IDLE], fallback: state !== CHARACTER_RUNTIME_STATES.IDLE });
  }

  function resolve(input = {}) {
    const state = resolveCharacterRuntimeState(input);
    return Object.freeze({ state, motion: resolveMotion(state) });
  }

  return Object.freeze({
    schema: 'soul.character-runtime-adapter',
    version: CHARACTER_RUNTIME_CONTRACT_VERSION,
    id,
    family,
    rigFamily,
    format,
    asset,
    geometry,
    motion,
    fallbacks,
    resolveState: resolveCharacterRuntimeState,
    resolveMotion,
    resolve
  });
}
