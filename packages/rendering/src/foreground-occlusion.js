import { Raycaster, Vector3 } from 'three';
import { createForegroundInstanceProxies } from './foreground-instance-proxies.js';

const cameraPosition = new Vector3();

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

function createFadeEntry(object) {
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

function activateFadeEntry(entry) {
  if (entry.active) return;
  for (const row of entry.meshes) row.mesh.material = row.faded;
  entry.active = true;
}

function applyFadeFactor(entry) {
  for (const row of entry.meshes) {
    for (const material of row.materials) material.material.opacity = material.baseOpacity * entry.factor;
  }
}

function restoreFadeEntry(entry) {
  if (!entry.active) return;
  for (const row of entry.meshes) if (row.mesh.material === row.faded) row.mesh.material = row.original;
  entry.active = false;
}

function writeTargetPoint(targetWorld, point) {
  if (point?.isVector3) targetWorld.copy(point);
  else targetWorld.set(Number(point?.x) || 0, Number(point?.y) || 0, Number(point?.z) || 0);
}

function sampleForegroundOccluders({ camera, point, occluderRoot, raycaster, direction, targetWorld, padding, matrixState }) {
  if (!camera || !point || !occluderRoot?.children?.length) return new Set();
  if (!matrixState.roots.has(occluderRoot)) {
    occluderRoot.updateWorldMatrix?.(true, true);
    matrixState.roots.add(occluderRoot);
  }
  camera.getWorldPosition(cameraPosition);
  writeTargetPoint(targetWorld, point);
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
    if (!hit?.object || hit.object.visible === false || hit.object.isInstancedMesh || hit.object.userData?.occlusionFadeDisabled) continue;
    const object = topLevelOccluder(hit.object, occluderRoot);
    if (!object || object.visible === false || object.userData?.occlusionFadeDisabled) continue;
    next.add(object);
  }
  return next;
}

function advanceFadeEntries(entries, dt, fadeSpeed, restoreSpeed) {
  const delta = Math.min(.1, Math.max(0, Number(dt) || 0));
  let transitioning = 0;
  for (const entry of entries.values()) {
    if (entry.target < 1 || entry.factor < .999) activateFadeEntry(entry);
    const speed = entry.target < entry.factor ? fadeSpeed : restoreSpeed;
    const blend = delta > 0 ? 1 - Math.exp(-Math.max(.01, speed) * delta) : 0;
    entry.factor += (entry.target - entry.factor) * blend;
    if (Math.abs(entry.target - entry.factor) < .002) entry.factor = entry.target;
    if (entry.active) applyFadeFactor(entry);
    if (entry.target === 1 && entry.factor === 1) restoreFadeEntry(entry);
    else if (entry.factor !== entry.target) transitioning++;
  }
  return transitioning;
}

function resetFadeEntry(entry) {
  entry.target = 1;
  entry.factor = 1;
  applyFadeFactor(entry);
  restoreFadeEntry(entry);
}

function disposeFadeEntry(entry) {
  resetFadeEntry(entry);
  const disposed = new Set();
  for (const row of entry.meshes) {
    for (const { material } of row.materials) {
      if (disposed.has(material)) continue;
      disposed.add(material);
      material.dispose?.();
    }
  }
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
  const raycaster = new Raycaster(), direction = new Vector3(), targetWorld = new Vector3();
  const entries = new Map(), matrixState = { roots: new WeakSet() }, instances = createForegroundInstanceProxies();
  const fadedFactor = Math.min(.8, Math.max(.08, Number(fadedOpacity) || .28));
  const sampleEvery = Math.max(0, Number(sampleInterval) || 0), padding = Math.max(0, Number(targetPadding) || 0);
  let activeRoots = new Set(), sampleClock = 0, sampled = false, occludedRatio = 0;

  const entryFor = object => {
    let entry = entries.get(object);
    if (!entry) { entry = createFadeEntry(object); entries.set(object, entry); }
    return entry;
  };
  const updateTargets = next => {
    activeRoots = next;
    for (const entry of entries.values()) entry.target = next.has(entry.object) ? fadedFactor : 1;
    for (const object of next) entryFor(object).target = fadedFactor;
  };
  const snapshot = (transitioning = 0) => Object.freeze({ occluded: activeRoots.size, transitioning, tracked: entries.size, occludedRatio, instanceProxies: instances.size });
  const clearSampling = () => { sampleClock = 0; sampled = false; };
  const advance = delta => {
    const transitioning = advanceFadeEntries(entries, delta, fadeSpeed, restoreSpeed);
    for (const [object, entry] of entries) if (object.userData?.foregroundInstanceKey && entry.factor === 1 && entry.target === 1) {
      disposeFadeEntry(entry); entries.delete(object); instances.release(object);
    }
    return snapshot(transitioning);
  };

  return {
    update({ camera, target: point, targets, occluderRoot, occluderRoots, instanceOccluders = [], enabled = true, dt = 0 } = {}) {
      const delta = Math.max(0, Number(dt) || 0);
      if (!enabled) {
        clearSampling(); occludedRatio = 0;
        if (activeRoots.size) updateTargets(new Set());
        return advance(delta);
      }
      sampleClock += delta;
      if (!sampled || sampleEvery === 0 || sampleClock >= sampleEvery) {
        matrixState.roots = new WeakSet();
        const samples = (targets?.length ? targets : [point]).filter(Boolean).slice(0, 8);
        const roots = (occluderRoots || [occluderRoot]).filter(Boolean), next = new Set();
        let blockedSamples = 0;
        instances.prepareSampling();
        for (const sample of samples) {
          let blocked = false;
          for (const root of roots) {
            const hits = sampleForegroundOccluders({ camera, point: sample, occluderRoot: root, raycaster, direction, targetWorld, padding, matrixState });
            if (hits.size) blocked = true;
            for (const object of hits) next.add(object);
          }
          if (camera && instanceOccluders.length) {
            camera.getWorldPosition(cameraPosition); writeTargetPoint(targetWorld, sample);
            direction.copy(targetWorld).sub(cameraPosition); const distance = direction.length();
            if (distance > padding + .01) {
              raycaster.camera = camera; raycaster.set(cameraPosition, direction.multiplyScalar(1 / distance)); raycaster.near = .01; raycaster.far = distance - padding;
              for (const hit of raycaster.intersectObjects(instanceOccluders, false)) {
                if (!hit.object.visible || hit.object.userData?.occlusionFadeDisabled) continue;
                const proxy = instances.proxyFor(hit.object, hit.instanceId);
                if (proxy) { next.add(proxy); blocked = true; }
              }
            }
          }
          if (blocked) blockedSamples++;
        }
        occludedRatio = samples.length ? blockedSamples / samples.length : 0;
        updateTargets(next); instances.maskSources();
        sampled = true; sampleClock = 0;
      }
      return advance(delta);
    },
    revealAll() {
      activeRoots = new Set(); clearSampling();
      for (const entry of entries.values()) resetFadeEntry(entry);
      occludedRatio = 0; return advance(0);
    },
    dispose() {
      for (const entry of entries.values()) disposeFadeEntry(entry);
      entries.clear(); instances.dispose(); activeRoots = new Set(); occludedRatio = 0; clearSampling(); matrixState.roots = new WeakSet();
    },
    snapshot,
  };
}
