export function createBattleTargeting({actors,getTime,distance,live}){
  function targetFor(actor,{downed=false}={}){return [...actors.values()].filter(a=>a.side!==actor.side&&!a.dead&&(downed?a.downed&&(!a.finisherClaimedBy||a.finisherClaimedBy===actor.id):live(a)&&time>=a.spawnUntil)).sort((a,b)=>Number(b.id===actor.targetId)-Number(a.id===actor.targetId)||distance(actor,a)-distance(actor,b)||a.id.localeCompare(b.id))[0]||null;}
  function nearestThreatFor(actor){return [...actors.values()].filter(enemy=>enemy.side!==actor.side&&live(enemy)&&time>=enemy.spawnUntil).sort((a,b)=>distance(actor,a)-distance(actor,b)||a.id.localeCompare(b.id))[0]||null;}
  return {targetFor,nearestThreatFor};
}
