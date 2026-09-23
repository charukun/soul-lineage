const clamp=(n,lo=0,hi=1)=>Math.min(hi,Math.max(lo,Number(n)||0));
const clone=value=>value==null?value:structuredClone(value);
const WEAPON_MASS=Object.freeze({fist:.58,dagger:.68,sword:1,great:1.52,spear:1.08,axe:1.38,staff:.82});
const ATTACK_FORCE=Object.freeze({jab:.72,straight:.82,slash:1,back:.92,thrust:1.02,pierce:1.08,sweep:1.16,diagonal:1.12,crosscut:1.18,round:1.22,spin:1.28,barrage:1.24,heavy:1.42,meteor:1.52,bullrush:1.45,oneinch:1.38,rushfist:1.34,uppercut:1.22,risingfist:1.26});
const GUARD_ATTACKS=new Set(['guard','parry','counter','brace','ward','slip','ready']);

function actorPose(actor){return actor?.combat?.tidebreakPose||actor?.tidebreakPose||null;}
function actorWeapon(actor){return actor?.equipment?.weapon||actor?.weapon||'sword';}
function targetForEvent(event,{state,front}){return event.type==='player-hit'||event.type==='one-motion'||event.type==='finisher'?(front?.enemies||[]).find(row=>row.id===event.targetId)||null:state;}
function sourceForEvent(event,{state,front}){return event.type==='enemy-hit'?(front?.enemies||[]).find(row=>row.id===event.sourceId)||null:state;}
function phaseForce(event){if(event.type==='one-motion'||event.type==='finisher'||event.manual===true||event.phase==='one'||event.phase==='finisher')return 1.5;if(event.phase==='kyu')return 1.3;if(event.phase==='ha')return 1.08;return 1;}
function directionForce(event){const sector=event.attackSector||event.sector;return sector==='back'?1.08:sector==='flank'||sector==='left'||sector==='right'?1.035:1;}
function impactPart(event,pose){if(event.part)return event.part;const attack=String(pose?.attack||'');if(['uppercut','risingfist','meteor'].includes(attack))return'head';if(['sweep','round','spin'].includes(attack))return event.attackSector==='flank'?'rightArm':'torso';if(['thrust','pierce','straight','oneinch'].includes(attack))return'torso';return'torso';}

export function impactEnergyForEvent(event,context={}){
  if(!event||!['player-hit','enemy-hit','one-motion','finisher'].includes(event.type)||!(Number(event.damage)>0))return 0;
  const source=sourceForEvent(event,context),target=targetForEvent(event,context),pose=actorPose(source),attack=String(pose?.attack||event.attack||'slash');
  const mass=WEAPON_MASS[actorWeapon(source)]||1,force=ATTACK_FORCE[attack]||1,phase=phaseForce(event),progress=clamp(pose?.progress),timing=.9+.1*Math.sin(progress*Math.PI),direction=directionForce(event),maxHp=Math.max(1,Number(target?.maxHp)||100),damageRatio=clamp(Number(event.damage)/maxHp,0,.7),direct=(event.guarded||event.blocked) ? .72 : 1,projectile=event.projectile ? .88 : 1;
  return clamp((.07+mass*.185+force*.175+phase*.125+Math.sqrt(damageRatio)*.27)*timing*direction,0,1)*direct*projectile;
}

export function impactProfile(energy,{reduced=false,qualityLevel=0}={}){
  energy=clamp(energy);const lowQuality=Number(qualityLevel)>=2;
  if(reduced||energy<.34)return Object.freeze({tier:'light',energy,stop:0,slow:0,scale:1,camera:energy*.018,fov:0,duck:0});
  if(energy<.58)return Object.freeze({tier:'medium',energy,stop:lowQuality ? .008 : .014,slow:lowQuality ? .05 : .075,scale:.72,camera:.026+energy*.025,fov:0,duck:.18});
  if(energy<.8)return Object.freeze({tier:'heavy',energy,stop:lowQuality ? .014 : .026,slow:lowQuality ? .085 : .14,scale:.5,camera:.045+energy*.035,fov:lowQuality ? .45 : 1.15,duck:.34});
  return Object.freeze({tier:'critical',energy,stop:lowQuality ? .018 : .04,slow:lowQuality ? .12 : .23,scale:.34,camera:.07+energy*.05,fov:lowQuality ? .8 : 2.25,duck:.52});
}

