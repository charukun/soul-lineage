import {WEAPONS,ARMORS} from '@soul/johakyu-combat/execution-capability';
import {combatBodyOutcome} from '@soul/johakyu-combat/choreography';
import {HEAVY_KINDS,THRUST_KINDS,freeze} from './technique.js';
import {clamp,WEAPON_MASS,executionIdentity} from './choreography.js';
const unit=(a,b)=>{const d=Math.max(.001,Math.hypot(b.x-a.x,b.z-a.z));return{x:(b.x-a.x)/d,z:(b.z-a.z)/d};};
/** A contact decision, not a presentation guess. Does not apply HP or mutate actors. */
export function resolveImpact({execution,source,target,defense=null,contactPoint=null,bodyPart='torso',timingError=0,clash=false}){
  const mass=WEAPON_MASS[source.equipment.weapon]||1,targetMass=WEAPON_MASS[target.equipment.weapon]||1;
  const heavy=HEAVY_KINDS.has(execution.kind),counter=execution.kind==='counter',phase=execution.phase;
  const injury=combatBodyOutcome(structuredClone(source)),targetBody=combatBodyOutcome(structuredClone(target));
  const power=mass*(heavy?1.38:THRUST_KINDS.has(execution.kind)?.88:1)*(phase==='kyu'?1.18:phase==='ha'?1.06:.92)*(execution.charge==='deep'?1.24:execution.charge==='breath'?1.1:1)*injury.attackScale;
  const momentum=power+Math.max(0,Number(source.approachSpeed)||0)*.22,stability=clamp((target.stability??.65)*targetBody.movementScale*(.55+.45*target.stamina/Math.max(1,target.staminaCap))*(1-clamp(target.posture/140)),.05,1.4);
  const shield=target.equipment.shield?.55:0,armor=(ARMORS[target.equipment.armor]||ARMORS.cloth).guard;
  const normal=unit(source.position,target.position),trajectory=execution.choreography.bladeTrajectory;
  const parryDirection=trajectory==='left-to-right'||trajectory==='forward'?'right':'left';
  const contactLeverage=contactPoint?clamp(Math.hypot(contactPoint.x-target.position.x,contactPoint.z-target.position.z),.25,1.2):.65;
  const timing=clamp(1-Math.abs(timingError)/.2),parry=defense==='parry',guard=defense==='guard'||defense==='brace';
  const deflectPower=(stability*1.45+targetMass*.35+contactLeverage*.18+timing*.7)*(phase==='kyu'?1.05:1);
  const strongParry=parry&&timing>.68&&deflectPower>=momentum*1.13;
  const guardCapacity=(stability*1.6+targetMass*.34+shield)*(defense==='brace'?1.2:1),absorbed=clash?1:parry?clamp(deflectPower/Math.max(.1,momentum)):guard?clamp(guardCapacity/Math.max(.1,momentum)):0;
  const postureDamage=clash?power*9:guard?power*13*(1-shield*.25):parry?power*(strongParry?2:7):power*(heavy?14:6);
  const guardBreak=guard&&(target.posture+postureDamage>=100||momentum>guardCapacity*1.7||target.stamina<power*6);
  const blocked=(parry||guard||clash)&&!guardBreak,base=(WEAPONS[source.equipment.weapon]||WEAPONS.fist).power;
  const damage=clash||parry?0:base*(heavy?1.5:counter?1.35:1)*(phase==='kyu'?1.22:1)*(1-armor)*Math.max(.15,1-(target.mitigation||0))*injury.attackScale*(source.damageScale??1)*(guard?(guardBreak?.48:Math.max(0,1-absorbed)*.22):1);
  const reactionSeverity=clamp(power/(1+stability)*(blocked?.48:1)+(counter?.3:0)+(guardBreak?.4:0),.08,2);
  const deepHit=!blocked&&(counter||guardBreak||heavy&&phase==='kyu')&&reactionSeverity>.7;
  const impulse=clash?.65:parry?(strongParry?.12:.38):guard?(guardBreak?2:Math.max(.06,(power-guardCapacity*.75)*.85)):deepHit?Math.min(2.6,power*.8):heavy?Math.min(1.4,power*.55):.1;
  const sourceKick=clash?.65:strongParry?1.85:parry?.6:guard?.25:heavy?.18:.04;
  const stagger=clash?.2:parry?.07:guardBreak?.5:deepHit?.36:heavy?.22:.07;
  const phaseDensity=phase==='kyu'||phase==='finisher'?1.16:phase==='ha'?1.06:.9;
  const contactStop=clash?.112:strongParry?.13:parry?.108:guard?Math.min(.068,(.038+power*.012)*phaseDensity):
    deepHit||counter?Math.min(.12,.096*phaseDensity):heavy?Math.min(.09,.073*phaseDensity):Math.min(.05,.043*phaseDensity);
  return freeze({...executionIdentity(execution),damage,bodyPart,power,momentum,heavy,counter,impulse,
    knockback:{x:normal.x*impulse,z:normal.z*impulse},sourceKick,sourceImpulse:{x:-normal.x*sourceKick,z:-normal.z*sourceKick},direction:normal,
    stagger,postureDamage,blocked,absorbed,deflected:parry,deepHit,interrupted:guardBreak||deepHit,guardBreak,reactionSeverity,
    parryStrength:parry?(strongParry?'strong':'weak'):null,strongParry,parryDirection,initiativeReversal:strongParry,counterOpportunity:strongParry?.85:parry?.35:0,
    staminaDamage:guard?power*(shield?4:7):parry?power*2:0,attackerRecoil:sourceKick,defenderRecoil:impulse,
    hitstop:contactStop,
    contactPoint:contactPoint||{x:(source.position.x+target.position.x)/2,y:1.05,z:(source.position.z+target.position.z)/2},
    signals:{stability,timing,weaponMass:mass,defenderWeaponMass:targetMass,contactLeverage,bladeTrajectory:trajectory,phase,posture:target.posture}});
}
