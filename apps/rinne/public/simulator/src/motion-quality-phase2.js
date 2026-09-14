export const MOTION_QUALITY_PHASE2_VERSION=1;

const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const smooth01=value=>{const x=clamp(value,0,1);return x*x*(3-2*x);};
const finite=(...values)=>values.every(Number.isFinite);
const freeze=o=>Object.freeze(o);

const ATTACK_PRESETS=freeze({
  slash: freeze({standoff:1.05,maxCorrection:.55,maxAcquireDistance:2.60,maxAcquireAngle:Math.PI*.75,turnEnd:.14,warpStart:.18,contact:.50}),
  back: freeze({standoff:1.00,maxCorrection:.38,maxAcquireDistance:2.45,maxAcquireAngle:Math.PI*.72,turnEnd:.14,warpStart:.19,contact:.50}),
  thrust: freeze({standoff:1.20,maxCorrection:.46,maxAcquireDistance:2.90,maxAcquireAngle:Math.PI*.62,turnEnd:.12,warpStart:.16,contact:.47}),
  heavy: freeze({standoff:1.08,maxCorrection:.30,maxAcquireDistance:2.55,maxAcquireAngle:Math.PI*.64,turnEnd:.16,warpStart:.22,contact:.52}),
  dash: freeze({standoff:1.12,maxCorrection:.16,maxAcquireDistance:3.40,maxAcquireAngle:Math.PI*.52,turnEnd:.11,warpStart:.18,contact:.50}),
  spin: freeze({standoff:1.05,maxCorrection:.12,maxAcquireDistance:2.25,maxAcquireAngle:Math.PI,turnEnd:.18,warpStart:.24,contact:.50}),
  leap: freeze({standoff:1.14,maxCorrection:.18,maxAcquireDistance:3.25,maxAcquireAngle:Math.PI*.55,turnEnd:.12,warpStart:.20,contact:.52}),
  retreat: freeze({standoff:1.30,maxCorrection:0,maxAcquireDistance:2.30,maxAcquireAngle:Math.PI,turnEnd:.16,warpStart:.24,contact:.52})
});

function fallbackPreset(kind){
  if(/thrust|pierce|straight|sky/i.test(kind))return ATTACK_PRESETS.thrust;
  if(/heavy|meteor|smash/i.test(kind))return ATTACK_PRESETS.heavy;
  if(/spin|round|wheel|sweep/i.test(kind))return ATTACK_PRESETS.spin;
  if(/dash|rush|blink/i.test(kind))return ATTACK_PRESETS.dash;
  if(/leap|jump/i.test(kind))return ATTACK_PRESETS.leap;
  if(/back|return/i.test(kind))return ATTACK_PRESETS.back;
  return ATTACK_PRESETS.slash;
}

export function attackMotionProfile(kind,{contact,duration,lunge}={}){
  if(typeof kind!=='string'||!kind)throw Error('Invalid motion-quality attack kind');
  const preset=ATTACK_PRESETS[kind]??fallbackPreset(kind);
  const resolvedContact=Number.isFinite(contact)?contact:preset.contact;
  if(!finite(resolvedContact)||resolvedContact<=preset.warpStart||resolvedContact>1)throw Error('Invalid motion-quality contact');
  if(duration!=null&&(!Number.isFinite(duration)||duration<=0))throw Error('Invalid motion-quality duration');
  if(lunge!=null&&(!Number.isFinite(lunge)||lunge<0))throw Error('Invalid motion-quality lunge');
  return freeze({
    version:MOTION_QUALITY_PHASE2_VERSION,
    kind,
    standoff:preset.standoff,
    maxCorrection:preset.maxCorrection,
    maxAcquireDistance:preset.maxAcquireDistance,
    maxAcquireAngle:preset.maxAcquireAngle,
    turnEnd:preset.turnEnd,
    warpStart:preset.warpStart,
    warpEnd:resolvedContact,
    contact:resolvedContact,
    duration:duration??null,
    gameplayLunge:lunge??null,
    rootMotion:freeze({
      horizontalOwner:'controller',
      authoredHorizontalTravel:0,
      visualRootPolicy:'local-pose-only',
      gameplayMovement:'existing-controller-footwork',
      correctionPolicy:'bounded-motion-warp'
    })
  });
}

