const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']);
const LEGACY_PROGRESS_KEYS=Object.freeze(['combatLessons','combatLessonRecent','techniqueEvolution','combatLegacy','combatLegacyFinal']);

function hash01(value){const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;}
function cleanSeverity(value){return clamp(Number(value)||0,0,1);}
function injuryRow(value,ageSeconds=0){if(value&&typeof value==='object')return{severity:cleanSeverity(value.severity),at:Number.isFinite(value.at)?value.at:ageSeconds};return{severity:cleanSeverity(value),at:ageSeconds};}

/** Removes progression fields accidentally introduced by the combat-evolution merge. */
export function stripCombatProgressionState(state){
  if(!state||typeof state!=='object')return state;
  for(const key of LEGACY_PROGRESS_KEYS)delete state[key];
  if(Array.isArray(state.lineage))state.lineage=state.lineage.map(row=>{if(!row||typeof row!=='object')return row;const clean={...row};delete clean.combatLegacy;return clean;});
  state.pendingDiscoveries=[];
  return state;
}

export function ensureCombatInjuryState(state){
  stripCombatProgressionState(state);state.injuries??={};
  for(const part of PARTS)state.injuries[part]=injuryRow(state.injuries[part],state.ageSeconds||0);
  state.ammo??={};if(!Number.isFinite(state.ammo.staffCharges))state.ammo.staffCharges=8;if(!Number.isFinite(state.ammo.staffMax))state.ammo.staffMax=8;
  return state;
}

export function recoverPersistentInjuries(state){
  ensureCombatInjuryState(state);const now=Number(state.ageSeconds)||0,resting=Boolean(state.resting)||state.zone==='village';
  for(const part of PARTS){const row=state.injuries[part],elapsed=Math.max(0,now-row.at),rate=resting?.0042:.0016;row.severity=clamp(row.severity-elapsed*rate,0,1);row.at=now;}
  return state.injuries;
}

export function injuryEffects(state){
  recoverPersistentInjuries(state);const i=state.injuries,arms=(i.leftArm.severity+i.rightArm.severity)/2,legs=(i.leftLeg.severity+i.rightLeg.severity)/2,head=i.head.severity,torso=i.torso.severity;
  return{
    attackScale:clamp(1-arms*.46-head*.08,.45,1),
    movementScale:clamp(1-legs*.52-torso*.08,.4,1),
    judgmentScale:clamp(1-head*.48-torso*.08,.42,1),
    staminaScale:clamp(1-torso*.38-head*.16,.42,1),
    severity:clamp((arms+legs+head+torso)/4,0,1),
  };
}

function chooseInjuryPart(state,{sector='front',sourceId='',damage=0}={}){
  const roll=hash01(`${state.seed}:${state.generation}:${sourceId}:${Math.floor(state.ageSeconds||0)}:${Math.round(damage*10)}`);
  if(sector==='back')return roll<.28?'head':roll<.72?'torso':roll<.86?'leftLeg':'rightLeg';
  if(sector==='left')return roll<.42?'leftArm':roll<.7?'leftLeg':roll<.9?'torso':'head';
  if(sector==='right')return roll<.42?'rightArm':roll<.7?'rightLeg':roll<.9?'torso':'head';
  return roll<.18?'head':roll<.48?'torso':roll<.61?'leftArm':roll<.74?'rightArm':roll<.87?'leftLeg':'rightLeg';
}

export function applyCombatInjury(state,{damage=0,sector='front',sourceId=''}={}){
  ensureCombatInjuryState(state);const part=chooseInjuryPart(state,{sector,sourceId,damage}),row=state.injuries[part],relative=Math.max(0,Number(damage)||0)/Math.max(1,Number(state.maxHp)||100),gain=clamp(relative*.72,.006,.2);
  row.severity=clamp(row.severity+gain,0,1);row.at=Number(state.ageSeconds)||0;
  return{part,severity:row.severity,gain};
}