function localPoint(actor,point){
  if(!actor||!Array.isArray(point))return null;const origin=actor.position||actor,yaw=Number(actor.yaw)||0,x=Number(point[0])||0,y=Number(point[1])||0,z=Number(point[2])||0,c=Math.cos(yaw),s=Math.sin(yaw);
  return{x:(Number(origin.x)||0)+x*c+z*s,y,z:(Number(origin.z)||0)-x*s+z*c};
}
export function weaponAnchor(actor){
  const frame=actorPose(actor),hand=frame?.pose?.hand,tip=frame?.pose?.tip,a=localPoint(actor,hand),b=localPoint(actor,tip);if(!a||!b)return null;const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z,h=Math.max(.001,Math.hypot(dx,dz));return{position:{x:b.x,y:b.y,z:b.z},rotation:{x:-Math.atan2(dy,h),y:Math.atan2(dx,dz),z:0},hand:a,tip:b};
}

function attackVector(source,target,event=null){const yaw=Number(event?.impact?.yaw);if(Number.isFinite(yaw))return{x:Math.sin(yaw),z:Math.cos(yaw)};const anchor=weaponAnchor(source);if(anchor){const dx=anchor.tip.x-anchor.hand.x,dz=anchor.tip.z-anchor.hand.z,len=Math.max(.001,Math.hypot(dx,dz));return{x:dx/len,z:dz/len};}const a=source?.position||source,b=target?.position||target,dx=(Number(b?.x)||0)-(Number(a?.x)||0),dz=(Number(b?.z)||0)-(Number(a?.z)||0),len=Math.max(.001,Math.hypot(dx,dz));return{x:dx/len,z:dz/len};}

function lerpValue(a,b,t){if(Number.isFinite(a)&&Number.isFinite(b))return a+(b-a)*t;if(Array.isArray(a)&&Array.isArray(b)&&a.length===b.length)return a.map((v,i)=>lerpValue(v,b[i],t));if(a&&b&&typeof a==='object'&&typeof b==='object'){const out={...a};for(const key of Object.keys(b))out[key]=lerpValue(a[key],b[key],t);return out;}return t>.65?clone(b):clone(a??b);}
function blendFrame(previous,current,t,slow){if(!current)return null;if(!previous||!slow)return clone(current);const same=previous.attack===current.attack&&previous.skill===current.skill;if(!same&&t<.72)return clone(previous);return lerpValue(previous,current,t);}

