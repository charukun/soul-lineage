import {engagementReady} from './engagement.js';

/** The actor is the mutable domain record. This projection is never written back.
 * Every subsystem reads the same priority order instead of inventing flag combinations.
 */
export const isBattleActorAlive=actor=>Boolean(actor&&!actor.dead&&!actor.downed&&!actor.incapacitated);

export function readBattleActorState(actor,time){
  const alive=isBattleActorAlive(actor);
  let phase;
  if(actor.dead)phase=actor.executionLifecycle==='EXECUTED'?'executed':'corpse';
  else if(!alive)phase=actor.executionLifecycle==='EXECUTION_LOCK'?'execution-victim':actor.executionLifecycle==='FALLING'?'falling':'downed';
  else if(time<actor.spawnUntil)phase='spawning';
  else if(actor.action?.finisher)phase='executing';
  else if(time<actor.staggerUntil)phase='staggered';
  else if(actor.action)phase='acting';
  else if(actor.phaseCue?.phase==='zanshin')phase='zanshin';
  else if(actor.decision?.intent==='execution-approach')phase='execution-approach';
  else if(engagementReady(actor.engagement))phase='ready';
  else phase=actor.decision?'approaching':'idle';
  const locked=['executing','execution-victim','executed','corpse','spawning'].includes(phase);
  const canMove=alive&&!locked&&phase!=='staggered';
  const canDecide=canMove&&!actor.action&&phase!=='zanshin';
  const weapon=alive&&(Boolean(actor.action)||phase==='execution-approach'||phase==='zanshin'||engagementReady(actor.engagement))?'drawn':'sheathed';
  return Object.freeze({phase,alive,canDecide,canMove,rootLocked:locked,weapon,
    targetId:actor.action?.targetId??actor.decision?.targetId??actor.engagement?.threatId??null,
    actionId:actor.action?.id??null});
}
