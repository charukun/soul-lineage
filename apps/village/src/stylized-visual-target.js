import { applyStylizedArtProfile, stylizedArtDiagnostics } from '@soul/rendering/stylized-art';
import { View } from './web/view.js';

const once = (root, profileId) => {
  if (!root?.traverse || root.userData?.stylizedArt?.profileId === profileId) return root;
  applyStylizedArtProfile(root, profileId, { cloneMaterials: false });
  return root;
};

function wrapFactory(name, profileId) {
  const original = View.prototype[name];
  if (typeof original !== 'function' || original.__stylizedVisualTarget) return;
  const wrapped = function stylizedVillageFactory(...args) {
    return once(original.apply(this, args), profileId);
  };
  wrapped.__stylizedVisualTarget = true;
  View.prototype[name] = wrapped;
}

// These methods return cached visual templates. Styling once at the cache edge
// keeps clones consistent and avoids per-frame material work.
wrapFactory('getProp', 'prop');
wrapFactory('getBuilding', 'environment');
wrapFactory('getFloor', 'environment');

function installActorBridge(tries = 0) {
  const view = window.village?.view;
  // Wait for the MasterCharacter bridge where available so this wrapper stays
  // outermost and styles both production residents and procedural fallbacks.
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
      version: 1,
      style: 'stylized-low-mid-poly.v1',
      diagnostics: () => ({
        objects: stylizedArtDiagnostics(view.objects),
        actors: stylizedArtDiagnostics(view.actors),
        inside: stylizedArtDiagnostics(view.inside),
      }),
    });
    return;
  }
  if (tries < 240) setTimeout(() => installActorBridge(tries + 1), 50);
}

if (typeof window !== 'undefined') installActorBridge();