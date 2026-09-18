const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const xyz=p=>Array.isArray(p)?{x:p[0],y:p[1],z:p[2]}:p;
const freeze=o=>Object.freeze(o);
const angleDelta=(from,to)=>{let d=(to-from)%(Math.PI*2);if(d>Math.PI)d-=Math.PI*2;if(d<-Math.PI)d+=Math.PI*2;return d;};
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const hash=value=>{let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;};
const phase=(seed,salt)=>((hash(`${seed}:${salt}`)%100003)/100003)*Math.PI*2;

export const MOTION_RUNTIME_VERSION=1;
export const MOTION_SYNC_CONTRACT=freeze({
 version:1,
 authoritative:freeze(['actorId','sequence','clock','state','phase','lockedTargetId','impactSerial','position','yaw','condition']),
 reconstructLocally:freeze(['micro','secondary','fingerGrip','gaze','poseCorrective','terrainPresentation','silhouetteQA'])
});

export const MOTION_PERSONALITIES=freeze({
 neutral:freeze({tempo:1,stride:1,anticipation:1,recovery:1,gaze:1,secondary:1,posture:0,grip:1,turnSharpness:1}),
 calm:freeze({tempo:.94,stride:.96,anticipation:.92,recovery:.88,gaze:.78,secondary:.82,posture:.02,grip:.92,turnSharpness:.84}),
 aggressive:freeze({tempo:1.10,stride:1.08,anticipation:1.18,recovery:1.10,gaze:1.18,secondary:1.14,posture:-.03,grip:1.12,turnSharpness:1.16}),
 timid:freeze({tempo:.92,stride:.86,anticipation:1.12,recovery:1.16,gaze:.64,secondary:1.10,posture:.08,grip:.94,turnSharpness:.76}),
 proud:freeze({tempo:.98,stride:1.02,anticipation:1.04,recovery:.92,gaze:1.08,secondary:.90,posture:-.06,grip:1.02,turnSharpness:.92}),
 elderly:freeze({tempo:.78,stride:.72,anticipation:1.16,recovery:1.32,gaze:.82,secondary:.72,posture:.16,grip:.86,turnSharpness:.62}),
 child:freeze({tempo:1.13,stride:.78,anticipation:.88,recovery:.82,gaze:1.22,secondary:1.18,posture:-.01,grip:.88,turnSharpness:1.20}),
 heavy:freeze({tempo:.82,stride:.88,anticipation:1.28,recovery:1.38,gaze:.92,secondary:.74,posture:.04,grip:1.16,turnSharpness:.68}),
 nimble:freeze({tempo:1.18,stride:1.04,anticipation:.84,recovery:.78,gaze:1.12,secondary:1.20,posture:-.02,grip:.96,turnSharpness:1.28})
});

export function resolveMotionPersonality(name='neutral',overrides={}){
 const base=MOTION_PERSONALITIES[name]||MOTION_PERSONALITIES.neutral,out={name:Object.hasOwn(MOTION_PERSONALITIES,name)?name:'neutral'};
 const ranges={tempo:[.65,1.35],stride:[.65,1.30],anticipation:[.65,1.40],recovery:[.65,1.50],gaze:[.4,1.35],secondary:[.4,1.40],posture:[-.2,.25],grip:[.65,1.30],turnSharpness:[.5,1.4]};
 for(const [key,[lo,hi]] of Object.entries(ranges)){const value=Number.isFinite(overrides[key])?overrides[key]:base[key];out[key]=clamp(value,lo,hi);}
 return freeze(out);
}

export function locomotionTransition({speed=0,previousSpeed=0,yaw=0,previousYaw=0,dt=1/60,plantedSide='left'}={}){
 if(!finite(speed,previousSpeed,yaw,previousYaw,dt)||dt<=0)throw Error('Invalid locomotion transition');
 const s=Math.max(0,speed),ps=Math.max(0,previousSpeed),delta=angleDelta(previousYaw,yaw),turnRate=delta/dt,accel=(s-ps)/dt,move=.14;
 let state='move';
 if(s<move&&ps<move&&Math.abs(delta)>.36)state='turn-in-place';
 else if(s>=move&&ps<move)state='start';
 else if(s<move&&ps>=move)state='stop';
 else if(s>=move&&Math.abs(delta)>.42)state='pivot';
 else if(s<move)state='idle';
 const transitionWeight=state==='start'?clamp((s-move)/1.4):state==='stop'?clamp((ps-s)/1.4):['pivot','turn-in-place'].includes(state)?clamp(Math.abs(delta)/1.2):0;
 const support=plantedSide==='right'?'right':'left';
 return freeze({state,speed:s,acceleration:accel,turnDelta:delta,turnRate,supportSide:support,transitionWeight,
  pelvisLean:clamp(accel*.012,-.16,.12),turnLean:clamp(delta*.28,-.22,.22),strideScale:state==='start'?.86:state==='stop'?.76:state==='pivot'?.82:1,
  pivotSign:Math.sign(delta)||0,phasePreserve:true});
}

