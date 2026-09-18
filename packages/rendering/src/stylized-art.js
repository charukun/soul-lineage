import { BoxGeometry, Matrix4, Vector3 } from 'three';
import {
  stylizedArtProfile,
  STYLIZED_ART_VERSION,
  STYLIZED_ART_STYLE_ID,
  defaultMaterialTokenForProfile,
  stylizedMaterialToken,
} from '@soul/characters';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const isRenderable = node => Boolean(node?.isMesh || node?.isSkinnedMesh || node?.isInstancedMesh);
const triangleCount = geometry => {
  if (!geometry) return 0;
  if (geometry.index) return Math.floor(geometry.index.count / 3);
  return Math.floor((geometry.attributes?.position?.count ?? 0) / 3);
};

export function applyStylizedMaterialToken(material, tokenId, { preserveBaseColor = null } = {}) {
  if (!material) return material;
  const token = stylizedMaterialToken(tokenId);
  const keepColor = preserveBaseColor ?? token.preserveBaseColor;
  if (!keepColor && token.baseColor && material.color?.set) material.color.set(token.baseColor);
  if ('roughness' in material) material.roughness = token.roughness;
  if ('metalness' in material) material.metalness = token.metalness;
  if (token.emissive && material.emissive?.set) material.emissive.set(token.emissive);
  if ('emissiveIntensity' in material && token.emissiveIntensity > 0) material.emissiveIntensity = token.emissiveIntensity;
  material.userData = material.userData || {};
  material.userData.soulMaterialToken = token.id;
  material.needsUpdate = true;
  return material;
}

function styledMaterial(material, profile, cache, clone) {
  if (!material) return material;
  if (cache.has(material)) return cache.get(material);
  if (clone && typeof material.clone !== 'function') return material;
  const next = clone ? material.clone() : material;
  applyStylizedMaterialToken(next, defaultMaterialTokenForProfile(profile.id), { preserveBaseColor: true });
  if ('roughness' in next && Number.isFinite(next.roughness)) {
    next.roughness = clamp(next.roughness, profile.surface.roughness[0], profile.surface.roughness[1]);
  }
  if ('metalness' in next && Number.isFinite(next.metalness)) {
    next.metalness = Math.min(next.metalness, profile.surface.metalnessMax);
  }
  if ('flatShading' in next) next.flatShading = profile.surface.flatShading;
  next.needsUpdate = true;
  cache.set(material, next);
  return next;
}

/**
 * Apply the shared visual direction without replacing source geometry, textures,
 * animation, collision or gameplay state. Destructive asset conversion remains
 * an offline authoring responsibility.
 */
export function applyStylizedArtProfile(root, profileId, { cloneMaterials = true } = {}) {
  if (!root || typeof root.traverse !== 'function') throw new Error('Stylized art target requires a Three.js Object3D');
  const profile = stylizedArtProfile(profileId);
  const cache = new Map();
  let meshes = 0;
  root.traverse(node => {
    if (!isRenderable(node)) return;
    meshes++;
    node.castShadow = profile.shadow.cast;
    node.receiveShadow = profile.shadow.receive;
    node.frustumCulled = true;
    node.material = Array.isArray(node.material)
      ? node.material.map(material => styledMaterial(material, profile, cache, cloneMaterials))
      : styledMaterial(node.material, profile, cache, cloneMaterials);
    node.userData = node.userData || {};
    node.userData.stylizedArtProfile = profile.id;
  });
  root.userData = root.userData || {};
  root.userData.stylizedArt = {
    version: STYLIZED_ART_VERSION,
    styleId: STYLIZED_ART_STYLE_ID,
    profileId: profile.id,
  };
  return { profile, meshes, materials: cache.size };
}

/** Keep newly-authored procedural primitives inside the role's silhouette budget. */
export function stylizedGeometrySegments(profileId, requested, minimum = 3) {
  const profile = stylizedArtProfile(profileId);
  if (!Number.isFinite(requested) || !Number.isFinite(minimum)) throw new Error('Segment values must be finite');
  const min = Math.max(3, Math.floor(minimum));
  return Math.max(min, Math.min(profile.geometry.radialSegmentsMax, Math.floor(requested)));
}

/**
 * Install a real runtime geometry LOD for static environment/prop meshes.
 * Near uses the authored geometry. Far swaps only the render geometry to a
 * local bounding-box proxy, retaining the original Object3D, transform,
 * material, picking identity and gameplay collision path. Skinned/morphed,
 * instanced and very flat terrain meshes are deliberately excluded.
 */
