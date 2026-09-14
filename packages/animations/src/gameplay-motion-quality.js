const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const finite=(...v)=>v.every(Number.isFinite);

export const MOTION_WARP_PROFILES=Object.freeze({
 slash:Object.freeze({standoff:1.05,maxDistance:.55,turnEnd:.14,warpStart:.18,contact:.50}),
 thrust:Object.freeze({standoff:1.12,maxDistance:.72,turnEnd:.12,warpStart:.15,contact:.52}),
 heavy:Object.freeze({standoff:1.18,maxDistance:.32,turnEnd:.18,warpStart:.24,contact:.55})
});

export const WEAPON_INERTIA_PROFILES=Object.freeze({
 fist:Object.freeze({lag:.000,maxAngle:0,stiffness:40,damping:13}),
 sword:Object.freeze({lag:.020,maxAngle:.055,stiffness:34,damping:10}),
 katana:Object.freeze({lag:.018,maxAngle:.050,stiffness:36,damping:10.5}),
 great:Object.freeze({lag:.035,maxAngle:.090,stiffness:22,damping:7.5}),
 axe:Object.freeze({lag:.033,maxAngle:.085,stiffness:23,damping:7.8}),
 spear:Object.freeze({lag:.030,maxAngle:.070,stiffness:25,damping:8.2})
});

export function distanceStrideMatch({speed,cycleDistance,clipDuration=1}={}){
 if(!finite(speed,cycleDistance,clipDuration)||cycleDistance<=0||clipDuration<=0)return{playback:1,strideScale:1};
 const ratio=Math.abs(speed)/(cycleDistance/clipDuration);
 return{playback:clamp(ratio,.72,1.28),strideScale:clamp(ratio,.78,1.22)};
}

export function orientationWarp({fromYaw,toYaw,phase,turnEnd=.14}={}){
 if(!finite(fromYaw,toYaw,phase,turnEnd)||turnEnd<=0)throw Error('Invalid orientation warp');
 let delta=(toYaw-fromYaw)%(Math.PI*2);if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
 return fromYaw+delta*smooth(phase/turnEnd);
}

export function collisionClampTravel(wanted,clearance){
 if(!finite(wanted,clearance)||wanted<0)return 0;
 return clamp(clearance,0,wanted);
}

export function selectAttackForRange({distance,angle=0,available=['slash']}={}){
 if(!finite(distance,angle)||!Array.isArray(available)||!available.length)return null;
 const has=x=>available.includes(x);
 if(distance>1.45&&Math.abs(angle)<.55&&has('thrust'))return'thrust';
 if(distance<.82&&has('slash'))return'slash';
 if(distance>1.18&&has('heavy'))return'heavy';
 return has('slash')?'slash':available[0];
}

export function inertializeScalar(previous,current,dt,halfLife=.085){
 if(!finite(previous,current,dt,halfLife)||dt<=0||halfLife<=0)return current;
 return current+(previous-current)*Math.pow(.5,dt/halfLife);
}

export function createImpactBeat({actorId,targetId,kind='slash',clock,serial,direction=null,strength=1,region='torso'}={}){
 if(!finite(clock,serial,strength)||serial<0||strength<0)throw Error('Invalid impact beat');
 const dir=direction&&finite(direction.x,direction.z)?Object.freeze({x:direction.x,z:direction.z}):null;
 return Object.freeze({version:2,id:`${actorId??'actor'}:${targetId??'target'}:${kind}:${serial}`,actorId:actorId??null,targetId:targetId??null,kind,clock,strength,region,direction:dir,channels:Object.freeze(['hit-stop','camera-impulse','hit-reaction','vfx','sfx'])});
}

export function directionalHitReaction({incomingX=0,incomingZ=-1,targetYaw=0,strength=1,region='torso'}={}){
 if(!finite(incomingX,incomingZ,targetYaw,strength)||strength<0)throw Error('Invalid directional hit reaction');
 let len=Math.hypot(incomingX,incomingZ);if(len<1e-6){incomingX=0;incomingZ=-1;len=1;}
 const dx=incomingX/len,dz=incomingZ/len,forwardX=Math.sin(targetYaw),forwardZ=Math.cos(targetYaw),rightX=Math.cos(targetYaw),rightZ=-Math.sin(targetYaw);
 const localRight=dx*rightX+dz*rightZ,localForward=dx*forwardX+dz*forwardZ,s=clamp(strength,0,2),low=region==='leg'||region==='lower';
 return Object.freeze({
  localRight,localForward,strength:s,region,
  pelvisYaw:clamp(-localRight*.20*s,-.34,.34),pelvisRoll:clamp(localRight*.08*s,-.15,.15),
  spinePitch:clamp(-localForward*(low?.08:.16)*s,-.26,.26),spineRoll:clamp(localRight*(low?.10:.22)*s,-.34,.34),
  chestYaw:clamp(-localRight*.24*s,-.40,.40),headCounterYaw:clamp(localRight*.10*s,-.18,.18),
  supportShiftX:clamp(localRight*(low?.10:.055)*s,-.14,.14),supportShiftZ:clamp(localForward*(low?.045:.025)*s,-.08,.08),
  duration:clamp(.16+.10*s+(low?.05:0),.14,.42)
 });
}

