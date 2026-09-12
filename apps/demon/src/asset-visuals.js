import './master-humans.js';
import * as T from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { NightView } from './web/view.js';

// Visual-only pass. No NPC state, combat hitbox, navigation or raid rules are changed.
const SKELETON_SOURCE = Object.freeze({
  repository: 'KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0',
  commit: '15b62b9bad122f72926c10fb14d622c73819fa54',
  license: 'CC0-1.0',
  manifest: 'assets/vendor/kaykit/MANIFEST.json',
});
const DUNGEON_SOURCE = Object.freeze({
  repository: 'KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0',
  commit: 'b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07',
  license: 'CC0-1.0',
  manifest: 'assets/vendor/kaykit/MANIFEST.json',
});
const LOCAL = Object.freeze({
  skeletons: `${import.meta.env.BASE_URL}assets/vendor/kaykit-skeletons`,
  dungeon: `${import.meta.env.BASE_URL}assets/vendor/kaykit-dungeon`,
});
const loader = new GLTFLoader();
const cache = new Map();

function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).catch(error => { cache.delete(url); throw error; }));
  return cache.get(url);
}
function shadows(root) {
  root.traverse(node => {
    if (!node.isMesh) return;
    node.castShadow = true;
    node.receiveShadow = true;
  });
  return root;
}
function fitHeight(root, height) {
  root.updateMatrixWorld(true);
  const box = new T.Box3().setFromObject(root);
  const size = box.getSize(new T.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0) return root;
  root.scale.multiplyScalar(height / size.y);
  root.updateMatrixWorld(true);
  const fitted = new T.Box3().setFromObject(root);
  const center = fitted.getCenter(new T.Vector3());
  root.position.x -= center.x;
  root.position.z -= center.z;
  root.position.y -= fitted.min.y;
  return root;
}

async function addSkeletonSentinel(view, generation) {
  const url = `${LOCAL.skeletons}/Skeleton_Minion.glb`;
  try {
    const gltf = await load(url);
    if (view.__assetPassGeneration !== generation || !view.environment?.parent) return;
    const root = new T.Group();
    const skeleton = fitHeight(shadows(gltf.scene.clone(true)), 2.15);
    skeleton.rotation.y = Math.PI * .12;
    root.add(skeleton);
    root.position.set(-10.9, 0, -20.2);
    root.name = 'KayKit_Skeleton_Minion_Ambient';
    root.userData.visualOnly = true;
    root.userData.source = SKELETON_SOURCE;
    root.userData.assetUrl = url;
    view.environment.add(root);
    if (gltf.animations?.length) {
      const mixer = new T.AnimationMixer(skeleton);
      const clip = gltf.animations.find(item => /idle/i.test(item.name)) || gltf.animations[0];
      mixer.clipAction(clip).play();
      view.__assetMixers.push(mixer);
    }
  } catch (error) {
    console.warn('[暗い喰らいCry] local skeleton visual candidate failed', error);
  }
}

const PROP_LAYOUT = Object.freeze([
  ['barrel_small.gltf.glb', -7.8, -22.2, 0.95, .25],
  ['box_small.gltf.glb', -8.6, -21.7, 0.95, -.18],
  ['rubble_large.gltf.glb', -13.9, -24.0, 0.75, .55],
  ['torch_lit.gltf.glb', -4.0, -25.2, 1.05, 0],
  ['torch_lit.gltf.glb', 4.0, -25.2, 1.05, 0],
]);
async function addDungeonProps(view, generation) {
  await Promise.all(PROP_LAYOUT.map(async ([file, x, z, scale, rotation]) => {
    const url = `${LOCAL.dungeon}/${file}`;
    try {
      const gltf = await load(url);
      if (view.__assetPassGeneration !== generation || !view.environment?.parent) return;
      const prop = shadows(gltf.scene.clone(true));
      prop.scale.setScalar(scale);
      prop.position.set(x, 0, z);
      prop.rotation.y = rotation;
      prop.name = `KayKit_${file}`;
      prop.userData.visualOnly = true;
      prop.userData.source = DUNGEON_SOURCE;
      prop.userData.assetUrl = url;
      view.environment.add(prop);
    } catch (error) {
      console.warn(`[暗い喰らいCry] local dungeon prop failed: ${file}`, error);
    }
  }));
}

const originalBuild = NightView.prototype.build;
NightView.prototype.build = function buildWithAssetPass(world) {
  const result = originalBuild.call(this, world);
  this.__assetPassGeneration = (this.__assetPassGeneration || 0) + 1;
  this.__assetMixers = [];
  const generation = this.__assetPassGeneration;
  addDungeonProps(this, generation);
  addSkeletonSentinel(this, generation);
  return result;
};

const originalUpdate = NightView.prototype.update;
NightView.prototype.update = function updateWithAssetPass(game, dt, title = false) {
  const result = originalUpdate.call(this, game, dt, title);
  for (const mixer of this.__assetMixers || []) mixer.update(dt);
  return result;
};

window.__DEMON_ASSET_PASS__ = Object.freeze({
  skeleton: SKELETON_SOURCE,
  dungeon: DUNGEON_SOURCE,
  roots: LOCAL,
  mode: 'repository-local-visual-only',
  note: 'Skeleton is an ambient candidate and has no combat or NPC semantics yet.',
});
