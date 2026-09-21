import {normalizeCombatStrategy,strategyForState} from '@soul/game-data/combat-strategy';
export {COMBAT_STRATEGY_PRESETS,normalizeCombatStrategy,strategyForState} from '@soul/game-data/combat-strategy';
import {ensureCombatInjuryState,injuryEffects} from './combat-injury.js';

const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,Number(n)||0));
export const COMBAT_BODY_PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']);
export const COMBAT_BODY_LABELS=Object.freeze({head:'頭',torso:'胴',leftArm:'左腕',rightArm:'右腕',leftLeg:'左脚',rightLeg:'右脚'});
const hash01=value=>{const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;};
const stageFor=severity=>severity>=.9?'機能不全':severity>=.68?'重傷':severity>=.42?'負傷':severity>=.18?'軽傷':'正常';
export function combatBodySnapshot(state){
  ensureCombatInjuryState(state);
  return Object.freeze(Object.fromEntries(COMBAT_BODY_PARTS.map(part=>{const severity=clamp(state.injuries?.[part]?.severity);return[part,Object.freeze({severity,durability:Math.round((1-severity)*100),stage:stageFor(severity),label:COMBAT_BODY_LABELS[part]})];})));
}
export function combatBodyOutcome(state){
  const body=combatBodySnapshot(state),head=body.head.severity,torso=body.torso.severity,leftLeg=body.leftLeg.severity,rightLeg=body.rightLeg.severity,leftArm=body.leftArm.severity,rightArm=body.rightArm.severity;
  const fatal=head>=.97||torso>=.99;
  const incapacitated=fatal||head>=.86||torso>=.91||(leftLeg>=.82&&rightLeg>=.82);
  const compromised=incapacitated||Math.max(head,torso,leftLeg,rightLeg,leftArm,rightArm)>=.68;
  const injury=injuryEffects(state);
  return Object.freeze({fatal,incapacitated,compromised,severity:injury.severity,attackScale:injury.attackScale,movementScale:injury.movementScale,judgmentScale:injury.judgmentScale,staminaScale:injury.staminaScale,body});
}
function choosePart(state,{sector='front',sourceId='',damage=0,phase='ha'}={}){
  ensureCombatInjuryState(state);
  const signature=COMBAT_BODY_PARTS.map(part=>Math.round(clamp(state.injuries[part]?.severity)*100)).join('-');
  const roll=hash01(`${state.seed||0}:${state.generation||0}:${sourceId}:${sector}:${phase}:${Math.round(damage*10)}:${signature}`);
  if(sector==='back')return roll<.3?'head':roll<.7?'torso':roll<.85?'leftLeg':'rightLeg';
  if(sector==='left')return roll<.46?'leftArm':roll<.72?'leftLeg':roll<.92?'torso':'head';
  if(sector==='right')return roll<.46?'rightArm':roll<.72?'rightLeg':roll<.92?'torso':'head';
  return roll<.14?'head':roll<.44?'torso':roll<.58?'leftArm':roll<.72?'rightArm':roll<.86?'leftLeg':'rightLeg';
}
export function applyChoreographyImpact(state,{damage=0,maxIntegrity=null,sector='front',sourceId='',phase='ha',part=null}={}){
  ensureCombatInjuryState(state);
  const targetPart=COMBAT_BODY_PARTS.includes(part)?part:choosePart(state,{sector,sourceId,damage,phase});
  const row=state.injuries[targetPart],base=Math.max(1,Number(maxIntegrity)||Number(state.maxHp)||100),relative=Math.max(0,Number(damage)||0)/base;
  const phaseScale=phase==='finisher'?1.8:phase==='one'?1.55:phase==='kyu'?1.38:phase==='ha'?1.14:.95;
  const phaseCap=phase==='finisher'?.55:phase==='one'?.4:phase==='kyu'?.24:phase==='ha'?.16:.11;
  const gain=clamp(relative*1.08*phaseScale+.004,.005,phaseCap);
  row.severity=clamp(row.severity+gain);row.at=Number(state.ageSeconds)||0;
  const outcome=combatBodyOutcome(state),entry=outcome.body[targetPart];
  return Object.freeze({part:targetPart,label:entry.label,severity:entry.severity,durability:entry.durability,stage:entry.stage,gain,outcome});
}
