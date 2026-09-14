import { applyStylizedArtProfile, stylizedArtDiagnostics } from '@soul/rendering/stylized-art';
import { NightView } from './web/view.js';

const once = (root, profileId) => {
  if (!root?.traverse || root.userData?.stylizedArt?.profileId === profileId) return root;
  applyStylizedArtProfile(root, profileId, { cloneMaterials: false });
  return root;
};

function environmentProfile(node) {
  const repository = String(node?.userData?.source?.repository || '');
  if (/Skeleton/i.test(repository) || /Skeleton/i.test(node?.name || '')) return 'enemy';
  if (node?.userData?.source || /^KayKit_/.test(node?.name || '')) return 'prop';
  return 'environment';
}

function styleView(view) {
  for (const child of view.environment?.children || []) once(child, environmentProfile(child));
  for (const child of view.actors?.children || []) {
    const profileId = child === view.player ? 'enemy'
      : child === view.reaper ? 'hero'
      : child.userData?.monster ? 'enemy' : 'npc';
    once(child, profileId);
  }
  if (view.canvas) view.canvas.dataset.visualStyle = 'stylized-low-mid-poly';
}

const build = NightView.prototype.build;
if (!build.__stylizedVisualTarget) {
  const wrappedBuild = function stylizedDemonBuild(...args) {
    const result = build.apply(this, args);
    styleView(this);
    return result;
  };
  wrappedBuild.__stylizedVisualTarget = true;
  NightView.prototype.build = wrappedBuild;
}

// Repository-local candidate assets finish loading asynchronously. The update
// bridge only scans top-level children and styles newly-arrived roots once.
const update = NightView.prototype.update;
if (!update.__stylizedVisualTarget) {
  const wrappedUpdate = function stylizedDemonUpdate(...args) {
    const result = update.apply(this, args);
    styleView(this);
    return result;
  };
  wrappedUpdate.__stylizedVisualTarget = true;
  NightView.prototype.update = wrappedUpdate;
}

if (typeof window !== 'undefined') {
  window.__DEMON_STYLIZED_TARGET__ = Object.freeze({
    version: 1,
    style: 'stylized-low-mid-poly.v1',
    diagnostics: view => ({
      environment: stylizedArtDiagnostics(view?.environment),
      actors: stylizedArtDiagnostics(view?.actors),
    }),
  });
}