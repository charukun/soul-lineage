import { SKILL_BY_ID } from './rebuild/skill-system.js';
import { techniqueForSourceSkill } from './combat-loadout.js';

const haptic=pattern=>{try{globalThis.navigator?.vibrate?.(pattern);}catch{}};
const skillType=id=>SKILL_BY_ID[id]?.type||null;
const displayName=(state,id)=>skillType(id)==='action'?(techniqueForSourceSkill(state,id)?.name||SKILL_BY_ID[id]?.name||id):(SKILL_BY_ID[id]?.name||id);

function updateBadges(model){
  const heart=model.unseenHeart.size,tech=model.unseenTechnique.size;
  if(model.ui.heartBadge){model.ui.heartBadge.textContent=String(heart);model.ui.heartBadge.hidden=heart===0;}
  if(model.ui.techBadge){model.ui.techBadge.textContent=String(tech);model.ui.techBadge.hidden=tech===0;}
  model.ui.heart?.setAttribute('aria-label',heart?`心。未確認の心得 ${heart}件`:'心');
  model.ui.techniques?.setAttribute('aria-label',tech?`技。未確認の技 ${tech}件`:'技');
}
function resetLife(model,nextId,current){
  const hadLife=model.lifeId!==null;model.lifeId=nextId;model.knownSnapshot=current;model.unseenHeart.clear();model.unseenTechnique.clear();model.latestDiscoveries=[];
  clearTimeout(model.sparkTimer);model.ui.spark.hidden=true;updateBadges(model);return hadLife;
}
function openLatest(model){
  const id=model.latestDiscoveries[0];if(!id)return;
  if(skillType(id)==='support')model.openHeart?.(id);else model.openTechnique?.(id);
}
function discover(model,ids){
  const fresh=[...new Set(ids)].filter(id=>SKILL_BY_ID[id]);if(!fresh.length)return;
  model.latestDiscoveries=fresh;
  for(const id of fresh){if(skillType(id)==='support')model.unseenHeart.add(id);else if(skillType(id)==='action')model.unseenTechnique.add(id);}
  updateBadges(model);const state=model.getState();model.ui.sparkName.textContent=fresh.slice(0,2).map(id=>displayName(state,id)).join('・')+(fresh.length>2?' ほか':'');model.ui.spark.hidden=false;
  clearTimeout(model.sparkTimer);model.sparkTimer=setTimeout(()=>{model.ui.spark.hidden=true;},7200);model.audio.item();haptic([18,28,12]);
}
function observeKnownSkills(model,next){
  const nextId=next?.id||null,current=new Set(next?.knownSkills||[]);
  if(model.lifeId!==nextId)return resetLife(model,nextId,current);
  if(model.knownSnapshot===null){model.knownSnapshot=current;return false;}
  const fresh=[...current].filter(id=>!model.knownSnapshot.has(id)&&SKILL_BY_ID[id]);model.knownSnapshot=current;if(fresh.length)discover(model,fresh);return false;
}

export function createSkillSetter({ui,audio,getState}){
  const model={ui,audio,getState,lifeId:null,knownSnapshot:null,unseenHeart:new Set(),unseenTechnique:new Set(),latestDiscoveries:[],sparkTimer:0,openHeart:null,openTechnique:null};
  updateBadges(model);
  ui.sparkSet.onclick=()=>{clearTimeout(model.sparkTimer);ui.spark.hidden=true;openLatest(model);};
  return{
    bindInteractions({openHeart,openTechnique}){model.openHeart=openHeart;model.openTechnique=openTechnique;},
    bindState(next){return observeKnownSkills(model,next);},
    consume(page){const set=page==='heart'?model.unseenHeart:model.unseenTechnique;set.clear();updateBadges(model);},
    firstUnseen(page){return[...(page==='heart'?model.unseenHeart:model.unseenTechnique)][0]||null;},
    discover(ids){discover(model,ids);},
    dispose(){clearTimeout(model.sparkTimer);}
  };
}
