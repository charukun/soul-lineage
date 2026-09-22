import { THREE as T } from '@soul/rendering';
import { createGpuAwareQualityGovernor } from '@soul/rendering/gpu-aware-quality';
import { createGpuTimer } from '@soul/rendering/gpu-timer';
import { applyTextureQuality, auditTextureBudget } from '@soul/rendering/texture-quality';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createWorldCellStreamingPlan } from '@soul/rendering/world-streaming';
import { createConservativeOcclusionCuller } from '@soul/rendering/occlusion';
import { createPerformanceRecorder } from '@soul/rendering/performance-lab';
import { auditTransparency, combineTransparencyAudits } from '@soul/rendering/transparency-audit';
import { createThermalTrendGovernor } from '@soul/rendering/thermal-governor';
import { applyVisualQualityFloor } from '@soul/rendering/visual-quality-floor';
import { deviceCapabilityProfile, saveDeviceCapability } from '@soul/platform-web/device-capability';
import { visualSceneTrackerFor } from './visual-scene-tracker.js';
import { View } from './web/view.js';

const governors = new WeakMap();
// Vegetation density is applied once by stylized-visual-target before rendering.
// A governor change is picked up there on the next frame, never by a competing
// post-render pass with a different random mask.

function setShadowSize(view, scale) {
  const base = view.softwareGPU ? 1024 : 2048, next = Math.max(256, Math.round(base * scale / 256) * 256);
  if (view.sun?.shadow?.mapSize?.x === next) return;
  view.sun.shadow.mapSize.set(next,next);
  view.sun.shadow.map?.dispose?.(); view.sun.shadow.map = null; view.renderer.shadowMap.needsUpdate = true;
}

function transparencyAudit(view) {
  return combineTransparencyAudits([view.objects,view.outside,view.inside,view.actors].map(root=>auditTransparency(root)));
}

function performanceScene(view) {
  const vegetationInstances=[...(view.forestMeshes||[]),...(view.flowerMeshes||[])].reduce((sum,mesh)=>sum+(Number(mesh?.count)||0),0);
  const actors=view.actors?.children?.length||0,outsideRoots=view.outside?.children?.length||0,insideRoots=view.inside?.children?.length||0,objectRoots=view.objects?.children?.length||0;
  return Object.freeze({id:'village-runtime-v1',actors,outsideRoots,insideRoots,objectRoots,vegetationInstances,signature:`a${actors}-o${outsideRoots}-i${insideRoots}-r${objectRoots}-v${vegetationInstances}`});
}

function apply(view, snapshot) {
  const q=snapshot.profile,npcQuality=applyVisualQualityFloor(q,'npc'),state=governors.get(view);
  view.__stylizedQuality = snapshot;
  const baseScale = view.__stylizedBaseRenderScale ?? (view.__stylizedBaseRenderScale = view.renderScale || 1);
  const nextScale = baseScale * q.renderScale;
  if (Math.abs(view.renderScale - nextScale) > .001) { view.renderScale = nextScale; view.resize(); }
  setShadowSize(view,q.shadowScale);
  for(const root of [view.objects,view.outside,view.inside,view.actors]){
    const anisotropy=root===view.actors?npcQuality.textureAnisotropy:q.textureAnisotropy;
    const key=`${snapshot.level}:${anisotropy}:${state.tracker.revision(root)}`;
    if(state.sceneKeys.get(root)===key)continue;
    root.userData.visualQualityLevel=snapshot.level;
    applyTextureQuality(root,{anisotropy});
    for(const child of root.children){child.userData.visualQualityLevel=snapshot.level;const profileId=child.userData?.stylizedArt?.profileId;if(profileId)applyStylizedShading(child,profileId);}
    state.textureBytes.set(root,auditTextureBudget(root).estimatedBytes);state.sceneKeys.set(root,key);
  }
  view.__estimatedTextureBytes=[...state.textureBytes.values()].reduce((a,b)=>a+b,0);

}

