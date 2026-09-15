const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const finite=(...v)=>v.every(Number.isFinite);
const xyz=p=>Array.isArray(p)?{x:p[0],y:p[1],z:p[2]}:p;
const angleDelta=(from,to)=>{let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};

export const MOTION_LIFE_VERSION=1;
export const READABILITY_CAMERA_YAWS=Object.freeze([0,Math.PI/4,Math.PI/2,Math.PI*3/4,Math.PI,-Math.PI*3/4,-Math.PI/2,-Math.PI/4]);

export function anticipationRecoveryEnvelope({phase,anticipationEnd=.24,recoveryStart=.72,intensity=1}={}){
 if(!finite(phase,anticipationEnd,recoveryStart,intensity)||anticipationEnd<=0||recoveryStart<=anticipationEnd||recoveryStart>=1||intensity<0)throw Error('Invalid anticipation/recovery envelope');
 const p=clamp(phase),ant=p<anticipationEnd?Math.sin(Math.PI*p/anticipationEnd)*intensity:0,drive=p>=anticipationEnd&&p<=recoveryStart?Math.sin(Math.PI*(p-anticipationEnd)/(recoveryStart-anticipationEnd))*intensity:0,recovery=p>recoveryStart?Math.sin(Math.PI*(p-recoveryStart)/(1-recoveryStart))*intensity:0;
 return Object.freeze({anticipation:ant,drive,recovery});
}

export function gazeAim({origin,target,bodyYaw=0,maxYaw=.48,maxPitch=.24,weight=1}={}){
 const a=xyz(origin),b=xyz(target);if(!a||!b||!finite(a.x,a.y,a.z,b.x,b.y,b.z,bodyYaw,maxYaw,maxPitch,weight)||maxYaw<0||maxPitch<0||weight<0)throw Error('Invalid gaze aim');
 const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,h=Math.hypot(dx,dz),yaw=angleDelta(bodyYaw,Math.atan2(dx,dz)),pitch=Math.atan2(dy,Math.max(1e-6,h));
 return Object.freeze({yaw:clamp(yaw*weight,-maxYaw,maxYaw),pitch:clamp(pitch*weight,-maxPitch,maxPitch),distance:Math.hypot(dx,dy,dz)});
}

export function gripStrengthProfile({phase,contact=.5,base=.32,impact=.98,recovery=.45}={}){
 if(!finite(phase,contact,base,impact,recovery)||contact<=.08||contact>=.92)throw Error('Invalid grip profile');
 const p=clamp(phase),rise=smooth((p-.08)/(contact-.08)),fall=smooth((p-contact)/(1-contact)),peak=base+(impact-base)*rise;
 return clamp(peak+(recovery-peak)*fall,0,1);
}

export function secondaryMotionStep({offset=0,velocity=0,target=0,dt,stiffness=18,damping=6,maxOffset=.14}={}){
 if(!finite(offset,velocity,target,dt,stiffness,damping,maxOffset)||dt<=0||stiffness<0||damping<0||maxOffset<0)throw Error('Invalid secondary motion step');
 const wanted=clamp(target,-maxOffset,maxOffset),accel=(wanted-offset)*stiffness-velocity*damping,nextVelocity=velocity+accel*dt,nextOffset=clamp(offset+nextVelocity*dt,-maxOffset,maxOffset);
 return Object.freeze({offset:nextOffset,velocity:nextVelocity,target:wanted});
}

export function poseSpaceCorrective({shoulderElevation=0,kneeFlex=0,hipFlex=0}={}){
 if(!finite(shoulderElevation,kneeFlex,hipFlex))throw Error('Invalid pose-space corrective');
 const shoulder=smooth((Math.abs(shoulderElevation)-.72)/.55),knee=smooth((kneeFlex-.75)/1.15),hip=smooth((hipFlex-.55)/.85);
 return Object.freeze({shoulder,knee,hip,upperChestOpen:shoulder*.055,pelvisCounter:(knee*.018+hip*.024),shoulderDrop:shoulder*.020});
}

export function comboMomentumCarry({previous=0,gap=0,phase=0,halfLife=.12,max=.35}={}){
 if(!finite(previous,gap,phase,halfLife,max)||gap<0||phase<0||halfLife<=0||max<0)throw Error('Invalid combo momentum');
 const decay=Math.pow(.5,(gap+phase*.20)/halfLife);return clamp(previous*decay,-max,max);
}

