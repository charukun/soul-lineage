import { InstancedMesh, Matrix4 } from 'three';

const localMatrix = new Matrix4(), inverseRoot = new Matrix4();

function eligible(mesh) {
  return Boolean(mesh?.isMesh && !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.morphTargetInfluences &&
    mesh.geometry && mesh.material && !Array.isArray(mesh.material) && mesh.children.length === 0 &&
    !mesh.userData?.streamingCritical && !mesh.userData?.interactive && !mesh.userData?.noBatch);
}

/**
 * Batches repeated static leaf meshes that share exact geometry/material identity.
 * Original meshes remain in the graph but are presentation-hidden, preserving
 * source transforms and ownership for diagnostics/recovery.
 */
export function batchStaticMeshes(root, { minInstances = 4, maxInstances = 512 } = {}) {
  if (!root?.traverse) throw new Error('Static batching requires an Object3D');
  root.updateWorldMatrix(true, true); inverseRoot.copy(root.matrixWorld).invert();
  const groups = new Map();
  root.traverse(node => {
    if (!eligible(node)) return;
    const key = `${node.geometry.uuid}:${node.material.uuid}:${node.castShadow ? 1 : 0}:${node.receiveShadow ? 1 : 0}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });
  const batches = [];
  for (const nodes of groups.values()) {
    if (nodes.length < minInstances) continue;
    for (let offset = 0; offset < nodes.length; offset += maxInstances) {
      const rows = nodes.slice(offset, offset + maxInstances);
      if (rows.length < minInstances) continue;
      const source = rows[0];
      const batch = new InstancedMesh(source.geometry, source.material, rows.length);
      batch.name = `Instanced_${source.name || source.geometry.uuid.slice(0, 8)}`;
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
      batch.userData.staticBatch = true; batch.userData.sourceCount = rows.length;
      rows.forEach((mesh, index) => {
        mesh.updateWorldMatrix(true, false);
        localMatrix.copy(inverseRoot).multiply(mesh.matrixWorld);
        batch.setMatrixAt(index, localMatrix);
        mesh.visible = false; mesh.userData.batchedInto = batch.name;
      });
      batch.instanceMatrix.needsUpdate = true;
      root.add(batch); batches.push({ batch, sources: rows });
    }
  }
  return {
    batches: batches.length,
    instances: batches.reduce((sum, row) => sum + row.sources.length, 0),
    restore() {
      for (const row of batches) { row.sources.forEach(mesh => { mesh.visible = true; delete mesh.userData.batchedInto; }); root.remove(row.batch); row.batch.dispose?.(); }
    },
  };
}

/** Atlas metadata contract for DCC/offline bakers. Runtime only validates slots. */
export function validateTextureAtlasManifest(manifest) {
  if (!manifest || !Number.isInteger(manifest.width) || !Number.isInteger(manifest.height) || manifest.width <= 0 || manifest.height <= 0) throw new Error('Invalid atlas dimensions');
  if (!Array.isArray(manifest.slots) || !manifest.slots.length) throw new Error('Atlas requires slots');
  for (const slot of manifest.slots) {
    if (!slot?.id || ![slot.x, slot.y, slot.width, slot.height].every(Number.isFinite)) throw new Error('Invalid atlas slot');
    if (slot.x < 0 || slot.y < 0 || slot.width <= 0 || slot.height <= 0 || slot.x + slot.width > manifest.width || slot.y + slot.height > manifest.height) throw new Error(`Atlas slot out of bounds: ${slot.id}`);
  }
  return manifest;
}
