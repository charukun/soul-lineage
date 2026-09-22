import {sweptWeaponContactEvidence,personalSpaceNavigationBias,createMotionDeviceCalibration} from './motion-operationalization.js';

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const freeze=value=>Object.freeze(value);
const finite=(...values)=>values.every(Number.isFinite);
const v=p=>Array.isArray(p)?{x:Number(p[0]),y:Number(p[1]),z:Number(p[2])}:p&&typeof p==='object'?{x:Number(p.x),y:Number(p.y??0),z:Number(p.z)}:null;
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const mul=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const len=a=>Math.hypot(a.x,a.y,a.z);
const lerp=(a,b,t)=>add(a,mul(sub(b,a),t));

export const SURFACE_MOTION_PROFILES=freeze({
 unknown:freeze({audio:'footstep-neutral',vfx:'none',decal:'none',response:.5}),
 grass:freeze({audio:'footstep-grass',vfx:'grass-bend',decal:'none',response:.42}),
 dirt:freeze({audio:'footstep-dirt',vfx:'dust-small',decal:'footprint-soft',response:.48}),
 stone:freeze({audio:'footstep-stone',vfx:'dust-hard',decal:'none',response:.72}),
 wood:freeze({audio:'footstep-wood',vfx:'none',decal:'none',response:.62}),
 mud:freeze({audio:'footstep-mud',vfx:'mud-splash',decal:'footprint-deep',response:.34}),
 water:freeze({audio:'footstep-water',vfx:'water-splash',decal:'ripple',response:.28}),
 snow:freeze({audio:'footstep-snow',vfx:'snow-puff',decal:'footprint-snow',response:.30})
});

export function surfaceFootPlantPresentation({surface='unknown',foot='left',position={x:0,y:0,z:0},normal={x:0,y:1,z:0},speed=0,weight=1,event=null}={}){
 const p=v(position),n=v(normal),profile=SURFACE_MOTION_PROFILES[surface]??SURFACE_MOTION_PROFILES.unknown;
 if(!p||!n||!finite(p.x,p.y,p.z,n.x,n.y,n.z,speed,weight)||speed<0||weight<0)throw Error('Invalid surface foot plant');
 const nm=len(n)||1,intensity=clamp((.25+speed*.16)*weight,0,1.5);
 return freeze({schema:'surface-foot-plant',version:1,surface:Object.hasOwn(SURFACE_MOTION_PROFILES,surface)?surface:'unknown',foot:foot==='right'?'right':'left',position:freeze(p),normal:freeze({x:n.x/nm,y:n.y/nm,z:n.z/nm}),audioCue:profile.audio,vfxCue:profile.vfx,decalCue:profile.decal,intensity,response:profile.response,eventName:event?.name??'foot-plant',presentationOnly:true,navigationPhysicsChanged:false,gameplayAuthority:false});
}