export function solveTwoBodyInteraction({actorA,actorB,anchorA,anchorB,massA=1,massB=1,maxTranslation=.22,maxYaw=.35}={}){
 const a=xyz(actorA),b=xyz(actorB),aa=xyz(anchorA),bb=xyz(anchorB);
 if(!a||!b||!aa||!bb||!finite(a.x,a.y??0,a.z,b.x,b.y??0,b.z,aa.x,aa.y,aa.z,bb.x,bb.y,bb.z,massA,massB,maxTranslation,maxYaw)||massA<=0||massB<=0||maxTranslation<0||maxYaw<0)throw Error('Invalid two-body interaction');
 let ex=bb.x-aa.x,ey=bb.y-aa.y,ez=bb.z-aa.z,mag=Math.hypot(ex,ey,ez),scale=mag>maxTranslation&&mag>1e-9?maxTranslation/mag:1;ex*=scale;ey*=scale;ez*=scale;
 const total=massA+massB,shareA=massB/total,shareB=massA/total,yawA=Number.isFinite(actorA.yaw)?actorA.yaw:0,yawB=Number.isFinite(actorB.yaw)?actorB.yaw:0,targetA=Math.atan2(b.x-a.x,b.z-a.z),targetB=targetA+Math.PI;
 return freeze({version:1,error:freeze({x:bb.x-aa.x,y:bb.y-aa.y,z:bb.z-aa.z,distance:mag}),
  a:freeze({offset:freeze({x:ex*shareA,y:ey*shareA,z:ez*shareA}),yaw:clamp(angleDelta(yawA,targetA),-maxYaw,maxYaw)}),
  b:freeze({offset:freeze({x:-ex*shareB,y:-ey*shareB,z:-ez*shareB}),yaw:clamp(angleDelta(yawB,targetB),-maxYaw,maxYaw)}),
  bounded:mag<=maxTranslation+1e-9});
}

export function conditionMotionProfile({fatigue=0,injuries={}}={}){
 if(!Number.isFinite(fatigue))throw Error('Invalid fatigue');const f=clamp(fatigue),inj={};for(const key of ['leftLeg','rightLeg','leftArm','rightArm','torso'])inj[key]=clamp(Number.isFinite(injuries[key])?injuries[key]:0);
 const leg=Math.max(inj.leftLeg,inj.rightLeg),arm=Math.max(inj.leftArm,inj.rightArm),imbalance=inj.leftLeg-inj.rightLeg;
 return freeze({fatigue:f,injuries:freeze(inj),speedScale:clamp(1-.34*f-.28*leg,.45,1),strideLeft:clamp(1-.32*f-.42*inj.leftLeg,.45,1),strideRight:clamp(1-.32*f-.42*inj.rightLeg,.45,1),
  weaponSag:clamp(.04*f+.11*arm,0,.18),shoulderDropLeft:clamp(.025*f+.09*inj.leftArm,0,.14),shoulderDropRight:clamp(.025*f+.09*inj.rightArm,0,.14),
  torsoGuard:clamp(.05*f+.12*inj.torso,0,.18),limp:clamp(Math.abs(imbalance)*.24,0,.24),limpSide:imbalance>.05?'left':imbalance<-.05?'right':null,
  breath:clamp(.28+.62*f,0,1),gazeStability:clamp(1-.28*f-.12*inj.torso,.5,1),recoveryScale:clamp(1+.34*f+.24*Math.max(leg,arm),1,1.7)});
}

export function microMotionSample({time=0,seed='actor',fatigue=0,personality='neutral'}={}){
 if(!finite(time,fatigue))throw Error('Invalid micro motion');const p=typeof personality==='string'?resolveMotionPersonality(personality):personality||resolveMotionPersonality(),f=clamp(fatigue),breathRate=.23+.16*f,breath=Math.sin(time*Math.PI*2*breathRate+phase(seed,'breath'))*(.012+.016*f),sway=Math.sin(time*.73+phase(seed,'sway'))*.009*p.secondary,headYaw=Math.sin(time*.41+phase(seed,'head'))*.018*p.gaze,headPitch=Math.sin(time*.53+phase(seed,'pitch'))*.010*p.gaze;
 const cycle=3.4+(hash(`${seed}:blink`)%180)/100,blinkT=((time+(hash(`${seed}:blink-phase`)%1000)/1000*cycle)%cycle+cycle)%cycle,blink=blinkT<.12?Math.sin(Math.PI*blinkT/.12):0;
 return freeze({breath,swayX:sway,swayZ:Math.sin(time*.59+phase(seed,'sway-z'))*.006*p.secondary,headYaw,headPitch,blink:clamp(blink),gripPulse:Math.sin(time*.88+phase(seed,'grip'))*.018*p.grip});
}

