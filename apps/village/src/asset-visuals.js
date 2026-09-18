import './nature-visuals.js';
import { THREE as T } from '@soul/rendering';
import { createCompressedGLTFLoader } from '@soul/rendering/compressed-gltf';
import { createAssetResidencyCache } from '@soul/platform-web/asset-residency';
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

const buildVersion=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__.commit:SOURCE.commit;
const residency=createAssetResidencyCache({version:buildVersion});
const templates = new Map();
const failures = new Set();
const loaderByRenderer = new WeakMap();
function compressedLoader(view) {
  if (!loaderByRenderer.has(view.renderer)) {
    loaderByRenderer.set(view.renderer, createCompressedGLTFLoader({
      renderer: view.renderer,
      transcoderPath: `${import.meta.env.BASE_URL}basis/`,
      residencyCache: residency,
      assetHashForUrl: url => `${SOURCE.commit}:${String(url).split('/').pop()}`,
    }));
  }
  return loaderByRenderer.get(view.renderer);
}

function candidateUrl(file) { return `${LOCAL_ROOT}/${file}`; }

function loadTemplate(kind, view) {
  if (failures.has(kind)) return Promise.reject(new Error(`asset disabled after load failure: ${kind}`));
  if (templates.has(kind)) return templates.get(kind);
  const candidate = CANDIDATES[kind];
  const pending = compressedLoader(view).loadAsync(candidateUrl(candidate.file))
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

function visualCandidate(kind, fallback, view) {
  const candidate = CANDIDATES[kind];
  if (!candidate) return fallback;
  const root = new T.Group();
  const fallbackNode = fallback?.clone?.(true) || fallback;
  root.name = `MURAAAAAAA_${kind}`;
  root.userData.assetSource = SOURCE;
  root.userData.assetCandidate = candidate.file;
  root.userData.assetUrl = candidateUrl(candidate.file);
  if (fallbackNode) root.add(fallbackNode);
  loadTemplate(kind, view).then(template => {
    const model = prepare(template.clone(true), candidate);
    // Never hide or reparent the shared procedural cache. Each consumer owns
    // its fallback clone until the session-cached authored template is ready.
    if (fallbackNode) root.remove(fallbackNode);
    root.add(model);
    root.userData.assetLoaded = true;
    root.userData.compression = { meshopt: true, ktx2: true };
    root.userData.residency = 'cache-storage';
  }).catch(error => {
    root.userData.assetLoaded = false;
    root.userData.assetError = error?.message || String(error);
    console.warn(`[MURAAAAAAA] local visual asset failed: ${kind}`, error);
  });
  return root;
}

const originalGetProp = View.prototype.getProp;
View.prototype.getProp = function getPropWithAssetCandidate(kind) {
  return visualCandidate(kind, originalGetProp.call(this, kind), this);
};

window.__MURAAAAAAA_ASSETS__ = Object.freeze({
  source: SOURCE,
  root: LOCAL_ROOT,
  candidates: CANDIDATES,
  compression: Object.freeze({ meshopt: true, ktx2: true, transcoder: `${import.meta.env.BASE_URL}basis/` }),
  residency: () => residency.snapshot(),
  mode: 'repository-local-with-procedural-fallback',
});