function closestSegments(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),eps=1e-9;let s=0,t=0;
 if(a<=eps&&e<=eps)return{a:p1,b:p2};
 if(a<=eps){t=clamp(dot(d2,r)/e);}
 else{const c=dot(d1,r);if(e<=eps)s=clamp(-c/a);else{const b=dot(d1,d2),denom=a*e-b*b;s=Math.abs(denom)>eps?clamp((b*dot(d2,r)-c*e)/denom):0;t=(b*s+dot(d2,r))/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return{a:add(p1,mul(d1,s)),b:add(p2,mul(d2,t)),s,t};
}

export function sweepWeaponSegmentAgainstCapsule({previousBase,previousTip,currentBase,currentTip,capsuleStart,capsuleEnd,radius=.28,dt=1/60,weaponMass=1,hitSerial=0,samples=6,source='weapon-segment-capsule-sweep'}={}){
 const pb=v(previousBase),pt=v(previousTip),cb=v(currentBase),ct=v(currentTip),ca=v(capsuleStart),cz=v(capsuleEnd);
 if(![pb,pt,cb,ct,ca,cz].every(Boolean)||![pb,pt,cb,ct,ca,cz].every(p=>finite(p.x,p.y,p.z))||!finite(radius,dt,weaponMass,hitSerial)||radius<=0||dt<=0||weaponMass<=0||hitSerial<0||!Number.isSafeInteger(samples)||samples<2||samples>16)throw Error('Invalid weapon capsule sweep');
 let best=null;
 for(let i=0;i<=samples;i++){
  const time=i/samples,base=lerp(pb,cb,time),tip=lerp(pt,ct,time),closest=closestSegments(base,tip,ca,cz),delta=sub(closest.a,closest.b),distance=len(delta),penetration=radius-distance;
  if(penetration<=0)continue;if(!best||penetration>best.penetration)best={time,point:closest.a,capsulePoint:closest.b,delta,distance,penetration};
 }
 if(!best)return null;
 const horizontal=Math.hypot(best.delta.x,best.delta.z),normal=horizontal>1e-6?{x:best.delta.x/horizontal,z:best.delta.z/horizontal}:{x:0,z:1},relativeSpeed=len(sub(ct,pt))/dt;
 const evidence=sweptWeaponContactEvidence({point:best.point,normal,relativeSpeed,penetration:best.penetration,weaponMass,hitSerial,source});
 return freeze({...evidence,geometry:'segment-capsule',timeOfImpact:best.time,capsule:freeze({start:freeze(ca),end:freeze(cz),radius}),capsulePoint:freeze(best.capsulePoint),measuredPenetration:true});
}

export function personalSpaceDesiredVelocity({position,preferredVelocity,neighbors=[],radius=.7,maxSuggestion=.28,maxSpeed=4}={}){
 if(!finite(maxSpeed)||maxSpeed<=0)throw Error('Invalid personal space max speed');
 const base=personalSpaceNavigationBias({position,preferredVelocity,neighbors,radius,maxSuggestion}),px=Number(base.preferred.x)||0,pz=Number(base.preferred.z)||0,sx=Number(base.suggestion.x)||0,sz=Number(base.suggestion.z)||0;let x=px+sx,z=pz+sz,m=Math.hypot(x,z);if(m>maxSpeed){x*=maxSpeed/m;z*=maxSpeed/m;}
 return freeze({version:1,preferred:base.preferred,bias:base.suggestion,desiredVelocity:freeze({x,z}),maxSpeed,accepted:true,bounded:true,advisory:true,worldAuthority:false,consumerOwnsNavigation:true});
}

export function calibratedMotionLod(calibration,{budgetMs=5.5}={}){
 if(!calibration||calibration.schema!=='motion-device-calibration'||calibration.version!==1||!finite(budgetMs)||budgetMs<=0)throw Error('Invalid motion calibration');
 if(calibration.measuredHardware!==true||!Number.isFinite(calibration.totalMeanMs))return freeze({version:1,apply:false,status:'unmeasured',tier:'full',reason:'physical-device-evidence-required',designBudgetIsMeasurement:false,mayDisableGameplay:false});
 const ratio=calibration.totalMeanMs/budgetMs,tier=ratio>1.65?'far':ratio>1.3?'mid':ratio>1.02?'near':'full',rates={full:{poseSearch:1,terrainIK:1,gaze:1,fingers:1,secondary:1},near:{poseSearch:1,terrainIK:1,gaze:1,fingers:.5,secondary:.75},mid:{poseSearch:.5,terrainIK:.75,gaze:.5,fingers:0,secondary:.35},far:{poseSearch:.25,terrainIK:.5,gaze:0,fingers:0,secondary:0}}[tier];
 return freeze({version:1,apply:true,status:'measured',tier,ratio,totalMeanMs:calibration.totalMeanMs,budgetMs,cohort:calibration.cohort,deviceClass:calibration.deviceClass,updateRates:freeze(rates),presentationOnly:true,mayDisableGameplay:false,contactSamplingRate:1,networkRate:1,damageRate:1});
}

export function normalizeMotionCalibration(input){return createMotionDeviceCalibration(input);}
