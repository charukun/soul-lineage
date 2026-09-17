import { InstancedMesh, Matrix4 } from 'three';

const localMatrix = new Matrix4();
const inverseRoot = new Matrix4();

function effectiveVisible(node, stopAt) {
  for (let current = node; current; current = current.parent) {
    if (current.visible === false) return false;
    if (current === stopAt) break;
  }
  return true;
}

function blocked(node, stopAt) {
  for (let current = node; current; current = current.parent) {
    const data = current.userData || {};
    if (data.streamingCritical || data.interactive || data.noBatch || data.noInstance || data.stateful || data.dynamic || data.animated || data.physicsBody || data.collisionRoot || data.focusTarget || data.mountPoint) return true;
    if (current === stopAt) break;
  }
  return false;
}

function ownerUnder(root, node) {
  let current = node;
  while (current?.parent && current.parent !== root) current = current.parent;
  return current?.parent === root ? current : null;
}

function materialSafe(material) {
  return Boolean(material && material.visible !== false && material.transparent !== true && Number(material.opacity ?? 1) >= 1);
}

function eligible(root, mesh, { requireOptIn, ownerFilter }) {
  if (!mesh?.isMesh || mesh.isSkinnedMesh || mesh.isInstancedMesh || mesh.morphTargetInfluences || !mesh.geometry || !mesh.material || Array.isArray(mesh.material)) return false;
  if (!materialSafe(mesh.material) || mesh.userData?.batchedInto || mesh.userData?.staticWorldBatchedInto) return false;
  if (!effectiveVisible(mesh, root) || blocked(mesh, root)) return false;
  const owner = ownerUnder(root, mesh);
  if (!owner) return false;
  if (requireOptIn && owner.userData?.staticBatchEligible !== true) return false;
  if (ownerFilter && !ownerFilter(owner, mesh)) return false;
  return true;
}

function keyFor(mesh) {
  return `${mesh.geometry.uuid}:${mesh.material.uuid}:${mesh.layers?.mask ?? 1}:${mesh.castShadow ? 1 : 0}:${mesh.receiveShadow ? 1 : 0}:${mesh.renderOrder || 0}:${mesh.frustumCulled === false ? 0 : 1}`;
}

