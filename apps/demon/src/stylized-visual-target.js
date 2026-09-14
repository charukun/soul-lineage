import { stylizedArtProfile } from '@soul/characters';
import { applyStylizedArtProfile, installStylizedGeometryLOD, stylizedArtDiagnostics } from '@soul/rendering/stylized-art';
import { NightView } from './web/view.js';

const enemyProfile = stylizedArtProfile('enemy');
const once = (root, profileId) => {
  if (!root?.traverse) return root;
  if (root.userData?.stylizedArt?.profileId !== profileId) applyStylizedArtProfile(root, profileId, { cloneMaterials: false });
  if (['environment', 'prop', 'distant'].includes(profileId) && root.userData?.stylizedLOD?.profileId !== profileId) {
    installStylizedGeometryLOD(root, profileId);
  }
  return root;
};

function environmentProfile(node) {
  const repository = String(node?.userData?.source?.repository || '');
  if (/Skeleton/i.test(repository) || /Skeleton/i.test(node?.name || '')) return 'enemy';
  if (node?.userData?.source || /^KayKit_/.test(node?.name || '')) return 'prop';
  return 'environment';
}

function activePointCount(view) {
  return (view.fx || []).reduce((sum, fx) => sum + (fx.mesh?.isPoints ? (fx.mesh.geometry?.attributes?.position?.count || 0) : 0), 0);
}

const spark = NightView.prototype.spark;
if (typeof spark === 'function' && !spark.__stylizedVisualTarget) {
  const wrappedSpark = function stylizedSpark(x, y, z, color, count = 16, inward = false) {
    const budget = this.stylizedVfxBudget || enemyProfile.effects;
    const remaining = Math.max(0, budget.maxParticles - activePointCount(this));
    // Low-poly presentation can spend some of the saved geometry budget on a
    // denser hit/feed burst, but never exceed the shared active-particle cap.
    const boosted = Math.ceil(count * (.85 + budget.scale * .35));
    const allowed = Math.min(remaining, boosted);
    if (allowed <= 0) return;
    const result = spark.call(this, x, y, z, color, allowed, inward);
    const fx = this.fx?.at(-1);
    if (fx?.mesh?.isPoints) {
      fx.mesh.material.size *= .96 + budget.scale * .16;
      fx.life *= .94 + budget.scale * .14;
      fx.mesh.userData.stylizedVfxBudget = { ...budget, activePoints: activePointCount(this) };
    }
    return result;
  };
  wrappedSpark.__stylizedVisualTarget = true;
  NightView.prototype.spark = wrappedSpark;
}

const slash = NightView.prototype.slash;
if (typeof slash === 'function' && !slash.__stylizedVisualTarget) {
  const wrappedSlash = function stylizedSlash(...args) {
    const result = slash.apply(this, args);
    const budget = this.stylizedVfxBudget || enemyProfile.effects;
    const fx = this.fx?.at(-1);
    if (fx?.mesh) {
      const gain = .96 + budget.scale * .12;
      fx.mesh.scale.multiplyScalar(gain);
      fx.mesh.userData.stylizedVfxBudget = { ...budget };
    }
    return result;
  };
  wrappedSlash.__stylizedVisualTarget = true;
  NightView.prototype.slash = wrappedSlash;
}

function styleView(view) {
  for (const child of view.environment?.children || []) once(child, environmentProfile(child));
  for (const child of view.actors?.children || []) {
    const profileId = child === view.player ? 'enemy' : child.userData?.monster ? 'enemy' : 'npc';
    once(child, profileId);
  }
  if (view.reaper?.root) once(view.reaper.root, 'hero');
  if (view.canvas) view.canvas.dataset.visualStyle = 'stylized-low-mid-poly';
  view.stylizedVfxBudget = enemyProfile.effects;
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
    version: 3,
    style: 'stylized-low-mid-poly.v1',
    vfxBudget: enemyProfile.effects,
    diagnostics: view => ({
      environment: stylizedArtDiagnostics(view?.environment),
      actors: stylizedArtDiagnostics(view?.actors),
      hero: stylizedArtDiagnostics(view?.reaper?.root),
      vfx: { activePoints: activePointCount(view), budget: view?.stylizedVfxBudget || enemyProfile.effects },
    }),
  });
}