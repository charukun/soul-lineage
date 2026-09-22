import {shino25dGuestEnabled} from './shino25d-guest-policy.js';
import {installJohakyuPresentation} from './johakyu-world-renderer.js';
import {createWorldRenderer as createBaseWorldRenderer} from './renderer.js';
import {installCombatEffects} from './combat-effects-stage.js';

export async function createWorldRenderer(options){
  const view=await createBaseWorldRenderer(options);
  let presented=view;
  try{presented=installJohakyuPresentation(installCombatEffects(view,options),options);}catch(error){
    // Optional presentation must never prevent the prepared game from starting.
    console.warn('Authored combat effects unavailable:',error);
    view.presentCombatEvents=()=>{};view.clearCombatEffects=()=>{};
  }
  // The ordinary game does not load the importer or any draft images.
  const environment=typeof __BUILD_INFO__!=='undefined'?__BUILD_INFO__.environment:options?.buildInfo?.environment;
  if(shino25dGuestEnabled(location.search,environment)){
    try{const {installShino25dGuest}=await import('./shino25d-guest.js');presented=installShino25dGuest(presented,{...options,environment});}
    catch(error){console.warn('Shino 2.5D guest unavailable:',error);}
  }
  return presented;
}
