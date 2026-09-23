const ZANSHIN_SECONDS=1.65,DOWNED_MOTION_SECONDS=1.85,FINISHER_SETTLE_SPEED=.08;
export function createBattleLifecycle({actors,getTime,getSerial,battleId,emit,targetFor,distance,live,clamp,freeze}){
  function downedStateFor(target){
    if(!target?.downed||target.dead||!target.incapacitated||!Number.isFinite(target.downedAt))return null;
    const elapsed=Math.max(0,getTime()-target.downedAt),progress=clamp(elapsed/DOWNED_MOTION_SECONDS),speed=Math.hypot(Number(target.impulseVelocity?.x)||0,Number(target.impulseVelocity?.z)||0);
    const evidence=target.executionPoseEvidence;
    // The render adapter may confirm the authored fall before it can switch to Lie_Pose.
    // In a headless host the authored clock remains the deterministic fallback.
    const settled=progress>=1&&getTime()>=target.staggerUntil&&speed<=FINISHER_SETTLE_SPEED&&(!evidence||evidence.grounded&&['Lie_Down','Lie_Pose'].includes(evidence.clip));
    if(settled&&target.executionLifecycle==='FALLING')target.executionLifecycle='SETTLED';
    return freeze({phase:settled?'settled':'settling',progress,duration:DOWNED_MOTION_SECONDS,elapsed,speed,poseVerified:!!evidence?.grounded,clip:evidence?.clip||null});
  }
  function fullyDownForFinisher(target){return downedStateFor(target)?.phase==='settled';}
  function threatened(actor){return [...actors.values()].some(enemy=>enemy.side!==actor.side&&live(enemy)&&(enemy.targetId===actor.id||enemy.decision?.targetId===actor.id||distance(actor,enemy)<4.6));}
  function settleZanshin(actor){
    if(!actor.pendingZanshin||!live(actor)||actor.action||actor.phaseCue||threatened(actor)||!actor.nonlethal&&targetFor(actor,{downed:true}))return;
    actor.pendingZanshin=false;actor.readyAt=getTime()+ZANSHIN_SECONDS;
    actor.phaseCue={key:`${battleId}:${actor.id}:zanshin:${getSerial()}`,phase:'zanshin',startedAt:getTime(),duration:ZANSHIN_SECONDS};
    actor.decision=null;emit({type:'zanshin',actorId:actor.id,sourceId:actor.id,after:'combat'});
  }
  return {downedStateFor,fullyDownForFinisher,settleZanshin,threatened};
}
