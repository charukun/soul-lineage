import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime} from './humanoid-interaction.js';
import {SLASH_SECONDS,SLASH_TIMING} from './authored-slash.js';
import {localLayerPlan,localSemanticTimeline,localPredict,localRank,localVariation,localSchema,localWeaponContact} from './motion-selection-math.js';

export const HUMANOID_SELECTION_REVISION='motion-selection-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const now=()=>globalThis.performance?.now?.()??Date.now();
const point=value=>value?.isVector3?value.clone():Array.isArray(value)||ArrayBuffer.isView(value)?new T.Vector3().fromArray(value):new T.Vector3(value?.x??0,value?.y??0,value?.z??0);
const writePoint=(target,value)=>{if(Array.isArray(target)||ArrayBuffer.isView(target)){target[0]=value.x;target[1]=value.y;target[2]=value.z;}else if(target?.copy)target.copy(value);};
const writeMatrix=(target,matrix)=>{if(target?.set)target.set(matrix.elements);else if(target)for(let i=0;i<16;i++)target[i]=matrix.elements[i];};

function interactionSchemaFor(a){const spec=a?._motionInteraction;if(!spec?.schema)return null;try{return localSchema(spec.schema,{partner:spec.partner,anchors:{self:spec.anchorSelf,partner:spec.anchorPartner}});}catch{return null;}}
function intentFor(a){const explicit=a?._motionIntent;if(explicit&&Number.isFinite(explicit.x)&&Number.isFinite(explicit.z))return{x:explicit.x,z:explicit.z};return{x:Number(a?.vx)||0,z:Number(a?.vz)||0};}
function rotateWeaponResult(result,constraint){if(!result?.a||!result?.b||!constraint)return;const base=point(result.a),sign=Math.sign(constraint.normal.x)||1,angle=constraint.deflection*sign,rot=new T.Matrix4().makeTranslation(base.x,base.y,base.z).multiply(new T.Matrix4().makeRotationY(angle)).multiply(new T.Matrix4().makeTranslation(-base.x,-base.y,-base.z)),translate=new T.Matrix4().makeTranslation(constraint.recoilOffset.x,0,constraint.recoilOffset.z),full=translate.multiply(rot);for(const key of ['a','b','weaponBase','weaponTip'])if(result[key])writePoint(result[key],point(result[key]).applyMatrix4(full));if(result.sm)writeMatrix(result.sm,full.clone().multiply(new T.Matrix4().fromArray(result.sm)));}

export class HumanoidRuntime extends BaseHumanoidRuntime{
 constructor(api){super(api);this._selection={layerPlan:localLayerPlan(),semantic:new Map(),current:null,profile:{samples:0,totalMs:0,maxMs:0,budgetMs:5.5}};}

 ground(c,a,d,commit){const variation=localVariation(a?.id??'hero'),hips=c?.bones?.hips;if(hips&&d.type!=='death'){const idle=d.type==='idle'||d.type==='guard',walk=d.type==='walk'||d.type==='run',yaw=(variation.stanceScale-1)*(idle?.12:.04)+(walk?(variation.turnScale-1)*.025:0);hips.quaternion.multiply(new T.Quaternion().setFromEuler(new T.Euler(0,yaw,0,'YXZ'))).normalize();}super.ground(c,a,d,commit);}

 buildSemantic(a){if(!a?.attack)return null;const kind=a.attack.kind,contact=this.api.clips?.[kind]?.contact??.5,duration=kind==='slash'?SLASH_SECONDS:Number(a.attack.duration)||1,active=kind==='slash'?SLASH_TIMING.active:[Math.max(0,contact-.08),Math.min(1,contact+.08)];return localSemanticTimeline({duration,contactPhase:contact,activeStart:active[0],activeEnd:active[1],plantPhase:kind==='slash'?SLASH_TIMING.plant*.30:.12,handoffPhase:kind==='slash'?SLASH_TIMING.chain:.9});}

 semanticCrossings(a,timeline,commit){if(!commit||!timeline||!a?.attack)return[];const key=String(a.id??'hero'),phase=clamp(this.api.progress(a)),old=this._selection.semantic.get(key),from=old?.attack===a.attack?old.phase:0,events=timeline.events.filter(e=>e.phase>from&&e.phase<=phase);this._selection.semantic.set(key,{attack:a.attack,phase});return events;}

 buildSelection(a,commit){const speed=Math.hypot(Number(a?.vx)||0,Number(a?.vz)||0),intent=intentFor(a),trajectory=localPredict({position:{x:Number(a?.x)||0,z:Number(a?.z)||0},velocity:{x:Number(a?.vx)||0,z:Number(a?.vz)||0},intent,yaw:Number(a?.yaw)||0}),variation=localVariation(a?.id??'hero'),timeline=this.buildSemantic(a),events=this.semanticCrossings(a,timeline,commit),supportSide=this.current?.footLocks?.left?.locked&&!this.current?.footLocks?.right?.locked?'left':this.current?.footLocks?.right?.locked&&!this.current?.footLocks?.left?.locked?'right':variation.startFoot,candidates=Array.isArray(a?._motionPoseCandidates)?a._motionPoseCandidates:null,pose=candidates?.length?localRank({query:{state:a?.attack?'attack':speed>.05?'move':'idle',speed,yaw:Number(a?.yaw)||0,supportSide,trajectory},candidates})[0]:null,schema=interactionSchemaFor(a);return{version:1,layerPlan:this._selection.layerPlan,trajectory,variation,timeline,events,poseSuggestion:pose,schema,advisory:true};}

 sample(a,at=null,px=a.x,pz=a.z,commit=false){const started=commit?now():0,result=super.sample(a,at,px,pz,commit);if(!result||!this.current)return result;if(commit){const state=this.buildSelection(a,true),contact=a?._weaponContactPresentation;let weaponContact=null;if(contact){try{weaponContact=localWeaponContact(contact);rotateWeaponResult(result,weaponContact);}catch{weaponContact=null;}}const elapsed=Math.max(0,now()-started),p=this._selection.profile;p.samples++;p.totalMs+=elapsed;p.maxMs=Math.max(p.maxMs,elapsed);const mean=p.totalMs/p.samples,lodRecommendation=mean>p.budgetMs*1.6?'far':mean>p.budgetMs*1.25?'mid':mean>p.budgetMs?'near':'full';this._selection.current={...state,weaponContact,profile:{samples:p.samples,meanMs:mean,maxMs:p.maxMs,budgetMs:p.budgetMs,overBudget:mean>p.budgetMs,lodRecommendation,mayDisableGameplay:false}};this.current.selectionMotion=this._selection.current;}return result;}

 report(){return{...super.report(),selection:{revision:HUMANOID_SELECTION_REVISION,...this._selection.current}};}
}
