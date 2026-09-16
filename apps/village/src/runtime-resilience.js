import { THREE as T } from '@soul/rendering';
import { createShaderWarmupManager } from '@soul/rendering/shader-warmup';
import { createResourceLifetimeManager, createResourceLeakSentinel } from '@soul/rendering/resource-lifetime';
import { installWebGLContextRecovery } from '@soul/rendering/context-recovery';
import { installStylizedBakedLighting } from '@soul/rendering/baked-lighting';
import { installSilhouetteImpostorLOD } from '@soul/rendering/impostor-lod';
import { markVisualQualityPriority } from '@soul/rendering/visual-quality-floor';
import { View } from './web/view.js';
import { visualSceneTrackerFor } from './visual-scene-tracker.js';

const states = new WeakMap();
const schedule = fn => (globalThis.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 0));

function stableSceneKey(view) {
  const world = view.world;
  return `${world?.id || 'village'}:${world?.objects?.length || 0}:${view.roomId || '-'}`;
}

function eligibleImpostorRoots(view) {
  const rows = [];
  for (const child of view.outside?.children || []) {
    if (!child?.traverse || child.isMesh || child.userData?.streamingCritical || child.userData?.interactive || child.userData?.impostorDisabled) continue;
    const explicit = child.userData?.visualOnly || child.userData?.impostorAllowed || /forest|tree|rock|ridge|hill|cliff/i.test(child.name || '');
    if (!explicit) continue;
    const box = new T.Box3().setFromObject(child); if (box.isEmpty()) continue;
    const size = box.getSize(new T.Vector3()), horizontal = Math.max(size.x, size.z);
    if (horizontal < 2 || horizontal > 90 || size.y < .4 || size.y > 60) continue;
    rows.push(child); if (rows.length >= 6) break;
  }
  return rows;
}

function disposeImpostors(state) {
  for (const controller of state.impostors) controller.dispose();
  state.impostors.length = 0;
}

function installImpostors(view, state) {
  disposeImpostors(state);
  for (const root of eligibleImpostorRoots(view)) {
    const controller = installSilhouetteImpostorLOD(root, { distance: 135, views: 8, size: 96 });
    if (controller) state.impostors.push(controller);
  }
}

function registerWorldResources(view, state) {
  const owner=`world:${state.worldGeneration=(state.worldGeneration||0)+1}`;
  for (const root of [view.outside,view.objects,view.inside,view.actors]) state.lifetime.retainObject3D(owner,root);
  if(state.worldOwner)state.lifetime.release(state.worldOwner);
  state.worldOwner=owner;
  state.lighting.apply(view.outside); state.lighting.apply(view.objects); state.lighting.apply(view.inside);
  markVisualQualityPriority(view.selection, 'critical');
  const tracker=visualSceneTrackerFor(view);
  if(state.outsideRevision!==tracker.revision(view.outside)){installImpostors(view,state);state.outsideRevision=tracker.revision(view.outside);}
  state.lastLeak = state.leak.observe(stableSceneKey(view));
}

function scheduleWarmup(view, state, reason) {
  if (state.warmupPending) return;
  state.warmupPending = true;
  schedule(() => {
    state.warmupPending = false;
    state.warmup.warmup(reason).catch(error => console.warn('[MURAAAAAAA shader warmup]', error));
  });
}

function ensure(view) {
  if (states.has(view)) return states.get(view);
  const warmup = createShaderWarmupManager(view.renderer, { maxVariants: 320 });
  warmup.registerPass('main', view.scene, view.camera, { exposeRoots: [view.inside, view.actors] });
  if (view.postScene && view.postCamera) warmup.registerPass('post', view.postScene, view.postCamera);
  const lifetime = createResourceLifetimeManager({ renderer: view.renderer, label: 'village' });
  const leak = createResourceLeakSentinel({ renderer: view.renderer, warmupSamples: 2, limits: { maxGeometryGrowth: 10, maxTextureGrowth: 5, maxProgramGrowth: 8 } });
  const lighting = installStylizedBakedLighting(view.scene, { cool: 0xa9bfd2, ground: 0x718066, warm: 0xffba73, intensity: .15 });
  const state = { warmup, lifetime, leak, lighting, context: null, impostors: [], frames: 0, lastLeak: null, warmupPending: false };
  states.set(view, state);
  state.context = installWebGLContextRecovery({
    canvas: view.canvas,
    renderer: view.renderer,
    onLost: () => { view.canvas.dataset.rendererRecovery = 'lost'; },
    onRestore: async () => {
      view.resize();
      if (view.rt) view.rt.setSize(view.rt.width, view.rt.height);
      view.renderer.shadowMap.needsUpdate = true;
      registerWorldResources(view, state);
      await state.warmup.warmup('context-restored');
      view.canvas.dataset.rendererRecovery = 'ready';
    },
  });
  if (typeof window !== 'undefined') {
    window.__VILLAGE_RUNTIME_RESILIENCE__ = {
      snapshot: () => ({ shader: warmup.snapshot(), resources: lifetime.snapshot(), leak: state.lastLeak || leak.snapshot(), context: state.context.snapshot(), lighting: lighting.snapshot(), impostors: state.impostors.map(row => row.snapshot()) }),
    };
  }
  return state;
}

const rebuild = View.prototype.rebuild;
if (typeof rebuild === 'function' && !rebuild.__runtimeResilience) {
  const wrapped = function resilientVillageRebuild(...args) {
    const result = rebuild.apply(this, args);
    if(result?.changed===false&&states.get(this)?.outsideRevision===visualSceneTrackerFor(this).revision(this.outside))return result;
    const state = ensure(this); registerWorldResources(this, state); scheduleWarmup(this, state, 'village-rebuild');
    return result;
  };
  wrapped.__runtimeResilience = true; View.prototype.rebuild = wrapped;
}

const render = View.prototype.render;
if (typeof render === 'function' && !render.__runtimeResilience) {
  const wrapped = function resilientVillageRender(...args) {
    const state = ensure(this);
    for (const controller of state.impostors) controller.update(this.camera);
    const result = render.apply(this, args);
    if ((++state.frames % 600) === 0) state.lastLeak = state.leak.observe(stableSceneKey(this));
    return result;
  };
  wrapped.__runtimeResilience = true; View.prototype.render = wrapped;
}
