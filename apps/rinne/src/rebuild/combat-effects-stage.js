import {createAuthoredEffectPlayer} from './authored-effect-player.js';
import {authoredEffectBase,createEffekseerBackend} from './effekseer-loader.js';
import {AUTHORED_EFFECTS} from './authored-effect-manifest.js';
import {createVfxStreamingDemand} from './vfx-streaming.js';
import {createImpactDirector} from './impact-director.js';
import {inspirationAfterimageCue} from './combat-effect-cues.js';
import {createImpactPresentationRuntime} from './impact-presentation-runtime.js';
import {clearRinneImpactAudio,presentRinneImpactAudio,presentRinneInspirationAudio} from '../gameplay-audio.js';

function anchorMap(director,state,front){
  const anchors={},hero=director.weaponAnchor(state);if(hero)anchors.hero=hero;
  for(const enemy of front?.enemies||[]){if(enemy.dead)continue;const anchor=director.weaponAnchor(enemy);if(anchor)anchors[`enemy:${enemy.id}`]=anchor;}
  return anchors;
}
function anticipationCue(row){const color=row.enemy?[255,126,96,220]:[255,236,196,245];return{effect:'slash',position:{...row.anchor.position},rotation:{...row.anchor.rotation},scale:row.enemy?.72:.92,lifetime:.46,color,priority:1,kind:'anticipation-trail',followKey:row.followKey};}

