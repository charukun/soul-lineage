import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime} from './humanoid-natural-stance.js';

export const HUMANOID_DYNAMICS_REVISION='mass-response-2';
export const LOCAL_WEAPON_INERTIA=Object.freeze({
 fist:Object.freeze({lag:0,maxAngle:0,stiffness:40,damping:13}),
 sword:Object.freeze({lag:.020,maxAngle:.055,stiffness:34,damping:10}),
 katana:Object.freeze({lag:.018,maxAngle:.050,stiffness:36,damping:10.5}),
 great:Object.freeze({lag:.035,maxAngle:.090,stiffness:22,damping:7.5}),
 axe:Object.freeze({lag:.033,maxAngle:.085,stiffness:23,damping:7.8}),
 spear:Object.freeze({lag:.030,maxAngle:.070,stiffness:25,damping:8.2})
});
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const q=()=>new T.Quaternion();
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const point3=value=>value?.isVector3?value.clone():(Array.isArray(value)||ArrayBuffer.isView(value))?v().fromArray(value):v(value?.x??0,value?.y??0,value?.z??0);
const writePoint=(target,value)=>{if(Array.isArray(target)||ArrayBuffer.isView(target)){target[0]=value.x;target[1]=value.y;target[2]=value.z;}else if(target?.copy)target.copy(value);else if(target&&typeof target==='object')Object.assign(target,value);};

export function localImpactBeat({actorId,targetId,kind='hit',clock=0,serial=0,direction=null,strength=1,region='torso'}={}){
 if(!finite(clock,serial,strength)||serial<0||strength<0)throw Error('Invalid impact beat');
 const dir=direction&&finite(direction.x,direction.z)?Object.freeze({x:direction.x,z:direction.z}):null;
 return Object.freeze({version:2,id:`${actorId??'actor'}:${targetId??'target'}:${kind}:${serial}`,actorId:actorId??null,targetId:targetId??null,kind,clock,strength,region,direction:dir,channels:Object.freeze(['hit-stop','camera-impulse','hit-reaction','vfx','sfx'])});
}

export function localDirectionalReaction({incomingX=0,incomingZ=-1,targetYaw=0,strength=1,region='torso'}={}){
 if(!finite(incomingX,incomingZ,targetYaw,strength)||strength<0)throw Error('Invalid directional hit reaction');
 let len=Math.hypot(incomingX,incomingZ);if(len<1e-6){incomingX=0;incomingZ=-1;len=1;}
 const dx=incomingX/len,dz=incomingZ/len,localRight=dx*Math.cos(targetYaw)-dz*Math.sin(targetYaw),localForward=dx*Math.sin(targetYaw)+dz*Math.cos(targetYaw),s=clamp(strength,0,2),low=region==='leg'||region==='lower';
 return{localRight,localForward,strength:s,region,pelvisYaw:clamp(-localRight*.20*s,-.34,.34),pelvisRoll:clamp(localRight*.08*s,-.15,.15),spinePitch:clamp(-localForward*(low?.08:.16)*s,-.26,.26),spineRoll:clamp(localRight*(low?.10:.22)*s,-.34,.34),chestYaw:clamp(-localRight*.24*s,-.40,.40),headCounterYaw:clamp(localRight*.10*s,-.18,.18),supportShiftX:clamp(localRight*(low?.10:.055)*s,-.14,.14),supportShiftZ:clamp(localForward*(low?.045:.025)*s,-.08,.08),duration:clamp(.16+.10*s+(low?.05:0),.14,.42)};
}

export function localWeaponInertiaStep({offset=0,velocity=0,targetAngularVelocity=0,dt,weapon='sword'}={}){
 if(!finite(offset,velocity,targetAngularVelocity,dt)||dt<=0)throw Error('Invalid weapon inertia step');
 const p=LOCAL_WEAPON_INERTIA[weapon]||LOCAL_WEAPON_INERTIA.sword,desired=clamp(-targetAngularVelocity*p.lag,-p.maxAngle,p.maxAngle),accel=(desired-offset)*p.stiffness-velocity*p.damping,nextVelocity=velocity+accel*dt;
 return{offset:clamp(offset+nextVelocity*dt,-p.maxAngle,p.maxAngle),velocity:nextVelocity,desired,maxAngle:p.maxAngle};
}

export function localTerrainAdjustments({left,right,maxFootLift=.22,maxPelvisShift=.16}={}){
 if(!left||!right||!finite(left.currentY,left.groundY,right.currentY,right.groundY,maxFootLift,maxPelvisShift))throw Error('Invalid terrain foot samples');
 const l=clamp(left.groundY-left.currentY,-maxFootLift,maxFootLift),r=clamp(right.groundY-right.currentY,-maxFootLift,maxFootLift),pelvis=clamp((l+r)/2,-maxPelvisShift,maxPelvisShift),norm=n=>{const x=n?.x??0,y=n?.y??1,z=n?.z??0,m=Math.hypot(x,y,z)||1;return{x:x/m,y:y/m,z:z/m};};
 return{left:{y:l-pelvis,normal:norm(left.normal)},right:{y:r-pelvis,normal:norm(right.normal)},pelvisY:pelvis};
}