export function installStylizedGeometryLOD(root, profileId, { minTriangles = 96 } = {}) {
  if (!root?.traverse) throw new Error('Stylized LOD target requires an Object3D');
  const profile = stylizedArtProfile(profileId);
  const enabled = ['environment', 'prop', 'distant'].includes(profile.id);
  if (!enabled) return { profileId, installed: 0, eligible: 0, sourceTriangles: 0, proxyTriangles: 0 };
  const threshold = profile.performance.lodDistances[1];
  let installed = 0, eligible = 0, sourceTriangles = 0, proxyTriangles = 0;
  root.traverse(node => {
    if (!node?.isMesh || node.isSkinnedMesh || node.isInstancedMesh || node.morphTargetInfluences || node.__stylizedLODState) return;
    const geometry = node.geometry, triangles = triangleCount(geometry);
    if (!geometry?.attributes?.position || triangles < minTriangles) return;
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (!box || box.isEmpty()) return;
    const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
    const max = Math.max(size.x, size.y, size.z), min = Math.max(1e-6, Math.min(size.x, size.y, size.z));
    if (!(max > 1e-5) || max / min > 70) return;
    eligible++;
    const proxy = new BoxGeometry(size.x, size.y, size.z, 1, 1, 1);
    proxy.translate(center.x, center.y, center.z);
    const original = geometry, before = node.onBeforeRender;
    const world = new Vector3(), cameraWorld = new Vector3();
    node.__stylizedLODState = { original, proxy, threshold };
    node.userData = node.userData || {};
    node.userData.stylizedLOD = { installed: true, threshold, sourceTriangles: triangles, proxyTriangles: triangleCount(proxy), current: 'full' };
    node.onBeforeRender = function stylizedLODRender(renderer, scene, camera, renderGeometry, material, group) {
      const distance = node.getWorldPosition(world).distanceTo(camera.getWorldPosition(cameraWorld));
      const useProxy = distance >= threshold;
      node.geometry = useProxy ? proxy : original;
      node.userData.stylizedLOD.current = useProxy ? 'proxy' : 'full';
      node.userData.stylizedLOD.distance = distance;
      if (typeof before === 'function') before.call(this, renderer, scene, camera, renderGeometry, material, group);
    };
    installed++;
    sourceTriangles += triangles;
    proxyTriangles += triangleCount(proxy);
  });
  root.userData = root.userData || {};
  root.userData.stylizedLOD = { profileId, installed, eligible, sourceTriangles, proxyTriangles, threshold };
  return root.userData.stylizedLOD;
}

function materialRows(node) {
  return (Array.isArray(node.material) ? node.material : [node.material]).filter(Boolean);
}

/** Geometry-based silhouette envelope. It samples the actual current skinned or static mesh vertices. */
export function stylizedSilhouetteMetrics(root, { sampleLimit = 9000 } = {}) {
  if (!root?.traverse) throw new Error('Silhouette target requires an Object3D');
  if (!Number.isInteger(sampleLimit) || sampleLimit < 128) throw new Error('Invalid silhouette sample limit');
  root.updateWorldMatrix(true, true);
  const inverseRoot = new Matrix4().copy(root.matrixWorld).invert();
  const point = new Vector3(), points = [];
  root.traverse(node => {
    if (!node?.isMesh || !node.geometry?.attributes?.position || points.length >= sampleLimit) return;
    const count = node.geometry.attributes.position.count;
    const remaining = Math.max(1, sampleLimit - points.length);
    const step = Math.max(1, Math.ceil(count / remaining));
    for (let i = 0; i < count && points.length < sampleLimit; i += step) {
      if (typeof node.getVertexPosition === 'function') node.getVertexPosition(i, point);
      else point.fromBufferAttribute(node.geometry.attributes.position, i);
      point.applyMatrix4(node.matrixWorld).applyMatrix4(inverseRoot);
      if (Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z)) points.push([point.x, point.y, point.z]);
    }
  });
  if (points.length < 8) return { sampleCount: points.length, valid: false, signature: [] };
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity, minD = Infinity, maxD = -Infinity;
  const invSqrt2 = Math.SQRT1_2;
  for (const [x, y, z] of points) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); const d = (x + z) * invSqrt2; minD = Math.min(minD, d); maxD = Math.max(maxD, d);
  }
  const height = Math.max(1e-6, maxY - minY), bands = Array.from({ length: 4 }, () => ({ minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity }));
  for (const [x, y, z] of points) {
    const index = Math.min(3, Math.max(0, Math.floor(((y - minY) / height) * 4)));
    const b = bands[index]; b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x); b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
  }
  const width = maxX - minX, depth = maxZ - minZ, diagonal = maxD - minD;
  const bandFront = bands.map(b => Number.isFinite(b.minX) ? (b.maxX - b.minX) / height : 0);
  const bandSide = bands.map(b => Number.isFinite(b.minZ) ? (b.maxZ - b.minZ) / height : 0);
  const signature = [width / height, depth / height, diagonal / height, ...bandFront, ...bandSide].map(v => Number(v.toFixed(5)));
  return {
    valid: true,
    sampleCount: points.length,
    height,
    frontWidth: width,
    sideDepth: depth,
    diagonalWidth: diagonal,
    frontAspect: width / height,
    sideAspect: depth / height,
    diagonalAspect: diagonal / height,
    bandFront,
    bandSide,
    signature,
  };
}

