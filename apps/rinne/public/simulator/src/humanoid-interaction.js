import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime} from './humanoid-life.js';
import {localPersonality,localLocomotion,localInteraction,localCondition,localMicro,localPairedImpact,localAdaptation,localSyncFrame,localReconcile} from './motion-interaction-math.js';

export const HUMANOID_INTERACTION_REVISION='motion-interaction-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const finite=(...v)=>v.every(Number.isFinite);
const q=()=>new T.Quaternion();
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const point3=value=>value?.isVector3?value.clone():(Array.isArray(value)||ArrayBuffer.isView(value))?v().fromArray(value):v(value?.x??0,value?.y??0,value?.z??0);
const writePoint=(target,value)=>{if(Array.isArray(target)||ArrayBuffer.isView(target)){target[0]=value.x;target[1]=value.y;target[2]=value.z;}else if(target?.copy)target.copy(value);else if(target&&typeof target==='object')Object.assign(target,value);};
const translateMatrix=(target,offset)=>{if(!target)return;const transformed=new T.Matrix4().makeTranslation(offset.x,offset.y??0,offset.z).multiply(new T.Matrix4().fromArray(target));if(target.set)target.set(transformed.elements);else for(let i=0;i<16;i++)target[i]=transformed.elements[i];};

function personalityFor(a){
 const explicit=a?._motionPersonality??a?.motionPersonality;if(typeof explicit==='string')return explicit;
 const age=Number(a?.ageYears??a?.age);if(Number.isFinite(age)&&age<12)return'child';if(Number.isFinite(age)&&age>=65)return'elderly';
 if(['great','axe'].includes(a?.weapon))return'heavy';if(a?.weapon==='katana')return'nimble';return'neutral';
}
function fatigueFor(a){
 if(Number.isFinite(a?._motionFatigue))return clamp(a._motionFatigue);
 if(Number.isFinite(a?.fatigue))return clamp(a.fatigue);
 const stamina=Number(a?.stamina),maximum=Number(a?.maxStamina??a?.staminaMax);return Number.isFinite(stamina)&&Number.isFinite(maximum)&&maximum>0?clamp(1-stamina/maximum):0;
}
function injuriesFor(a){const value=a?._motionInjuries??a?.injuries;return value&&typeof value==='object'?value:{};}
function bodyFor(a,c){const explicit=a?._motionBody;if(explicit&&typeof explicit==='object')return explicit;const scale=Number(c?.ageAppearance?.scale)||1;return{height:scale,width:1,armLength:scale,legLength:scale};}
function interactionFor(a){const spec=a?._motionInteraction;return spec&&typeof spec==='object'?spec:null;}
function syncSnapshot(c,names){if(!c.lastActual)return;for(const name of names){const b=c.bones[name],saved=c.lastActual[name];if(b&&saved){saved.p.copy(b.position);saved.q.copy(b.quaternion);}}}
function transformResult(result,offset){if(!result||!offset||![offset.x,offset.y??0,offset.z].every(Number.isFinite))return;for(const key of ['a','b','weaponBase','weaponTip'])if(result[key]){const p=point3(result[key]);p.x+=offset.x;p.y+=offset.y??0;p.z+=offset.z;writePoint(result[key],p);}for(const key of ['sm','leftSocket','rightSocket','carry'])if(result[key])translateMatrix(result[key],offset);}

export class HumanoidRuntime extends BaseHumanoidRuntime{
 constructor(api){super(api);this._interaction={active:null,history:new Map(),paired:null,plan:null,sync:null,reconciliation:null};}

 prepareInteractionState(a,commit){
  const c=this.current,key=String(a?.id??'hero'),clock=Number(a?._humanoidClock)||0,speed=Math.hypot(Number(a?.vx)||0,Number(a?.vz)||0),yaw=Number(a?.yaw)||0,prev=this._interaction.history.get(key)??{clock,speed:0,yaw},dt=clamp(clock-prev.clock||1/60,1/240,.1),personality=localPersonality(personalityFor(a),a?._motionPersonalityOverrides||{}),condition=localCondition({fatigue:fatigueFor(a),injuries:injuriesFor(a)}),adaptation=localAdaptation(bodyFor(a,c)),locks=c?.footLocks||{},plantedSide=locks.left?.locked&&!locks.right?.locked?'left':locks.right?.locked&&!locks.left?.locked?'right':((Number(a?._humanoidPhase)||0)%1<.5?'left':'right'),locomotion=localLocomotion({speed,previousSpeed:prev.speed,yaw,previousYaw:prev.yaw,dt,plantedSide}),micro=localMicro({time:clock,seed:key,fatigue:condition.fatigue,personality});
  const state={key,clock,speed,yaw,dt,personality,condition,adaptation,locomotion,micro,commit:Boolean(commit)};if(commit)this._interaction.history.set(key,{clock,speed,yaw});return state;
 }

