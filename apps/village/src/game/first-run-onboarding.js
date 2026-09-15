export const FIRST_RUN_AUTOPLAY_VERSION=1;

function current(state){
 const value=state?.onboarding?.firstRunAutoplay;
 return value?.version===FIRST_RUN_AUTOPLAY_VERSION
  ?{started:!!value.started,seen:!!value.seen}
  :{started:false,seen:false};
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
