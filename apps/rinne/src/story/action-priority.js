const kindOf=action=>String(action||'').split(':')[0];

/**
 * Rank visible story actions by player intent instead of DOM insertion order.
 * Lower numbers are more important. This never changes whether an action is
 * allowed; the controller remains the authority for enabled/disabled state.
 */
export function storyActionPriority(action,state={}){
  const kind=kindOf(action);
  if(state.activity&&kind==='cancel')return 0;
  if((state.pendingDiscoveries?.length||0)>0&&kind==='discover')return 1;
  if(kind==='rescue')return 2;
  if(kind==='next')return 3;
  if(kind==='travel')return 4;
  if(kind==='equip')return 5;
  if(kind==='activity'){
    if(String(action).startsWith('activity:observe')||String(action).startsWith('activity:track'))return 8;
    return 6;
  }
  if(kind==='cancel')return 7;
  return 9;
}

export function choosePrimaryStoryAction(buttons,state={}){
  const available=buttons.filter(button=>button.dataset?.action!=='rest');
  const enabled=available.filter(button=>!button.disabled);
  const pool=enabled.length?enabled:available;
  return pool.toSorted((a,b)=>storyActionPriority(a.dataset?.action,state)-storyActionPriority(b.dataset?.action,state))[0]||null;
}
