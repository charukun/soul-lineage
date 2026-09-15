import { stylizedArtProfile } from '@soul/characters';
import { THREE as T } from '@soul/rendering';
import { createGpuAwareQualityGovernor } from '@soul/rendering/gpu-aware-quality';
import { createGpuTimer } from '@soul/rendering/gpu-timer';
import { applyTextureQuality, auditTextureBudget } from '@soul/rendering/texture-quality';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createVisualDistanceStreamer } from '@soul/rendering/world-streaming';
import { createConservativeOcclusionCuller } from '@soul/rendering/occlusion';
import { batchStaticMeshes } from '@soul/rendering/instance-atlas';
import { createPerformanceRecorder } from '@soul/rendering/performance-lab';
import { auditTransparency, combineTransparencyAudits } from '@soul/rendering/transparency-audit';
import { NightView } from './web/view.js';

const governors = new WeakMap(), enemyFx = stylizedArtProfile('enemy').effects;
const isMobileTarget = () => (typeof innerWidth === 'number' && innerWidth < 800) || /Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent || '');

function setShadowSize(view, scale) {
  const base = innerWidth < 700 ? 512 : 1024, next = Math.max(256,Math.round(base*scale/256)*256);
  if (view.moon?.shadow?.mapSize?.x === next) return;
  view.moon.shadow.mapSize.set(next,next); view.moon.shadow.map?.dispose?.(); view.moon.shadow.map=null; view.renderer.shadowMap.needsUpdate=true;
}

function markCritical(view) {
  for (const root of [view.gate,view.entry,view.back,view.ward]) if (root) root.traverse?.(node=>{node.userData=node.userData||{};node.userData.streamingCritical=true;node.userData.noBatch=true;});
  for (const child of view.environment?.children || []) {
    const geometry = child.geometry;
    if (geometry?.parameters?.width >= 100 || geometry?.parameters?.height >= 100) { child.userData.streamingCritical=true; child.userData.noBatch=true; }
  }
}

function textureBytes(view) {
  return [view.environment,view.actors,view.reaper?.root].filter(Boolean).reduce((sum,root)=>sum+auditTextureBudget(root).estimatedBytes,0);
}

function transparencyAudit(view) {
  return combineTransparencyAudits([view.environment,view.actors,view.reaper?.root].filter(Boolean).map(root=>auditTransparency(root)));
}

function apply(view,snapshot) {
  const q=snapshot.profile; view.__stylizedQuality=snapshot;
  const base=view.__stylizedBasePixelRatio ?? (view.__stylizedBasePixelRatio=view.renderer.getPixelRatio());
  const ratio=Math.max(.55,base*q.renderScale);
  if (Math.abs(view.renderer.getPixelRatio()-ratio)>.01) { view.renderer.setPixelRatio(ratio); view.resize(); }
  setShadowSize(view,q.shadowScale);
  for (const root of [view.environment,view.actors,view.reaper?.root]) if (root) {
    applyTextureQuality(root,{anisotropy:q.textureAnisotropy});
    const own=root.userData?.stylizedArt?.profileId;if(own)applyStylizedShading(root,own);
    for(const child of root.children||[]){const profileId=child.userData?.stylizedArt?.profileId;if(profileId)applyStylizedShading(child,profileId);}
  }
  view.stylizedVfxBudget={...enemyFx,scale:enemyFx.scale*q.vfxScale,maxParticles:Math.max(80,Math.floor(enemyFx.maxParticles*q.vfxScale)),trailSegments:Math.max(8,Math.floor(enemyFx.trailSegments*q.vfxScale))};
  view.__estimatedTextureBytes=textureBytes(view);
}

function occlusionRoots(view) {
  const occluders=[],candidates=[];
  for(const child of view.environment?.children||[]){
    if(child.userData?.streamingCritical||child.userData?.occlusionDisabled||child.userData?.staticBatch)continue;
    const box=new T.Box3().setFromObject(child);if(box.isEmpty())continue;const size=box.getSize(new T.Vector3()),horizontal=Math.max(size.x,size.z);
    if(size.y>2.5&&horizontal>3.5&&horizontal<90)occluders.push(child);
    else if(size.y>.1&&horizontal<35)candidates.push(child);
  }
  return {occluders,candidates};
}