/** Install into the existing scene pass, including its HDR/depth/focus target. */
export function installCombatEffects(view,{document,canvas,backendFactory=createEffekseerBackend}={}){
  const T=view.THREE,win=document.defaultView||globalThis;
  const mobile=Boolean(win.matchMedia?.('(pointer: coarse)').matches);
  const motion=win.matchMedia?.('(prefers-reduced-motion: reduce)');
  const baseUrl=authoredEffectBase(document),abort=new AbortController();
  const player=createAuthoredEffectPlayer({mobile,reducedMotion:Boolean(motion?.matches)}),director=createImpactDirector({mobile,reducedMotion:Boolean(motion?.matches)});
  const presentation=typeof T?.Vector3==='function'?createImpactPresentationRuntime({view,director}):{beforeRender(){},afterRender(){},clear(){}};
  let disposed=false,booted=false,front=null,peers=[],demandElapsed=1,echoElapsed=0,lastHero=null;
  const seenInspiration=new Set();
  const geometry=new T.PlaneGeometry(1,1);
  const material=new T.MeshBasicMaterial({transparent:true,opacity:0,colorWrite:false,depthWrite:false,depthTest:false,toneMapped:false});
  const stage=new T.Mesh(geometry,material);
  stage.name='TidebreakAuthoredEffects';stage.frustumCulled=false;stage.renderOrder=Number.MAX_SAFE_INTEGER;
  stage.castShadow=false;stage.receiveShadow=false;
  stage.onAfterRender=(renderer,_scene,camera)=>{
    if(disposed)return;
    if(!booted){
      booted=true;stage.visible=false;
      Promise.resolve().then(()=>{
        if(disposed)return null;
        return backendFactory({renderer,document,baseUrl,signal:abort.signal,budget:player.snapshot().budget,streaming:true,fallbackEffects:['slash','impact'],maxResident:24,retentionMs:60_000});
      }).then(backend=>{if(backend)player.attach(backend);}).catch(error=>player.fail(error));
      return;
    }
    player.draw(camera);
  };
  view.scene.add(stage);
  const previousBefore=view.scene.onBeforeRender,previousAfter=view.scene.onAfterRender;
  view.scene.onBeforeRender=(...args)=>{previousBefore?.apply(view.scene,args);presentation.beforeRender();};
  view.scene.onAfterRender=(...args)=>{presentation.afterRender();previousAfter?.apply(view.scene,args);};
  const original={renderState:view.renderState,syncFront:view.syncFront,updateFront:view.updateFront,syncPeers:view.syncPeers,
    dispose:view.dispose,visualSnapshot:view.visualSnapshot};
  view.syncFront=(next)=>{front=next;return original.syncFront(next);};
  view.updateFront=(next)=>{front=next;return original.updateFront(next);};
  view.syncPeers=(rows)=>{peers=Array.isArray(rows)?rows:[];demandElapsed=1;return original.syncPeers(rows);};
  const syncDemand=state=>player.prefetch(createVfxStreamingDemand({self:state,peers,effectDefinitions:AUTHORED_EFFECTS}));
  view.presentCombatEvents=(events,context)=>{
    if(disposed||document.hidden||context.state?.zone!=='frontier')return;
    const fresh=(Array.isArray(events)?events:[]).filter(event=>{
      if(event?.type!=='inspiration-start')return true;
      const id=String(event.attackId||'')+':'+String(event.sourceId||'');
      if(seenInspiration.has(id))return false;
      seenInspiration.add(id);if(seenInspiration.size>64)seenInspiration.delete(seenInspiration.values().next().value);
      if(event.sourceId===context.state.id&&event.firstInspirationPresentation?.sound==='inspiration')presentRinneInspirationAudio();
      return true;
    });
    const currentFront=context.front||front,result=director.present(fresh,{...context,front:currentFront});
    const anchors=anchorMap(director,context.state,currentFront);player.present(fresh,{...context,front:currentFront,anchors});
    if(result.strongest)presentRinneImpactAudio({energy:result.strongest.profile.energy,prehit:false});
  };
  view.clearCombatEffects=()=>{player.clear();director.clear();presentation.clear();clearRinneImpactAudio();seenInspiration.clear();lastHero=null;echoElapsed=0;};
  view.renderState=(state,dt=0,options={})=>{
    if(state?.zone!=='frontier'){director.clear();presentation.clear();clearRinneImpactAudio();lastHero=null;echoElapsed=0;seenInspiration.clear();}
    if(!options?.titlePreview){demandElapsed+=Number.isFinite(dt)?Math.max(0,dt):0;if(demandElapsed>=.25){demandElapsed=0;syncDemand(state);}}
    const level=original.visualSnapshot?.().focus?.level||0,reduced=Boolean(motion?.matches),hidden=Boolean(document.hidden),snap=director.frame(dt,{level,reduced,hidden});
    const restorePose=director.applyPoseLag(state,front,dt);
    try{
      const anchors=anchorMap(director,state,front),anticipation=state?.zone==='frontier'?director.anticipation(state,front):[];
      const cue=state?.combat?.inspirationCue,profile=cue?.presentation,here=state?.position;
      if(here&&cue&&state.combat.battleTime<cue.until&&profile?.trail&&!reduced&&level<3){
        echoElapsed+=Math.max(0,Math.min(.08,Number(dt)||0));
        if(echoElapsed>=profile.afterimageInterval){
          echoElapsed=0;
          const echo=inspirationAfterimageCue(lastHero,here,profile);
          if(echo)player.presentCues([echo]);
        }
      }else echoElapsed=0;
      lastHero=here&&Number.isFinite(here.x)&&Number.isFinite(here.z)?{x:here.x,z:here.z}:null;
      if(anticipation.length){
        player.presentCues(anticipation.map(anticipationCue));
        const hero=anticipation.find(row=>!row.enemy),danger=anticipation.find(row=>row.enemy&&(front?.enemies||[]).find(e=>`enemy:${e.id}`===row.followKey)?.attentionTargetId===state.id);
        if(hero||danger)presentRinneImpactAudio({energy:hero?.attack==='heavy' ? .78 : .58,prehit:true});
      }
      // Only pose/VFX presentation consumes the local scale. The base renderer receives real dt so performance and simulation clocks stay truthful.
      player.frame(state,front,dt*snap.timeScale,{level,reduced,hidden,anchors});
      const mayBoot=!hidden&&!options?.titlePreview&&!state?.ended;
      stage.visible=(!booted&&mayBoot)||player.snapshot().active>0;
      return original.renderState(state,dt,options);
    }finally{restorePose();}
  };
  view.visualSnapshot=()=>({...original.visualSnapshot?.(),combatEffects:player.snapshot(),impactDirector:director.snapshot()});
  const lost=()=>{abort.abort();player.fail(Error('WebGL context lost; effects disabled for this view'));director.clear();presentation.clear();clearRinneImpactAudio();};
  canvas.addEventListener('webglcontextlost',lost);
  view.dispose=()=>{
    if(disposed)return;disposed=true;abort.abort();player.dispose();director.clear();presentation.clear();clearRinneImpactAudio();canvas.removeEventListener('webglcontextlost',lost);
    view.scene.onBeforeRender=previousBefore;view.scene.onAfterRender=previousAfter;
    stage.onAfterRender=()=>{};stage.removeFromParent();geometry.dispose();material.dispose();original.dispose();
  };
  return view;
}
