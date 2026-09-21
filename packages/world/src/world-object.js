const VECTOR_KEYS = ['position', 'rotation', 'scale'];

function finiteVector(value, fallback) {
  const source = value ?? fallback;
  if (!Array.isArray(source) || source.length !== 3 || !source.every(Number.isFinite)) {
    throw new TypeError('WorldObject vectors must contain exactly three finite numbers');
  }
  return [...source];
}

function clone(value) {
  return value == null ? value : structuredClone(value);
}

function normalizePoint(point, label) {
  if (!point || typeof point !== 'object') throw new TypeError(`${label} must be an object`);
  return {
    ...clone(point),
    position: finiteVector(point.position, [0, 0, 0]),
    rotation: finiteVector(point.rotation, [0, 0, 0])
  };
}

function normalizeComponents(components = {}) {
  if (!components || typeof components !== 'object' || Array.isArray(components)) {
    throw new TypeError('WorldObject components must be an object');
  }

  const normalized = clone(components);

  if (normalized.placeable) {
    const footprint = normalized.placeable.footprint;
    if (!Array.isArray(footprint) || footprint.length !== 2 || !footprint.every(Number.isFinite)) {
      throw new TypeError('placeable.footprint must be [width, depth]');
    }
    normalized.placeable.footprint = [...footprint];
    normalized.placeable.snapPoints = (normalized.placeable.snapPoints ?? []).map((point, index) =>
      normalizePoint(point, `placeable.snapPoints[${index}]`)
    );
  }

  if (normalized.interactable) {
    const actions = normalized.interactable.actions ?? [];
    if (!Array.isArray(actions) || actions.some(action => typeof action !== 'string' || !action)) {
      throw new TypeError('interactable.actions must be an array of non-empty strings');
    }
    normalized.interactable.actions = [...new Set(actions)];
    normalized.interactable.points = (normalized.interactable.points ?? []).map((point, index) => ({
      ...normalizePoint(point, `interactable.points[${index}]`),
      action: point.action ?? null,
      id: point.id ?? `point-${index}`
    }));
  }

  if (normalized.enterable) {
    const entrances = normalized.enterable.entrances ?? [];
    if (!Array.isArray(entrances) || entrances.length === 0) {
      throw new TypeError('enterable.entrances must contain at least one entrance');
    }
    const ids = new Set();
    normalized.enterable.entrances = entrances.map((entrance, index) => {
      const id = entrance.id ?? (index === 0 ? 'front' : `entrance-${index}`);
      if (ids.has(id)) throw new TypeError(`Duplicate entrance id: ${id}`);
      ids.add(id);
      return {
        ...clone(entrance),
        id,
        outside: normalizePoint(entrance.outside, `enterable.entrances[${index}].outside`),
        inside: normalizePoint(entrance.inside, `enterable.entrances[${index}].inside`)
      };
    });
  }

  return normalized;
}

export function defineWorldObject(definition) {
  if (!definition || typeof definition !== 'object') throw new TypeError('WorldObject definition is required');
  if (!definition.kind || typeof definition.kind !== 'string') throw new TypeError('WorldObject kind is required');

  const transform = {
    position: finiteVector(definition.transform?.position, [0, 0, 0]),
    rotation: finiteVector(definition.transform?.rotation, [0, 0, 0]),
    scale: finiteVector(definition.transform?.scale, [1, 1, 1])
  };

  return Object.freeze({
    schemaVersion: 1,
    id: definition.id ?? null,
    kind: definition.kind,
    assetId: definition.assetId ?? null,
    transform: Object.freeze(transform),
    components: Object.freeze(normalizeComponents(definition.components)),
    metadata: Object.freeze(clone(definition.metadata ?? {}))
  });
}

function copyTransform(transform) {
  return Object.fromEntries(VECTOR_KEYS.map(key => [key, [...transform[key]]]));
}