export function distanceMatchedPhase({phase=0,from,to,cycleDistance,direction=1}={}){
  if(!from||!to||!finite(phase,from.x,from.z,to.x,to.z,cycleDistance,direction)||cycleDistance<=0||Math.abs(direction)<1e-9)throw Error('Invalid distance-match sample');
  const distance=Math.hypot(to.x-from.x,to.z-from.z);
  return freeze({phase:phase+distance/cycleDistance*Math.sign(direction),distance,cycleDistance,direction:Math.sign(direction)});
}

export function strideScaleFor({distance,dt,cycleDistance,clipDuration,min=.82,max=1.16}={}){
  if(!finite(distance,dt,cycleDistance,clipDuration,min,max)||distance<0||dt<=0||cycleDistance<=0||clipDuration<=0||min<=0||max<min)throw Error('Invalid stride-match sample');
  const actualSpeed=distance/dt,authoredSpeed=cycleDistance/clipDuration;
  const raw=authoredSpeed>1e-9?actualSpeed/authoredSpeed:1;
  return freeze({scale:clamp(raw,min,max),raw,actualSpeed,authoredSpeed,min,max});
}

export function angleDelta(from,to){
  if(!finite(from,to))throw Error('Invalid orientation angles');
  let delta=(to-from)%(Math.PI*2);
  if(delta>Math.PI)delta-=Math.PI*2;
  if(delta<-Math.PI)delta+=Math.PI*2;
  return delta;
}

export function orientationWarpDistribution(delta,progress,{maxAngle=Math.PI*.72}={}){
  if(!finite(delta,progress,maxAngle)||maxAngle<=0)throw Error('Invalid orientation warp');
  const bounded=clamp(delta,-maxAngle,maxAngle),turn=smooth01(progress),applied=bounded*turn,lag=applied*(1-turn);
  return freeze({
    boundedDelta:bounded,
    progress:clamp(progress,0,1),
    applied,
    hips:-lag*.18,
    spine:-lag*.12,
    chest:-lag*.06,
    leftFoot:-lag*.72,
    rightFoot:-lag*.72,
    leg:-lag*.34
  });
}

export function transitionInertialWeight(elapsed,duration=.12){
  if(!finite(elapsed,duration)||duration<=0)throw Error('Invalid transition inertial timing');
  const p=clamp(elapsed/duration,0,1),s=smooth01(p);
  return freeze({progress:p,weight:(1-s)*(1-s),done:p>=1});
}

export function selectSpatialAttackVariant({requestedKind,candidates,distance,angle=0}={}){
  if(typeof requestedKind!=='string'||!requestedKind||!Array.isArray(candidates)||!finite(distance,angle)||distance<0)throw Error('Invalid spatial attack selection');
  const normalized=candidates.map((candidate,index)=>{
    if(!candidate||typeof candidate.kind!=='string'||!candidate.kind)return null;
    const min=Number.isFinite(candidate.minDistance)?candidate.minDistance:0;
    const max=Number.isFinite(candidate.maxDistance)?candidate.maxDistance:Infinity;
    const maxAngle=Number.isFinite(candidate.maxAngle)?candidate.maxAngle:Math.PI;
    const priority=Number.isFinite(candidate.priority)?candidate.priority:0;
    if(min<0||max<min||maxAngle<0||maxAngle>Math.PI)return null;
    if(distance<min||distance>max||Math.abs(angle)>maxAngle)return null;
    const center=Number.isFinite(max)?(min+max)/2:Math.max(min,distance);
    return{kind:candidate.kind,index,priority,error:Math.abs(distance-center)};
  }).filter(Boolean).sort((a,b)=>b.priority-a.priority||a.error-b.error||a.kind.localeCompare(b.kind)||a.index-b.index);
  const selected=normalized[0]?.kind??requestedKind;
  return freeze({requestedKind,selected,changed:selected!==requestedKind,eligible:freeze(normalized.map(x=>x.kind))});
}

