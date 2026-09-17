import {createWorldRenderer as createBaseWorldRenderer} from './renderer.js';
import {installCombatEffects} from './combat-effects-stage.js';

export async function createWorldRenderer(options){
  const view=await createBaseWorldRenderer(options);
  try{return installCombatEffects(view,options);}catch(error){
    // Optional presentation must never prevent the prepared game from starting.
    console.warn('Authored combat effects unavailable:',error);
    view.presentCombatEvents=()=>{};view.clearCombatEffects=()=>{};return view;
  }
}