export function compareStylizedSilhouettes(rows, threshold = .055) {
  if (!Array.isArray(rows) || !Number.isFinite(threshold) || threshold <= 0) throw new Error('Invalid silhouette comparison');
  const pairs = [];
  for (let i = 0; i < rows.length; i++) for (let j = i + 1; j < rows.length; j++) {
    const a = rows[i]?.silhouette?.signature ?? rows[i]?.signature ?? [], b = rows[j]?.silhouette?.signature ?? rows[j]?.signature ?? [];
    if (!a.length || a.length !== b.length) continue;
    const rms = Math.sqrt(a.reduce((sum, value, k) => sum + (value - b[k]) ** 2, 0) / a.length);
    if (rms <= threshold) pairs.push({ a: rows[i].id ?? String(i), b: rows[j].id ?? String(j), distance: rms });
  }
  return pairs.sort((a, b) => a.distance - b.distance);
}

export function stylizedArtAudit(root, profileId = root?.userData?.stylizedArt?.profileId) {
  const profile = stylizedArtProfile(profileId || 'npc');
  const materials = new Set(), textures = new Set(), tokenCounts = {}, warnings = [], errors = [];
  let meshes = 0, triangles = 0, drawCalls = 0, lodEligible = 0, lodInstalled = 0;
  root?.traverse?.(node => {
    if (!isRenderable(node)) return;
    meshes++;
    const meshTriangles = triangleCount(node.geometry); triangles += meshTriangles;
    const rows = materialRows(node); drawCalls += Math.max(1, rows.length);
    for (const material of rows) {
      materials.add(material);
      const token = material.userData?.soulMaterialToken || 'unclassified'; tokenCounts[token] = (tokenCounts[token] || 0) + 1;
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
    if (node.isMesh && !node.isSkinnedMesh && !node.isInstancedMesh && !node.morphTargetInfluences && meshTriangles >= 96) {
      lodEligible++;
      if (node.userData?.stylizedLOD?.installed) lodInstalled++;
    }
  });
  const silhouette = stylizedSilhouetteMetrics(root);
  const budget = profile.performance;
  if (triangles > budget.softTriangleBudget) warnings.push(`triangles ${triangles.toLocaleString()} > soft budget ${budget.softTriangleBudget.toLocaleString()}`);
  if (materials.size > budget.softMaterialBudget) warnings.push(`materials ${materials.size} > soft budget ${budget.softMaterialBudget}`);
  if (drawCalls > budget.softDrawCallBudget) warnings.push(`estimated draw calls ${drawCalls} > soft budget ${budget.softDrawCallBudget}`);
  if (Object.hasOwn(tokenCounts, 'unclassified')) warnings.push(`${tokenCounts.unclassified} material bindings have no shared token`);
  if (['environment', 'prop', 'distant'].includes(profile.id) && lodEligible > 0 && lodInstalled === 0) warnings.push('complex static meshes have no runtime LOD');
  if (!silhouette.valid || silhouette.height <= 1e-4) errors.push('silhouette envelope is invalid');
  const gate = errors.length ? 'fail' : warnings.length ? 'review' : 'pass';
  return {
    styleId: STYLIZED_ART_STYLE_ID,
    profileId: profile.id,
    gate,
    warnings,
    errors,
    meshes,
    triangles,
    materials: materials.size,
    textures: textures.size,
    estimatedDrawCalls: drawCalls,
    materialTokens: tokenCounts,
    lod: { eligible: lodEligible, installed: lodInstalled },
    silhouette,
    budget,
  };
}

export function stylizedArtDiagnostics(root) {
  const byProfile = {}, tokenCounts = {};
  let meshes = 0, triangles = 0, lodInstalled = 0;
  root?.traverse?.(node => {
    if (!isRenderable(node)) return;
    meshes++;
    triangles += triangleCount(node.geometry);
    const id = node.userData?.stylizedArtProfile || 'unprofiled';
    byProfile[id] = (byProfile[id] || 0) + 1;
    if (node.userData?.stylizedLOD?.installed) lodInstalled++;
    for (const material of materialRows(node)) {
      const token = material.userData?.soulMaterialToken || 'unclassified';
      tokenCounts[token] = (tokenCounts[token] || 0) + 1;
    }
  });
  return { styleId: STYLIZED_ART_STYLE_ID, meshes, triangles, byProfile, materialTokens: tokenCounts, lodInstalled };
}