import { EXPERIENCES } from './rebuild/domain.js';
import { guidanceDistance, guidanceFor } from './rebuild/guidance.js';
import { DISCOVERIES, skillUnlockProgress } from './rebuild/skill-system.js';

const ARROWS=['↑','↗','→','↘','↓','↙','←','↖'];
function directionArrow(state,target){
  if(!target)return'';const dx=Number(target.x)-Number(state?.position?.x||0),dz=Number(target.z)-Number(state?.position?.z||0);if(Math.hypot(dx,dz)<.5)return'●';
  const angle=Math.atan2(dx,-dz),index=Math.round(angle/(Math.PI/4));return ARROWS[(index+8)%8];
}
function nextExperienceMilestone(state,kind){
  if(!kind)return null;const known=new Set(state?.knownSkills||[]),rows=DISCOVERIES.filter(row=>!known.has(row.id)&&(row.needs||[]).includes(kind)).map(row=>({row,progress:skillUnlockProgress(state,row)})).sort((a,b)=>b.progress.progress-a.progress.progress||a.row.threshold-b.row.threshold);
  const score=Math.max(0,Number(state?.experiences?.[kind]?.score)||0),label=EXPERIENCES[kind]||kind,next=rows[0];
  if(!next)return{label,text:`${label} ${score.toFixed(1)}`,score,threshold:null};
  return{label,text:`${label} ${Math.min(score,next.row.threshold).toFixed(1)}/${next.row.threshold}`,score,threshold:next.row.threshold,skillId:next.row.id};
}
export function createGameplayViewModel(state,{stations=[]}={}){
  if(!state)return{guidance:null,target:null,phase:null,activity:null};
  const canResolveGuidance=state.zone!=='frontier'||Boolean(state.frontState),guidance=canResolveGuidance?guidanceFor({state,stations,front:state.frontState}):null,distance=guidance?guidanceDistance(state,guidance):null,target=guidance?.target?{...guidance.target,distance,arrow:directionArrow(state,guidance.target)}:null;
  const phase=state.combat?.sharedPhase||state.combat?.phase||null,activity=state.activity?nextExperienceMilestone(state,state.activity.kind):null;
  return{guidance,target,phase,activity,down:Boolean(state.down),ended:Boolean(state.ended),generation:Number(state.generation)||1,age:Math.floor(Number(state.ageYears)||0)};
}
