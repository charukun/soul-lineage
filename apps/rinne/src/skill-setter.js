function clearBadges(ui){
  if(ui.heartBadge){ui.heartBadge.textContent='0';ui.heartBadge.hidden=true;}
  if(ui.techBadge){ui.techBadge.textContent='0';ui.techBadge.hidden=true;}
  ui.heart?.setAttribute('aria-label','心・心得');
  ui.techniques?.setAttribute('aria-label','技・連技');
  if(ui.spark)ui.spark.hidden=true;
}

/**
 * Compatibility surface for the old discovery tracker.
 * Combat/life history no longer unlocks abilities, so discovery notifications
 * and unseen badges are intentionally disabled.
 */
export function createSkillSetter({ui}){
  let lifeId=null;clearBadges(ui);
  if(ui.sparkSet)ui.sparkSet.onclick=()=>{ui.spark.hidden=true;};
  return{
    bindInteractions(){},
    bindState(next){const nextId=next?.id||null,changed=lifeId!==null&&lifeId!==nextId;lifeId=nextId;clearBadges(ui);return changed;},
    consume(){clearBadges(ui);},
    firstUnseen(){return null;},
    discover(){clearBadges(ui);},
    dispose(){}
  };
}
