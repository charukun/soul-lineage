import { THREE as T, GLTFLoader } from '@soul/rendering';
import { View } from './web/view.js';

// Visual-only candidates. Gameplay IDs, unlock rules, room effects and placement
// collision continue to come from the existing village implementation.
const SOURCE = Object.freeze({
  repository: 'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',
  commit: 'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
  license: 'CC0-1.0',
  manifest: 'assets/vendor/kaykit/MANIFEST.json',
});
const LOCAL_ROOT = `${import.meta.env.BASE_URL}assets/vendor/kaykit-dungeon`;
const CANDIDATES = Object.freeze({
  chair: { file: 'chair.gltf.glb', size: [1.0, 1.15, 1.0] },
  table: { file: 'table_medium.gltf.glb', size: [2.2, 1.1, 1.5] },
  bed: { file: 'bed_decorated.gltf.glb', size: [2.1, 1.25, 3.0] },
  shelf: { file: 'shelf_large.gltf.glb', size: [1.9, 2.0, 0.75] },
  counter: { file: 'table_small.gltf.glb', size: [1.5, 1.05, 1.15] },
  workbench: { file: 'table_long.gltf.glb', size: [2.7, 1.15, 1.35] },
  lamp: { file: 'candle_lit.gltf.glb', size: [0.45, 0.8, 0.45] },
  chest: { file: 'chest.glb', size: [1.35, 1.0, 0.95] },
});

const loader = new GLTFLoader();
const templates = new Map();
const failures = new Set();

function candidateUrl(file) {
  return `${LOCAL_ROOT}/${file}`;
}

function loadTemplate(kind) {
  if (failures.has(kind)) return Promise.reject(new Error(`asset disabled after load failure: ${kind}`));
  if (templates.has(kind)) return templates.get(kind);
  const candidate = CANDIDATES[kind];
  const pending = loader.loadAsync(candidateUrl(candidate.file))
    .then(gltf => {
      if (!gltf.scene) throw new Error(`KayKit scene missing: ${candidate.file}`);
      return gltf.scene;
    })
    .catch(error => {
      failures.add(kind);
      templates.delete(kind);
      throw error;
    });
  templates.set(kind, pending);
  return pending;
}

function fitToFootprint(node, [targetX, targetY, targetZ]) {
  node.updateMatrixWorld(true);
  const initial = new T.Box3().setFromObject(node);
  const size = initial.getSize(new T.Vector3());
  if (![size.x, size.y, size.z].every(Number.isFinite) || Math.max(size.x, size.y, size.z) <= 0) return;
  const scale = Math.min(targetX / Math.max(size.x, 0.001), targetY / Math.max(size.y, 0.001), targetZ / Math.max(size.z, 0.001));
  node.scale.multiplyScalar(scale);
  node.updateMatrixWorld(true);
  const fitted = new T.Box3().setFromObject(node);
  const center = fitted.getCenter(new T.Vector3());
  node.position.x -= center.x;
  node.position.z -= center.z;
  node.position.y -= fitted.min.y;
}

function prepare(node, candidate) {
  node.name = `KayKit_${candidate.file}`;
  node.traverse(child => {
    if (!child.isMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = true;
  });
  fitToFootprint(node, candidate.size);
  return node;
}

function visualCandidate(kind, fallback) {
  const candidate = CANDIDATES[kind];
  if (!candidate) return fallback;
  const root = new T.Group();
  root.name = `MURAAAAAAA_${kind}`;
  root.userData.assetSource = SOURCE;
  root.userData.assetCandidate = candidate.file;
  root.userData.assetUrl = candidateUrl(candidate.file);
  if (fallback) root.add(fallback);
  loadTemplate(kind).then(template => {
    const model = prepare(template.clone(true), candidate);
    if (fallback) fallback.visible = false;
    root.add(model);
    root.userData.assetLoaded = true;
  }).catch(error => {
    root.userData.assetLoaded = false;
    root.userData.assetError = error?.message || String(error);
    // The procedural model remains visible, so a missing/corrupt local asset
    // never removes furniture or blocks gameplay.
    console.warn(`[MURAAAAAAA] local visual asset failed: ${kind}`, error);
  });
  return root;
}

const originalGetProp = View.prototype.getProp;
View.prototype.getProp = function getPropWithAssetCandidate(kind) {
  return visualCandidate(kind, originalGetProp.call(this, kind));
};

window.__MURAAAAAAA_ASSETS__ = Object.freeze({
  source: SOURCE,
  root: LOCAL_ROOT,
  candidates: CANDIDATES,
  mode: 'repository-local-with-procedural-fallback',
});
