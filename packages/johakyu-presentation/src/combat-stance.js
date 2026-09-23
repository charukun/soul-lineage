import {combatStanceRootFrame} from './observed-locomotion.js';
export function applyCombatStancePresentation(actor,row,dt){
 actor.combatReadyWeight+=(Number(row.combatReady===true)-actor.combatReadyWeight)*(1-Math.exp(-Math.max(0,dt)*10));
 const frame=combatStanceRootFrame({active:actor.combatReadyWeight>.001,held:actor.combatReadyWeight,attack:Boolean(row.action?.motion?.offense),progress:row.action?.progress});
 actor.posture.position.y-=frame.drop;actor.posture.rotation.x-=frame.pitch;
}
