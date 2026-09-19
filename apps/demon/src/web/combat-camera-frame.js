import {combatCameraFrame} from '@soul/rendering/combat-camera-frame';

export function demonCombatCameraThreats(game){
  if(!game?.fight)return[];
  const out=[],seen=new Set();
  const add=npc=>{if(!npc||npc.dead||npc.eaten||seen.has(npc.id))return;seen.add(npc.id);out.push(npc);};
  add(game.fight.npc);
  for(const record of Array.isArray(game.combatants)?game.combatants:[])add(record?.npc);
  return out;
}

export function demonCombatCameraFrame(game,{wide=false}={}){
  const player=game?.player,threats=demonCombatCameraThreats(game);if(!player||!threats.length)return null;
  return combatCameraFrame({player,threats,style:'demon',wide});
}
