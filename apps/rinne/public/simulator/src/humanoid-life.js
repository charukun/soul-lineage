import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime} from './humanoid-dynamics.js';
import {weaponSockets} from './humanoid-core.js';
import {localAnticipationRecovery,localGazeAim,localGripStrength,localSecondaryStep,localPoseCorrective,localComboCarry,localReadability,localTrajectory,localMotionLod} from './motion-life-math.js';

export const HUMANOID_LIFE_REVISION='motion-life-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const q=()=>new T.Quaternion();
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const secondaryName=/hair|pony|ribbon|skirt|coat|cloth|sleeve|scabbard|sheath|accessory|ornament/i;
const angleBetween=(a,b)=>{const d=a.length()*b.length();return d>1e-9?Math.acos(clamp(a.dot(b)/d,-1,1)):0;};
const kindSign=kind=>/back|reverse|return|uppercut/i.test(kind||'')?-1:1;
const kindMomentum=kind=>kindSign(kind)*(/heavy|meteor|leap/i.test(kind||'')?.26:/thrust|pierce/i.test(kind||'')?.14:.19);

function syncSnapshot(c,names){if(!c.lastActual)return;for(const name of names){const b=c.bones[name],saved=c.lastActual[name];if(b&&saved){saved.p.copy(b.position);saved.q.copy(b.quaternion);}}}
function rotateWorldPoint(point,origin,angle){const dx=point.x-origin.x,dz=point.z-origin.z,cs=Math.cos(angle),sn=Math.sin(angle);return v(origin.x+dx*cs+dz*sn,point.y,origin.z-dx*sn+dz*cs);}

export class HumanoidRuntime extends BaseHumanoidRuntime{
 constructor(api){super(api);this._life={combo:new Map(),secondary:new Map(),secondaryNodes:null,trajectory:[],readability:null,perceptual:null,lod:null,gaze:null,grip:null,corrective:null};}

 combatPose(c,weapon,kind,p,baseTime=0){
  super.combatPose(c,weapon,kind,p,baseTime);if(!kind)return;
  const env=localAnticipationRecovery({phase:p,intensity:/heavy|meteor|leap/i.test(kind)?1.18:1}),sign=kindSign(kind),add=(name,e)=>{const b=c.bones[name];if(b)b.quaternion.multiply(q().setFromEuler(e)).normalize();};
  add('hips',new T.Euler(-.020*env.anticipation,.038*sign*(env.recovery-env.anticipation),.010*sign*env.anticipation,'YXZ'));
  add('spine',new T.Euler(-.026*env.anticipation+.012*env.recovery,.052*sign*(env.recovery-env.anticipation),.014*sign*env.anticipation,'YXZ'));
  add('chest',new T.Euler(-.014*env.anticipation+.018*env.recovery,.040*sign*(env.recovery-env.anticipation),-.010*sign*env.recovery,'YXZ'));
  c.root.updateMatrixWorld(true);
  const shoulder=c.bones.rightUpperArm&&c.bones.rightHand?this.point(c,'rightHand').sub(this.point(c,'rightUpperArm')):v(),shoulderElevation=shoulder.lengthSq()>1e-9?Math.atan2(shoulder.y,Math.hypot(shoulder.x,shoulder.z)):0;
  const A=c.bones.leftUpperLeg?this.point(c,'leftUpperLeg'):v(),B=c.bones.leftLowerLeg?this.point(c,'leftLowerLeg'):v(),C=c.bones.leftFoot?this.point(c,'leftFoot'):v(),kneeFlex=Math.PI-angleBetween(A.clone().sub(B),C.clone().sub(B)),leg=C.clone().sub(A),hipFlex=leg.lengthSq()>1e-9?Math.acos(clamp(-leg.y/leg.length(),-1,1)):0,fix=localPoseCorrective({shoulderElevation,kneeFlex,hipFlex});
  if(c.bones.upperChest)c.bones.upperChest.quaternion.multiply(q().setFromEuler(new T.Euler(0,0,-sign*fix.upperChestOpen,'YXZ'))).normalize();
  for(const side of ['left','right']){const bone=c.bones[side+'Shoulder'];if(bone)bone.quaternion.multiply(q().setFromEuler(new T.Euler(0,0,(side==='left'?1:-1)*fix.shoulderDrop,'YXZ'))).normalize();}
  c.lifeCorrective=fix;this._life.corrective=fix;c.root.updateMatrixWorld(true);
 }

