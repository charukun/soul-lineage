const ZANSHIN_SECONDS=1.65,DOWNED_MOTION_SECONDS=1.85,FINISHER_SETTLE_SPEED=.08;

/** Owns down/recovery, execution reservations and zanshin transitions.
 * Snapshot queries below are pure; only these commands change lifecycle state.
 */
export function createBattleLifecycle({actors,getTime,getSerial,battleId,emit,targetFor,threatened,live,clamp,freeze}){
  function downedStateFor(target){
    if(!target?.downed||target.dead||!target.incapacitated||!Number.isFinite(target.downedAt))return null;
    const elapsed=Math.max(0,getTime()-target.downedAt),progress=clamp(elapsed/DOWNED_MOTION_SECONDS);
    const speed=Math.hypot(Number(target.impulseVelocity?.x)||0,Number(target.impulseVelocity?.z)||0),evidence=target.executionPoseEvidence;
    const settled=progress>=1&&getTime()>=target.staggerUntil&&speed<=FINISHER_SETTLE_SPEED
      &&(!evidence||evidence.grounded&&['Lie_Down','Lie_Pose'].includes(evidence.clip));
    return freeze({phase:settled?'settled':'settling',progress,duration:DOWNED_MOTION_SECONDS,elapsed,speed,poseVerified:!!evidence?.grounded,clip:evidence?.clip||null});
  }
  const fullyDownForFinisher=target=>downedStateFor(target)?.phase==='settled';
  function releaseVictim(victim){
    victim.finisherClaimedBy=null;victim.finisherClaimAttackId=null;
    victim.executionLifecycle=victim.dead?'CORPSE':victim.downed?(fullyDownForFinisher(victim)?'SETTLED':'FALLING'):'ACTIVE';
  }
  function releaseExecution(actor){
    for(const victim of actors.values())if(victim.finisherClaimedBy===actor.id)releaseVictim(victim);
    actor.executionSocket=null;
    if(actor.decision?.intent==='execution-approach')actor.decision=null;
    if(live(actor))actor.executionLifecycle='ACTIVE';
  }
  function claimExecution(actor,victim,socket){
    if(!live(actor)||actor.nonlethal||actor.canFinish===false||!fullyDownForFinisher(victim)
      ||victim.side===actor.side||victim.finisherClaimedBy&&victim.finisherClaimedBy!==actor.id)return false;
    if(actor.decision?.targetId!==victim.id)releaseExecution(actor);
    actor.executionSocket=socket;actor.targetId=victim.id;
    actor.decision={intent:'execution-approach',footwork:'forward',stopDistance:0,targetId:victim.id};
    victim.finisherClaimedBy=actor.id;victim.executionLifecycle='EXECUTION_APPROACH';
    return true;
  }
  function lockExecution(actor,victim,execution){
    victim.finisherClaimedBy=actor.id;victim.finisherClaimAttackId=execution.id;
    victim.executionLifecycle='EXECUTION_LOCK';actor.executionLifecycle='EXECUTING';
    actor.impulseVelocity={x:0,z:0};victim.impulseVelocity={x:0,z:0};
  }
  function completeExecution(actor){releaseExecution(actor);actor.pendingZanshin=true;}
  function recordDowned(actor){
    if(!actor.downed)actor.downedAt=getTime();
    actor.downed=true;actor.incapacitated=true;actor.hp=0;
    actor.executionLifecycle='FALLING';actor.executionPoseEvidence=null;
  }
  function recordExecuted(actor){
    actor.hp=0;actor.dead=true;actor.downed=true;actor.incapacitated=true;
    actor.finisherExecutedAt=getTime();actor.executionLifecycle='EXECUTED';
    actor.impulseVelocity={x:0,z:0};
  }
  function reconcile(){
    for(const actor of actors.values()){
      if(actor.downed&&actor.executionLifecycle==='FALLING'&&fullyDownForFinisher(actor))actor.executionLifecycle='SETTLED';
      if(actor.finisherClaimedBy){
        const owner=actors.get(actor.finisherClaimedBy),action=owner?.action;
        const locked=action?.finisher&&action.targetId===actor.id&&(!actor.dead||action.contactResolved);
        const approaching=!actor.dead&&owner?.decision?.intent==='execution-approach'&&owner.decision.targetId===actor.id;
        if(!actor.downed||!live(owner)||!locked&&!approaching)releaseVictim(actor);
      }
      if(actor.dead&&!actor.finisherClaimedBy)actor.executionLifecycle='CORPSE';
    }
  }
  function advanceCue(actor){
    const cue=actor.phaseCue;if(!cue)return;
    if(!live(actor)||getTime()>=cue.startedAt+cue.duration){actor.phaseCue=null;return;}
    if(cue.phase==='zanshin'&&threatened(actor)){
      actor.phaseCue=null;actor.pendingZanshin=true;actor.readyAt=getTime();
    }
  }
  function settleZanshin(actor){
    if(!actor.pendingZanshin||!live(actor)||actor.action||actor.phaseCue||threatened(actor)
      ||!actor.nonlethal&&actor.canFinish!==false&&targetFor(actor,{downed:true}))return;
    actor.pendingZanshin=false;actor.readyAt=getTime()+ZANSHIN_SECONDS;
    actor.phaseCue={key:`${battleId}:${actor.id}:zanshin:${getSerial()}`,phase:'zanshin',startedAt:getTime(),duration:ZANSHIN_SECONDS};
    actor.decision=null;emit({type:'zanshin',actorId:actor.id,sourceId:actor.id,after:'combat'});
  }
  return {downedStateFor,fullyDownForFinisher,claimExecution,lockExecution,releaseExecution,
    completeExecution,recordDowned,recordExecuted,reconcile,advanceCue,settleZanshin};
}