function projectRelative(body,point,yaw){const b=xyz(body),p=xyz(point);if(!b||!p||!finite(b.x,b.y,b.z,p.x,p.y,p.z,yaw))throw Error('Invalid readability point');const dx=p.x-b.x,dy=p.y-b.y,dz=p.z-b.z;return{x:dx*Math.cos(yaw)-dz*Math.sin(yaw),y:dy};}
export function motionReadabilityReport({keyframes,cameraYaws=READABILITY_CAMERA_YAWS,minScore=.40}={}){
 if(!Array.isArray(keyframes)||!keyframes.length||!Array.isArray(cameraYaws)||!cameraYaws.length||!cameraYaws.every(Number.isFinite)||!finite(minScore))throw Error('Invalid readability input');
 const views=[];let weakest=Infinity;
 for(const frame of keyframes){if(!frame?.body||!frame.weaponBase||!frame.weaponTip)throw Error('Invalid readability keyframe');for(const yaw of cameraYaws){const base=projectRelative(frame.body,frame.weaponBase,yaw),tip=projectRelative(frame.body,frame.weaponTip,yaw),tipSeparation=Math.hypot(tip.x,tip.y),bladeLength=Math.hypot(tip.x-base.x,tip.y-base.y),score=clamp((tipSeparation*.65+bladeLength*.35)/.35);weakest=Math.min(weakest,score);views.push(Object.freeze({id:frame.id??'frame',yaw,tipSeparation,bladeLength,score,readable:score>=minScore}));}}
 return Object.freeze({version:1,weakestScore:weakest,readable:views.every(v=>v.readable),views:Object.freeze(views)});
}

export function perceptualTrajectoryDiagnostics(samples,{jerkThreshold=180,minSpeed=.05}={}){
 if(!Array.isArray(samples)||samples.length<4||!finite(jerkThreshold,minSpeed)||jerkThreshold<0||minSpeed<0)throw Error('Invalid trajectory samples');
 const pts=samples.map(s=>({t:s.t,...xyz(s)}));if(!pts.every(p=>finite(p.t,p.x,p.y,p.z)))throw Error('Invalid trajectory samples');
 const velocity=[];for(let i=1;i<pts.length;i++){const dt=pts[i].t-pts[i-1].t;if(!(dt>0))throw Error('Non-monotonic trajectory time');velocity.push({t:pts[i].t,x:(pts[i].x-pts[i-1].x)/dt,y:(pts[i].y-pts[i-1].y)/dt,z:(pts[i].z-pts[i-1].z)/dt});}
 const accel=[];for(let i=1;i<velocity.length;i++){const dt=velocity[i].t-velocity[i-1].t;accel.push({t:velocity[i].t,x:(velocity[i].x-velocity[i-1].x)/dt,y:(velocity[i].y-velocity[i-1].y)/dt,z:(velocity[i].z-velocity[i-1].z)/dt});}
 const jerk=[];for(let i=1;i<accel.length;i++){const dt=accel[i].t-accel[i-1].t;jerk.push({t:accel[i].t,x:(accel[i].x-accel[i-1].x)/dt,y:(accel[i].y-accel[i-1].y)/dt,z:(accel[i].z-accel[i-1].z)/dt});}
 const mag=p=>Math.hypot(p.x,p.y,p.z),maxSpeed=Math.max(...velocity.map(mag)),maxAcceleration=Math.max(...accel.map(mag)),maxJerk=Math.max(...jerk.map(mag)),jitterFrames=jerk.filter(p=>mag(p)>jerkThreshold).length;let reversals=0;
 for(let i=1;i<velocity.length;i++){const a=velocity[i-1],b=velocity[i],sa=mag(a),sb=mag(b);if(sa>minSpeed&&sb>minSpeed&&a.x*b.x+a.y*b.y+a.z*b.z<0)reversals++;}
 return Object.freeze({version:1,samples:pts.length,maxSpeed,maxAcceleration,maxJerk,jitterFrames,reversals,smooth:jitterFrames===0});
}

export function motionLodProfile({distance=0,isHero=false}={}){
 if(!finite(distance)||distance<0)throw Error('Invalid motion LOD distance');
 const level=isHero||distance<=3?'full':distance<=8?'near':distance<=18?'mid':'far';
 const table={full:{fingers:true,gaze:true,secondaryBones:12,corrective:true,terrain:true,perceptualQA:true},near:{fingers:true,gaze:true,secondaryBones:8,corrective:true,terrain:true,perceptualQA:false},mid:{fingers:false,gaze:true,secondaryBones:4,corrective:false,terrain:true,perceptualQA:false},far:{fingers:false,gaze:false,secondaryBones:0,corrective:false,terrain:false,perceptualQA:false}};
 return Object.freeze({level,...table[level]});
}

export function createMotionPerceptionEvidence({readability,trajectory,lod}={}){
 if(!readability||readability.version!==1||!trajectory||trajectory.version!==1||!lod?.level)throw Error('Invalid motion perception evidence');
 return Object.freeze({schema:'motion-perception-qa',version:1,readability,trajectory,lod,visualApprovalRequired:true});
}
