import { SKILL_BY_ID } from './rebuild/skill-system.js';

function badge(node,count){if(!node)return;node.textContent=String(count);node.hidden=count<=0;}
function setLabels(ui,heartCount,techCount){
  ui.heart?.setAttribute('aria-label',heartCount?`心・心得 新規${heartCount}件`:'心・心得');
  ui.techniques?.setAttribute('aria-label',techCount?`技・連技 新規${techCount}件`:'技・連技');
  ui.combat?.setAttribute('aria-label',heartCount+techCount?`戦技 新規${heartCount+techCount}件`:'戦技');
}
export function createSkillSetter({ui,audio,getState}){
  let lifeId=null,known=new Set(),interactions={openHeart:null,openTechnique:null},unseen={heart:[],technique:[]},sparkId=null;
  function syncBadges(){const h=unseen.heart.length,t=unseen.technique.length;badge(ui.heartBadge,h);badge(ui.techBadge,t);badge(ui.combatBadge,h+t);setLabels(ui,h,t);}
  function showSpark(id){
    const row=SKILL_BY_ID[id];if(!row||!ui.spark)return;sparkId=id;ui.sparkName.textContent=row.name;ui.spark.hidden=false;ui.spark.dataset.kind=row.type==='support'?'heart':'technique';
  }
  function discover(ids=[]){
    let latest=null;
    for(const id of ids){const row=SKILL_BY_ID[id];if(!row)continue;const kind=row.type==='support'?'heart':'technique';if(!unseen[kind].includes(id))unseen[kind].push(id);known.add(id);latest=id;}
    if(latest){showSpark(latest);audio?.item?.();}syncBadges();
  }
  if(ui.sparkSet)ui.sparkSet.onclick=()=>{if(!sparkId)return;const row=SKILL_BY_ID[sparkId];ui.spark.hidden=true;if(row?.type==='support')interactions.openHeart?.(sparkId);else interactions.openTechnique?.(sparkId);};
  return{
    bindInteractions(next={}){interactions={...interactions,...next};},
    bindState(next){
      const nextId=next?.id||null,lifeChanged=lifeId!==null&&lifeId!==nextId,nextKnown=new Set((next?.knownSkills||[]).filter(id=>SKILL_BY_ID[id]));
      if(lifeId===null||lifeChanged){lifeId=nextId;known=nextKnown;unseen={heart:[],technique:[]};sparkId=null;if(ui.spark)ui.spark.hidden=true;syncBadges();return lifeChanged;}
      const found=[...nextKnown].filter(id=>!known.has(id));known=nextKnown;if(found.length)discover(found);syncBadges();return false;
    },
    consume(kind){if(kind==='heart'||kind==='technique')unseen[kind]=[];syncBadges();},
    firstUnseen(kind){return unseen[kind]?.[0]||null;},
    discover,
    dispose(){if(ui.spark)ui.spark.hidden=true;unseen={heart:[],technique:[]};syncBadges();}
  };
}