 combatPose(c,weapon,kind,p,baseTime=0){
  super.combatPose(c,weapon,kind,p,baseTime);const state=this._interaction.active;if(!state)return;const {personality,condition,adaptation}=state,sign=/back|reverse|return/i.test(kind||'')?-1:1,add=(name,e)=>{const b=c.bones[name];if(b)b.quaternion.multiply(q().setFromEuler(e)).normalize();};
  const phase=clamp(p),load=Math.sin(Math.PI*clamp(phase/.28)),recover=phase>.68?Math.sin(Math.PI*clamp((phase-.68)/.32)):0;
  add('hips',new T.Euler((personality.posture+condition.torsoGuard)*.20,-sign*.025*load*personality.anticipation,sign*.012*recover,'YXZ'));
  add('spine',new T.Euler(personality.posture*.22+condition.torsoGuard*.34,-sign*.032*load*personality.anticipation,sign*.015*recover,'YXZ'));
  if(c.bones.leftShoulder)c.bones.leftShoulder.quaternion.multiply(q().setFromEuler(new T.Euler(0,0,condition.shoulderDropLeft,'YXZ'))).normalize();
  if(c.bones.rightShoulder)c.bones.rightShoulder.quaternion.multiply(q().setFromEuler(new T.Euler(0,0,-condition.shoulderDropRight,'YXZ'))).normalize();
  const weaponSag=condition.weaponSag*(weapon==='great'||weapon==='axe'?1.15:1)*adaptation.weaponArcScale;if(c.bones.rightUpperArm)c.bones.rightUpperArm.quaternion.multiply(q().setFromEuler(new T.Euler(weaponSag*.18,0,0,'YXZ'))).normalize();
  c.root.updateMatrixWorld(true);
 }

 ground(c,a,d,commit){
  super.ground(c,a,d,commit);const state=this._interaction.active;if(!state||d.type==='death')return;const {personality,condition,adaptation,locomotion,micro}=state,add=(name,e)=>{const b=c.bones[name];if(b)b.quaternion.multiply(q().setFromEuler(e)).normalize();};
  const limpSign=condition.limpSide==='left'?-1:condition.limpSide==='right'?1:0,moveScale=adaptation.strideScale*personality.stride*condition.speedScale;
  add('hips',new T.Euler(locomotion.pelvisLean*.16+micro.breath*.16,locomotion.turnLean*.22*personality.turnSharpness,limpSign*condition.limp+micro.swayX*.35,'YXZ'));
  add('spine',new T.Euler(personality.posture*.24+condition.torsoGuard*.30+micro.breath*.32,locomotion.turnLean*.12,micro.swayX*.42,'YXZ'));
  add('head',new T.Euler(micro.headPitch,0,micro.headYaw*.35,'YXZ'));
  if(['walk','run'].includes(d.type)){const left=c.bones.leftUpperLeg,right=c.bones.rightUpperLeg;if(left)left.quaternion.multiply(q().setFromEuler(new T.Euler((moveScale-1)*.05*condition.strideLeft,0,0,'YXZ'))).normalize();if(right)right.quaternion.multiply(q().setFromEuler(new T.Euler((moveScale-1)*.05*condition.strideRight,0,0,'YXZ'))).normalize();}
  c.root.updateMatrixWorld(true);if(commit)syncSnapshot(c,['hips','spine','head','leftUpperLeg','rightUpperLeg']);
 }

