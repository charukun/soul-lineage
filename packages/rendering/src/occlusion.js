import { Box3, Raycaster, Vector3 } from 'three';

const center = new Vector3(), cameraPosition = new Vector3(), target = new Vector3();

function candidateSamples(object) {
  const box = new Box3().setFromObject(object);
  if (box.isEmpty()) return [];
  const min = box.min, max = box.max, c = box.getCenter(new Vector3());
  return [
    c,
    new Vector3(min.x, c.y, min.z),
    new Vector3(max.x, c.y, min.z),
    new Vector3(min.x, c.y, max.z),
    new Vector3(max.x, c.y, max.z),
  ];
}

function streamAllows(object) {
  return object?.userData?.visualStreamManaged ? object.userData.visualStreamVisible !== false : true;
}

/**
 * Conservative CPU occlusion culler for static set dressing.
 * A candidate is hidden only when every sampled ray is blocked by a registered
 * solid occluder before reaching the candidate. Distance streaming and
 * occlusion keep separate desired-visibility state, so neither can resurrect
 * an object that the other still wants hidden.
 */
export function createConservativeOcclusionCuller({ maxChecksPerUpdate = 8, minDistance = 18, hiddenConfirmations = 2 } = {}) {
  const raycaster = new Raycaster();
  let cursor = 0, tested = 0, hidden = 0, visible = 0;
  const state = new WeakMap();

  function blocked(camera, object, occluders) {
    camera.getWorldPosition(cameraPosition);
    // Raycaster#set configures only the ray. Recursive occluder groups may
    // contain Sprites, whose raycast contract also requires the active camera.
    raycaster.camera = camera;
    const samples = candidateSamples(object);
    if (!samples.length) return false;
    object.getWorldPosition(center);
    if (center.distanceTo(cameraPosition) < minDistance) return false;
    for (const point of samples) {
      target.copy(point).sub(cameraPosition);
      const distance = target.length();
      if (distance <= 1e-4) return false;
      raycaster.set(cameraPosition, target.multiplyScalar(1 / distance));
      raycaster.far = Math.max(0, distance - .08);
      const hits = raycaster.intersectObjects(occluders, true);
      if (!hits.some(hit => hit.object?.visible !== false)) return false;
    }
    return true;
  }

  function snapshot() {
    return Object.freeze({ tested, hidden, visible, cursor });
  }

  return {
    update({ camera, candidates = [], occluders = [] } = {}) {
      if (!camera || !candidates.length || !occluders.length) return snapshot();
      const count = Math.min(maxChecksPerUpdate, candidates.length);
      for (let i = 0; i < count; i++) {
        const object = candidates[(cursor + i) % candidates.length];
        if (!object || object.userData?.streamingCritical || object.userData?.occlusionDisabled) continue;
        const row = state.get(object) || { blocked: 0, ownedHidden: false };
        if (!streamAllows(object)) {
          row.blocked = 0; row.ownedHidden = false; object.userData.occluded = false; object.visible = false; state.set(object, row); continue;
        }
        if (object.visible === false && !row.ownedHidden && !object.userData?.visualStreamManaged) { row.blocked = 0; state.set(object, row); continue; }
        const isBlocked = blocked(camera, object, occluders);
        tested++;
        if (isBlocked) {
          row.blocked++;
          if (row.blocked >= hiddenConfirmations) { object.visible = false; row.ownedHidden = true; object.userData.occluded = true; hidden++; }
        } else {
          row.blocked = 0;
          if (row.ownedHidden || object.userData?.visualStreamManaged) object.visible = streamAllows(object);
          row.ownedHidden = false; object.userData.occluded = false; visible++;
        }
        state.set(object, row);
      }
      cursor = (cursor + count) % Math.max(1, candidates.length);
      return snapshot();
    },
    revealAll(candidates = []) {
      for (const object of candidates) {
        const row = state.get(object);
        if (object && row?.ownedHidden) { object.visible = streamAllows(object); row.ownedHidden = false; row.blocked = 0; if (object.userData) object.userData.occluded = false; }
      }
    },
    snapshot,
  };
}

function materialRows(material) {
  return (Array.isArray(material) ? material : [material]).filter(Boolean);
}

function cloneFadeMaterial(material) {
  if (!material?.clone) return null;
  const clone = material.clone();
  clone.onBeforeCompile = material.onBeforeCompile;
  if (Object.hasOwn(material, 'customProgramCacheKey')) clone.customProgramCacheKey = material.customProgramCacheKey;
  clone.userData = { ...(clone.userData || {}), soulForegroundOcclusionFade: true };
  if (!material.transparent) {
    clone.alphaHash = true;
    clone.transparent = false;
    clone.depthWrite = material.depthWrite;
  } else {
    clone.transparent = true;
    clone.depthWrite = false;
  }
  clone.needsUpdate = true;
  return clone;
}

function topLevelOccluder(object, root) {
  let current = object;
  while (current?.parent && current.parent !== root) current = current.parent;
  return current?.parent === root ? current : null;
}

/**
 * Player-visibility fader for fixed/limited cameras.
 *
 * Only top-level children of `occluderRoot` that intersect the camera-to-target
 * segment are faded. Opaque materials use alpha hashing instead of sorted alpha
 * blending, keeping depth testing/write behavior while avoiding transparent
 * sorting artifacts. Material clones are created lazily per encountered object,
 * and original shared materials are restored when the obstruction clears.
 */