function groupsFor(root, options) {
  const groups = new Map();
  root.updateWorldMatrix?.(true, true);
  root.traverse?.(node => {
    if (!eligible(root, node, options)) return;
    const key = keyFor(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });
  return groups;
}

function projection(count, minInstances, maxInstances) {
  let batches = 0, instances = 0;
  for (let offset = 0; offset < count; offset += maxInstances) {
    const size = Math.min(maxInstances, count - offset);
    if (size < minInstances) continue;
    batches++;
    instances += size;
  }
  const untouched = count - instances;
  return { batches, instances, untouched, savedDrawCalls: Math.max(0, count - batches - untouched) };
}

function normalizedOptions({ minInstances = 2, maxInstances = 512, requireOptIn = true, ownerFilter = null } = {}) {
  const safeMin = Math.max(2, Math.floor(minInstances));
  const safeMax = Math.max(safeMin, Math.floor(maxInstances));
  return { minInstances: safeMin, maxInstances: safeMax, requireOptIn: requireOptIn !== false, ownerFilter };
}

export function auditStaticWorldBatchOpportunities(root, { maxOpportunities = 12, ...input } = {}) {
  if (!root?.traverse) throw new Error('Static world batching audit requires an Object3D root');
  const options = normalizedOptions(input), groups = groupsFor(root, options), opportunities = [];
  let candidateMeshes = 0, projectedBatches = 0, projectedInstances = 0, projectedSavedDrawCalls = 0;
  for (const meshes of groups.values()) {
    const row = projection(meshes.length, options.minInstances, options.maxInstances);
    if (!row.batches) continue;
    candidateMeshes += meshes.length;
    projectedBatches += row.batches;
    projectedInstances += row.instances;
    projectedSavedDrawCalls += row.savedDrawCalls;
    const source = meshes[0];
    opportunities.push(Object.freeze({
      geometry: String(source.geometry?.name || source.geometry?.uuid || 'geometry'),
      material: String(source.material?.name || source.material?.uuid || source.material?.type || 'material'),
      meshes: meshes.length,
      projectedBatches: row.batches,
      projectedInstances: row.instances,
      projectedSavedDrawCalls: row.savedDrawCalls,
    }));
  }
  opportunities.sort((a, b) => b.projectedSavedDrawCalls - a.projectedSavedDrawCalls || b.meshes - a.meshes || a.geometry.localeCompare(b.geometry));
  return Object.freeze({
    candidateGroups: opportunities.length,
    candidateMeshes,
    projectedBatches,
    projectedInstances,
    projectedSavedDrawCalls,
    opportunities: Object.freeze(opportunities.slice(0, Math.max(0, Math.floor(maxOpportunities)))),
  });
}

/**
 * Consolidates exact static geometry/material repeats across transform owners under
 * one explicitly-static presentation root. Gameplay/state owners must opt in or
 * be covered by a caller contract using requireOptIn=false.
 */
export function batchStaticWorldMeshes(root, input = {}) {
  if (!root?.traverse) throw new Error('Static world batching requires an Object3D root');
  const options = normalizedOptions(input), groups = groupsFor(root, options), batches = [];
  root.updateWorldMatrix?.(true, true);
  inverseRoot.copy(root.matrixWorld).invert();
  for (const meshes of groups.values()) {
    if (meshes.length < options.minInstances) continue;
    for (let offset = 0; offset < meshes.length; offset += options.maxInstances) {
      const sources = meshes.slice(offset, offset + options.maxInstances);
      if (sources.length < options.minInstances) continue;
      const source = sources[0], batch = new InstancedMesh(source.geometry, source.material, sources.length);
      batch.name = `StaticWorld_${source.name || source.geometry.uuid.slice(0, 8)}`;
      batch.castShadow = source.castShadow;
      batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder;
      batch.frustumCulled = source.frustumCulled;
      if (batch.layers && source.layers) batch.layers.mask = source.layers.mask;
      Object.assign(batch.userData, { staticWorldBatch: true, staticBatch: true, sourceCount: sources.length });
      const sourceState = sources.map(mesh => ({
        mesh,
        visible: mesh.visible,
        batchedInto: mesh.userData?.batchedInto,
        staticWorldBatchedInto: mesh.userData?.staticWorldBatchedInto,
      }));
      sources.forEach((mesh, index) => {
        mesh.updateWorldMatrix?.(true, false);
        localMatrix.copy(inverseRoot).multiply(mesh.matrixWorld);
        batch.setMatrixAt(index, localMatrix);
        mesh.visible = false;
        mesh.userData = mesh.userData || {};
        mesh.userData.batchedInto = batch.name;
        mesh.userData.staticWorldBatchedInto = batch.name;
      });
      batch.instanceMatrix.needsUpdate = true;
      root.add(batch);
      batches.push({ batch, sourceState });
    }
  }
  const instances = batches.reduce((sum, row) => sum + row.sourceState.length, 0);
  const stats = Object.freeze({ batches: batches.length, instances, savedDrawCalls: Math.max(0, instances - batches.length) });
  let restored = false;
  return {
    ...stats,
    restore() {
      if (restored) return;
      restored = true;
      for (const row of batches) {
        for (const state of row.sourceState) {
          state.mesh.visible = state.visible;
          if (state.batchedInto === undefined) delete state.mesh.userData.batchedInto;
          else state.mesh.userData.batchedInto = state.batchedInto;
          if (state.staticWorldBatchedInto === undefined) delete state.mesh.userData.staticWorldBatchedInto;
          else state.mesh.userData.staticWorldBatchedInto = state.staticWorldBatchedInto;
        }
        row.batch.removeFromParent();
        row.batch.dispose?.();
      }
    },
  };
}

function descriptorRows(input) {
  const rows = typeof input === 'function' ? input() : input;
  return (Array.isArray(rows) ? rows : [rows]).filter(Boolean).map((row, index) => row?.root ? row : { id: `root-${index}`, root: row });
}

/** Explicit mutation-boundary controller. It never traverses or rebuilds per frame. */
export function createStaticBatchController({ roots, minInstances = 2, maxInstances = 512, requireOptIn = true } = {}) {
  if (!roots) throw new Error('Static batch controller requires roots');
  let active = [], dirty = true, generation = 0, last = Object.freeze({ generation, roots: 0, batches: 0, instances: 0, savedDrawCalls: 0 });
  const restore = () => {
    for (const row of active) row.result.restore();
    active = [];
  };
  return {
    beforeMutation() { restore(); dirty = true; },
    invalidate() { dirty = true; },
    refresh(force = false) {
      if (!dirty && !force) return last;
      restore();
      const descriptors = descriptorRows(roots);
      let batches = 0, instances = 0, savedDrawCalls = 0;
      for (const descriptor of descriptors) {
        if (!descriptor.root?.traverse) continue;
        const result = batchStaticWorldMeshes(descriptor.root, {
          minInstances: descriptor.minInstances ?? minInstances,
          maxInstances: descriptor.maxInstances ?? maxInstances,
          requireOptIn: descriptor.requireOptIn ?? requireOptIn,
          ownerFilter: descriptor.ownerFilter ?? null,
        });
        active.push({ id: descriptor.id || descriptor.root.name || 'root', result });
        batches += result.batches;
        instances += result.instances;
        savedDrawCalls += result.savedDrawCalls;
      }
      dirty = false;
      generation++;
      last = Object.freeze({ generation, roots: descriptors.length, batches, instances, savedDrawCalls });
      return last;
    },
    snapshot() { return last; },
    dispose() { restore(); dirty = true; },
  };
}
