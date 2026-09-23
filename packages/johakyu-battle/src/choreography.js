import {resolveJohakyuMotion} from '@soul/johakyu-combat/motion-contract';
import {DEFENSIVE_KINDS,HEAVY_KINDS,THRUST_KINDS,freeze} from './technique.js';
export const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,Number(x)||0));
export const WEAPON_MASS=Object.freeze({fist:.5,dagger:.65,sword:1,great:1.85,axe:1.7,spear:1.15,staff:1.05});
/** Normalized stage clock. Values are semantic pose anchors, never asset names. */
export function stageChoreography(technique,stage,{weapon=technique.weapon,tempo=1,chainLength=1}={}){
  const kind=stage.kind,heavy=HEAVY_KINDS.has(kind),twoHand=['great','axe','spear','staff'].includes(weapon),thrust=THRUST_KINDS.has(kind);
  const semantic=resolveJohakyuMotion({weapon,kind,charge:stage.charge,phase:'jo'}),contact=semantic.contactProgress??.5;
  const rhythm={sharp:.58,flow:.66,weight:.82,elastic:.64,seamless:.54}[technique.rhythm]||.66;
  const duration=Math.max(.34,rhythm*(heavy?1.22:DEFENSIVE_KINDS.has(kind)?.9:1)*(chainLength>1?.9:1)*(stage.charge==='deep'?1.16:stage.charge==='breath'?1.08:1)/(technique.tempo*Math.max(.5,tempo)));
  const timeline={anticipation:0,commit:contact-(heavy?.24:.2),execute:contact-.12,contact,impact:contact,followThrough:contact+.07,recovery:Math.min(.92,contact+.27),end:1};
  return freeze({duration,timeline,contactProgress:contact,offense:!DEFENSIVE_KINDS.has(kind),
    bladeTrajectory:semantic.bladeTrajectory||'neutral',
    motionIntent:kind,weight:(WEAPON_MASS[weapon]||1)*(heavy?1.35:thrust?.86:1),
    speedCurve:{anticipation:heavy?.72:.92,execute:heavy?1.35:1.15,recovery:heavy?.76:1}});
}
/** Continuous contact-preserving acceleration curve; shared by execution and animation. */
export function stagePoseProgress(progress,choreography){
  const p=clamp(progress),t=choreography.timeline;
  if(p<t.commit)return t.commit*Math.pow(p/Math.max(.001,t.commit),1.18);
  if(p<t.contact){const q=(p-t.commit)/(t.contact-t.commit);return t.commit+(t.contact-t.commit)*q*q;}
  if(p<t.recovery){const q=(p-t.contact)/(t.recovery-t.contact);return t.contact+(t.recovery-t.contact)*(1-Math.pow(1-q,1.25));}
  return p;
}
export function timelinePhase(progress,{timeline:t}){
  if(progress>=t.recovery)return'recovery';if(progress>=t.followThrough)return'followThrough';if(progress>=t.contact)return'impact';if(progress>=t.execute)return'execute';if(progress>=t.commit)return'commit';return'anticipation';
}
export function executionIdentity(execution){
  return {executionId:execution.id,attackId:execution.id,techniqueId:execution.techniqueId,stageIndex:execution.stageIndex,
    kind:execution.kind,footwork:execution.footwork,charge:execution.charge,phase:execution.phase,weapon:execution.weapon,chainId:execution.chainId,techniqueIndex:execution.techniqueIndex};
}
