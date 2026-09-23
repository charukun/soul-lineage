import {beginJohakyuStage,cancelJohakyuStage} from '@soul/johakyu-combat/execution-capability';
import {resolveJohakyuMotion as semanticMotion} from '@soul/johakyu-combat/motion-contract';
import {PHASES,defineTechnique,freeze} from './technique.js';
import {stageChoreography,executionIdentity} from './choreography.js';
const clone=value=>structuredClone(value);
export function createBattleExecution({actors,getTime,getSerial,battleId,emit,exchange,pair,fullyDownForFinisher,distance,live,lifecycle}){
  function node(actor){const c=actor.cursor,phase=PHASES[c.phaseIndex],chain=actor.loadout[phase],technique=chain[Math.min(c.techniqueIndex,chain.length-1)];return {phase,chain,technique,stage:technique.stages[Math.min(c.stageIndex,technique.stages.length-1)]};}
  function begin(actor,target,{reaction=null,finisher=false}={}){
    if(!live(actor)||actor.action||getTime()<actor.spawnUntil||!target||target.dead||(!finisher&&!live(target)))return null;
    if(finisher&&(!fullyDownForFinisher(target)||!actor.executionSocket||distance(actor,{position:actor.executionSocket.position})>.17||target.finisherClaimedBy&&target.finisherClaimedBy!==actor.id))return null;
    if(!reaction&&!finisher&&!actor.override&&actor.queuedTechnique){actor.override={technique:actor.queuedTechnique,stageIndex:0};actor.queuedTechnique=null;}
    const n=node(actor),technique=reaction?defineTechnique({id:`reaction.${reaction}`,name:reaction==='parry'?'弾き':reaction==='counter'?'返し':'受け',steps:[{kind:reaction,footwork:reaction==='counter'?'chase':'stay',charge:'none'}]},{weapon:actor.equipment.weapon}):finisher?defineTechnique({id:'finisher.execution',name:'トドメ',rhythm:'weight',steps:[{kind:actor.equipment.weapon==='fist'?'bash':'heavy',footwork:'stay',charge:'breath'}]},{weapon:actor.equipment.weapon}):actor.override?.technique||n.technique;
    const stage=reaction||finisher?technique.stages[0]:actor.override?technique.stages[actor.override.stageIndex]:n.stage,phase=finisher?'finisher':reaction?'uke':actor.override?(actor.override.inspirationPhase||'one'):n.phase;
    const continuing=!reaction&&!finisher&&phase!=='one'&&actor.chainLastAt!==null&&actor.chainTargetId===target.id;
    const momentum=continuing?1+Math.min(.14,actor.cursor.phaseIndex*.035+actor.cursor.techniqueIndex*.025):1;
    const baseChoreography=stageChoreography(technique,stage,{weapon:actor.equipment.weapon,tempo:finisher?1:(actor.tempo||1)*momentum,chainLength:finisher?1:n.chain.length,phase:finisher?'finisher':reaction?'ha':phase});
    const finisherScale=actor.finisherProfile?.durationScale||({sokudan:.9,kakudan:1,danzetsu:1.1}[actor.finisherProfile]||1);
    const firstCast=technique.source==='trial'&&stage.stageIndex===0&&!reaction&&!finisher;
    const firstProfile=firstCast?technique.firstInspirationPresentation:null;
    const choreography=finisher?freeze({...baseChoreography,duration:Math.max(1.7,Math.min(2.3,2*finisherScale))}):firstCast?freeze({...baseChoreography,duration:Math.max(baseChoreography.duration,firstProfile.firstStageSeconds)}):baseChoreography;
    const execution={id:`${battleId}:${actor.id}:${getSerial()}`,actorId:actor.id,targetId:target.id,techniqueId:technique.id,technique,stageIndex:stage.stageIndex,
      kind:stage.kind,footwork:stage.footwork,charge:stage.charge,phase,weapon:actor.equipment.weapon,chainId:`${actor.id}:${actor.cursor.cycle}:${n.phase}`,techniqueIndex:actor.cursor.techniqueIndex,
      chainLength:n.chain.length,choreography,elapsed:0,duration:choreography.duration,contactResolved:false,reaction,finisher,scope:technique.source==='trial'?'trial':actor.scope||'equipped'};
    if(!semanticMotion(execution).supported){actor.readyAt=getTime()+.5;emit({type:'execution-blocked',sourceId:actor.id,targetId:target.id,...executionIdentity(execution),reason:'unsupported-stage'});return null;}
    const staminaBefore=actor.stamina,receipt=beginJohakyuStage(actor,execution,{weapon:execution.weapon,phase,techniqueId:technique.id,...stage,staminaMultiplier:actor.staminaMultiplier??1});
    if(!receipt.allowed){actor.readyAt=getTime()+.35;emit({type:'execution-blocked',sourceId:actor.id,targetId:target.id,...executionIdentity(execution),reason:receipt.reason});return null;}
    execution.paid=receipt.paid;if(finisher){execution.socket=clone(actor.executionSocket);lifecycle.lockExecution(actor,target,execution);}actor.action=execution;actor.phaseCue=null;actor.decision=null;actor.readSeconds=0;
    if(firstCast){
      const profile=firstProfile;
      actor.firstInspirationUntil=getTime()+profile.protectionSeconds;
      actor.firstInspirationTechniqueId=technique.id;
      target.staggerUntil=Math.max(target.staggerUntil,getTime()+(target.boss?profile.bossStaggerSeconds:profile.targetStaggerSeconds));
      if(!target.boss)interrupt(target,'inspiration-stagger');
      emit({type:'inspiration-start',sourceId:actor.id,targetId:target.id,techniqueId:technique.id,
        attackId:execution.id,phase:execution.phase,skill:technique.name,firstInspirationPresentation:profile});
    }
    if(!reaction&&!finisher&&phase!=='one')actor.chainTargetId=target.id;
    if(!reaction&&!finisher){const p=pair(actor,target).state;if(p.mode!=='pressure')exchange(actor,target,{type:'normal-start',phase:n.phase,seeded:true});exchange(actor,target,{type:'commit',phase:n.phase});}
    if(reaction==='counter')exchange(actor,target,{type:'counter-start'});
    emit({type:finisher?'finisher-start':reaction?'reaction-start':'stage-start',sourceId:actor.id,actorId:actor.id,targetId:target.id,...executionIdentity(execution),staminaBefore,staminaPaid:receipt.paid});return execution;
  }
  function finish(actor){
    const action=actor.action;if(!action)return;emit({type:'stage-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});cancelJohakyuStage(action);actor.action=null;actor.readyAt=getTime()+.033;
    if(action.finisher){
      lifecycle.completeExecution(actor);
      emit({type:'finisher-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});
      return;}
    if(actor.override&&action.techniqueId===actor.override.technique.id){
      actor.override.stageIndex++;
      if(actor.override.stageIndex>=actor.override.technique.stages.length){
        const inspired=Boolean(actor.override.inspirationPhase);
        actor.override=null;actor.readyAt=getTime()+.033;
        emit({type:'technique-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});
        if(inspired){actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:actor.cursor.cycle+1};actor.chainTargetId=null;actor.chainLastAt=null;
          emit({type:'phase-change',actorId:actor.id,phase:'jo'});}
      }
      return;
    }
    if(action.reaction){if(action.reaction==='counter'){actor.counterUntil=0;const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'counter-complete'});}return;}
    if(action.breakReason||!live(actors.get(action.targetId)||{})){breakChain(actor,action.breakReason||'target-lost',action.targetId);return;}
    actor.chainLastAt=getTime();
    const c=actor.cursor,n=node(actor);c.stageIndex++;
    if(c.stageIndex>=n.technique.stages.length){c.stageIndex=0;c.techniqueIndex++;const opponent=actors.get(action.targetId);if(opponent){exchange(actor,opponent,{type:'offense-complete',phase:action.phase});}emit({type:'technique-complete',sourceId:actor.id,targetId:action.targetId,...executionIdentity(action)});
      if(c.techniqueIndex>=n.chain.length){c.techniqueIndex=0;c.phaseIndex=(c.phaseIndex+1)%3;emit({type:'phase-change',actorId:actor.id,phase:PHASES[c.phaseIndex]});
        if(c.phaseIndex===0){c.cycle++;actor.chainTargetId=null;actor.chainLastAt=null;actor.readyAt=getTime()+.033;actor.pendingZanshin=true;const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'kyu-complete',phase:'kyu'});}
      }
    }
  }
  function breakChain(actor,reason,targetId=actor.chainTargetId){
    actor.override=null;actor.chainTargetId=null;actor.chainLastAt=null;actor.phaseCue=null;actor.decision=null;actor.readSeconds=0;
    actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:actor.cursor.cycle+1};
    emit({type:'chain-break',actorId:actor.id,sourceId:actor.id,targetId,reason});
  }
  function cancel(actor,{delay=.22,pendingZanshin=false}={}){
    const action=actor.action;
    cancelJohakyuStage(action);actor.action=null;lifecycle.releaseExecution(actor);
    actor.override=null;actor.queuedTechnique=null;actor.queuedInspiration=null;
    actor.chainTargetId=null;actor.chainLastAt=null;actor.phaseCue=null;actor.pendingZanshin=pendingZanshin;
    actor.decision=null;actor.decisionUntil=0;actor.readSeconds=0;
    actor.counterUntil=0;actor.counterTarget=null;
    actor.pursuitSeconds=0;actor.pursuitUntil=0;actor.pursuitTargetId=null;
    actor.cursor={phaseIndex:0,techniqueIndex:0,stageIndex:0,cycle:actor.cursor.cycle+1};
    actor.readyAt=Math.max(getTime()+delay,Number(actor.staggerUntil)||0);
    return action;
  }
  function interrupt(actor,reason){
    if(!actor.action){lifecycle.releaseExecution(actor);return;}
    const action=cancel(actor);
    const target=actors.get(action.targetId);if(target)exchange(actor,target,{type:'interrupted',phase:action.phase});
    emit({type:'interrupted',sourceId:actor.id,targetId:action.targetId,reason,...executionIdentity(action)});
  }
  return {node,begin,finish,breakChain,interrupt,cancel};
}
