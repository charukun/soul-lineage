export function retireLegacyTutorialAfterFirstRun(state,{seen=false}={}){
  if(!seen)return false;
  state.tutorial??={};
  if(state.tutorial.dismissed)return false;
  state.tutorial.dismissed=true;
  return true;
}