function impactVector(a,includeBeat=true){
 const beat=includeBeat?a?._impactBeat:null,dir=beat?.direction??a?.reaction?.direction;
 if(dir&&finite(dir.x,dir.z))return{x:dir.x,z:dir.z,strength:beat?.strength??a.reaction?.strength??1,region:beat?.region??a.reaction?.region??'torso'};
 const rx=a?.reaction;if(rx&&finite(rx.fromX,rx.fromZ)&&finite(a.x,a.z))return{x:a.x-rx.fromX,z:a.z-rx.fromZ,strength:rx.strength??1,region:rx.region??'torso'};
 return{x:-Math.sin(a?.yaw||0),z:-Math.cos(a?.yaw||0),strength:rx?.strength??1,region:rx?.region??'torso'};
}

function syncSnapshot(c,names){if(!c.lastActual)return;for(const name of names){const b=c.bones[name],saved=c.lastActual[name];if(b&&saved){saved.p.copy(b.position);saved.q.copy(b.quaternion);}}}

export class HumanoidRuntime extends BaseHumanoidRuntime{
 constructor(api){super(api);this._dynamics={weapon:new Map(),impactByActor:new Map(),impact:null,balance:null,terrain:null,reaction:null};}

 emitImpactBeat(a){
  if(!a?.reaction)return null;const actorKey=a.id??'hero',serial=a._hitSerial??a.reaction.serial??0,previous=this._dynamics.impactByActor.get(actorKey);if(previous?.serial===serial&&previous?.reaction===a.reaction)return previous.beat;
  const vector=impactVector(a,false),sourceId=a.reaction.attackerId??a.reaction.sourceId??a.reaction.source?.id??null,kind=a.reaction.kind??a.reaction.attackKind??'hit',beat=localImpactBeat({actorId:sourceId,targetId:a.id??actorKey,kind,clock:a._humanoidClock||0,serial,direction:{x:vector.x,z:vector.z},strength:vector.strength,region:vector.region});
  a._impactBeat=beat;this._dynamics.impactByActor.set(actorKey,{serial,reaction:a.reaction,beat});this._dynamics.impact=beat;
  try{globalThis.__RINNE_IMPACT_BEAT__?.(beat);}catch{}
  const channels=globalThis.__RINNE_IMPACT_CHANNELS__;if(channels&&typeof channels==='object')for(const channel of beat.channels){try{channels[channel]?.(beat);}catch{}}
  return beat;
 }

 applyDirectionalReaction(c,a,commit){
  if(!a?.reaction||a.dead)return;
  const duration=Math.max(.05,a.reaction.duration||.25),phase=clamp((a.reaction.t||0)/duration),envelope=Math.sin(Math.PI*phase);if(envelope<=1e-5)return;
  const hit=impactVector(a),r=localDirectionalReaction({incomingX:hit.x,incomingZ:hit.z,targetYaw:a.yaw||0,strength:hit.strength,region:hit.region}),add=(name,e)=>{const b=c.bones[name];if(b)b.quaternion.multiply(q().setFromEuler(e)).normalize();};
  add('hips',new T.Euler(0,r.pelvisYaw*envelope,r.pelvisRoll*envelope,'YXZ'));
  add('spine',new T.Euler(r.spinePitch*envelope,0,r.spineRoll*envelope,'YXZ'));
  add('chest',new T.Euler(r.spinePitch*.45*envelope,r.chestYaw*envelope,r.spineRoll*.55*envelope,'YXZ'));
  add('head',new T.Euler(-r.spinePitch*.18*envelope,r.headCounterYaw*envelope,-r.spineRoll*.16*envelope,'YXZ'));
  c.bones.hips.position.x+=r.supportShiftX*envelope/c.unit;c.bones.hips.position.z+=r.supportShiftZ*envelope/c.unit;c.root.updateMatrixWorld(true);
  c.dynamicsReaction={...r,envelope};this._dynamics.reaction=c.dynamicsReaction;if(commit)syncSnapshot(c,['hips','spine','chest','head']);
 }

 applyTerrain(c,a,commit){
  if(!commit||a?.air||a?.dead||a?.attack||a?.recovery)return;
  const sampler=this.api.terrain??globalThis.__RINNE_TERRAIN_SAMPLE__;if(typeof sampler!=='function')return;
  c.root.updateMatrixWorld(true);const feet={};for(const side of ['left','right']){const p=this.point(c,side+'Foot'),sample=sampler(p.x,p.z);if(!sample||!Number.isFinite(sample.y))return;feet[side]={point:p,sample};}
  const adjust=localTerrainAdjustments({left:{currentY:feet.left.point.y,groundY:feet.left.sample.y,normal:feet.left.sample.normal},right:{currentY:feet.right.point.y,groundY:feet.right.sample.y,normal:feet.right.sample.normal}}),scale=Math.max(1e-6,c.root.scale.y||c.unit||1);
  c.bones.hips.position.y+=adjust.pelvisY/scale;c.root.updateMatrixWorld(true);
  for(const side of ['left','right']){const current=this.point(c,side+'Foot'),spec=adjust[side],target=current.clone();target.y+=spec.y;const footQ=c.bones[side+'Foot'].getWorldQuaternion(q()),up=v(0,1,0).applyQuaternion(footQ),normal=v(spec.normal.x,spec.normal.y,spec.normal.z),delta=q().setFromUnitVectors(up.normalize(),normal.normalize());this.solve(c,side,'leg',target,v(side==='left'?.15:-.15,0,1),true);this.setWorldQ(c,side+'Foot',delta.multiply(footQ));}
  c.root.updateMatrixWorld(true);c.dynamicsTerrain=adjust;this._dynamics.terrain=adjust;syncSnapshot(c,['hips','leftUpperLeg','leftLowerLeg','leftFoot','rightUpperLeg','rightLowerLeg','rightFoot']);
 }

