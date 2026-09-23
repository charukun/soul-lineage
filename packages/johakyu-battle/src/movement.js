import {combatBodyOutcome} from '@soul/johakyu-combat/choreography';
import {COMBAT_LOCOMOTION} from '@soul/johakyu-combat/locomotion';
import {battleSpacing,footworkVelocity,moveWithResistance} from './exchange.js';
export function createBattleMovement({actors,manualMoves,bounds,blocked,getTime,targetFor,distance,live,clamp}){
  function move(actor,dt){
    const before={...actor.position};if(actor.action?.finisher)return;moveWithResistance(actor,dt,{bounds,blocked});
    if(!live(actor)||getTime()<actor.staggerUntil)return;
    if(actor.action?.finisher)return;
    if(actor.executionSocket&&actor.decision?.intent==='execution-approach'){const socket=actor.executionSocket,next=socket.position,d=Math.hypot(next.x-actor.position.x,next.z-actor.position.z);if(d>.005){const stride=Math.min(d,COMBAT_LOCOMOTION.walkSpeed*dt);const candidate={x:actor.position.x+(next.x-actor.position.x)*stride/d,z:actor.position.z+(next.z-actor.position.z)*stride/d};if(!blocked(actor.position,candidate,actor))actor.position=candidate;actor.moving=stride>.0001;}actor.yaw=socket.yaw;return;}
    const manual=manualMoves.get(actor.id);
    if(manual&&Math.hypot(manual.x,manual.z)>.08){
      const speed=(manual.dash?COMBAT_LOCOMOTION.dashSpeed:COMBAT_LOCOMOTION.walkSpeed)*combatBodyOutcome(actor).movementScale*(actor.action?COMBAT_LOCOMOTION.actionMoveScale:1);
      const next={x:clamp(actor.position.x+manual.x*speed*dt,bounds.minX,bounds.maxX),z:clamp(actor.position.z+manual.z*speed*dt,bounds.minZ,bounds.maxZ)};
      if(!blocked(actor.position,next,actor))actor.position=next;
      actor.moving=Math.hypot(actor.position.x-before.x,actor.position.z-before.z)>.0001;
      const target=targetFor(actor);if(target)actor.yaw=Math.atan2(target.position.x-actor.position.x,target.position.z-actor.position.z);
      else if(actor.moving)actor.yaw=Math.atan2(manual.x,manual.z);
      return;
    }
    const a=actor.action,target=actors.get(a?.targetId||actor.decision?.targetId);if(!target)return;
    const footwork=a?.footwork||actor.decision?.footwork||'stay',speed=a?.techniqueId==='heart.pursuer'?COMBAT_LOCOMOTION.dashSpeed*.63:COMBAT_LOCOMOTION.walkSpeed*(COMBAT_LOCOMOTION.footworkScale[footwork]??.75),d=distance(actor,target),spacing=battleSpacing(actor,target,d);
    const movement=footworkVelocity(footwork,actor.position,target.position,speed*(combatBodyOutcome(actor).movementScale)*(a?.chainLength>1&&['forward','chase','rush'].includes(footwork)?1.12:1));
    let scale=dt;const radial=(movement.x*(target.position.x-actor.position.x)+movement.z*(target.position.z-actor.position.z))/Math.max(.001,d);
    const stop=a?.techniqueId==='heart.pursuer'?1.48:(actor.decision?.stopDistance??spacing.preferredSpacing);
    if(radial>0)scale=Math.min(dt,Math.max(0,d-stop)/Math.max(.001,radial));
    if(footwork==='retreat'){
      // Retreating strikes used to walk themselves outside canonical weapon reach before their contact frame.
      // Hold the root inside a small contact envelope until impact, then let the authored retreat finish in recovery.
      const contactStop=a?.choreography?.offense&&!a.contactResolved?Math.max(1.46,spacing.engagementRange-.12):null,retreatStop=contactStop??actor.decision?.stopDistance;
      if(Number.isFinite(retreatStop))scale=Math.min(dt,Math.max(0,retreatStop-d)/Math.max(.001,speed));
    }
    const next={x:clamp(actor.position.x+movement.x*scale,bounds.minX,bounds.maxX),z:clamp(actor.position.z+movement.z*scale,bounds.minZ,bounds.maxZ)};
    if(!blocked(actor.position,next,actor))actor.position=next;
    actor.approachSpeed=Math.max(0,radial);actor.moving=Math.hypot(actor.position.x-before.x,actor.position.z-before.z)>.0001;actor.yaw=Math.atan2(target.position.x-actor.position.x,target.position.z-actor.position.z);
  }
  function separate(){const rows=[...actors.values()].filter(live);for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){const a=rows[i],b=rows[j],d=distance(a,b);if(d>=1.46)continue;const v=d>.001?{x:(b.position.x-a.position.x)/d,z:(b.position.z-a.position.z)/d}:{x:1,z:0},push=(1.46-d)/(a.action?.finisher||b.action?.finisher?1:2);for(const [actor,sign]of [[a,-1],[b,1]]){if(actor.action?.finisher)continue;const next={x:actor.position.x+v.x*push*sign,z:actor.position.z+v.z*push*sign};if(!blocked(actor.position,next,actor))actor.position=next;}}}
  return {move,separate};
}
