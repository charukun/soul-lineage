const finite = value => typeof value === 'number' && Number.isFinite(value);

function triangleCount(geometry, instances = 1) {
  if (!geometry) return 0;
  const base = geometry.index ? Math.floor((geometry.index.count || 0) / 3) : Math.floor((geometry.attributes?.position?.count || 0) / 3);
  return base * Math.max(1, Number.isInteger(instances) ? instances : 1);
}

function materialRows(node) {
  return (Array.isArray(node?.material) ? node.material : [node?.material]).filter(Boolean);
}

function materialClass(material) {
  const opacity = finite(material.opacity) ? material.opacity : 1;
  const alphaTest = finite(material.alphaTest) ? material.alphaTest : 0;
  if (material.transparent === true || opacity < .999) return 'blended';
  if (alphaTest > 0) return 'cutout';
  return 'opaque';
}

/**
 * Low-frequency runtime QA for alpha/overdraw pressure. Triangle counts are an
 * upper bound when a mesh mixes opaque and transparent material groups; the
 * audit deliberately labels them as such rather than pretending to measure
 * physical GPU overdraw or screen coverage.
 */
export function auditTransparency(root) {
  const materials = new Set(), blended = new Set(), cutout = new Set();
  let meshes = 0, blendedDrawCalls = 0, cutoutDrawCalls = 0, transparentTriangleUpperBound = 0, cutoutTriangleUpperBound = 0;
  root?.traverse?.(node => {
    if ((!node?.isMesh && !node?.isSkinnedMesh && !node?.isInstancedMesh) || node.visible === false) return;
    meshes++;
    const rows = materialRows(node);
    let hasBlended = false, hasCutout = false;
    for (const material of rows) {
      materials.add(material);
      const kind = materialClass(material);
      if (kind === 'blended') { blended.add(material); blendedDrawCalls++; hasBlended = true; }
      else if (kind === 'cutout') { cutout.add(material); cutoutDrawCalls++; hasCutout = true; }
    }
    const triangles = triangleCount(node.geometry, node.isInstancedMesh ? node.count : 1);
    if (hasBlended) transparentTriangleUpperBound += triangles;
    if (hasCutout) cutoutTriangleUpperBound += triangles;
  });
  return Object.freeze({
    meshes,
    materials: materials.size,
    blendedMaterials: blended.size,
    cutoutMaterials: cutout.size,
    blendedDrawCalls,
    cutoutDrawCalls,
    transparentTriangleUpperBound,
    cutoutTriangleUpperBound,
    risk: blendedDrawCalls > 24 || transparentTriangleUpperBound > 120000 ? 'review' : 'pass',
  });
}

export function combineTransparencyAudits(rows = []) {
  const totals = { meshes: 0, materials: 0, blendedMaterials: 0, cutoutMaterials: 0, blendedDrawCalls: 0, cutoutDrawCalls: 0, transparentTriangleUpperBound: 0, cutoutTriangleUpperBound: 0 };
  for (const row of rows.filter(Boolean)) for (const key of Object.keys(totals)) totals[key] += Number(row[key]) || 0;
  return Object.freeze({ ...totals, risk: totals.blendedDrawCalls > 24 || totals.transparentTriangleUpperBound > 120000 ? 'review' : 'pass' });
}
