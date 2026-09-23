export function createBattleTargeting({actors,getTime,distance,live}){
  const available=(actor,candidate)=>candidate!==actor&&candidate.side!==actor.side&&!candidate.dead&&getTime()>=(candidate.spawnUntil??0);
  const nearest=(actor,rows,preferred=false)=>rows.sort((a,b)=>(preferred?Number(b.id===actor.targetId)-Number(a.id===actor.targetId):0)||distance(actor,a)-distance(actor,b)||a.id.localeCompare(b.id))[0]||null;
  function targetFor(actor,{downed=false}={}){
    return nearest(actor,[...actors.values()].filter(candidate=>available(actor,candidate)&&(downed
      ?candidate.downed&&(!candidate.finisherClaimedBy||candidate.finisherClaimedBy===actor.id)
      :live(candidate))),true);
  }
  function nearestThreatFor(actor){return nearest(actor,[...actors.values()].filter(candidate=>available(actor,candidate)&&live(candidate)));}
  function threatened(actor){return [...actors.values()].some(enemy=>available(actor,enemy)&&live(enemy)
    &&(enemy.action?.targetId===actor.id||enemy.targetId===actor.id||enemy.decision?.targetId===actor.id||distance(actor,enemy)<4.6));}
  return {targetFor,nearestThreatFor,threatened};
}
