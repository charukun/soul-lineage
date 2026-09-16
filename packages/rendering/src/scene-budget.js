import { auditStaticBatchOpportunities } from './instance-atlas.js';
import { auditTextureBudget } from './texture-quality.js';

const materialRows = node => (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);

function effectivelyVisible(node) {
  for (let p = node; p; p = p.parent) if (p.visible === false) return false;
  return true;
}

function renderable(node) {
  return Boolean(node?.isMesh || node?.isLine || node?.isLineSegments || node?.isPoints || node?.isSprite);
}

function estimatedObjectDrawCalls(node) {
  const rows = materialRows(node);
  if (!rows.length) return 0;
  if (!Array.isArray(node.material)) return 1;
  const groups = node.geometry?.groups;
  if (!Array.isArray(groups) || !groups.length) return rows.length;
  const used = new Set();
  for (const group of groups) {
    const index = Number(group?.materialIndex || 0);
    if (index >= 0 && index < rows.length) used.add(index);
  }
  return Math.max(1, used.size);
}

/**
 * Non-mutating scene-level draw-call/material audit. The projected draw-call
 * number only applies the same conservative static-instancing rules as
 * `batchStaticMeshes`; it does not mutate scene state or reduce visual quality.
 */
export function auditSceneBudget(root, {
  softDrawCalls = 220,
  softMaterials = 96,
  includeInvisible = false,
  minInstances = 4,
  maxInstances = 512,
  maxMaterialOffenders = 12,
  maxBatchOpportunities = 12,
} = {}) {
  if (!root?.traverse) throw new Error('Scene budget audit requires an Object3D');
  const materials = new Map();
  let renderables = 0, estimatedDrawCalls = 0, multiMaterialObjects = 0;

  root.traverse(node => {
    if (!renderable(node) || (!includeInvisible && !effectivelyVisible(node))) return;
    const rows = materialRows(node);
    if (!rows.length) return;
    renderables++;
    estimatedDrawCalls += estimatedObjectDrawCalls(node);
    if (rows.length > 1) multiMaterialObjects++;
    for (const material of rows) {
      const existing = materials.get(material) || {
        label: String(material?.name || material?.uuid || material?.type || 'material'),
        type: String(material?.type || 'Material'),
        uses: 0,
      };
      existing.uses++;
      materials.set(material, existing);
    }
  });

  const staticBatch = auditStaticBatchOpportunities(root, {
    minInstances,
    maxInstances,
    maxOpportunities: maxBatchOpportunities,
  });
  const projectedDrawCalls = Math.max(0, estimatedDrawCalls - staticBatch.projectedSavedDrawCalls);
  const materialPressure = [...materials.values()]
    .sort((a, b) => b.uses - a.uses || a.label.localeCompare(b.label))
    .slice(0, Math.max(0, Math.floor(maxMaterialOffenders)))
    .map(row => Object.freeze({ ...row }));
  const gate = estimatedDrawCalls > softDrawCalls || materials.size > softMaterials ? 'review' : 'pass';
  const reasons = [];
  if (estimatedDrawCalls > softDrawCalls) reasons.push(`estimatedDrawCalls ${estimatedDrawCalls} > ${softDrawCalls}`);
  if (materials.size > softMaterials) reasons.push(`uniqueMaterials ${materials.size} > ${softMaterials}`);

  return Object.freeze({
    renderables,
    estimatedDrawCalls,
    projectedDrawCalls,
    softDrawCalls,
    uniqueMaterials: materials.size,
    softMaterials,
    multiMaterialObjects,
    gate,
    reasons: Object.freeze(reasons),
    materialPressure: Object.freeze(materialPressure),
    staticBatch,
  });
}

/** One-call snapshot for diagnostics panels, CI evidence, and browser QA. */
export function createRenderingBudgetSnapshot(root, { texture = {}, scene = {} } = {}) {
  return Object.freeze({
    texture: auditTextureBudget(root, texture),
    scene: auditSceneBudget(root, scene),
  });
}
