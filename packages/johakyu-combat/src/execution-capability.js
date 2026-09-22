import {combatBodyOutcome} from './choreography.js';
import {resolveJohakyuMotion} from './motion-contract.js';
import {spendActionStamina,staminaPolicyFor} from './stamina.js';
import {WEAPONS,ARMORS} from './equipment.js';
export {WEAPONS,ARMORS} from './equipment.js';

const freeze=Object.freeze,FUNCTIONAL_SEVERITY=.68;
const ONE_LEG_FOOTWORK=new Set(['forward','retreat']);
const TWO_LEG_FOOTWORK=new Set(['chase','rush','sideL','sideR','orbitL','orbitR','cross','spiral']);
const TWO_HANDED_WEAPONS=new Set(['great','spear','axe','staff']);
const ARM_DEFENSE_KINDS=new Set(['guard','brace','parry']);
const PHASE_COST_SCALE=freeze({jo:1,ha:1.08,kyu:1.25});
const committedCharge=charge=>charge==='deep'||charge==='focus';
export function johakyuWeaponRequiresTwoHands(weapon){return TWO_HANDED_WEAPONS.has(weapon);}

function probeActor(actor){
  if(!actor||typeof actor!=='object')throw new TypeError('Actor required');
  const injuries=Object.fromEntries(['head','torso','leftArm','rightArm','leftLeg','rightLeg'].map(part=>[
    part,{severity:Number(actor.injuries?.[part]?.severity??actor.body?.[part]??0),at:Number(actor.injuries?.[part]?.at??actor.ageSeconds??0)}
  ]));
  return {
    id:actor.id||'probe',side:actor.side||'probe',hp:Number(actor.hp??100),maxHp:Number(actor.maxHp??100),
    stamina:Number(actor.stamina??0),staminaCap:Number(actor.staminaCap??100),dead:Boolean(actor.dead),
    incapacitated:Boolean(actor.incapacitated),ageSeconds:Number(actor.ageSeconds??0),seed:Number(actor.seed??1),generation:Number(actor.generation??1),
    zone:actor.zone||'frontier',moving:Boolean(actor.moving),resting:Boolean(actor.resting),idleSeconds:Number(actor.idleSeconds??0),
    lastSpendSeconds:Number(actor.lastSpendSeconds??0),combat:actor.combat!==false,injuries
  };
}
function functional(body,part){return Number(body?.[part]?.severity??1)<FUNCTIONAL_SEVERITY;}
function footworkLegDemand(footwork){
  if(!footwork||footwork==='stay')return 0;
  if(ONE_LEG_FOOTWORK.has(footwork))return 1;
  if(TWO_LEG_FOOTWORK.has(footwork))return 2;
  return 1;
}
function reasonFor({outcome,stamina,motion,armDemand,legDemand,functionalArms,functionalLegs,effectiveCost,available,committed}){
  if(outcome.fatal||outcome.incapacitated)return'incapacitated';
  if(!motion.supported)return'motion';
  if(motion.offense&&!stamina.allowOffense)return'stamina-policy';
  if(committed&&!stamina.allowFinisher)return'commitment-stamina';
  if(functionalArms<armDemand)return'arm-injury';
  if(functionalLegs<legDemand)return'leg-injury';
  if(available<effectiveCost)return'stamina';
  return null;
}

/** Pure decision; the supplied cost is before the canonical injury modifier. */
export function johakyuStageCapability(actor,{weapon='sword',phase='jo',kind='ready',footwork='stay',charge='none',staminaCost=0,requiresTwoHands=null}={}){
  if(!Number.isFinite(staminaCost)||staminaCost<0)throw new TypeError('Invalid stage stamina cost');
  const probe=probeActor(actor),outcome=combatBodyOutcome(probe),stamina=staminaPolicyFor(probe),motion=resolveJohakyuMotion({weapon,kind,charge,phase});
  const body=outcome.body,functionalArms=['leftArm','rightArm'].filter(part=>functional(body,part)).length,functionalLegs=['leftLeg','rightLeg'].filter(part=>functional(body,part)).length;
  // Callers may require a stronger grip, but cannot invent a one-handed mode
  // for a canonical two-handed weapon. Receiving force needs that grip too.
  const twoHanded=johakyuWeaponRequiresTwoHands(weapon)||Boolean(requiresTwoHands);
  const usesArms=motion.supported&&(motion.offense||ARM_DEFENSE_KINDS.has(kind));
  const armDemand=usesArms?(twoHanded?2:1):0,legDemand=footworkLegDemand(footwork),committed=committedCharge(charge);
  const staminaScale=Math.max(.42,Number(outcome.staminaScale)||1),effectiveCost=staminaCost/staminaScale,available=Math.max(0,Number(probe.stamina)||0);
  const reason=probe.dead||probe.incapacitated?'incapacitated':reasonFor({outcome,stamina,motion,armDemand,legDemand,functionalArms,functionalLegs,effectiveCost,available,committed});
  return freeze({allowed:!reason,reason,weapon,phase,kind,footwork,charge,offense:Boolean(motion.supported&&motion.offense),equipment:freeze({requiresTwoHands:twoHanded}),
    stamina:freeze({...stamina,available,baseCost:staminaCost,effectiveCost}),body:freeze({functionalArms,functionalLegs,armDemand,legDemand,
      attackScale:outcome.attackScale,movementScale:outcome.movementScale,judgmentScale:outcome.judgmentScale,staminaScale:outcome.staminaScale,
      compromised:outcome.compromised,severity:outcome.severity})});
}

