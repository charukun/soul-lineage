import {battleSpacing,chooseExchangeIntent} from './exchange.js';
import {executionSockets} from './execution-socket.js';
import {defineTechnique} from './technique.js';
import {readBattleActorState} from './state.js';

/** Decision policy issues commands; execution and lifecycle own the resulting transitions. */
export function createBattleDecisions({actors,manualMoves,bounds,blocked,getTime,targetFor,fullyDownForFinisher,distance,node,begin,breakChain,pair,lifecycle,emit}){
  function decide(actor,dt){
    const time=getTime();
    if(!readBattleActorState(actor,time).canDecide)return;
    const target=targetFor(actor);
    if(actor.chainTargetId&&(actor.chainTargetId!==target?.id||actor.chainLastAt!==null&&time-actor.chainLastAt>2.5))breakChain(actor,target?'target-changed':'target-lost');
    const input=manualMoves.get(actor.id),manual=Boolean(input&&Math.hypot(input.x,input.z)>.08);
    const downed=!manual&&!actor.nonlethal&&actor.canFinish!==false?targetFor(actor,{downed:true}):null;
    if(downed&&(!target||distance(actor,target)>2.8)){
      if(fullyDownForFinisher(downed)&&(!downed.finisherClaimedBy||downed.finisherClaimedBy===actor.id)){
        const socket=executionSockets(downed,{bounds,blocked,actors:[...actors.values()],executor:actor})[0];
        if(socket){
          if(!lifecycle.claimExecution(actor,downed,socket))return;
          const gap=distance(actor,{position:socket.position});
          if(gap<=.17&&time>=actor.readyAt){actor.yaw=socket.yaw;begin(actor,downed,{finisher:true});return;}
          return;
        }
      }
      if(!target){lifecycle.releaseExecution(actor);actor.decision=null;return;}
    }
    lifecycle.releaseExecution(actor);
    if(!target){actor.targetId=null;actor.decision=null;return;}
    if(actor.decision&&actor.decision.targetId!==target.id){actor.decision=null;actor.readSeconds=0;}
    actor.targetId=target.id;
    // A committed retreat is read from actual enemy displacement, not its intended stance.
    if(actor.pursuit&&target.side==='enemy'&&actor.pursuitTargetId===target.id&&actor.pursuitUntil>=time
      &&time>=actor.pursuitReadyAt&&actor.canAttack!==false&&actor.stamina>=22
      &&distance(actor,target)>1.46&&distance(actor,target)<4.5&&!blocked(actor.position,target.position,actor)){
      const d=distance(actor,target),spacing=battleSpacing(actor,target,d);
      if(d>spacing.engagementRange){
        // Pursuit closes the gap as locomotion first. The attack action starts only after the shared engagement boundary is crossed.
        actor.decision={...spacing,intent:'pursuit',footwork:'rush',stopDistance:spacing.engagementRange-.04,targetId:target.id};actor.decisionUntil=time+.12;return;
      }
      if(time<actor.readyAt)return;
      const kind=actor.equipment.weapon==='fist'?'straight':'dash';
      actor.override={technique:defineTechnique({id:'heart.pursuer',name:'追う者',steps:[{kind,footwork:'rush',charge:'none'}]},{weapon:actor.equipment.weapon}),stageIndex:0};
      if(begin(actor,target)){actor.pursuitSeconds=0;actor.pursuitUntil=0;actor.pursuitReadyAt=time+2.8;emit({type:'pursuit-leap',sourceId:actor.id,targetId:target.id});return;}
      actor.override=null;
    }
    const opposing=target.action,threat=opposing&&opposing.targetId===actor.id&&opposing.choreography.offense&&!opposing.contactResolved?opposing:null;
    if(threat&&time>=actor.readyAt&&threat.elapsed/threat.duration>.15&&distance(actor,target)<battleSpacing(target,actor,distance(actor,target)).engagementRange){
      const current=node(actor),authored=['parry','guard','brace'].includes(current.stage.kind);
      const intent=chooseExchangeIntent({actor,target,exchange:pair(actor,target).state,phase:current.phase,distance:distance(actor,target),threat});
      if(authored||actor.defenseDebt<2&&['intercept','guard-pressure'].includes(intent.intent)){
        const action=begin(actor,target,{reaction:authored?null:intent.intent==='intercept'?'parry':'guard'});
        if(action){const remaining=Math.max(.015,threat.duration*threat.choreography.contactProgress-threat.elapsed);action.elapsed=Math.max(0,action.duration*action.choreography.contactProgress-remaining);return;}
      }
    }
    if(time<actor.readyAt)return;
    const n=node(actor),counter=actor.counterUntil>time&&actor.counterTarget===target.id;
    if(counter&&distance(actor,target)<=battleSpacing(actor,target,distance(actor,target)).engagementRange){begin(actor,target,{reaction:'counter'});return;}
    // A live combo proceeds straight into its next authored stage while the target remains in reach.
    if(actor.chainTargetId===target.id&&actor.chainLastAt!==null&&actor.canAttack!==false&&actor.stamina>=14&&actor.posture<=82&&distance(actor,target)<=battleSpacing(actor,target,distance(actor,target)).engagementRange){
      if(begin(actor,target))return;
    }
    actor.readSeconds+=dt;
    if(!actor.decision||time>=actor.decisionUntil){actor.decision={...chooseExchangeIntent({actor,target,exchange:pair(actor,target).state,phase:n.phase,distance:distance(actor,target),threat,readSeconds:actor.readSeconds,serial:actor.cursor.cycle+actor.cursor.stageIndex}),targetId:target.id};actor.decisionUntil=time+.12;}
    if(actor.decision.intent==='commit'&&actor.canAttack!==false){
      begin(actor,target);}
  }
  return {decide};
}
