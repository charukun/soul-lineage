import * as THREE from 'three';
import { createRinneCharacterStage as createBaseStage } from './runtime-character-stage-base.js';
import { createCombatTerrainPresentation } from './combat-terrain-presentation.js';

export async function createRinneCharacterStage(options){
  const base=await createBaseStage(options),terrain=createCombatTerrainPresentation({THREE,frontRoot:options.frontRoot,mat:options.mat});
  const syncFront=front=>{terrain.sync(front);base.syncFront(front);};
  const updateFront=front=>{terrain.sync(front);base.updateFront(front);};
  const dispose=()=>{terrain.dispose();base.dispose();};
  return{...base,syncFront,updateFront,dispose};
}
