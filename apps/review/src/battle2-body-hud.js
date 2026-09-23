import {COMBAT_BODY_PARTS,combatBodySnapshot} from '@soul/johakyu-combat/choreography';
import {createBodySilhouette} from '@soul/shared-ui/body-silhouette';
import '@soul/shared-ui/body-silhouette.css';
import './battle2-body-hud.css';

const TONE={'正常':'normal','軽傷':'light','負傷':'wounded','重傷':'severe','機能不全':'disabled'};
function actorState(actor){
 const injuries={};for(const part of COMBAT_BODY_PARTS)injuries[part]={severity:Number(actor?.body?.[part]?.severity)||0,at:0};
 return {seed:1,generation:1,ageSeconds:0,maxHp:Number(actor?.maxHp)||125,injuries};
}
export function battle2BodyModel(actor){
 const body=combatBodySnapshot(actorState(actor));
 return {parts:COMBAT_BODY_PARTS.map(id=>({...body[id],id,tone:TONE[body[id].stage]||'normal'}))};
}
export function createBattle2BodyHud(root){
 if(!root)return null;root.classList.add('battle2-body-hud');root.hidden=true;
 const {figure,parts}=createBodySilhouette({parts:COMBAT_BODY_PARTS});
 root.replaceChildren(figure);
 let actor=null,previous=new Map(),timer=0;
 function render(){
  if(!actor)return;const model=battle2BodyModel(actor);
  for(const part of model.parts){
   const item=parts.get(part.id);item.node.dataset.tone=part.tone;item.node.dataset.stage=part.stage;item.node.setAttribute('aria-label',part.label+' '+part.stage+' '+part.durability+'%');
   item.node.style.setProperty('--level',part.durability+'%');
  }
 }
 function flash(part){const item=parts.get(part);if(!item)return;clearTimeout(timer);for(const row of parts.values())row.node.removeAttribute('data-hit');item.node.dataset.hit='true';timer=setTimeout(()=>item.node.removeAttribute('data-hit'),560);}
 return {setVisible(v){root.hidden=!v;},update(next){actor=next;const model=battle2BodyModel(actor);for(const part of model.parts){const before=previous.get(part.id)??part.severity;if(part.severity>before+.0001)flash(part.id);previous.set(part.id,part.severity);}render();},destroy(){clearTimeout(timer);root.replaceChildren();}};
}