export function weaponInertiaStep({offset=0,velocity=0,targetAngularVelocity=0,dt,weapon='sword'}={}){
 if(!finite(offset,velocity,targetAngularVelocity,dt)||dt<=0)throw Error('Invalid weapon inertia step');
 const p=WEAPON_INERTIA_PROFILES[weapon]||WEAPON_INERTIA_PROFILES.sword,desired=clamp(-targetAngularVelocity*p.lag,-p.maxAngle,p.maxAngle);
 const accel=(desired-offset)*p.stiffness-velocity*p.damping,nextVelocity=velocity+accel*dt,nextOffset=clamp(offset+nextVelocity*dt,-p.maxAngle,p.maxAngle);
 return Object.freeze({offset:nextOffset,velocity:nextVelocity,desired,maxAngle:p.maxAngle});
}

const xyz=p=>Array.isArray(p)?{x:p[0],y:p[1],z:p[2]}:p;
export function estimateCenterOfMass(points={}){
 const weights={hips:.34,chest:.25,head:.08,leftHand:.05,rightHand:.05,leftFoot:.115,rightFoot:.115};let total=0,x=0,y=0,z=0;
 for(const [name,w]of Object.entries(weights)){const p=xyz(points[name]);if(!p||!finite(p.x,p.y,p.z))continue;total+=w;x+=p.x*w;y+=p.y*w;z+=p.z*w;}
 if(total<.5)throw Error('Insufficient COM points');
 return Object.freeze({x:x/total,y:y/total,z:z/total,weight:total});
}

export function supportBalance({com,supports=[],footRadius=.09}={}){
 const c=xyz(com);if(!c||!finite(c.x,c.z,footRadius)||footRadius<=0||!Array.isArray(supports)||!supports.length)throw Error('Invalid support balance');
 const pts=supports.map(xyz).filter(p=>p&&finite(p.x,p.z));if(!pts.length)throw Error('Invalid support balance');
 let qx=pts[0].x,qz=pts[0].z;
 if(pts.length>1){const a=pts[0],b=pts[1],vx=b.x-a.x,vz=b.z-a.z,d=vx*vx+vz*vz,t=d>1e-9?clamp(((c.x-a.x)*vx+(c.z-a.z)*vz)/d):0;qx=a.x+vx*t;qz=a.z+vz*t;}
 const distance=Math.hypot(c.x-qx,c.z-qz),margin=footRadius-distance;
 return Object.freeze({inside:margin>=0,margin,distance,nearest:Object.freeze({x:qx,z:qz}),supportCount:pts.length});
}

export function terrainFootAdjustments({left,right,maxFootLift=.22,maxPelvisShift=.16}={}){
 if(!left||!right||!finite(left.currentY,left.groundY,right.currentY,right.groundY,maxFootLift,maxPelvisShift)||maxFootLift<0||maxPelvisShift<0)throw Error('Invalid terrain foot samples');
 const l=clamp(left.groundY-left.currentY,-maxFootLift,maxFootLift),r=clamp(right.groundY-right.currentY,-maxFootLift,maxFootLift),pelvis=clamp((l+r)/2,-maxPelvisShift,maxPelvisShift);
 const norm=n=>{const x=n?.x??0,y=n?.y??1,z=n?.z??0,m=Math.hypot(x,y,z)||1;return Object.freeze({x:x/m,y:y/m,z:z/m});};
 return Object.freeze({left:Object.freeze({y:l-pelvis,normal:norm(left.normal)}),right:Object.freeze({y:r-pelvis,normal:norm(right.normal)}),pelvisY:pelvis});
}

export function rootTravelMetadata({kind='slash',forward,standoff,authoritative=false}={}){
 if(!finite(forward,standoff)||forward<0||standoff<0)throw Error('Invalid root travel metadata');
 return Object.freeze({version:1,kind,forward,standoff,units:'world-metres',authoritative:Boolean(authoritative),owner:authoritative?'gameplay':'animation-intent'});
}
