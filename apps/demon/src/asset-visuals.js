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
const PARTICLE_SOURCE = Object.freeze({
  repository: 'Calinou/kenney-particle-pack',
  commit: 'ab7086639ee73be31abd87feb21bf1402d4e8144',
  license: 'CC0-1.0',
  manifest: 'assets/vendor/kenney-particles/MANIFEST.json',
  files: Object.freeze(['spark_05.png', 'slash_03.png', 'smoke_05.png', 'flare_01.png']),
});
const LOCAL = Object.freeze({
  skeletons: `${import.meta.env.BASE_URL}assets/vendor/kaykit-skeletons`,
  dungeon: `${import.meta.env.BASE_URL}assets/vendor/kaykit-dungeon`,
  particles: `${import.meta.env.BASE_URL}assets/vendor/kenney-particles`,
});
const loader = new GLTFLoader();
const textureLoader = new T.TextureLoader();
const cache = new Map();
const particleTextures = new Map();

function load(url) {
  if (!cache.has(url)) cache.set(url, loader.loadAsync(url).catch(error => { cache.delete(url); throw error; }));
  return cache.get(url);
}
function particleTexture(file) {
  if (particleTextures.has(file)) return particleTextures.get(file);
  const url = `${LOCAL.particles}/${file}`;
  const texture = textureLoader.load(url, loaded => {
    loaded.colorSpace = T.SRGBColorSpace;
    loaded.needsUpdate = true;
  }, undefined, error => console.warn(`[尽喰廻遊] local particle texture failed: ${file}`, error));
  texture.colorSpace = T.SRGBColorSpace;
  particleTextures.set(file, texture);
  return texture;
}
function primeParticleTextures() {
  for (const file of PARTICLE_SOURCE.files) particleTexture(file);
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
    console.warn('[尽喰廻遊] local skeleton visual candidate failed', error);
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
      console.warn(`[尽喰廻遊] local dungeon prop failed: ${file}`, error);
    }
  }));
}

// Reuse the existing bounded particle simulation and only replace its texture/material layer.
NightView.prototype.spark = function sourcedSpark(x, y, z, color, count = 16, inward = false) {
  const geometry = new T.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const velocity = [];
  for (let i = 0; i < count; i++) {
    const angle = i * 2.399;
    positions.set([x, y, z], i * 3);
    velocity.push([Math.cos(angle) * (1 + i % 4), .8 + (i % 5) * .65, Math.sin(angle) * (1 + i % 3)]);
  }
  geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
  const mesh = new T.Points(geometry, new T.PointsMaterial({
    color,
    size: inward ? .22 : .13,
    map: particleTexture(inward ? 'smoke_05.png' : 'spark_05.png'),
    alphaTest: .025,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: T.AdditiveBlending,
    sizeAttenuation: true,
  }));
  mesh.userData.visualOnly = true;
  mesh.userData.source = PARTICLE_SOURCE;
  this.effects.add(mesh);
  this.fx.push({ mesh, age: 0, life: inward ? .82 : .7, vel: velocity, inward });
};

const originalSlash = NightView.prototype.slash;
NightView.prototype.slash = function sourcedSlash(x, z, yaw) {
  originalSlash.call(this, x, z, yaw);
  const geometry = new T.PlaneGeometry(1.9, 1.9);
  const material = new T.MeshBasicMaterial({
    map: particleTexture('slash_03.png'),
    color: 0xe8ddbe,
    transparent: true,
    opacity: .82,
    alphaTest: .02,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, .08, z);
  mesh.rotation.set(-Math.PI / 2, 0, -yaw + .3);
  mesh.userData.visualOnly = true;
  mesh.userData.source = PARTICLE_SOURCE;
  this.effects.add(mesh);
  this.fx.push({ mesh, age: 0, life: .18 });
};

function addFlare(view, x, y, z, color, scale = 1.5) {
  const geometry = new T.PlaneGeometry(scale, scale);
  const material = new T.MeshBasicMaterial({
    map: particleTexture('flare_01.png'),
    color,
    transparent: true,
    opacity: .72,
    alphaTest: .01,
    depthWrite: false,
    side: T.DoubleSide,
    blending: T.AdditiveBlending,
  });
  const mesh = new T.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.quaternion.copy(view.camera.quaternion);
  mesh.userData.visualOnly = true;
  mesh.userData.source = PARTICLE_SOURCE;
  view.effects.add(mesh);
  view.fx.push({ mesh, age: 0, life: .24 });
}

const originalEvent = NightView.prototype.event;
NightView.prototype.event = function eventWithSourcedVfx(event) {
  const result = originalEvent.call(this, event);
  if (event.type === 'gate') addFlare(this, event.x, 1, event.z, 0xc8a775, 2.2);
  if (event.type === 'shadow') {
    addFlare(this, event.x, 1, event.z, 0x83bdba, 1.7);
    addFlare(this, event.tx, 1, event.tz, 0x83bdba, 1.7);
  }
  return result;
};

const originalBuild = NightView.prototype.build;
NightView.prototype.build = function buildWithAssetPass(world) {
  const result = originalBuild.call(this, world);
  this.__assetPassGeneration = (this.__assetPassGeneration || 0) + 1;
  this.__assetMixers = [];
  const generation = this.__assetPassGeneration;
  primeParticleTextures();
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
  particles: PARTICLE_SOURCE,
  roots: LOCAL,
  mode: 'repository-local-visual-only',
  note: 'Sourced particles replace only the visual material layer; combat and NPC semantics are unchanged. Skeleton remains ambient-only.',
});
