export const COMBAT_ENTER_SECONDS=.18;
export const COMBAT_EXIT_SECONDS=.14;

const clamp=(value,min=0,max=1)=>Math.max(min,Math.min(max,Number(value)||0));

export function advanceCombatWeight(weight,active,dt){
 const current=clamp(weight),seconds=active?COMBAT_ENTER_SECONDS:COMBAT_EXIT_SECONDS;
 const step=clamp(dt,0,.08)/seconds;
 return active?Math.min(1,current+step):Math.max(0,current-step);
}

export function easeCombatWeight(weight){const t=clamp(weight);return t*t*(3-2*t);}
export function blendScalar(from,to,weight){const t=easeCombatWeight(weight);return(Number(from)||0)+((Number(to)||0)-(Number(from)||0))*t;}
export function blendPoint(from,to,weight){const a=Array.isArray(from)?from:[0,0,0],b=Array.isArray(to)?to:a,t=easeCombatWeight(weight);return[0,1,2].map(i=>(Number(a[i])||0)+((Number(b[i])||0)-(Number(a[i])||0))*t);}

function copyPose(pose){
 if(!pose||typeof pose!=='object')return null;
 const out={};
 for(const [key,value] of Object.entries(pose))out[key]=Array.isArray(value)?value.map(v=>typeof v==='number'?v:Number(v)||0):value;
 return out;
}

export function stepCombatPresentation(state,pose,dt){
 const active=!!pose,weight=advanceCombatWeight(state?.weight,active,dt),held=pose?copyPose(pose):state?.pose||null;
 return{weight,eased:easeCombatWeight(weight),pose:weight>0?held:null,active};
}