export function createImpactDirector({mobile=false,reducedMotion=false}={}){
  let stop=0,slow=0,slowDuration=0,slowScale=1,qualityLevel=0,reduced=reducedMotion,hidden=false,camera={x:0,z:0,strength:0,fov:0},reactions=[],poseDisplay=new Map(),attackTrack=new Map(),strongest=null;
  function present(events,context={}){
    if(hidden||!Array.isArray(events))return{impacts:[],strongest:null};const impacts=[],hitTargets=new Set(events.filter(event=>event?.type==='player-hit'&&Number(event.damage)>0).map(event=>event.targetId)),downTargets=new Set(events.filter(event=>event?.type==='enemy-down').map(event=>event.targetId));
    for(const event of events){if(event?.type==='one-motion'&&hitTargets.has(event.targetId))continue;let energy=impactEnergyForEvent(event,context);if(downTargets.has(event?.targetId))energy=clamp(energy+.1);if(!(energy>0))continue;const profile=impactProfile(energy,{reduced,qualityLevel}),source=sourceForEvent(event,context),target=targetForEvent(event,context),vector=attackVector(source,target,event),targetKey=event.type==='enemy-hit'?'hero':`enemy:${event.targetId}`;
      impacts.push({event,profile,source,target,vector,targetKey,part:impactPart(event,actorPose(source))});
    }
    impacts.sort((a,b)=>b.profile.energy-a.profile.energy);strongest=impacts[0]||null;if(strongest){const p=strongest.profile,shared=strongest.event?.feel;if(!shared){stop=Math.max(stop,p.stop);slow=Math.max(slow,p.slow);slowDuration=Math.max(slowDuration,p.slow);slowScale=Math.min(slowScale,p.scale);}camera={x:strongest.vector.x,z:strongest.vector.z,strength:Math.max(camera.strength,p.camera),fov:Math.max(camera.fov,p.fov)};}
    // Camera presentation belongs only to the actor's own view. No world clock
    // or peer camera is changed by an inspiration event.
    for(const event of events)if(event?.type==='inspiration-start'&&event.sourceId===context.state?.id&&!reduced){
      const target=(context.front?.enemies||[]).find(row=>row.id===event.targetId),vector=attackVector(context.state,target,event),profile=event.firstInspirationPresentation||{};
      camera={x:vector.x,z:vector.z,strength:Math.max(camera.strength,clamp(profile.cameraStrength,0,.16)),
        fov:Math.max(camera.fov,clamp(profile.cameraFov,0,2.5))};
    }
    for(const row of impacts)reactions.push({actorKey:row.targetKey,part:row.part,vector:row.vector,energy:row.profile.energy,remaining:.12+row.profile.energy*.12,duration:.12+row.profile.energy*.12});
    reactions=reactions.sort((a,b)=>b.energy-a.energy).slice(0,8);return{impacts,strongest};
  }
  function setMode({level=0,reduced:nextReduced=reducedMotion,isHidden=false}={}){qualityLevel=Number(level)||0;reduced=Boolean(nextReduced);hidden=Boolean(isHidden);if(hidden){stop=slow=0;camera.strength=0;camera.fov=0;reactions=[];}}
  function timeScale(){if(reduced||hidden)return 1;if(stop>0)return .002;if(slow<=0)return 1;const p=slowDuration>0?1-clamp(slow/slowDuration):1,release=p*p;return slowScale+(1-slowScale)*release;}
  function anticipation(state,front){
    if(hidden||reduced||qualityLevel>=3)return[];const actors=[{key:'hero',actor:state},...(front?.enemies||[]).filter(e=>!e.dead).map(actor=>({key:`enemy:${actor.id}`,actor}))],cues=[];
    for(const {key,actor} of actors){const frame=actorPose(actor),attack=String(frame?.attack||''),progress=clamp(frame?.progress);const prior=attackTrack.get(key)||{attack:'',progress:0,fired:false};if(!attack||GUARD_ATTACKS.has(attack)){attackTrack.set(key,{attack:'',progress:0,fired:false});continue;}const restarted=attack!==prior.attack||progress+0.18<prior.progress,next={attack,progress,fired:restarted?false:prior.fired};if(!next.fired&&progress>=.42){const anchor=weaponAnchor(actor);if(anchor){next.fired=true;cues.push({key:`${key}:${attack}:${frame?.skill||''}:${frame?.slot||''}`,followKey:key,anchor,attack,progress,enemy:key!=='hero'});}}attackTrack.set(key,next);}
    return cues;
  }
  function applyPoseLag(state,front,realDt,presentationScale=null){const scale=Number.isFinite(presentationScale)?clamp(presentationScale,.001,1):timeScale(),actors=[{key:'hero',holder:state.combat,field:'tidebreakPose'},...(front?.enemies||[]).map(enemy=>({key:`enemy:${enemy.id}`,holder:enemy,field:'tidebreakPose'}))],restore=[];for(const row of actors){if(!row.holder)continue;const current=row.holder[row.field];if(!current){poseDisplay.delete(row.key);continue;}const previous=poseDisplay.get(row.key),alpha=clamp(realDt*(scale<.99?8+18*scale:45),0,1),display=blendFrame(previous,current,alpha,scale<.99);poseDisplay.set(row.key,clone(display));if(scale<.995){restore.push([row.holder,row.field,current]);row.holder[row.field]=display;}}return()=>{for(const [holder,field,value] of restore)holder[field]=value;};}
  function frame(realDt,{level=qualityLevel,reduced:nextReduced=reduced,hidden:isHidden=hidden}={}){setMode({level,reduced:nextReduced,isHidden});const renderScale=timeScale();realDt=Math.max(0,Math.min(.08,Number(realDt)||0));if(stop>0)stop=Math.max(0,stop-realDt);else if(slow>0)slow=Math.max(0,slow-realDt);if(slow<=0){slowScale=1;slowDuration=0;}camera.strength*=Math.exp(-realDt*16);camera.fov*=Math.exp(-realDt*13);for(const row of reactions)row.remaining=Math.max(0,row.remaining-realDt);reactions=reactions.filter(row=>row.remaining>0);return{...snapshot(),timeScale:renderScale};}
  function snapshot(){return{timeScale:timeScale(),camera:{...camera},reactions:reactions.map(row=>({...row})),strongest:strongest?{profile:strongest.profile,targetKey:strongest.targetKey,part:strongest.part,vector:{...strongest.vector}}:null,qualityLevel,reduced,hidden};}
  function clear(){stop=slow=slowDuration=0;slowScale=1;camera={x:0,z:0,strength:0,fov:0};reactions=[];poseDisplay.clear();attackTrack.clear();strongest=null;}
  return{present,frame,snapshot,anticipation,applyPoseLag,weaponAnchor,clear};
}