function occlusionRoots(view) {
  const occluders=[],candidates=[];
  for(const child of view.outside?.children||[]){
    if(child.isInstancedMesh||child.userData?.streamingCritical||child.userData?.occlusionDisabled)continue;
    const box=new T.Box3().setFromObject(child);if(box.isEmpty())continue;const size=box.getSize(new T.Vector3()),horizontal=Math.max(size.x,size.z);
    if(size.y>2.5&&horizontal>4&&horizontal<120)occluders.push(child);
    else if(size.y>.15&&horizontal<30)candidates.push(child);
  }
  return {occluders,candidates};
}

function governorFor(view) {
  if (governors.has(view)) return governors.get(view);
  const device=deviceCapabilityProfile({renderer:view.renderer});
  saveDeviceCapability(device);
  const plan = createWorldCellStreamingPlan({cellSize:32,preloadRadius:2,retainRadius:3});
  const gpu=createGpuTimer(view.renderer),recorder=createPerformanceRecorder({label:'village',snapshotOnSample:false}),occlusion=createConservativeOcclusionCuller({maxChecksPerUpdate:5,minDistance:24,hiddenConfirmations:2});
  const thermal=createThermalTrendGovernor({sampleEverySeconds:5,baselineSamples:6,windowSamples:12});
  const governor = createGpuAwareQualityGovernor({targetFps:device.targetFps,initialLevel:Math.max(view.softwareGPU?2:0,device.initialQuality),bottleneckFrames:12,onChange:s=>apply(view,s)});
  const state = { tracker:visualSceneTrackerFor(view),sceneKeys:new Map(),textureBytes:new Map(),occlusionRevision:-1,occlusionRoots:null,governor, plan, gpu, recorder, occlusion, thermal, device, occlusionFrame:0, transparencyFrame:0, transparency:combineTransparencyAudits([]), stream: plan.update(view.target.x,view.target.z) };
  governors.set(view,state); apply(view,governor.snapshot());
  if (typeof window !== 'undefined') window.__VILLAGE_ADAPTIVE_QUALITY__ = { snapshot:()=>({quality:governor.snapshot(),device,gpu:gpu.snapshot(),thermal:thermal.snapshot(),performance:recorder.snapshot(),occlusion:occlusion.snapshot(),transparency:state.transparency,scene:performanceScene(view),stream:state.stream,textureBytes:view.__estimatedTextureBytes||0}) };
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
    apply(this,snapshot);
    state.stream = state.plan.update(this.target.x,this.target.z);
    state.gpu.begin('village-frame');
    const result = render.call(this,time,dt,...rest);
    state.gpu.end(); const gpu=state.gpu.poll();
    let next=state.governor.observeFrame(dt,gpu.emaMs);
    const thermal=state.thermal.observe(dt,dt*1000,gpu.emaMs);
    if(thermal.recommendedMinLevel>next.level)next=state.governor.setLevel(thermal.recommendedMinLevel);
    if((state.transparencyFrame++%120)===0)state.transparency=transparencyAudit(this);
    state.recorder.sample({frameMs:dt*1000,gpuMs:gpu.emaMs,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textureBytes:this.__estimatedTextureBytes||0,transparentDrawCalls:state.transparency.blendedDrawCalls,transparentTriangleUpperBound:state.transparency.transparentTriangleUpperBound});
    if((state.occlusionFrame++%12)===0){
      const revision=state.tracker.revision(this.outside);
      if(state.occlusionRevision!==revision){state.occlusion.revealAll(state.occlusionRoots?.candidates);state.occlusionRoots=occlusionRoots(this);state.occlusionRevision=revision;}
      state.occlusion.update({camera:this.camera,...state.occlusionRoots});
    }
    return result;
  };
  wrapped.__adaptiveVisualPerformance = true;
  View.prototype.render = wrapped;
}
