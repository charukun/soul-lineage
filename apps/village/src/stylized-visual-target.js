import { stylizedDensityForDistance } from '@soul/characters';
import { THREE as T } from '@soul/rendering';
import { applyStylizedArtProfile, installStylizedGeometryLOD, stylizedArtDiagnostics } from '@soul/rendering/stylized-art';
import { View } from './web/view.js';

const once = (root, profileId, { cloneMaterials = false } = {}) => {
  if (!root?.traverse || root.userData?.stylizedArt?.profileId === profileId) return root;
  applyStylizedArtProfile(root, profileId, { cloneMaterials });
  return root;
};

function wrapFactory(name, profileId) {
  const original = View.prototype[name];
  if (typeof original !== 'function' || original.__stylizedVisualTarget) return;
  const wrapped = function stylizedVillageFactory(...args) {
    // A cached visual template gets one profile-local material set. All clones
    // of that template still share it, while different roles cannot cross-talk.
    return once(original.apply(this, args), profileId, { cloneMaterials: true });
  };
  wrapped.__stylizedVisualTarget = true;
  View.prototype[name] = wrapped;
}

wrapFactory('getProp', 'prop');
wrapFactory('getBuilding', 'environment');
wrapFactory('getFloor', 'environment');

function installStaticLOD(root) {
  for (const child of root?.children || []) {
    const profileId = child.userData?.stylizedArt?.profileId;
    if (['environment', 'prop', 'distant'].includes(profileId)) installStylizedGeometryLOD(child, profileId);
    if (!profileId && child.children?.length) installStaticLOD(child);
  }
}

const matrix = new T.Matrix4(), hidden = new T.Matrix4().makeScale(0, 0, 0), position = new T.Vector3();
const densityHash = index => {
  const x = Math.sin((index + 1) * 91.733 + 17.17) * 43758.5453;
  return x - Math.floor(x);
};

function captureVegetationMatrices(view) {
  for (const instanced of [...(view.forestMeshes || []), ...(view.flowerMeshes || [])]) {
    const base = [];
    for (let i = 0; i < instanced.count; i++) {
      const row = new T.Matrix4(); instanced.getMatrixAt(i, row); base.push(row);
    }
    instanced.userData.stylizedDensityBase = base;
  }
  view.__stylizedDensityTarget = null;
}

function applyVegetationDensity(view) {
  const target = view.target;
  if (!target) return;
  const last = view.__stylizedDensityTarget;
  if (last && Math.hypot(target.x - last.x, target.z - last.z) < 5 && Math.abs(view.span - last.span) < 8) return;
  view.__stylizedDensityTarget = { x: target.x, z: target.z, span: view.span };
  for (const instanced of [...(view.forestMeshes || []), ...(view.flowerMeshes || [])]) {
    const base = instanced.userData.stylizedDensityBase;
    if (!base?.length) continue;
    for (let i = 0; i < base.length; i++) {
      position.setFromMatrixPosition(base[i]);
      const distance = Math.hypot(position.x - target.x, position.z - target.z);
      const density = stylizedDensityForDistance('environment', distance);
      instanced.setMatrixAt(i, densityHash(i + instanced.id * 17) <= density ? base[i] : hidden);
    }
    instanced.instanceMatrix.needsUpdate = true;
  }
}

const rebuild = View.prototype.rebuild;
if (!rebuild.__stylizedVisualTarget) {
  const wrappedRebuild = function stylizedVillageRebuild(...args) {
    const result = rebuild.apply(this, args);
    installStaticLOD(this.objects);
    installStaticLOD(this.inside);
    captureVegetationMatrices(this);
    applyVegetationDensity(this);
    return result;
  };
  wrappedRebuild.__stylizedVisualTarget = true;
  View.prototype.rebuild = wrappedRebuild;
}

const render = View.prototype.render;
if (typeof render === 'function' && !render.__stylizedVisualTarget) {
  const wrappedRender = function stylizedVillageRender(...args) {
    applyVegetationDensity(this);
    return render.apply(this, args);
  };
  wrappedRender.__stylizedVisualTarget = true;
  View.prototype.render = wrappedRender;
}

function installActorBridge(tries = 0) {
  const view = window.village?.view;
  const masterReady = Boolean(window.__MURA_MASTER_CHARACTERS__);
  if (view && (masterReady || tries >= 160) && !view.__stylizedActorBridge) {
    const syncActor = view.syncActor.bind(view);
    view.syncActor = (person, time, monster = false) => {
      const node = syncActor(person, time, monster);
      if (node) once(node, monster || node.userData?.monster ? 'enemy' : 'npc');
      return node;
    };
    view.__stylizedActorBridge = true;
    view.canvas.dataset.visualStyle = 'stylized-low-mid-poly';
    window.__VILLAGE_STYLIZED_TARGET__ = Object.freeze({
      version: 3,
      style: 'stylized-low-mid-poly.v1',
      refreshDensity: () => { view.__stylizedDensityTarget = null; applyVegetationDensity(view); },
      diagnostics: () => ({
        objects: stylizedArtDiagnostics(view.objects),
        actors: stylizedArtDiagnostics(view.actors),
        inside: stylizedArtDiagnostics(view.inside),
        density: view.__stylizedDensityTarget,
      }),
    });
    return;
  }
  if (tries < 240) setTimeout(() => installActorBridge(tries + 1), 50);
}

if (typeof window !== 'undefined') installActorBridge();