import {NightView} from './web/view.js';
import {activeCharacter} from './characters.js';
import {externalMonsterSpec,loadExternalMonsterModel,updateExternalMonsterModel} from './web/monster-models.js';

const states=new WeakMap();
function stateFor(view){
 if(states.has(view))return states.get(view);
 const state={models:new Map(),pending:new Map(),failed:new Map()};states.set(view,state);
 return state;
}
function showProceduralPlayer(view,visible){view.player?.traverse?.(node=>{if(node.isMesh)node.visible=visible;});}
function requestModel(view,state,species){
 if(!externalMonsterSpec(species)||state.models.has(species)||state.pending.has(species)||state.failed.has(species))return;
 const pending=loadExternalMonsterModel(species,view.renderer).then(instance=>{
  if(!instance)return;instance.root.visible=false;view.scene.add(instance.root);state.models.set(species,instance);view.canvas.dataset.monsterModel='ready';
 }).catch(error=>{state.failed.set(species,String(error?.message||error));view.canvas.dataset.monsterModel='fallback';console.warn(`[monster ${species}] procedural fallback`,error);}).finally(()=>state.pending.delete(species));
 state.pending.set(species,pending);view.canvas.dataset.monsterModel='loading';
}
function syncMonster(view,game,time){
 const state=stateFor(view),species=game?.monsterSpecies||'night-creature',spec=externalMonsterSpec(species),character=activeCharacter(game?.profile||{}).id;
 view.canvas.dataset.monsterSpecies=species;
 if(spec)requestModel(view,state,species);
 for(const instance of state.models.values())instance.root.visible=false;
 const instance=state.models.get(species),useExternal=Boolean(spec&&instance&&character==='night-creature');
 showProceduralPlayer(view,!useExternal);
 if(!useExternal){if(!spec)view.canvas.dataset.monsterModel='procedural';return;}
 instance.root.visible=true;view.canvas.dataset.monsterModel='gobkit';
 updateExternalMonsterModel(instance,game.player,time,{form:game.profile?.form,eating:Boolean(game.devour)});
}

const originalUpdate=NightView.prototype.update;
NightView.prototype.update=function updateWithMonsterSpecies(game,dt,title=false){syncMonster(this,game,game?.time||this.elapsed||0);return originalUpdate.call(this,game,dt,title);};

if(typeof window!=='undefined')window.__DEMON_MONSTER_MODELS__={snapshot:()=>({source:'Gobkit CC0',views:[...document.querySelectorAll('canvas[data-monster-species]')].map(canvas=>({species:canvas.dataset.monsterSpecies,model:canvas.dataset.monsterModel}))})};
