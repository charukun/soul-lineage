const materialRows = node => (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);

export function markLifetimeOwned(resource, owner = 'runtime') {
  if (!resource || typeof resource !== 'object') return resource;
  resource.userData = resource.userData || {};
  resource.userData.soulLifetimeOwned = true;
  resource.userData.soulLifetimeOwner = String(owner);
  return resource;
}

function resourcesForObject(root) {
  const resources = new Set();
  root?.traverse?.(node => {
    if (node.geometry) resources.add(node.geometry);
    if (node.skeleton?.boneTexture) resources.add(node.skeleton.boneTexture);
    for (const material of materialRows(node)) {
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
  });
  return resources;
}

function dispose(resource) {
  if (resource?.userData?.soulLifetimeOwned !== true) return false;
  if (typeof resource.dispose === 'function') { resource.dispose(); return true; }
  return false;
}

export function rendererMemorySnapshot(renderer) {
  const memory = renderer?.info?.memory || {};
  const programs = Array.isArray(renderer?.info?.programs) ? renderer.info.programs.length : null;
  return Object.freeze({ geometries: Number(memory.geometries || 0), textures: Number(memory.textures || 0), programs });
}

export function compareRendererMemory(baseline, current, { maxGeometryGrowth = 8, maxTextureGrowth = 4, maxProgramGrowth = 6 } = {}) {
  const warnings = [], errors = [];
  const check = (key, maxGrowth) => {
    const before = Number(baseline?.[key]), after = Number(current?.[key]);
    if (!Number.isFinite(before) || !Number.isFinite(after)) return;
    const growth = after - before;
    if (growth > maxGrowth) errors.push({ metric: key, baseline: before, current: after, growth, limit: maxGrowth });
    else if (growth > Math.max(1, Math.floor(maxGrowth * .6))) warnings.push({ metric: key, baseline: before, current: after, growth, limit: maxGrowth });
  };
  check('geometries', maxGeometryGrowth); check('textures', maxTextureGrowth); check('programs', maxProgramGrowth);
  return Object.freeze({ pass: errors.length === 0, warnings, errors });
}

/** Reference-counted registry. Only resources explicitly marked as lifetime-owned are disposed. */
export function createResourceLifetimeManager({ renderer = null, label = 'runtime' } = {}) {
  const owners = new Map(), refs = new Map();
  let disposed = 0, retained = 0;
  const retain = (owner, resource) => {
    if (!resource || typeof resource !== 'object') return;
    const id = String(owner);
    if (!owners.has(id)) owners.set(id, new Set());
    const set = owners.get(id);
    if (set.has(resource)) return;
    set.add(resource); refs.set(resource, (refs.get(resource) || 0) + 1); retained++;
  };
  const release = owner => {
    const id = String(owner), set = owners.get(id);
    if (!set) return { released: 0, disposed: 0 };
    let released = 0, disposedNow = 0;
    for (const resource of set) {
      const next = Math.max(0, (refs.get(resource) || 1) - 1); released++;
      if (next === 0) { refs.delete(resource); if (dispose(resource)) { disposed++; disposedNow++; } }
      else refs.set(resource, next);
    }
    owners.delete(id);
    return { released, disposed: disposedNow };
  };
  return {
    retain,
    retainObject3D(owner, root) { for (const resource of resourcesForObject(root)) retain(owner, resource); return this.snapshot(); },
    release,
    releaseAll() { for (const owner of [...owners.keys()]) release(owner); return this.snapshot(); },
    snapshot() { return Object.freeze({ label, owners: owners.size, resources: refs.size, retained, disposed, renderer: rendererMemorySnapshot(renderer) }); },
  };
}

/** Leak sentinel compares repeated observations of the same stable scene key. */
export function createResourceLeakSentinel({ renderer, warmupSamples = 2, limits = {} } = {}) {
  if (!renderer) throw new Error('Resource leak sentinel requires a renderer');
  const baselines = new Map();
  let last = null;
  return {
    observe(sceneKey) {
      const key = String(sceneKey || 'default'), memory = rendererMemorySnapshot(renderer);
      const row = baselines.get(key) || { samples: 0, baseline: memory };
      row.samples++;
      if (row.samples <= warmupSamples) {
        row.baseline = {
          geometries: Math.max(row.baseline.geometries, memory.geometries),
          textures: Math.max(row.baseline.textures, memory.textures),
          programs: Number.isFinite(memory.programs) ? Math.max(row.baseline.programs ?? 0, memory.programs) : null,
        };
      }
      baselines.set(key, row);
      const gate = row.samples > warmupSamples ? compareRendererMemory(row.baseline, memory, limits) : { pass: true, warnings: [], errors: [] };
      last = Object.freeze({ key, samples: row.samples, baseline: row.baseline, current: memory, ...gate });
      return last;
    },
    snapshot() { return last || Object.freeze({ key: null, samples: 0, pass: true, warnings: [], errors: [] }); },
    reset(sceneKey = null) { if (sceneKey == null) baselines.clear(); else baselines.delete(String(sceneKey)); last = null; },
  };
}
