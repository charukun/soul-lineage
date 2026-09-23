import {combatReadyEnvelope,combatReachPolicy} from '@soul/johakyu-combat/locomotion';
export function resolveEngagement({actor,threat,distance}){
  const weapon=actor.equipment.weapon,policy=combatReachPolicy({weapon});
  if(!threat)return {state:'idle',threatId:null,distance:null,weaponReach:policy.weaponReach,enterRange:policy.engagementRange,exitRange:policy.readyExitRange};
  const gap=distance(actor,threat),wasReady=actor.engagement?.state==='ready'||actor.engagement?.state==='engaged';
  const envelope=combatReadyEnvelope({distance:gap,weapon,wasReady});
  const state=envelope.ready?(actor.action&&!actor.action.finisher?'engaged':'ready'):(actor.moving||actor.decision?.intent==='pursuit'?'approach':'idle');
  return {state,threatId:threat.id,distance:gap,weaponReach:policy.weaponReach,enterRange:envelope.enterRange,exitRange:envelope.exitRange};
}
export const engagementReady=engagement=>engagement?.state==='ready'||engagement?.state==='engaged';