 applyInteractionPlan(c,a,result,commit){
  if(!commit)return null;const spec=interactionFor(a);if(!spec)return null;const partner=spec.partner;if(!partner||!finite(partner.x,partner.z))return null;const anchorSelf=spec.anchorSelf??{x:c.root.position.x,y:c.root.position.y,z:c.root.position.z},anchorPartner=spec.anchorPartner??{x:partner.x,y:Number(partner.y)||0,z:partner.z},plan=localInteraction({actorA:{x:a.x,y:Number(a.y)||0,z:a.z,yaw:a.yaw},actorB:{x:partner.x,y:Number(partner.y)||0,z:partner.z,yaw:partner.yaw},anchorA:anchorSelf,anchorB:anchorPartner,massA:Number(spec.massSelf)||1,massB:Number(spec.massPartner)||1,maxTranslation:Number.isFinite(spec.maxTranslation)?spec.maxTranslation:.22,maxYaw:Number.isFinite(spec.maxYaw)?spec.maxYaw:.35}),offset=spec.role==='partner'?plan.b.offset:plan.a.offset;
  c.root.position.x+=offset.x;c.root.position.y+=offset.y;c.root.position.z+=offset.z;c.root.rotation.y+=spec.role==='partner'?plan.b.yaw:plan.a.yaw;c.root.updateMatrixWorld(true);transformResult(result,offset);this._interaction.plan=plan;return plan;
 }

 applyPairedResponse(c,a,result,commit){
  if(!commit||!a?.reaction||!a?._impactBeat?.direction)return null;const beat=a._impactBeat,response=localPairedImpact({serial:beat.serial??a._hitSerial??0,direction:beat.direction,strength:beat.strength??1,massAttacker:Number(a?._motionAttackerMass)||1,massDefender:Number(a?._motionMass)||1}),phase=clamp((a.reaction.t||0)/Math.max(.05,a.reaction.duration||.25)),envelope=Math.sin(Math.PI*phase),offset={x:response.defender.offset.x*envelope,y:0,z:response.defender.offset.z*envelope};c.root.position.x+=offset.x;c.root.position.z+=offset.z;c.root.updateMatrixWorld(true);transformResult(result,offset);this._interaction.paired={...response,envelope};return this._interaction.paired;
 }

 sample(a,at=null,px=a.x,pz=a.z,commit=false){
  const previous=this._interaction.active,state=this.prepareInteractionState(a,commit);this._interaction.active=state;let result;try{result=super.sample(a,at,px,pz,commit);}finally{this._interaction.active=previous;}const c=this.current;if(!result||!c)return result;if(commit){this.applyInteractionPlan(c,a,result,true);this.applyPairedResponse(c,a,result,true);c.root.updateMatrixWorld(true);for(const proxy of c.shadowMeshes){proxy.matrix.copy(proxy.userData.source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;}c.interactionMotion={personality:state.personality,condition:state.condition,adaptation:state.adaptation,locomotion:state.locomotion,micro:state.micro,paired:this._interaction.paired,plan:this._interaction.plan};}return result;
 }

 interactionPlan(input){return localInteraction(input);}
 pairedImpact(input){return localPairedImpact(input);}
 motionSyncFrame(a,{sequence=0}={}){const state=this._interaction.history.get(String(a?.id??'hero'))??{clock:Number(a?._humanoidClock)||0},frame=localSyncFrame({actorId:a?.id??'hero',sequence,clock:state.clock??0,state:a?.attack?.kind?'attack':a?.reaction?'hit':a?.recovery?'recovery':Math.hypot(a?.vx||0,a?.vz||0)>.05?'move':'idle',phase:this.api.progress(a),lockedTargetId:a?._motionGazeTarget?.id??a?.attack?.targetId??null,impactSerial:a?._impactBeat?.serial??a?._hitSerial??0,position:{x:a?.x||0,z:a?.z||0},yaw:a?.yaw||0,condition:{fatigue:fatigueFor(a),injuries:injuriesFor(a)}});this._interaction.sync=frame;return frame;}
 reconcileMotion(local,remote,options){const result=localReconcile(local,remote,options);this._interaction.reconciliation=result;return result;}
 report(){return{...super.report(),interaction:{revision:HUMANOID_INTERACTION_REVISION,current:this.current?.interactionMotion??null,paired:this._interaction.paired,plan:this._interaction.plan,sync:this._interaction.sync,reconciliation:this._interaction.reconciliation}};}
}
