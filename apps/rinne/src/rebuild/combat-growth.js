import { eligibleDiscoveries, skillName } from './skill-system.js';

const clamp=(n,lo,hi)=>Math.min(hi,Math.max(lo,n));
const PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']);
const LESSON_EXPERIENCE=Object.freeze({
  backHit:['sense','observe'],
  surrounded:['sense','balance'],
  staminaBreak:['breathe','rest'],
  rangeLoss:['distance','observe'],
  knockdown:['fall','balance'],
  repeatedPattern:['practice','focus'],
});

function hash01(value){const text=String(value);let hash=2166136261;for(let i=0;i<text.length;i++){hash^=text.charCodeAt(i);hash=Math.imul(hash,16777619);}return(hash>>>0)/4294967295;}
function cleanSeverity(value){return clamp(Number(value)||0,0,1);}
function injuryRow(value,ageSeconds=0){if(value&&typeof value==='object')return{severity:cleanSeverity(value.severity),at:Number.isFinite(value.at)?value.at:ageSeconds};return{severity:cleanSeverity(value),at:ageSeconds};}

export function ensureCombatGrowthState(state){
  state.combatLessons??={};state.combatLessonRecent??={};state.techniqueEvolution??={};state.injuries??={};
  for(const part of PARTS)state.injuries[part]=injuryRow(state.injuries[part],state.ageSeconds||0);
  state.ammo??={};if(!Number.isFinite(state.ammo.staffCharges))state.ammo.staffCharges=8;if(!Number.isFinite(state.ammo.staffMax))state.ammo.staffMax=8;
  state.combatLegacy??={forms:{},lessons:{}};
  return state;
}

export function recoverPersistentInjuries(state){
  ensureCombatGrowthState(state);const now=Number(state.ageSeconds)||0,resting=Boolean(state.resting)||state.zone==='village';
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
  ensureCombatGrowthState(state);const part=chooseInjuryPart(state,{sector,sourceId,damage}),row=state.injuries[part],relative=Math.max(0,Number(damage)||0)/Math.max(1,Number(state.maxHp)||100),gain=clamp(relative*.72,.006,.2);
  row.severity=clamp(row.severity+gain,0,1);row.at=Number(state.ageSeconds)||0;
  return{part,severity:row.severity,gain};
}

function addExperience(state,kind,gain){
  const row=state.experiences[kind]||{count:0,score:0,last:0};state.experiences[kind]={count:row.count+1,score:row.score+gain,last:state.ageSeconds||0};
}

export function recordCombatLesson(state,kind,{amount=.42,cooldown=3}={}){
  ensureCombatGrowthState(state);const now=Number(state.ageSeconds)||0,last=Number(state.combatLessonRecent[kind]??-1e9);if(now-last<cooldown)return{recorded:false,unlocked:[]};
  state.combatLessonRecent[kind]=now;state.combatLessons[kind]=(Number(state.combatLessons[kind])||0)+amount;for(const exp of LESSON_EXPERIENCE[kind]||[])addExperience(state,exp,amount);
  const unlocked=[];for(const row of eligibleDiscoveries(state)){if(state.knownSkills.includes(row.id)||state.pendingDiscoveries.includes(row.id))continue;state.knownSkills.push(row.id);unlocked.push(row.id);}
  state.combatLegacy.lessons[kind]=(Number(state.combatLegacy.lessons[kind])||0)+amount;
  return{recorded:true,unlocked,names:unlocked.map(skillName)};
}

export function noteTechniqueUse(state,skill,{phase='jo',hit=true}={}){
  ensureCombatGrowthState(state);skill=String(skill||'basic');const row=state.techniqueEvolution[skill]??={uses:0,hits:0,jo:0,ha:0,kyu:0,seed:hash01(`${state.seed}:${skill}`)};row.uses++;if(hit)row.hits++;if(['jo','ha','kyu'].includes(phase))row[phase]++;state.techniqueEvolution[skill]=row;
  const mutation=techniqueMutationFor(state,skill);state.combatLegacy.forms[skill]={...mutation,uses:row.uses};return mutation;
}

export function techniqueMutationFor(state,skill){
  ensureCombatGrowthState(state);const row=state.techniqueEvolution[String(skill||'basic')]||{uses:0,jo:0,ha:0,kyu:0,seed:hash01(`${state.seed}:${skill}`)},tier=Math.min(3,Math.floor(row.uses/12)),axis=row.seed<.34?'advance':row.seed<.67?'flank':'retreat',dominant=row.kyu>row.jo&&row.kyu>row.ha?'weight':row.ha>row.jo?'flow':'sharp';
  return{tier,axis,rhythm:tier>=2?dominant:null,tempoScale:1+(axis==='advance'?.025:axis==='flank'?.012:-.01)*tier,chargeBias:tier>=3?(dominant==='weight'?'breath':'none'):null,footworkBias:tier?axis:null};
}

export function evolveTechniqueForm(state,skill,form){
  const mutation=techniqueMutationFor(state,skill),out={...form,kinds:[...(form.kinds||[])],feet:[...(form.feet||[])],charges:[...(form.charges||[])]};if(!mutation.tier)return out;
  const foot={advance:'chase',flank:mutation.tier>=2?'orbitR':'sideR',retreat:'retreat'}[mutation.axis];if(out.feet.length)out.feet[Math.min(out.feet.length-1,mutation.tier-1)]=foot;
  if(mutation.rhythm)out.rhythm=mutation.rhythm;if(mutation.chargeBias&&out.charges.length)out.charges[out.charges.length-1]=mutation.chargeBias;out.tempo=(Number(out.tempo)||1)*mutation.tempoScale;return out;
}

export function combatLegacySnapshot(state){ensureCombatGrowthState(state);return{forms:structuredClone(state.combatLegacy.forms),lessons:structuredClone(state.combatLegacy.lessons),injuries:Object.fromEntries(PARTS.map(part=>[part,state.injuries[part].severity]))};}