 resolveGazeTarget(a){const raw=a?.attack?.targetActor??a?.attack?.target??a?.target??a?._motionGazeTarget;if(raw&&typeof raw==='object'&&Number.isFinite(raw.x)&&Number.isFinite(raw.z))return raw;try{const t=this.api.gazeTarget?.(a)??globalThis.__RINNE_GAZE_TARGET__?.(a);if(t&&Number.isFinite(t.x)&&Number.isFinite(t.z))return t;}catch{}return null;}

 applyGaze(c,a,commit,lod){if(!lod.gaze||a?.dead)return;const target=this.resolveGazeTarget(a);if(!target)return;c.root.updateMatrixWorld(true);const head=this.point(c,'head'),progress=a.attack?this.api.progress(a):0,weight=a.reaction?.2:a.attack?(progress<.62?1:.52):.68,aim=localGazeAim({origin:head,target:{x:target.x,y:Number.isFinite(target.y)?target.y:head.y,z:target.z},bodyYaw:a.yaw||0,weight});for(const [name,k]of [['neck',.48],['head',.52]]){const bone=c.bones[name];if(bone)bone.quaternion.multiply(q().setFromEuler(new T.Euler(-aim.pitch*k,aim.yaw*k,0,'YXZ'))).normalize();}c.lifeGaze=aim;this._life.gaze=aim;c.root.updateMatrixWorld(true);if(commit)syncSnapshot(c,['neck','head']);}

 applyGrip(c,a,commit,lod){if(!lod.fingers||a?.dead||(a?.weapon||'sword')==='fist')return;const phase=a.attack?this.api.progress(a):0,contact=this.api.clips?.[a.attack?.kind]?.contact??.5,strength=a.attack?localGripStrength({phase,contact}):(a.combatReady?.44:.30),weapon=a.weapon||'sword',two=!!weaponSockets[weapon]?.two;this.curl(c,'right',strength);if(two)this.curl(c,'left',strength);else if(c.bones.leftHand)this.curl(c,'left',Math.min(.28,strength*.45));c.lifeGrip={strength,weapon,two};this._life.grip=c.lifeGrip;if(commit)syncSnapshot(c,['rightHand','leftHand']);}

 secondaryNodes(c,limit){if(!this._life.secondaryNodes){const human=new Set(Object.values(c.bones)),nodes=[];c.vrm.scene.traverse(node=>{if(node?.isBone&&!human.has(node)&&secondaryName.test(node.name||''))nodes.push(node);});this._life.secondaryNodes=nodes.slice(0,12);}return this._life.secondaryNodes.slice(0,limit);}
 applySecondary(c,a,commit,lod){if(!commit||!lod.secondaryBones)return;const clock=a._humanoidClock||0,key=a.id??'hero',state=this._life.secondary.get(key)??{clock,yaw:a.yaw||0,nodes:new Map()},dt=clamp(clock-state.clock,1/240,1/20),dyaw=((a.yaw||0)-state.yaw+Math.PI*3)%(Math.PI*2)-Math.PI,angular=dyaw/dt,speed=Math.hypot(a.vx||0,a.vz||0),nodes=this.secondaryNodes(c,lod.secondaryBones);nodes.forEach((node,index)=>{const old=state.nodes.get(node.uuid)??{offset:0,velocity:0};if(old.offset)node.quaternion.multiply(q().setFromAxisAngle(v(0,0,1),-old.offset));const target=clamp(-angular*.008+(index%2?-1:1)*speed*.002,-.12,.12),next=localSecondaryStep({...old,target,dt,stiffness:16+(index%3)*2,damping:5.5,maxOffset:.12});node.quaternion.multiply(q().setFromAxisAngle(v(0,0,1),next.offset));state.nodes.set(node.uuid,next);});state.clock=clock;state.yaw=a.yaw||0;this._life.secondary.set(key,state);c.lifeSecondary={nodes:nodes.length,angular,speed};c.root.updateMatrixWorld(true);}

