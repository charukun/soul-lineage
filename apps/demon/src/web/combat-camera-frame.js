const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot((a?.x||0)-(b?.x||0),(a?.z||0)-(b?.z||0));

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
  const points=[player,...threats],center=points.reduce((sum,point)=>({x:sum.x+point.x,z:sum.z+point.z}),{x:0,z:0});center.x/=points.length;center.z/=points.length;
  const spread=Math.max(...points.map(point=>distance(center,point)),0),zoom=clamp((wide?11:13.6)+spread*1.2,wide?11.5:14,wide?18:22),height=clamp((wide?8.6:10.8)+spread*.85,wide?9:11,wide?15.5:18.5),angle=.33;
  return{camera:{x:center.x+Math.sin(angle)*zoom*.88,y:height,z:center.z+Math.cos(angle)*zoom*.88},look:{x:center.x,y:.75,z:center.z},count:threats.length,spread};
}