/** Forecast remaining stages using the same payment (including cap fatigue),
 * without advancing time, regenerating stamina or mutating the real actor. */
export function johakyuTechniqueCapability(actor,{stages=[],fromStage=0,weapon='sword',phase='jo',requiresTwoHands=null}={}){
  if(!Array.isArray(stages)||!stages.length)return freeze({canStart:false,canContinue:false,blockedStageIndex:0,reason:'empty-technique',stages:freeze([])});
  if(!Number.isInteger(fromStage)||fromStage<0||fromStage>=stages.length)throw new RangeError('Invalid technique stage index');
  const probe=probeActor(actor);let blockedStageIndex=null,reason=null;const rows=[];
  for(let index=fromStage;index<stages.length;index++){
    const stage=stages[index]||{},cap=johakyuStageCapability(probe,{weapon:stage.weapon||weapon,phase:stage.phase||phase,kind:stage.kind,footwork:stage.footwork,charge:stage.charge,staminaCost:Number(stage.staminaCost)||0,requiresTwoHands:stage.requiresTwoHands??requiresTwoHands});
    rows.push(freeze({index,...cap}));if(!cap.allowed){blockedStageIndex=index;reason=cap.reason;break;}
    spendActionStamina(probe,cap.stamina.effectiveCost);
  }
  const canStart=rows[0]?.allowed===true,canContinue=blockedStageIndex===null;
  return freeze({canStart,canContinue,blockedStageIndex,reason,remainingStamina:probe.stamina,remainingStaminaCap:probe.staminaCap,stages:freeze(rows)});
}

/** Equipment/phase/technique/skill modifiers are applied exactly once here.
 * Adapters supply canonical skill effects; they do not redefine equipment or
 * injury rules. The body modifier remains owned by johakyuStageCapability. */
export function johakyuEquippedStageRequest(actor,{weapon=actor?.equipment?.weapon||'sword',phase='jo',effort=1,staminaMultiplier=1,...stage}={}){
  if(!Number.isFinite(effort)||effort<0||!Number.isFinite(staminaMultiplier)||staminaMultiplier<0)throw new TypeError('Invalid stamina modifier');
  const base=WEAPONS[actor?.equipment?.weapon||weapon]||WEAPONS.fist,armor=ARMORS[actor?.equipment?.armor]||ARMORS.cloth;
  const staminaCost=base.stamina*(PHASE_COST_SCALE[phase]||1)*effort*staminaMultiplier/Math.max(.5,armor.staminaScale);
  return {...stage,weapon:actor?.equipment?.weapon||weapon,phase,staminaCost};
}
export function johakyuEquippedStageCapability(actor,request={}){
  return johakyuStageCapability(actor,johakyuEquippedStageRequest(actor,request));
}
export function johakyuEquippedTechniqueCapability(actor,{stages=[],fromStage=0,...request}={}){
  const prepared=stages.map(stage=>johakyuEquippedStageRequest(actor,{...request,...stage,...(stage.step||{})}));
  return johakyuTechniqueCapability(actor,{...request,stages:prepared,fromStage});
}

// Attempts are runtime identities, not forecasts. A failed or cancelled attempt
// cannot become successful on a later update; a retry needs a new identity.
const attempts=new WeakMap();
export function beginJohakyuStage(actor,attempt,request={}){
  if(!attempt||typeof attempt!=='object')throw new TypeError('Stage attempt required');
  const previous=attempts.get(attempt);
  if(previous?.actor&&previous.actor!==actor)throw new Error('Stage attempt actor changed');
  if(previous?.cancelled)return freeze({allowed:false,reason:'interrupted',paid:0,capability:previous.receipt?.capability??null});
  if(previous?.receipt)return previous.receipt;
  const capability=johakyuEquippedStageCapability(actor,request);
  const allowed=capability.allowed&&spendActionStamina(actor,capability.stamina.effectiveCost);
  const receipt=freeze({allowed,reason:allowed?null:capability.reason||'stamina',paid:allowed?capability.stamina.effectiveCost:0,capability});
  attempts.set(attempt,{actor,receipt,cancelled:false});return receipt;
}
export function cancelJohakyuStage(attempt){
  if(!attempt||typeof attempt!=='object')return;
  const previous=attempts.get(attempt)||{};attempts.set(attempt,{...previous,cancelled:true});
}
export function johakyuStageIsActive(attempt){
  const state=attempt&&attempts.get(attempt);return Boolean(state?.receipt?.allowed&&!state.cancelled);
}