 applyWeaponInertia(c,a,result,commit){
  if(!commit||!result?.a||!result?.b||!result?.sm||a?.dead||(a?.weapon||'sword')==='fist')return;
  const key=a.id??'hero',clock=a._humanoidClock||0,A=point3(result.a),B=point3(result.b),dir=B.clone().sub(A);if(!finite(A.x,A.y,A.z,B.x,B.y,B.z)||dir.lengthSq()<1e-8)return;
  const angle=Math.atan2(dir.x,dir.z),prev=this._dynamics.weapon.get(key)??{angle,clock,offset:0,velocity:0},dt=clamp(clock-prev.clock,1/240,1/20);let delta=(angle-prev.angle)%(Math.PI*2);if(delta>Math.PI)delta-=Math.PI*2;if(delta<-Math.PI)delta+=Math.PI*2;
  const next=localWeaponInertiaStep({offset:prev.offset,velocity:prev.velocity,targetAngularVelocity:delta/dt,dt,weapon:a.weapon||'sword'});this._dynamics.weapon.set(key,{...next,angle,clock});if(Math.abs(next.offset)<1e-5)return;
  const rot=q().setFromAxisAngle(v(0,1,0),next.offset),newB=B.clone().sub(A).applyQuaternion(rot).add(A);writePoint(result.b,newB);if(result.weaponTip)writePoint(result.weaponTip,newB);
  const m=new T.Matrix4().fromArray(result.sm),pos=v(),orientation=q(),scale=v();m.decompose(pos,orientation,scale);orientation.premultiply(rot);const transformed=new T.Matrix4().compose(pos,orientation,scale);if(result.sm.set)result.sm.set(transformed.elements);else result.sm=Array.from(transformed.elements);
  c.dynamicsWeapon={weapon:a.weapon||'sword',offset:next.offset,desired:next.desired};
 }

 updateBalance(c,a){
  if(a?.air||a?.dead)return;const names=['hips','chest','head','leftHand','rightHand','leftFoot','rightFoot'],weights={hips:.34,chest:.25,head:.08,leftHand:.05,rightHand:.05,leftFoot:.115,rightFoot:.115},points={},com=v(),total={value:0};for(const name of names){if(!c.bones[name])continue;const p=this.point(c,name),w=weights[name];points[name]=p;com.addScaledVector(p,w);total.value+=w;}if(total.value<.5)return;com.multiplyScalar(1/total.value);
  const supports=['left','right'].filter(side=>c.footLocks?.[side]?.locked);if(!supports.length)supports.push('left','right');const support=supports.map(side=>points[side+'Foot']).filter(Boolean);if(!support.length)return;let nearest=support[0].clone(),distance;if(support.length>1){const a0=support[0],b=support[1],line=b.clone().sub(a0),d=line.lengthSq(),t=d>1e-9?clamp(com.clone().sub(a0).dot(line)/d):0;nearest=a0.clone().addScaledVector(line,t);}distance=Math.hypot(com.x-nearest.x,com.z-nearest.z);const radius=.09*Math.max(1,c.root.scale.x||1),margin=radius-distance;c.dynamicsBalance={com:com.toArray(),support:support.map(p=>p.toArray()),inside:margin>=0,margin,distance};this._dynamics.balance=c.dynamicsBalance;
 }

 sample(a,at=null,px=a.x,pz=a.z,commit=false){const result=super.sample(a,at,px,pz,commit),c=this.current;if(!result||!c)return result;if(commit)this.emitImpactBeat(a);this.applyDirectionalReaction(c,a,commit);this.applyTerrain(c,a,commit);this.applyWeaponInertia(c,a,result,commit);if(commit)this.updateBalance(c,a);if(commit){c.vrm.update(0);c.root.updateMatrixWorld(true);}return result;}
 report(){return{...super.report(),dynamics:{revision:HUMANOID_DYNAMICS_REVISION,impact:this._dynamics.impact,reaction:this._dynamics.reaction,terrain:this._dynamics.terrain,balance:this._dynamics.balance,weapon:[...this._dynamics.weapon.entries()].map(([id,x])=>({id,offset:x.offset,velocity:x.velocity}))}};}
}
