const freeze=value=>Object.freeze(value);
const finite=(...values)=>values.every(Number.isFinite);
const distance2=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const angleDelta=(from,to)=>{let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};

function validateFootSample(sample){return sample&&finite(sample.time,sample.x,sample.z)&&typeof sample.planted==='boolean';}
function footWindows(samples,side,warningMetres,failMetres){
  if(!Array.isArray(samples)||samples.some(s=>!validateFootSample(s)))throw Error('Invalid foot slide samples');
  const windows=[];let current=null;
  for(const sample of samples){
    if(sample.planted){
      if(!current)current={side,start:sample.time,end:sample.time,origin:{x:sample.x,z:sample.z},previous:{x:sample.x,z:sample.z},maxDisplacement:0,pathMetres:0,samples:0};
      const point={x:sample.x,z:sample.z};current.end=sample.time;current.samples++;current.maxDisplacement=Math.max(current.maxDisplacement,distance2(point,current.origin));current.pathMetres+=distance2(point,current.previous);current.previous=point;
    }else if(current){windows.push(current);current=null;}
  }
  if(current)windows.push(current);
  return windows.map(window=>{const status=window.maxDisplacement>failMetres?'fail-candidate':window.maxDisplacement>warningMetres?'warning':'pass';return freeze({side:window.side,start:window.start,end:window.end,duration:Math.max(0,window.end-window.start),samples:window.samples,maxDisplacement:window.maxDisplacement,pathMetres:window.pathMetres,status});});
}

export function footSlidingDiagnostics({left=[],right=[]}={}, {warningMetres=.02,failMetres=.05}={}){
  if(!finite(warningMetres,failMetres)||warningMetres<0||failMetres<=warningMetres)throw Error('Invalid foot slide thresholds');
  const windows=[...footWindows(left,'left',warningMetres,failMetres),...footWindows(right,'right',warningMetres,failMetres)].sort((a,b)=>a.start-b.start||a.side.localeCompare(b.side));
  const worst=windows.reduce((row,next)=>!row||next.maxDisplacement>row.maxDisplacement?next:row,null),failed=windows.filter(w=>w.status==='fail-candidate').length,warnings=windows.filter(w=>w.status==='warning').length;
  return freeze({schema:'motion-foot-slide-qa',version:1,warningMetres,failMetres,windows:freeze(windows),worst,failed,warnings,pass:failed===0,visualApprovalRequired:true});
}

function vector(sample,key){const value=sample?.[key];if(Array.isArray(value)&&value.length>=3&&value.slice(0,3).every(Number.isFinite))return value.slice(0,3);if(value&&finite(value.x,value.y,value.z))return[value.x,value.y,value.z];return null;}
const magnitude=v=>Math.hypot(...v);
const subtract=(a,b)=>a.map((x,i)=>x-b[i]);
const scale=(a,k)=>a.map(x=>x*k);
function derivative(values,times,angular=false){const out=[];for(let i=1;i<values.length;i++){const dt=times[i]-times[i-1];if(!Number.isFinite(dt)||dt<=0)throw Error('Motion QA samples require increasing time');const delta=angular?values[i].map((x,j)=>angleDelta(values[i-1][j],x)):subtract(values[i],values[i-1]);out.push(scale(delta,1/dt));}return out;}
function jerkForTrack(name,samples,linearWarning,angularWarning){
  if(!Array.isArray(samples)||samples.length<4||samples.some(s=>!Number.isFinite(s?.time)))throw Error(`Invalid jerk track: ${name}`);
  const times=samples.map(s=>s.time),positions=samples.map(s=>vector(s,'position')),angles=samples.map(s=>vector(s,'rotation'));
  const result={name,linear:null,angular:null,spikes:[]};
  if(positions.every(Boolean)){
    const velocity=derivative(positions,times),accel=derivative(velocity,times.slice(1)),jerk=derivative(accel,times.slice(2));const magnitudes=jerk.map(magnitude),max=Math.max(0,...magnitudes);result.linear={maxJerk:max,warning:linearWarning,spikeCount:magnitudes.filter(v=>v>linearWarning).length};magnitudes.forEach((value,index)=>{if(value>linearWarning)result.spikes.push(freeze({kind:'linear',time:times[index+3],value}));});
  }
  if(angles.every(Boolean)){
    const velocity=derivative(angles,times,true),accel=derivative(velocity,times.slice(1)),jerk=derivative(accel,times.slice(2)),magnitudes=jerk.map(magnitude),max=Math.max(0,...magnitudes);result.angular={maxJerk:max,warning:angularWarning,spikeCount:magnitudes.filter(v=>v>angularWarning).length};magnitudes.forEach((value,index)=>{if(value>angularWarning)result.spikes.push(freeze({kind:'angular',time:times[index+3],value}));});
  }
  if(!result.linear&&!result.angular)throw Error(`Track ${name} has no position or rotation series`);
  result.spikes.sort((a,b)=>b.value-a.value||a.time-b.time);return freeze({...result,spikes:freeze(result.spikes)});
}

export function motionJerkDiagnostics(tracks={}, {linearWarning=120,angularWarning=240}={}){
  if(!tracks||typeof tracks!=='object'||Array.isArray(tracks)||!finite(linearWarning,angularWarning)||linearWarning<=0||angularWarning<=0)throw Error('Invalid jerk diagnostics');
  const rows=Object.entries(tracks).map(([name,samples])=>jerkForTrack(name,samples,linearWarning,angularWarning));
  const spikes=rows.flatMap(row=>row.spikes.map(spike=>freeze({track:row.name,...spike}))).sort((a,b)=>b.value-a.value||a.track.localeCompare(b.track));
  return freeze({schema:'motion-jerk-qa',version:1,linearWarning,angularWarning,tracks:freeze(rows),spikes:freeze(spikes),pass:spikes.length===0,visualApprovalRequired:true});
}

export function createMotionKinematicsEvidence({feet,tracks},{footThresholds,jerkThresholds}={}){
  const footSliding=footSlidingDiagnostics(feet,footThresholds),jerk=motionJerkDiagnostics(tracks,jerkThresholds);
  return freeze({schema:'motion-kinematics-evidence',version:1,footSliding,jerk,diagnosticPass:footSliding.pass&&jerk.pass,visualApprovalRequired:true});
}
