import { stylizedDensityForDistance } from '@soul/characters';
import { THREE as T } from '@soul/rendering';
import { createAdaptiveQualityGovernor } from '@soul/rendering/adaptive-quality';
import { applyTextureQuality } from '@soul/rendering/texture-quality';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createWorldCellStreamingPlan } from '@soul/rendering/world-streaming';
import { View } from './web/view.js';

const governors = new WeakMap(), densityMatrix = new T.Matrix4(), hiddenMatrix = new T.Matrix4().makeScale(0,0,0), densityPosition = new T.Vector3();
const densityHash = index => { const x = Math.sin((index + 1) * 73.173 + 11.7) * 43758.5453; return x - Math.floor(x); };
const isMobileTarget = () => (typeof innerWidth === 'number' && innerWidth < 800) || /Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent || '');

function applyAdaptiveVegetation(view, scale) {
  const target=view.target;if(!target)return;
  const last=view.__adaptiveDensityTarget;
  if(last&&last.level===view.__stylizedQuality?.level&&Math.hypot(target.x-last.x,target.z-last.z)<5)return;
  view.__adaptiveDensityTarget={x:target.x,z:target.z,level:view.__stylizedQuality?.level??0};
  for(const instanced of [...(view.forestMeshes||[]),...(view.flowerMeshes||[])]){
    const base=instanced.userData.stylizedDensityBase;if(!base?.length)continue;
    for(let i=0;i<base.length;i++){densityMatrix.copy(base[i]);densityPosition.setFromMatrixPosition(densityMatrix);const distance=Math.hypot(densityPosition.x-target.x,densityPosition.z-target.z);const density=stylizedDensityForDistance('environment',distance)*scale;instanced.setMatrixAt(i,densityHash(i+instanced.id*31)<=density?base[i]:hiddenMatrix);}
    instanced.instanceMatrix.needsUpdate=true;
  }
}

function setShadowSize(view, scale) {
  const base = view.softwareGPU ? 1024 : 2048, next = Math.max(256, Math.round(base * scale / 256) * 256);
  if (view.sun?.shadow?.mapSize?.x === next) return;
  view.sun.shadow.mapSize.set(next,next);
  view.sun.shadow.map?.dispose?.(); view.sun.shadow.map = null; view.renderer.shadowMap.needsUpdate = true;
}

function apply(view, snapshot) {
  const q = snapshot.profile;
  view.__stylizedQuality = snapshot;
  view.objects.userData.visualQualityLevel = snapshot.level;
  view.outside.userData.visualQualityLevel = snapshot.level;
  view.inside.userData.visualQualityLevel = snapshot.level;
  view.actors.userData.visualQualityLevel = snapshot.level;
  for (const root of [view.objects,view.outside,view.inside,view.actors]) for (const child of root.children || []) child.userData.visualQualityLevel = snapshot.level;
  const baseScale = view.__stylizedBaseRenderScale ?? (view.__stylizedBaseRenderScale = view.renderScale || 1);
  const nextScale = baseScale * q.renderScale;
  if (Math.abs(view.renderScale - nextScale) > .001) { view.renderScale = nextScale; view.resize(); }
  setShadowSize(view,q.shadowScale);
  for (const root of [view.objects,view.outside,view.inside,view.actors]) {
    applyTextureQuality(root,{anisotropy:q.textureAnisotropy});
    for(const child of root.children||[]){const profileId=child.userData?.stylizedArt?.profileId;if(profileId)applyStylizedShading(child,profileId);}
  }
  view.__stylizedDensityTarget = null; view.__adaptiveDensityTarget = null;
  window.__VILLAGE_STYLIZED_TARGET__?.refreshDensity?.();
  applyAdaptiveVegetation(view,q.vegetationScale);
}

function governorFor(view) {
  if (governors.has(view)) return governors.get(view);
  const plan = createWorldCellStreamingPlan({cellSize:32,preloadRadius:2,retainRadius:3});
  const governor = createAdaptiveQualityGovernor({targetFps:isMobileTarget()?30:60,initialLevel:view.softwareGPU?2:0,onChange:s=>apply(view,s)});
  const state = { governor, plan, stream: plan.update(view.target.x,view.target.z) };
  governors.set(view,state); apply(view,governor.snapshot());
  if (typeof window !== 'undefined') window.__VILLAGE_ADAPTIVE_QUALITY__ = { snapshot:()=>({quality:governor.snapshot(),stream:state.stream}) };
  return state;
}

const render = View.prototype.render;
if (typeof render === 'function' && !render.__adaptiveVisualPerformance) {
  const wrapped = function adaptiveVillageRender(time,dt,...rest) {
    const state = governorFor(this), snapshot = state.governor.snapshot(), level = snapshot.level;
    for (const actor of this.actors?.children || []) {
      actor.userData.presentationDistance = Math.hypot((actor.position?.x||0)-this.target.x,(actor.position?.z||0)-this.target.z);
      actor.userData.visualQualityLevel = level;
    }
    state.stream = state.plan.update(this.target.x,this.target.z);
    const result = render.call(this,time,dt,...rest);
    // The base Stylized bridge refreshes its normal distance density inside the
    // wrapped render. Apply the adaptive multiplier afterwards so it cannot be
    // overwritten; these matrices become the next frame's presentation state.
    applyAdaptiveVegetation(this,snapshot.profile.vegetationScale);
    state.governor.observeFrame(dt);
    return result;
  };
  wrapped.__adaptiveVisualPerformance = true;
  View.prototype.render = wrapped;
}
