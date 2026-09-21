export const CHARACTER_MODEL_WRAPPER_VERSION = 1;

function required(value, field) {
  if (value == null) throw new TypeError(`${field} is required`);
  return value;
}

function resolveValue(value) {
  return typeof value === 'function' ? value() : value;
}

function currentActor(source) {
  const actor = resolveValue(source);
  if (!actor || !actor.root || !actor.bones || typeof actor.sample !== 'function') {
    throw new TypeError('character model wrapper requires a compatible actor');
  }
  return actor;
}

function currentAdapter(source) {
  const adapter = resolveValue(source);
  if (!adapter || adapter.schema !== 'soul.character-runtime-adapter' || typeof adapter.resolveMotion !== 'function') {
    throw new TypeError('character model wrapper requires a character runtime adapter');
  }
  return adapter;
}

function currentModelId(source, actor) {
  const modelId = resolveValue(source);
  if (typeof modelId === 'string' && modelId.trim()) return modelId.trim();
  const stamped = actor?.root?.userData?.characterModel;
  return typeof stamped === 'string' && stamped.trim() ? stamped.trim() : null;
}

function stampMotion(actor, resolved) {
  if (!actor.root.userData) actor.root.userData = {};
  actor.root.userData.characterRuntimeState = resolved.requestedState;
  actor.root.userData.characterRuntimeMotion = resolved.resolvedState;
  actor.root.userData.characterRuntimeRoute = resolved.route;
}

export function createCharacterModelWrapper({
  actor,
  adapter,
  modelId = null,
  motionDriver = null
} = {}) {
  required(actor, 'actor');
  required(adapter, 'adapter');
  if (motionDriver != null && typeof motionDriver !== 'function') {
    throw new TypeError('character model wrapper motionDriver must be a function');
  }

  const getActor = () => currentActor(actor);
  const getAdapter = () => currentAdapter(adapter);

  function resolveSocket(socket) {
    const runtime = getAdapter();
    return runtime.geometry?.sockets?.[socket] || socket;
  }

  function getBone(slot) {
    const target = getActor();
    const direct = target.bones[slot];
    if (direct) return direct;
    const socketBone = resolveSocket(slot);
    return target.bones[socketBone] || null;
  }

  function requestMotion(state, options = {}) {
    const target = getActor();
    const runtime = getAdapter();
    const resolved = runtime.resolveMotion(state);
    stampMotion(target, resolved);
    if (options.clip !== undefined) target.setClip?.(options.clip);
    motionDriver?.(Object.freeze({
      actor: target,
      modelId: currentModelId(modelId, target),
      adapter: runtime,
      ...resolved
    }), options);
    return resolved;
  }

  function attachEquipment(key, object, options = {}) {
    const target = getActor();
    if (typeof target.attachWeapon !== 'function') {
      throw new TypeError('character actor does not support equipment attachments');
    }
    const socket = options.socket || key;
    const bone = options.bone || resolveSocket(socket);
    const { socket: _socket, ...transform } = options;
    return target.attachWeapon(key, object, { ...transform, bone });
  }

  const wrapper = {
    schema: 'soul.character-model-wrapper',
    version: CHARACTER_MODEL_WRAPPER_VERSION,
    get id() { return getActor().id; },
    get modelId() { const target = getActor(); return currentModelId(modelId, target); },
    get adapter() { return getAdapter(); },
    get root() { return getActor().root; },
    get visual() { return getActor().visual; },
    get bones() { return getActor().bones; },
    get attachments() { return getActor().attachments; },
    get motionRest() { return getActor().motionRest; },
    resolveMotion(state) { return getAdapter().resolveMotion(state); },
    requestMotion,
    play(state, options = {}) { return requestMotion(state, options); },
    getBone,
    setClip(...args) { return getActor().setClip?.(...args); },
    sample(...args) { return getActor().sample(...args); },
    attachEquipment,
    detachEquipment(key) { return getActor().detachWeapon?.(key) ?? null; },
    attachWeapon(...args) { return getActor().attachWeapon?.(...args); },
    detachWeapon(...args) { return getActor().detachWeapon?.(...args); },
    updateAttachments(...args) { return getActor().updateAttachments?.(...args); },
    setVisible(...args) { return getActor().setVisible?.(...args); },
    reset(...args) { return getActor().reset?.(...args); }
  };
  return Object.freeze(wrapper);
}
