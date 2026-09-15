export const FIRST_RUN_AUTOPLAY_VERSION=1;
const RESET_REPLAY_KEY='soul.village.first-run-after-reset.v1';

function current(state){
 const value=state?.onboarding?.firstRunAutoplay;
 return value?.version===FIRST_RUN_AUTOPLAY_VERSION
  ?{started:!!value.started,seen:!!value.seen}
  :{started:false,seen:false};
}

function resetReplayKey(environment){return `${RESET_REPLAY_KEY}.${environment||'unknown'}`;}

export function requestFirstRunAutoplayAfterReset(environment,storage=globalThis.sessionStorage){
 try{storage?.setItem(resetReplayKey(environment),'1');return !!storage;}
 catch{return false;}
}

export function consumeFirstRunAutoplayAfterReset(environment,storage=globalThis.sessionStorage){
 try{
  if(!storage)return false;
  const key=resetReplayKey(environment),requested=storage.getItem(key)==='1';
  if(requested)storage.removeItem(key);
  return requested;
 }catch{return false;}
}

export function shouldRunFirstRunAutoplay(state,{freshLoad=false}={}){
 const status=current(state);
 return !status.seen&&(freshLoad||status.started);
}

export function markFirstRunAutoplayStarted(state){
 state.onboarding={...(state.onboarding||{}),firstRunAutoplay:{version:FIRST_RUN_AUTOPLAY_VERSION,started:true,seen:false}};
 return state.onboarding.firstRunAutoplay;
}

export function markFirstRunAutoplaySeen(state){
 state.onboarding={...(state.onboarding||{}),firstRunAutoplay:{version:FIRST_RUN_AUTOPLAY_VERSION,started:false,seen:true}};
 return state.onboarding.firstRunAutoplay;
}
