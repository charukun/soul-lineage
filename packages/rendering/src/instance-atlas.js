import { CanvasTexture, InstancedMesh, Matrix4, SRGBColorSpace } from 'three';

const localMatrix = new Matrix4(), inverseRoot = new Matrix4();

function blockedByAncestor(node) {
  for (let p = node; p; p = p.parent) {
    const data = p.userData || {};
    if (data.streamingCritical || data.interactive || data.noBatch || data.noInstance || data.stateful || data.dynamic || data.animated || data.physicsBody || data.collisionRoot || data.focusTarget || data.mountPoint) return true;
  }
  return false;
}
function effectivelyVisible(node) {
  for (let p = node; p; p = p.parent) if (p.visible === false) return false;
  return true;
}
function eligible(mesh) {
  return Boolean(mesh?.isMesh && !mesh.isSkinnedMesh && !mesh.isInstancedMesh && !mesh.morphTargetInfluences &&
    mesh.geometry && mesh.material && !Array.isArray(mesh.material) && mesh.children.length === 0 &&
    effectivelyVisible(mesh) && !mesh.userData?.batchedInto && !blockedByAncestor(mesh));
}
function batchKey(node) {
  return `${node.parent?.uuid || 'root'}:${node.geometry.uuid}:${node.material.uuid}:${node.layers?.mask ?? 1}:${node.castShadow ? 1 : 0}:${node.receiveShadow ? 1 : 0}:${node.renderOrder || 0}:${node.frustumCulled === false ? 0 : 1}`;
}
function collectBatchGroups(root) {
  const groups = new Map();
  root.traverse(node => {
    if (!eligible(node)) return;
    const key = batchKey(node);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  });
  return groups;
}
function projectGroup(nodes, minInstances, maxInstances) {
  let batches = 0, instances = 0;
  for (let offset = 0; offset < nodes.length; offset += maxInstances) {
    const count = Math.min(maxInstances, nodes.length - offset);
    if (count < minInstances) continue;
    batches++; instances += count;
  }
  const untouched = nodes.length - instances;
  return { batches, instances, untouched, savedDrawCalls: Math.max(0, nodes.length - (batches + untouched)) };
}

/**
 * Non-mutating preview of the exact groups `batchStaticMeshes` may consolidate.
 * Interactive/stateful/collision/focus content is deliberately excluded.
 */
export function auditStaticBatchOpportunities(root, { minInstances = 4, maxInstances = 512, maxOpportunities = 12 } = {}) {
  if (!root?.traverse) throw new Error('Static batching audit requires an Object3D');
  const safeMin = Math.max(2, Math.floor(minInstances));
  const safeMax = Math.max(safeMin, Math.floor(maxInstances));
  const groups = collectBatchGroups(root);
  let candidateMeshes = 0, projectedBatches = 0, projectedInstances = 0, projectedSavedDrawCalls = 0;
  const opportunities = [];
  for (const nodes of groups.values()) {
    const projection = projectGroup(nodes, safeMin, safeMax);
    if (!projection.batches) continue;
    candidateMeshes += nodes.length;
    projectedBatches += projection.batches;
    projectedInstances += projection.instances;
    projectedSavedDrawCalls += projection.savedDrawCalls;
    const source = nodes[0];
    opportunities.push(Object.freeze({
      geometry: String(source.geometry?.name || source.geometry?.uuid || 'geometry'),
      material: String(source.material?.name || source.material?.uuid || source.material?.type || 'material'),
      meshes: nodes.length,
      batchedInstances: projection.instances,
      untouchedMeshes: projection.untouched,
      projectedBatches: projection.batches,
      projectedSavedDrawCalls: projection.savedDrawCalls,
      castShadow: Boolean(source.castShadow),
      receiveShadow: Boolean(source.receiveShadow),
      renderOrder: Number(source.renderOrder || 0),
    }));
  }
  opportunities.sort((a, b) => b.projectedSavedDrawCalls - a.projectedSavedDrawCalls || b.meshes - a.meshes || a.geometry.localeCompare(b.geometry));
  return Object.freeze({
    eligibleMeshes: [...groups.values()].reduce((sum, rows) => sum + rows.length, 0),
    candidateGroups: opportunities.length,
    candidateMeshes,
    projectedBatches,
    projectedInstances,
    projectedSavedDrawCalls,
    opportunities: Object.freeze(opportunities.slice(0, Math.max(0, Math.floor(maxOpportunities)))),
  });
}

