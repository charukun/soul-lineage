import { BoxGeometry, Vector3 } from 'three';
import { stylizedArtProfile } from '@soul/characters';
import { installStylizedGeometryLOD } from './stylized-art.js';

const triangles = geometry => geometry?.index ? Math.floor(geometry.index.count / 3) : Math.floor((geometry?.attributes?.position?.count || 0) / 3);
const variant = name => /^(.*?)(?:[_ .-]LOD)([012])$/i.exec(String(name || ''));
const markVariant = node => {
  if (!node) return;
  node.visible = false;
  node.userData = node.userData || {};
  node.userData.stylizedLOD = { variant: true, current: 'variant' };
  node.__stylizedLODState = { variant: true };
};

export function installAuthoredStylizedLOD(root, profileId, { minTriangles = 96 } = {}) {
  if (!root?.traverse) throw new Error('Authored LOD target requires an Object3D');
  const profile = stylizedArtProfile(profileId), groups = new Map();
  root.traverse(node => {
    if (!node?.isMesh || !node.geometry) return;
    const match = variant(node.name); if (!match) return;
    const key = match[1].toLowerCase(), level = Number(match[2]);
    if (!groups.has(key)) groups.set(key, {});
    groups.get(key)[level] = node;
  });
  let authored = 0;
  for (const levels of groups.values()) {
    const base = levels[0], lod1 = levels[1], lod2 = levels[2];
    if (!base || (!lod1 && !lod2) || base.__stylizedLODState || base.isSkinnedMesh || base.isInstancedMesh || base.morphTargetInfluences) continue;
    const original = base.geometry;
    if (triangles(original) < minTriangles) continue;
    markVariant(lod1); markVariant(lod2);
    const fallback = (() => {
      original.computeBoundingBox(); const box = original.boundingBox;
      if (!box || box.isEmpty()) return null;
      const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
      const geometry = new BoxGeometry(size.x, size.y, size.z, 1, 1, 1); geometry.translate(center.x, center.y, center.z); return geometry;
    })();
    const [, mid, far] = profile.performance.lodDistances;
    const before = base.onBeforeRender, world = new Vector3(), cameraWorld = new Vector3();
    base.__stylizedLODState = { original, lod1: lod1?.geometry || null, lod2: lod2?.geometry || null, proxy: fallback, threshold: mid };
    base.userData = base.userData || {};
    base.userData.stylizedLOD = { installed: true, authored: true, thresholds: [mid, far], sourceTriangles: triangles(original), lod1Triangles: triangles(lod1?.geometry), lod2Triangles: triangles(lod2?.geometry), proxyTriangles: triangles(fallback), current: 'full' };
    base.onBeforeRender = function authoredStylizedLOD(renderer, scene, camera, renderGeometry, material, group) {
      const quality = Math.max(0, Math.min(3, Number(root.userData?.visualQualityLevel) || 0));
      const distanceScale = [1, .92, .8, .68][quality];
      const distance = base.getWorldPosition(world).distanceTo(camera.getWorldPosition(cameraWorld));
      let geometry = original, current = 'full';
      if (distance >= far * distanceScale) { geometry = lod2?.geometry || fallback || lod1?.geometry || original; current = lod2 ? 'lod2' : fallback ? 'proxy' : lod1 ? 'lod1' : 'full'; }
      else if (distance >= mid * distanceScale && lod1?.geometry) { geometry = lod1.geometry; current = 'lod1'; }
      base.geometry = geometry; base.userData.stylizedLOD.current = current; base.userData.stylizedLOD.distance = distance;
      if (typeof before === 'function') before.call(this, renderer, scene, camera, renderGeometry, material, group);
    };
    authored++;
  }
  const fallback = installStylizedGeometryLOD(root, profileId, { minTriangles });
  root.userData = root.userData || {};
  root.userData.authoredStylizedLOD = { profileId, authored, fallback: fallback.installed };
  return root.userData.authoredStylizedLOD;
}
