import {combatCameraFrame} from '@soul/rendering/combat-camera-frame';

const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));

export function rinneCombatCameraFrame({player,enemies=[],targetId=null,active=false}={}){
  if(!active||!player)return null;
  const living=(Array.isArray(enemies)?enemies:[]).filter(enemy=>enemy&&!enemy.dead&&Number.isFinite(enemy.x)&&Number.isFinite(enemy.z));
  const nearby=living.filter(enemy=>enemy.id===targetId||distance(player,enemy)<=6.8);
  return combatCameraFrame({player,threats:nearby,style:'rinne'});
}