export function createForegroundOcclusionFader({
  fadedOpacity = .28,
  fadeSpeed = 12,
  restoreSpeed = 8,
  sampleInterval = .05,
  targetPadding = .18,
} = {}) {
  const raycaster = new Raycaster();
  const direction = new Vector3(), targetWorld = new Vector3();
  const entries = new Map();
  let activeRoots = new Set(), sampleClock = 0, sampled = false, matrixRoot = null;

  const fadedFactor = Math.min(.8, Math.max(.08, Number(fadedOpacity) || .28));
  const sampleEvery = Math.max(0, Number(sampleInterval) || 0);
  const padding = Math.max(0, Number(targetPadding) || 0);

  function createEntry(object) {
    const meshes = [];
    object?.traverse?.(mesh => {
      if (!mesh?.isMesh || !mesh.material) return;
      const source = materialRows(mesh.material);
      if (!source.length || source.some(material => !material?.clone)) return;
      const clones = source.map(cloneFadeMaterial);
      if (clones.some(material => !material)) return;
      meshes.push({
        mesh,
        original: mesh.material,
        faded: Array.isArray(mesh.material) ? clones : clones[0],
        materials: clones.map((material, index) => ({
          material,
          baseOpacity: Number.isFinite(source[index]?.opacity) ? source[index].opacity : 1,
        })),
      });
    });
    return { object, meshes, factor: 1, target: 1, active: false };
  }

  function entryFor(object) {
    let entry = entries.get(object);
    if (!entry) { entry = createEntry(object); entries.set(object, entry); }
    return entry;
  }

  function activate(entry) {
    if (entry.active) return;
    for (const row of entry.meshes) row.mesh.material = row.faded;
    entry.active = true;
  }

  function applyFactor(entry) {
    for (const row of entry.meshes) {
      for (const material of row.materials) material.material.opacity = material.baseOpacity * entry.factor;
    }
  }

  function restore(entry) {
    if (!entry.active) return;
    for (const row of entry.meshes) if (row.mesh.material === row.faded) row.mesh.material = row.original;
    entry.active = false;
  }

  function setTargetPoint(point) {
    if (point?.isVector3) targetWorld.copy(point);
    else targetWorld.set(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0);
  }

  function sample(camera, point, occluderRoot) {
    if (!camera || !point || !occluderRoot?.children?.length) return new Set();
    if (matrixRoot !== occluderRoot) {
      occluderRoot.updateWorldMatrix?.(true, true);
      matrixRoot = occluderRoot;
    }
    camera.getWorldPosition(cameraPosition);
    setTargetPoint(point);
    direction.copy(targetWorld).sub(cameraPosition);
    const distance = direction.length();
    if (distance <= padding + 1e-4) return new Set();
    direction.multiplyScalar(1 / distance);
    raycaster.camera = camera;
    raycaster.set(cameraPosition, direction);
    raycaster.near = .01;
    raycaster.far = Math.max(.01, distance - padding);
    const next = new Set();
    for (const hit of raycaster.intersectObjects(occluderRoot.children, true)) {
      if (!hit?.object || hit.object.visible === false) continue;
      const object = topLevelOccluder(hit.object, occluderRoot);
      if (!object || object.visible === false || object.userData?.occlusionFadeDisabled) continue;
      next.add(object);
    }
    return next;
  }

  function updateTargets(next) {
    activeRoots = next;
    for (const entry of entries.values()) entry.target = next.has(entry.object) ? fadedFactor : 1;
    for (const object of next) entryFor(object).target = fadedFactor;
  }

  function tick(dt) {
    const delta = Math.min(.1, Math.max(0, Number(dt) || 0));
    let transitioning = 0;
    for (const entry of entries.values()) {
      if (entry.target < 1 || entry.factor < .999) activate(entry);
      const speed = entry.target < entry.factor ? fadeSpeed : restoreSpeed;
      const blend = delta > 0 ? 1 - Math.exp(-Math.max(.01, speed) * delta) : 0;
      entry.factor += (entry.target - entry.factor) * blend;
      if (Math.abs(entry.target - entry.factor) < .002) entry.factor = entry.target;
      if (entry.active) applyFactor(entry);
      if (entry.target === 1 && entry.factor === 1) restore(entry);
      else if (entry.factor !== entry.target) transitioning++;
    }
    return transitioning;
  }

  function snapshot(transitioning = 0) {
    return Object.freeze({ occluded: activeRoots.size, transitioning, tracked: entries.size });
  }

  return {
    update({ camera, target: point, occluderRoot, enabled = true, dt = 0 } = {}) {
      const delta = Math.max(0, Number(dt) || 0);
      if (!enabled) {
        sampleClock = 0; sampled = false;
        if (activeRoots.size) updateTargets(new Set());
        return snapshot(tick(delta));
      }
      sampleClock += delta;
      if (!sampled || sampleEvery === 0 || sampleClock >= sampleEvery) {
        updateTargets(sample(camera, point, occluderRoot));
        sampled = true; sampleClock = 0;
      }
      return snapshot(tick(delta));
    },
    revealAll() {
      activeRoots = new Set(); sampled = false; sampleClock = 0;
      for (const entry of entries.values()) { entry.target = 1; entry.factor = 1; applyFactor(entry); restore(entry); }
      return snapshot(0);
    },
    dispose() {
      for (const entry of entries.values()) {
        entry.factor = 1; applyFactor(entry); restore(entry);
        const disposed = new Set();
        for (const row of entry.meshes) for (const { material } of row.materials) if (!disposed.has(material)) { disposed.add(material); material.dispose?.(); }
      }
      entries.clear(); activeRoots = new Set(); sampled = false; sampleClock = 0;
    },
    snapshot,
  };
}
