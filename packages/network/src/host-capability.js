export const HOST_CAPABILITY_VERSION = 1;
const clamp=(n,min,max)=>Math.min(max,Math.max(min,n));
const finite=(value,fallback=null)=>Number.isFinite(Number(value))?Number(value):fallback;

export function normalizeHostCapability(input={}){
  const foreground=input.foreground!==false;
  const charging=input.charging===true;
  const batteryLevel=finite(input.batteryLevel,null);
  const hardwareConcurrency=clamp(finite(input.hardwareConcurrency,2),1,64);
  const deviceMemory=clamp(finite(input.deviceMemory,2),.5,64);
  const rttMs=finite(input.rttMs,null);
  const downlinkMbps=finite(input.downlinkMbps,null);
  const frameP95Ms=finite(input.frameP95Ms,null);
  const gpuP95Ms=finite(input.gpuP95Ms,null);
  const saveData=input.saveData===true;
  let score=50;
  const reasons=[];
  if(foreground){score+=16;reasons.push('foreground');}else{score-=60;reasons.push('background');}
  score+=Math.min(14,Math.max(0,(hardwareConcurrency-2)*2));
  score+=Math.min(10,Math.max(0,(deviceMemory-2)*2));
  if(charging)score+=5;
  if(batteryLevel!==null&&!charging){if(batteryLevel<.12){score-=34;reasons.push('critical-battery');}else if(batteryLevel<.25)score-=14;}
  if(rttMs!==null){if(rttMs<=80)score+=10;else if(rttMs<=160)score+=5;else if(rttMs>700)score-=28;else if(rttMs>300)score-=14;}
  if(downlinkMbps!==null){if(downlinkMbps>=10)score+=8;else if(downlinkMbps>=3)score+=4;else if(downlinkMbps<1)score-=12;}
  if(saveData)score-=8;
  if(frameP95Ms!==null){if(frameP95Ms<=20)score+=10;else if(frameP95Ms<=34)score+=5;else if(frameP95Ms>80)score-=28;else if(frameP95Ms>50)score-=14;}
  if(gpuP95Ms!==null){if(gpuP95Ms<=20)score+=5;else if(gpuP95Ms>70)score-=12;}
  const stable=foreground&&!(batteryLevel!==null&&!charging&&batteryLevel<.08)&&(rttMs===null||rttMs<=1200)&&(frameP95Ms===null||frameP95Ms<=120);
  if(!stable)reasons.push('unstable');
  return Object.freeze({version:HOST_CAPABILITY_VERSION,score:Math.round(clamp(score,0,100)),stable,foreground,charging,batteryLevel:batteryLevel===null?null:clamp(batteryLevel,0,1),hardwareConcurrency,deviceMemory,rttMs:rttMs===null?null:clamp(rttMs,0,5000),downlinkMbps:downlinkMbps===null?null:clamp(downlinkMbps,0,1000),frameP95Ms:frameP95Ms===null?null:clamp(frameP95Ms,0,1000),gpuP95Ms:gpuP95Ms===null?null:clamp(gpuP95Ms,0,1000),saveData,reasons});
}

function memberCapability(member){
  const value=member?.meta?.hostCapability;
  if(!value)return normalizeHostCapability({});
  try{return normalizeHostCapability(value);}catch{return normalizeHostCapability({});}
}

export function rankHostCandidates(members,{currentHostId=null,mayorId=null}={}){
  const candidates=Object.entries(members||{}).filter(([id,m])=>id!==currentHostId&&m?.connected&&m?.eligible).map(([id,member])=>{
    const capability=memberCapability(member);
    const mayorBonus=id===mayorId?10:0;
    return{id,member,capability,total:capability.score+mayorBonus,mayorBonus};
  });
  const stable=candidates.filter(row=>row.capability.stable);
  const pool=stable.length?stable:candidates;
  return pool.sort((a,b)=>b.total-a.total||(a.member.joinOrder??Number.MAX_SAFE_INTEGER)-(b.member.joinOrder??Number.MAX_SAFE_INTEGER)||a.id.localeCompare(b.id));
}

export function selectHostCandidate(members,options={}){
  return rankHostCandidates(members,options)[0]?.id??null;
}