/** Batches repeated static leaf meshes that share exact geometry/material identity. */
export function batchStaticMeshes(root, { minInstances = 4, maxInstances = 512 } = {}) {
  if (!root?.traverse) throw new Error('Static batching requires an Object3D');
  const safeMin = Math.max(2, Math.floor(minInstances));
  const safeMax = Math.max(safeMin, Math.floor(maxInstances));
  root.updateWorldMatrix(true, true);
  const groups = collectBatchGroups(root);
  const batches = [];
  for (const nodes of groups.values()) {
    if (nodes.length < safeMin) continue;
    for (let offset = 0; offset < nodes.length; offset += safeMax) {
      const rows = nodes.slice(offset, offset + safeMax);
      if (rows.length < safeMin) continue;
      const source = rows[0];
      const batch = new InstancedMesh(source.geometry, source.material, rows.length);
      batch.name = `Instanced_${source.name || source.geometry.uuid.slice(0, 8)}`;
      batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow;
      batch.renderOrder = source.renderOrder; batch.frustumCulled = source.frustumCulled;
      if (batch.layers && source.layers) batch.layers.mask = source.layers.mask;
      batch.userData.staticBatch = true; batch.userData.sourceCount = rows.length;
      const parent = source.parent;
      parent.updateWorldMatrix(true, false); inverseRoot.copy(parent.matrixWorld).invert();
      rows.forEach((mesh, index) => {
        mesh.updateWorldMatrix(true, false);
        localMatrix.copy(inverseRoot).multiply(mesh.matrixWorld);
        batch.setMatrixAt(index, localMatrix);
        mesh.visible = false; mesh.userData.batchedInto = batch.name;
      });
      batch.instanceMatrix.needsUpdate = true;
      parent.add(batch); batches.push({ batch, sources: rows, parent });
    }
  }
  return {
    batches: batches.length,
    instances: batches.reduce((sum, row) => sum + row.sources.length, 0),
    restore() {
      for (const row of batches) { row.sources.forEach(mesh => { mesh.visible = true; delete mesh.userData.batchedInto; }); row.parent.remove(row.batch); }
    },
  };
}

export function validateTextureAtlasManifest(manifest) {
  if (!manifest || !Number.isInteger(manifest.width) || !Number.isInteger(manifest.height) || manifest.width <= 0 || manifest.height <= 0) throw new Error('Invalid atlas dimensions');
  if (!Array.isArray(manifest.slots) || !manifest.slots.length) throw new Error('Atlas requires slots');
  const ids = new Set();
  for (const slot of manifest.slots) {
    if (!slot?.id || ids.has(slot.id) || ![slot.x, slot.y, slot.width, slot.height].every(Number.isFinite)) throw new Error('Invalid atlas slot');
    ids.add(slot.id);
    if (slot.x < 0 || slot.y < 0 || slot.width <= 0 || slot.height <= 0 || slot.x + slot.width > manifest.width || slot.y + slot.height > manifest.height) throw new Error(`Atlas slot out of bounds: ${slot.id}`);
  }
  return manifest;
}

/** Build a runtime atlas for small authored/procedural images. Offline baking remains preferred for production assets. */
export function buildTextureAtlas(entries, { width = 1024, height = 1024, padding = 2, colorSpace = SRGBColorSpace } = {}) {
  if (typeof document === 'undefined') throw new Error('Texture atlas canvas requires a browser/DCC canvas environment');
  if (!Array.isArray(entries) || !entries.length || entries.some(row => !row?.id || !row.image)) throw new Error('Atlas entries require id and image');
  const columns = Math.ceil(Math.sqrt(entries.length)), rows = Math.ceil(entries.length / columns);
  const cellWidth = Math.floor(width / columns), cellHeight = Math.floor(height / rows);
  if (cellWidth <= padding * 2 || cellHeight <= padding * 2) throw new Error('Atlas dimensions too small');
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true }); context.clearRect(0, 0, width, height);
  const slots = entries.map((entry, index) => {
    const column=index%columns,row=Math.floor(index/columns),x=column*cellWidth+padding,y=row*cellHeight+padding,w=cellWidth-padding*2,h=cellHeight-padding*2;
    context.drawImage(entry.image,x,y,w,h);
    return { id:entry.id,x,y,width:w,height:h };
  });
  const manifest=validateTextureAtlasManifest({width,height,slots});
  const texture=new CanvasTexture(canvas); texture.colorSpace=colorSpace; texture.name='SoulTextureAtlas'; texture.userData.atlas=manifest;
  return { texture, manifest, canvas };
}

/** Clone geometry and remap its 0..1 UVs into one validated atlas slot. */
export function remapGeometryUVToAtlas(geometry, manifest, slotId) {
  validateTextureAtlasManifest(manifest);
  const slot=manifest.slots.find(row=>row.id===slotId); if(!slot)throw new Error(`Unknown atlas slot: ${slotId}`);
  const uv=geometry?.attributes?.uv; if(!uv)throw new Error('Geometry has no UV attribute');
  const clone=geometry.clone(),out=clone.attributes.uv;
  const sx=slot.width/manifest.width,sy=slot.height/manifest.height,ox=slot.x/manifest.width,oy=slot.y/manifest.height;
  for(let i=0;i<out.count;i++)out.setXY(i,ox+out.getX(i)*sx,oy+out.getY(i)*sy);
  out.needsUpdate=true; clone.userData=clone.userData||{}; clone.userData.textureAtlasSlot=slotId; return clone;
}