 tick(a,dt){if(a&&typeof a==='object'){const key=a.id??'hero',clock=a._humanoidClock||0,state=this._life.combo.get(key)??{attack:null,endedAt:null,lastMomentum:0};if(a.attack!==state.attack){if(a.attack){const gap=state.endedAt==null?0:Math.max(0,clock-state.endedAt);a._motionCombo={previous:state.lastMomentum,gap,start:clock};state.attack=a.attack;state.lastMomentum=kindMomentum(a.attack.kind);}else if(state.attack){state.attack=null;state.endedAt=clock;}}this._life.combo.set(key,state);}return super.tick(a,dt);}

 applyCombo(c,a,result){if(!a?.attack||!a._motionCombo||!result)return;const phase=this.api.progress(a),carry=localComboCarry({previous:a._motionCombo.previous,gap:a._motionCombo.gap,phase});if(Math.abs(carry)<1e-5)return;const angle=carry*.22,origin={x:a.x,y:0,z:a.z};c.root.rotation.y+=angle;c.root.updateMatrixWorld(true);if(result.a&&result.b){const A=rotateWorldPoint(result.a,origin,angle),B=rotateWorldPoint(result.b,origin,angle);result.a.copy?.(A)??Object.assign(result.a,A);result.b.copy?.(B)??Object.assign(result.b,B);}if(result.sm){const around=new T.Matrix4().makeTranslation(a.x,0,a.z).multiply(new T.Matrix4().makeRotationY(angle)).multiply(new T.Matrix4().makeTranslation(-a.x,0,-a.z)),m=new T.Matrix4().fromArray(result.sm);around.multiply(m);if(result.sm.set)result.sm.set(around.elements);else result.sm=Array.from(around.elements);}c.lifeCombo={carry,angle};}

 recordPerception(c,a,result,lod){if(!lod.perceptualQA||!result?.b)return;c.root.updateMatrixWorld(true);const hips=this.point(c,'hips'),chest=c.bones.chest?this.point(c,'chest'):hips,body=hips.clone().lerp(chest,.55),tip=result.b.clone?result.b.clone():v(result.b.x,result.b.y,result.b.z),base=result.a.clone?result.a.clone():v(result.a.x,result.a.y,result.a.z),clock=a._humanoidClock||0;this._life.trajectory.push({t:clock,x:tip.x,y:tip.y,z:tip.z});while(this._life.trajectory.length>45)this._life.trajectory.shift();this._life.readability=localReadability({keyframes:[{id:a.attack?.kind||'pose',body:body.toArray(),weaponBase:base.toArray(),weaponTip:tip.toArray()}]});if(this._life.trajectory.length>=4){try{this._life.perceptual=localTrajectory(this._life.trajectory);}catch{}}c.lifeReadability=this._life.readability;c.lifePerceptual=this._life.perceptual;}

 sample(a,at=null,px=a.x,pz=a.z,commit=false){const result=super.sample(a,at,px,pz,commit),c=this.current;if(!result||!c)return result;const lod=localMotionLod({distance:Number.isFinite(a?._motionQualityDistance)?a._motionQualityDistance:0,isHero:!!a?.hero});this._life.lod=lod;this.applyCombo(c,a,result);this.applyGaze(c,a,commit,lod);this.applyGrip(c,a,commit,lod);this.applySecondary(c,a,commit,lod);if(commit)this.recordPerception(c,a,result,lod);if(commit)c.root.updateMatrixWorld(true);return result;}
 report(){return{...super.report(),life:{revision:HUMANOID_LIFE_REVISION,lod:this._life.lod,gaze:this._life.gaze,grip:this._life.grip,corrective:this._life.corrective,readability:this._life.readability,perceptual:this._life.perceptual,trajectorySamples:this._life.trajectory.length}};}
}
