import {NightView} from './web/view.js';
import {activeCharacter} from './characters.js';
import {createManifestationEffect,createProgressiveManifestation,MANIFESTATION_STAGES} from '@soul/rendering/progressive-manifestation';
import {externalMonsterSpec,loadExternalMonsterModel,updateExternalMonsterModel} from './web/monster-models.js';

const states=new WeakMap();
function stateFor(view){
 if(states.has(view))return states.get(view);
 const state={models:new Map(),effects:new Map(),registered:new Set(),failed:new Map(),director:createProgressiveManifestation({maxConcurrent:2})};states.set(view,state);
 return state;
}
function showProceduralPlayer(view,visible){view.player?.traverse?.(node=>{if(node.isMesh)node.visible=visible;});}
function requestModel(view,state,species){
 const spec=externalMonsterSpec(species);if(!spec)return;
 if(!state.registered.has(species)){
  state.registered.add(species);
  state.director.register(species,{
   profile:spec.manifestation,
   load:({signal,onProgress})=>loadExternalMonsterModel(species,view.renderer,fetch,{signal,onProgress}),
   onState:snapshot=>{
    if(view.canvas.dataset.monsterSpecies!==species)return;
    view.canvas.dataset.monsterManifestation=snapshot.stage;view.canvas.dataset.monsterLoadProgress=String(Math.round(snapshot.progress*100));
   },
   onReady:(instance,profile)=>{
    if(!instance)return;instance.root.visible=false;view.scene.add(instance.root);state.models.set(species,instance);
    const qualityScale=view.__stylizedQuality?.profile?.vfxScale??1,effect=createManifestationEffect({profile,qualityScale});instance.root.add(effect.root);state.effects.set(species,effect);
   },
   onFailure:error=>{state.failed.set(species,String(error?.message||error));console.warn(`[monster ${species}] procedural fallback`,error);}
  });
 }
 // The local monster is always a player-observed subject, so its asset owns top priority.
 state.director.focus(species,220);
}
function syncMonster(view,game,time,dt=0){
 const state=stateFor(view),species=game?.monsterSpecies||'night-creature',spec=externalMonsterSpec(species),character=activeCharacter(game?.profile||{}).id;
 view.canvas.dataset.monsterSpecies=species;if(spec)requestModel(view,state,species);state.director.update(dt);
 for(const instance of state.models.values())instance.root.visible=false;
 const snapshot=spec&&state.registered.has(species)?state.director.snapshot(species):null,instance=state.models.get(species),forming=snapshot?.stage===MANIFESTATION_STAGES.FORMING,manifested=snapshot?.stage===MANIFESTATION_STAGES.MANIFESTED,useExternal=Boolean(spec&&instance&&character==='night-creature'&&(forming||manifested));
 showProceduralPlayer(view,!useExternal);
 if(!spec){view.canvas.dataset.monsterModel='procedural';view.canvas.dataset.monsterManifestation=MANIFESTATION_STAGES.MANIFESTED;view.canvas.dataset.monsterLoadProgress='100';return;}
 if(snapshot?.stage===MANIFESTATION_STAGES.FAILED){view.canvas.dataset.monsterModel='fallback';return;}
 if(!useExternal){view.canvas.dataset.monsterModel=snapshot?.stage===MANIFESTATION_STAGES.LOADING||snapshot?.stage===MANIFESTATION_STAGES.HINTED?'loading':'fallback';return;}
 instance.root.visible=true;updateExternalMonsterModel(instance,game.player,time,{form:game.profile?.form,eating:Boolean(game.devour)});
 const effect=state.effects.get(species);if(effect){if(forming)effect.update(snapshot.formingProgress);else effect.update(1);}
 view.canvas.dataset.monsterModel=manifested?'gobkit':'manifesting';view.canvas.dataset.monsterManifestation=snapshot.stage;view.canvas.dataset.monsterLoadProgress='100';
}

const originalUpdate=NightView.prototype.update;
NightView.prototype.update=function updateWithMonsterSpecies(game,dt,title=false){syncMonster(this,game,game?.time||this.elapsed||0,dt);return originalUpdate.call(this,game,dt,title);};
const originalDispose=NightView.prototype.dispose;
if(typeof originalDispose==='function')NightView.prototype.dispose=function disposeMonsterManifestation(...args){const state=states.get(this);if(state){for(const effect of state.effects.values())effect.dispose();for(const instance of state.models.values())instance.root.removeFromParent();state.director.dispose();states.delete(this);}return originalDispose.apply(this,args);};

if(typeof window!=='undefined')window.__DEMON_MONSTER_MODELS__={snapshot:()=>({source:'Gobkit CC0',views:[...document.querySelectorAll('canvas[data-monster-species]')].map(canvas=>({species:canvas.dataset.monsterSpecies,model:canvas.dataset.monsterModel,stage:canvas.dataset.monsterManifestation,progress:Number(canvas.dataset.monsterLoadProgress||0)}))})};
