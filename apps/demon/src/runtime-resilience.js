import { THREE as T } from '@soul/rendering';
import { createShaderWarmupManager } from '@soul/rendering/shader-warmup';
import { createResourceLifetimeManager, createResourceLeakSentinel } from '@soul/rendering/resource-lifetime';
import { installWebGLContextRecovery } from '@soul/rendering/context-recovery';
import { installStylizedBakedLighting } from '@soul/rendering/baked-lighting';
import { installSilhouetteImpostorLOD } from '@soul/rendering/impostor-lod';
import { markVisualQualityPriority } from '@soul/rendering/visual-quality-floor';
import { NightView } from './web/view.js';

const states = new WeakMap();
const schedule = fn => (globalThis.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0));

function stableSceneKey(view) {
  const world = view.world;
  return `${world?.id || world?.seed || 'demon'}:${world?.entities?.length || 0}:${world?.npcs?.length || 0}`;
}

function disposeImpostors(state) {
  for (const controller of state.impostors) controller.dispose();
  state.impostors.length = 0;
}

function installImpostors(view, state) {
  disposeImpostors(state);
  for (const child of view.environment?.children || []) {
    if (state.impostors.length >= 8) break;
    if (!child?.traverse || child.isMesh || child.userData?.streamingCritical || child.userData?.interactive || child.userData?.impostorDisabled || child.userData?.staticBatch) continue;
    const box = new T.Box3().setFromObject(child); if (box.isEmpty()) continue;
    const size = box.getSize(new T.Vector3()), horizontal = Math.max(size.x, size.z);
    if (horizontal < 2.5 || horizontal > 72 || size.y < .6 || size.y > 45) continue;
    const controller = installSilhouetteImpostorLOD(child, { distance: 88, views: 8, size: 96 });
    if (controller) state.impostors.push(controller);
  }
}

function refreshWarmupPass(view,state){
  state.warmup.registerPass('main',view.scene,view.camera,{exposeRoots:[view.environment,view.actors,view.effects,view.reaper?.root].filter(Boolean)});
}

function registerWorld(view, state) {
  state.lifetime.release('world');
  for (const root of [view.environment, view.actors, view.effects, view.reaper?.root].filter(Boolean)) state.lifetime.retainObject3D('world', root);
  refreshWarmupPass(view,state);
  state.lighting.apply(view.environment); state.lighting.apply(view.actors);
  if (view.player) markVisualQualityPriority(view.player, 'enemy');
  if (view.reaper?.root) markVisualQualityPriority(view.reaper.root, 'hero');
  for (const root of [view.gate, view.entry, view.back, view.ward].filter(Boolean)) markVisualQualityPriority(root, 'critical');
  installImpostors(view, state);
  state.lastLeak = state.leak.observe(stableSceneKey(view));
}

function disposeWarmupMesh(mesh) {
  if (!mesh) return;
  if (mesh.parent) mesh.parent.remove(mesh);
  mesh.geometry?.dispose?.();
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  for (const material of materials) material?.dispose?.();
}

async function warmupDemon(view, state, reason) {
  const before = view.fx?.length || 0;
  const beforeChildren = new Set(view.effects?.children || []);
  try {
    view.spark?.(0, -1000, 0, 0xffffff, 1, false);
    view.slash?.(0, -1000, 0);
    for (const fx of (view.fx || []).slice(before)) if (fx.mesh) { fx.mesh.frustumCulled = false; fx.mesh.visible = true; }
    for (const child of view.effects?.children || []) if (!beforeChildren.has(child)) { child.frustumCulled = false; child.visible = true; }
    await state.warmup.warmup(reason);
  } finally {
    const extra = (view.fx || []).splice(before);
    const meshes = new Set(extra.map(fx => fx?.mesh).filter(Boolean));
    for (const child of view.effects?.children || []) if (!beforeChildren.has(child)) meshes.add(child);
    for (const mesh of meshes) disposeWarmupMesh(mesh);
  }
}

function scheduleWarmup(view, state, reason) {
  if (state.warmupPending) return;
  state.warmupPending = true;
  schedule(() => {
    state.warmupPending = false;
    warmupDemon(view, state, reason).catch(error => console.warn('[尽喰廻遊 shader warmup]', error));
  });
}

function ensure(view) {
  if (states.has(view)) return states.get(view);
  const warmup = createShaderWarmupManager(view.renderer, { maxVariants: 320 });
  warmup.registerPass('main', view.scene, view.camera, { exposeRoots: [view.environment, view.actors, view.effects, view.reaper?.root].filter(Boolean) });
  const lifetime = createResourceLifetimeManager({ renderer: view.renderer, label: 'demon' });
  const leak = createResourceLeakSentinel({ renderer: view.renderer, warmupSamples: 2, limits: { maxGeometryGrowth: 10, maxTextureGrowth: 5, maxProgramGrowth: 8 } });
  const lighting = installStylizedBakedLighting(view.scene, { cool: 0x779dba, ground: 0x38473c, warm: 0xe9a05b, intensity: .14 });
  const state = { warmup, lifetime, leak, lighting, context: null, impostors: [], frames: 0, lastLeak: null, warmupPending: false };
  states.set(view, state);
  state.context = installWebGLContextRecovery({
    canvas: view.canvas,
    renderer: view.renderer,
    onLost: () => { view.canvas.dataset.rendererRecovery = 'lost'; },
    onRestore: async () => {
      view.resize(); view.renderer.shadowMap.needsUpdate = true;
      registerWorld(view, state);
      await warmupDemon(view, state, 'context-restored');
      view.canvas.dataset.rendererRecovery = 'ready';
    },
  });
  if (typeof window !== 'undefined') {
    window.__DEMON_RUNTIME_RESILIENCE__ = {
      snapshot: () => ({ shader: warmup.snapshot(), resources: lifetime.snapshot(), leak: state.lastLeak || leak.snapshot(), context: state.context.snapshot(), lighting: lighting.snapshot(), impostors: state.impostors.map(row => row.snapshot()) }),
    };
  }
  return state;
}

const build = NightView.prototype.build;
if (typeof build === 'function' && !build.__runtimeResilience) {
  const wrapped = function resilientDemonBuild(...args) {
    const existing = states.get(this); if (existing) disposeImpostors(existing);
    const result = build.apply(this, args);
    const state = ensure(this); registerWorld(this, state); scheduleWarmup(this, state, 'demon-build');
    return result;
  };
  wrapped.__runtimeResilience = true; NightView.prototype.build = wrapped;
}

const update = NightView.prototype.update;
if (typeof update === 'function' && !update.__runtimeResilience) {
  const wrapped = function resilientDemonUpdate(...args) {
    const state = ensure(this);
    for (const controller of state.impostors) controller.update(this.camera);
    const result = update.apply(this, args);
    if ((++state.frames % 600) === 0) state.lastLeak = state.leak.observe(stableSceneKey(this));
    return result;
  };
  wrapped.__runtimeResilience = true; NightView.prototype.update = wrapped;
}

const prepareCharacter=NightView.prototype.prepareCharacter;
if(typeof prepareCharacter==='function'&&!prepareCharacter.__runtimeResilience){
  const wrapped=async function resilientPrepareCharacter(...args){const result=await prepareCharacter.apply(this,args);const state=ensure(this);registerWorld(this,state);scheduleWarmup(this,state,'character-ready');return result;};
  wrapped.__runtimeResilience=true;NightView.prototype.prepareCharacter=wrapped;
}
