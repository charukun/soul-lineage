import { stylizedArtProfile } from '@soul/characters';
import { createAdaptiveQualityGovernor } from '@soul/rendering/adaptive-quality';
import { applyTextureQuality } from '@soul/rendering/texture-quality';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createVisualDistanceStreamer } from '@soul/rendering/world-streaming';
import { NightView } from './web/view.js';

const governors = new WeakMap(), enemyFx = stylizedArtProfile('enemy').effects;
const isMobileTarget = () => (typeof innerWidth === 'number' && innerWidth < 800) || /Android|iPhone|iPad/i.test(globalThis.navigator?.userAgent || '');

function setShadowSize(view, scale) {
  const base = innerWidth < 700 ? 512 : 1024, next = Math.max(256,Math.round(base*scale/256)*256);
  if (view.moon?.shadow?.mapSize?.x === next) return;
  view.moon.shadow.mapSize.set(next,next); view.moon.shadow.map?.dispose?.(); view.moon.shadow.map=null; view.renderer.shadowMap.needsUpdate=true;
}

function markCritical(view) {
  for (const node of [view.gate,view.entry,view.back,view.ward]) if (node?.userData) node.userData.streamingCritical=true;
  for (const child of view.environment?.children || []) {
    const geometry = child.geometry;
    if (geometry?.parameters?.width >= 100 || geometry?.parameters?.height >= 100) child.userData.streamingCritical=true;
  }
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
}

function governorFor(view) {
  if (governors.has(view)) return governors.get(view);
  const streamer=createVisualDistanceStreamer({baseDistance:138,hysteresis:14});
  const governor=createAdaptiveQualityGovernor({targetFps:isMobileTarget()?30:60,onChange:s=>apply(view,s)});
  const state={governor,streamer,stream:null};governors.set(view,state);markCritical(view);apply(view,governor.snapshot());
  if(typeof window!=='undefined')window.__DEMON_ADAPTIVE_QUALITY__={snapshot:()=>({quality:governor.snapshot(),stream:state.stream,vfx:view.stylizedVfxBudget})};
  return state;
}

const build=NightView.prototype.build;
if(typeof build==='function'&&!build.__adaptiveVisualPerformance){
 const wrapped=function adaptiveDemonBuild(...args){const result=build.apply(this,args);markCritical(this);const state=governorFor(this);apply(this,state.governor.snapshot());return result;};
 wrapped.__adaptiveVisualPerformance=true;NightView.prototype.build=wrapped;
}

const update=NightView.prototype.update;
if(typeof update==='function'&&!update.__adaptiveVisualPerformance){
 const wrapped=function adaptiveDemonUpdate(game,dt,...rest){
  const result=update.call(this,game,dt,...rest),state=governorFor(this),snapshot=state.governor.snapshot(),focus=game?.player||this.player?.position||{x:0,z:0};
  for(const actor of this.actors?.children||[]){actor.userData.presentationDistance=Math.hypot((actor.position?.x||0)-(focus.x||0),(actor.position?.z||0)-(focus.z||0));actor.userData.visualQualityLevel=snapshot.level;}
  if(this.reaper?.root){this.reaper.root.userData.presentationDistance=0;this.reaper.root.userData.visualQualityLevel=snapshot.level;}
  this.environment.userData.visualQualityLevel=snapshot.level;for(const child of this.environment.children||[])child.userData.visualQualityLevel=snapshot.level;
  state.stream=state.streamer.update(this.environment,focus,snapshot.profile.streamDistanceScale);
  apply(this,snapshot);state.governor.observeFrame(dt);return result;
 };
 wrapped.__adaptiveVisualPerformance=true;NightView.prototype.update=wrapped;
}
