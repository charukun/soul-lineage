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

/** Short-lived goals outrank generic age guidance while the player is in the village. */
export function storyTransientObjective(state,experienceNames={}){
  if(state?.zone!=='village'||state?.phase!=='living')return null;
  if(state.activity){
    const name=experienceNames[state.activity.kind]||'生活行動';
    return `${name}を続けています。歩き出すと中断します。`;
  }
  if((state.pendingDiscoveries?.length||0)>0)return'暮らしの閃きを受け取り、技目録へ加えよう。';
  return null;
}

/**
 * Story activities may share one physical landmark. A navigation map should
 * show that landmark once and summarize what can be done there instead of
 * looking like several duplicate buildings. When fallbacks share the campfire,
 * keep the historical `garden` target so saved/tests/navigation links remain valid.
 */
export function uniqueStoryDestinations(places=[]){
  const groups=new Map();
  for(const place of places){
    const key=`${Math.round(Number(place.x)*10)/10}:${Math.round(Number(place.z)*10)/10}`;
    let group=groups.get(key);
    if(!group){group={places:[],verbs:[]};groups.set(key,group);}
    group.places.push(place);
    if(place.verb&&!group.verbs.includes(place.verb))group.verbs.push(place.verb);
  }
  return [...groups.values()].map(group=>{
    const canonical=group.places.find(place=>place.id==='garden')||group.places[0];
    return{
      ...canonical,
      verb:group.verbs.length?group.verbs.join('・'):canonical.verb,
      activities:group.verbs,
      aliases:group.places.map(place=>place.id),
    };
  });
}
