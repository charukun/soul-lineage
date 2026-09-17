import * as THREE from 'three';
import { createRinneCharacterStage as createBaseStage } from './runtime-character-stage-base.js';
import { createCombatTerrainPresentation } from './combat-terrain-presentation.js';
import { createCombatProjectilePresentation } from './combat-projectile-presentation.js';

export async function createRinneCharacterStage(options){
  const base=await createBaseStage(options),terrain=createCombatTerrainPresentation({THREE,frontRoot:options.frontRoot,mat:options.mat}),projectiles=createCombatProjectilePresentation({THREE,frontRoot:options.frontRoot,mat:options.mat});let peers=[];
  const syncFront=front=>{terrain.sync(front);base.syncFront(front);};
  const updateFront=front=>{terrain.sync(front);base.updateFront(front);};
  const syncPeers=rows=>{peers=Array.isArray(rows)?rows:[];base.syncPeers(rows);};
  const render=(life,dt=0)=>{base.render(life,dt);projectiles.sync(life,peers);};
  const dispose=()=>{projectiles.dispose();terrain.dispose();base.dispose();};
  return{...base,render,syncPeers,syncFront,updateFront,dispose};
}
