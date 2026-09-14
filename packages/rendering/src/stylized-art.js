import { stylizedArtProfile, STYLIZED_ART_VERSION, STYLIZED_ART_STYLE_ID } from '@soul/characters';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function styledMaterial(material, profile, cache, clone) {
  if (!material) return material;
  if (cache.has(material)) return cache.get(material);
  if (clone && typeof material.clone !== 'function') return material;
  const next = clone ? material.clone() : material;
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
 * Apply the shared visual direction without replacing geometry, textures,
 * animation, collision or gameplay state. This is intentionally safe for
 * audited MasterCharacter and repository-local vendor assets.
 */
export function applyStylizedArtProfile(root, profileId, { cloneMaterials = true } = {}) {
  if (!root || typeof root.traverse !== 'function') throw new Error('Stylized art target requires a Three.js Object3D');
  const profile = stylizedArtProfile(profileId);
  const cache = new Map();
  let meshes = 0;
  root.traverse(node => {
    if (!node.isMesh && !node.isSkinnedMesh && !node.isInstancedMesh) return;
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

export function stylizedArtDiagnostics(root) {
  const byProfile = {};
  let meshes = 0;
  root?.traverse?.(node => {
    if (!node.isMesh && !node.isSkinnedMesh && !node.isInstancedMesh) return;
    meshes++;
    const id = node.userData?.stylizedArtProfile || 'unprofiled';
    byProfile[id] = (byProfile[id] || 0) + 1;
  });
  return { styleId: STYLIZED_ART_STYLE_ID, meshes, byProfile };
}