export function createWorldObject(definition, initialState = {}) {
  const spec = defineWorldObject(definition);
  const runtime = {
    transform: copyTransform(spec.transform),
    placed: Boolean(initialState.placed),
    interior: initialState.interior ?? null,
    doorStates: { ...(initialState.doorStates ?? {}) }
  };

  const component = name => spec.components[name] ?? null;

  const requireComponent = name => {
    const value = component(name);
    if (!value) throw new Error(`WorldObject "${spec.kind}" does not support ${name}`);
    return value;
  };

  const entrance = (id = 'front') => {
    const enterable = requireComponent('enterable');
    const found = enterable.entrances.find(item => item.id === id);
    if (!found) throw new Error(`Unknown entrance: ${id}`);
    return clone(found);
  };

  return {
    spec,
    state: runtime,
    has: name => Boolean(component(name)),
    component: name => clone(component(name)),
    setTransform(next = {}) {
      for (const key of VECTOR_KEYS) {
        if (next[key] !== undefined) runtime.transform[key] = finiteVector(next[key], runtime.transform[key]);
      }
      return copyTransform(runtime.transform);
    },
    place(next = {}) {
      requireComponent('placeable');
      this.setTransform(next);
      runtime.placed = true;
      return copyTransform(runtime.transform);
    },
    unplace() {
      requireComponent('placeable');
      runtime.placed = false;
    },
    resolveEntrance: entrance,
    enter(id = 'front') {
      const target = entrance(id);
      runtime.interior = { entranceId: target.id, destination: target.destination ?? spec.id ?? spec.kind };
      return { type: 'enter', entranceId: target.id, destination: runtime.interior.destination, transform: clone(target.inside) };
    },
    exit(id = runtime.interior?.entranceId ?? 'front') {
      const target = entrance(id);
      runtime.interior = null;
      return { type: 'exit', entranceId: target.id, destination: target.destination ?? spec.id ?? spec.kind, transform: clone(target.outside) };
    },
    canInteract(action) {
      const interactable = component('interactable');
      return Boolean(interactable?.actions?.includes(action));
    },
    interactionPoint(action, id = null) {
      const interactable = requireComponent('interactable');
      const matches = interactable.points.filter(point => !point.action || point.action === action);
      const found = id ? matches.find(point => point.id === id) : matches[0];
      return found ? clone(found) : null;
    },
    setDoorOpen(id = 'front', open = true) {
      entrance(id);
      runtime.doorStates[id] = Boolean(open);
      return runtime.doorStates[id];
    },
    snapshot() {
      return {
        schemaVersion: 1,
        id: spec.id,
        kind: spec.kind,
        transform: copyTransform(runtime.transform),
        placed: runtime.placed,
        interior: clone(runtime.interior),
        doorStates: { ...runtime.doorStates }
      };
    }
  };
}

export function createBuildingObject({
  id = null,
  kind = 'building',
  assetId = null,
  transform,
  footprint,
  entrances,
  actions = ['enter', 'exit'],
  interactionPoints = [],
  housing = {},
  collision = {},
  metadata = {}
}) {
  return createWorldObject({
    id,
    kind,
    assetId,
    transform,
    metadata,
    components: {
      collision: { shape: 'footprint', ...collision },
      placeable: { footprint, snapPoints: [] },
      interactable: { actions, points: interactionPoints },
      enterable: { entrances },
      housing: clone(housing)
    }
  });
}

export function createPlaceableObject({
  id = null,
  kind,
  assetId = null,
  transform,
  footprint,
  actions = [],
  interactionPoints = [],
  placement = {},
  metadata = {}
}) {
  return createWorldObject({
    id,
    kind,
    assetId,
    transform,
    metadata,
    components: {
      collision: { shape: 'footprint' },
      placeable: { footprint, snapPoints: [], ...clone(placement) },
      interactable: { actions, points: interactionPoints }
    }
  });
}