function governorFor(view) {
  if (governors.has(view)) return governors.get(view);
  const streamer=createVisualDistanceStreamer({baseDistance:138,hysteresis:14});
  const gpu=createGpuTimer(view.renderer),recorder=createPerformanceRecorder({label:'demon'}),occlusion=createConservativeOcclusionCuller({maxChecksPerUpdate:6,minDistance:18,hiddenConfirmations:2});
  const governor=createGpuAwareQualityGovernor({targetFps:isMobileTarget()?30:60,onChange:s=>apply(view,s)});
  const state={governor,streamer,gpu,recorder,occlusion,occlusionFrame:0,transparencyFrame:0,transparency:combineTransparencyAudits([]),staticBatch:null,stream:null};governors.set(view,state);markCritical(view);apply(view,governor.snapshot());
  if(typeof window!=='undefined')window.__DEMON_ADAPTIVE_QUALITY__={snapshot:()=>({quality:governor.snapshot(),gpu:gpu.snapshot(),performance:recorder.snapshot(),occlusion:occlusion.snapshot(),transparency:state.transparency,staticBatch:state.staticBatch?{batches:state.staticBatch.batches,instances:state.staticBatch.instances}:null,stream:state.stream,vfx:view.stylizedVfxBudget,textureBytes:view.__estimatedTextureBytes||0})};
  return state;
}

const build=NightView.prototype.build;
if(typeof build==='function'&&!build.__adaptiveVisualPerformance){
 const wrapped=function adaptiveDemonBuild(...args){const result=build.apply(this,args);markCritical(this);const state=governorFor(this);if(!state.staticBatch)state.staticBatch=batchStaticMeshes(this.environment,{minInstances:3,maxInstances:256});apply(this,state.governor.snapshot());return result;};
 wrapped.__adaptiveVisualPerformance=true;NightView.prototype.build=wrapped;
}

const update=NightView.prototype.update;
if(typeof update==='function'&&!update.__adaptiveVisualPerformance){
 const wrapped=function adaptiveDemonUpdate(game,dt,...rest){
  const state=governorFor(this);state.gpu.begin('demon-frame');
  const result=update.call(this,game,dt,...rest);state.gpu.end();const gpu=state.gpu.poll(),snapshot=state.governor.snapshot(),focus=game?.player||this.player?.position||{x:0,z:0};
  for(const actor of this.actors?.children||[]){actor.userData.presentationDistance=Math.hypot((actor.position?.x||0)-(focus.x||0),(actor.position?.z||0)-(focus.z||0));actor.userData.visualQualityLevel=snapshot.level;}
  if(this.reaper?.root){this.reaper.root.userData.presentationDistance=0;this.reaper.root.userData.visualQualityLevel=snapshot.level;}
  this.environment.userData.visualQualityLevel=snapshot.level;for(const child of this.environment.children||[])child.userData.visualQualityLevel=snapshot.level;
  state.stream=state.streamer.update(this.environment,focus,snapshot.profile.streamDistanceScale);
  const next=state.governor.observeFrame(dt,gpu.emaMs);apply(this,next);
  if((state.transparencyFrame++%120)===0)state.transparency=transparencyAudit(this);
  state.recorder.sample({frameMs:dt*1000,gpuMs:gpu.emaMs,drawCalls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,textureBytes:this.__estimatedTextureBytes||0,transparentDrawCalls:state.transparency.blendedDrawCalls,transparentTriangleUpperBound:state.transparency.transparentTriangleUpperBound});
  if((state.occlusionFrame++%10)===0){const roots=occlusionRoots(this);state.occlusion.update({camera:this.camera,...roots});}
  return result;
 };
 wrapped.__adaptiveVisualPerformance=true;NightView.prototype.update=wrapped;
}