function pointSafe(point,{bounds,colliders=[],blockers=[],radius=0,canEnter}={}){
  if(!point||!finite(point.x,point.z,radius)||radius<0)return false;
  if(bounds){
    const bx=Number.isFinite(bounds.x)?bounds.x:Infinity,bz=Number.isFinite(bounds.z)?bounds.z:Infinity;
    if(Math.abs(point.x)>bx-radius||Math.abs(point.z)>bz-radius)return false;
  }
  if(typeof canEnter==='function'&&!canEnter(point.x,point.z,radius))return false;
  for(const obstacle of [...colliders,...blockers]){
    if(!obstacle||!finite(obstacle.x,obstacle.z))continue;
    const obstacleRadius=Number.isFinite(obstacle.r)?Math.max(0,obstacle.r):0;
    if(Math.hypot(point.x-obstacle.x,point.z-obstacle.z)<radius+obstacleRadius)return false;
  }
  return true;
}

export function sweepWarpEndpoint({from,to,radius=0,bounds=null,colliders=[],blockers=[],canEnter=null,maxStep=.08}={}){
  if(!from||!to||!finite(from.x,from.z,to.x,to.z,radius,maxStep)||radius<0||maxStep<=0)throw Error('Invalid warp sweep');
  const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz);
  if(distance<1e-9)return freeze({x:from.x,z:from.z,requestedDistance:0,actualDistance:0,clipped:false,fraction:1});
  const steps=Math.max(1,Math.ceil(distance/maxStep));
  let last={x:from.x,z:from.z},safeSteps=0;
  for(let step=1;step<=steps;step++){
    const t=step/steps,point={x:from.x+dx*t,z:from.z+dz*t};
    if(!pointSafe(point,{bounds,colliders,blockers,radius,canEnter}))break;
    last=point;safeSteps=step;
  }
  const actualDistance=Math.hypot(last.x-from.x,last.z-from.z),fraction=distance>0?actualDistance/distance:1;
  return freeze({x:last.x,z:last.z,requestedDistance:distance,actualDistance,clipped:safeSteps<steps,fraction});
}

export function createImpactBeat({id,clock,sourceId,targetId,attackId,kind,guarded=false,heavy=false,hitstop=0,impactSlow=0,impactSlowScale=1,cameraImpulse=0,reactionSerial=0,point=null}={}){
  if((id!=null&&typeof id!=='string')||typeof kind!=='string'||!kind||!finite(clock,hitstop,impactSlow,impactSlowScale,cameraImpulse,reactionSerial)||clock<0||hitstop<0||impactSlow<0||impactSlowScale<=0||cameraImpulse<0||reactionSerial<0)throw Error('Invalid impact beat');
  const normalizedPoint=Array.isArray(point)&&point.length>=3&&point.slice(0,3).every(Number.isFinite)?freeze(point.slice(0,3)):null;
  return freeze({
    version:MOTION_QUALITY_PHASE2_VERSION,
    id:id??`${String(attackId??'attack')}:${String(targetId??'target')}:${reactionSerial}`,
    clock,
    sourceId:sourceId??null,
    targetId:targetId??null,
    attackId:attackId??null,
    kind,
    guarded:!!guarded,
    heavy:!!heavy,
    point:normalizedPoint,
    channels:freeze(['hit-stop','impact-slow','camera','vfx','sfx','reaction']),
    hitstop,
    impactSlow,
    impactSlowScale,
    cameraImpulse,
    reactionSerial,
    damageAuthority:'gameplay-unchanged'
  });
}

export function motionQualitySnapshot({distanceMatch=null,stride=null,orientation=null,inertial=null,attack=null,impact=null}={}){
  return freeze({version:MOTION_QUALITY_PHASE2_VERSION,distanceMatch,stride,orientation,inertial,attack,impact,visualApproval:'required'});
}