export function pairedImpactResponse({serial=0,direction={x:0,z:1},strength=1,massAttacker=1,massDefender=1,maxAttacker=.08,maxDefender=.12}={}){
 const d=xyz(direction);if(!d||!finite(serial,d.x,d.z,strength,massAttacker,massDefender,maxAttacker,maxDefender)||serial<0||strength<0||massAttacker<=0||massDefender<=0)throw Error('Invalid paired impact');let n=Math.hypot(d.x,d.z);const x=n>1e-9?d.x/n:0,z=n>1e-9?d.z/n:1,impulse=clamp(strength,0,2.5),aMag=Math.min(maxAttacker,impulse*.045/massAttacker),bMag=Math.min(maxDefender,impulse*.065/massDefender);
 return freeze({version:1,serial,impulse:freeze({x:x*impulse,z:z*impulse}),attacker:freeze({offset:freeze({x:-x*aMag,z:-z*aMag}),recoil:clamp(impulse*.22,0,.48)}),defender:freeze({offset:freeze({x:x*bMag,z:z*bMag}),recoil:clamp(impulse*.34,0,.72)}),singleDamageEvent:true});
}

export function bodyMotionAdaptation({height=1,width=1,armLength=1,legLength=1}={}){
 if(!finite(height,width,armLength,legLength)||Math.min(height,width,armLength,legLength)<=0)throw Error('Invalid body adaptation');const h=clamp(height,.7,1.35),w=clamp(width,.7,1.35),a=clamp(armLength,.7,1.35),l=clamp(legLength,.7,1.35);
 return freeze({height:h,width:w,armLength:a,legLength:l,reachScale:clamp(a/h,.72,1.28),strideScale:clamp(l/h,.72,1.28),stanceScale:clamp(w,.78,1.24),tempoScale:clamp(Math.sqrt(h/l),.82,1.18),weaponArcScale:clamp((a+w*.25)/(1.25),.76,1.28)});
}

export function createMotionSyncFrame({actorId,sequence=0,clock=0,state='idle',phase=0,lockedTargetId=null,impactSerial=0,position={x:0,z:0},yaw=0,condition=null}={}){
 const p=xyz(position);if(actorId===undefined||actorId===null||!Number.isSafeInteger(sequence)||sequence<0||!finite(clock,phase,impactSerial,p?.x,p?.z,yaw)||clock<0||impactSerial<0||typeof state!=='string'||state.length>80)throw Error('Invalid motion sync frame');
 const c=condition?conditionMotionProfile(condition):null;return freeze({version:1,actorId:String(actorId),sequence,clock,state,phase:clamp(phase),lockedTargetId:lockedTargetId==null?null:String(lockedTargetId),impactSerial,position:freeze({x:p.x,z:p.z}),yaw,condition:c});
}
export function validateMotionSyncFrame(frame){if(!frame||frame.version!==1)return false;try{createMotionSyncFrame(frame);return true;}catch{return false;}}
export function reconcileMotionSync(local,remote,{maxClockSkew=.18,maxPositionError=.35}={}){
 if(!validateMotionSyncFrame(local)||!validateMotionSyncFrame(remote)||local.actorId!==remote.actorId||!finite(maxClockSkew,maxPositionError))throw Error('Invalid motion reconciliation');const dx=remote.position.x-local.position.x,dz=remote.position.z-local.position.z,positionError=Math.hypot(dx,dz),clockError=remote.clock-local.clock,phaseError=remote.phase-local.phase,yawError=angleDelta(local.yaw,remote.yaw);
 return freeze({remoteNewer:remote.sequence>local.sequence,clockError,phaseError,yawError,positionError,targetChanged:remote.lockedTargetId!==local.lockedTargetId,impactChanged:remote.impactSerial!==local.impactSerial,reseedPresentation:Math.abs(clockError)>maxClockSkew||positionError>maxPositionError||remote.impactSerial!==local.impactSerial,authoritativePosition:remote.position,authoritativeYaw:remote.yaw});
}

export function createSharedMotionRuntime({clock=()=>0}={}){
 const history=new Map();
 return freeze({version:MOTION_RUNTIME_VERSION,
  sample(actor,{speed=0,yaw=0,plantedSide='left',personality='neutral',personalityOverrides={},fatigue=0,injuries={},body={},time=clock(),isHero=false}={}){
   if(!actor?.id&&actor?.id!==0)throw Error('Motion runtime actor id required');const key=String(actor.id),prev=history.get(key)??{speed:0,yaw,time},dt=Math.max(1/240,Math.min(.1,time-prev.time||1/60)),p=resolveMotionPersonality(personality,personalityOverrides),condition=conditionMotionProfile({fatigue,injuries}),adaptation=bodyMotionAdaptation(body),transition=locomotionTransition({speed,previousSpeed:prev.speed,yaw,previousYaw:prev.yaw,dt,plantedSide}),micro=microMotionSample({time,seed:key,fatigue,personality:p});history.set(key,{speed,yaw,time});return freeze({personality:p,condition,adaptation,transition,micro,isHero:Boolean(isHero)});
  },
  interaction:solveTwoBodyInteraction,
  pairedImpact:pairedImpactResponse,
  sync:createMotionSyncFrame,
  reconcile:reconcileMotionSync,
  reset(id){if(id===undefined)history.clear();else history.delete(String(id));}
 });
}
