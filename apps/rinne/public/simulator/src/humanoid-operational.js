import * as T from '../vendor/three.js';
import {HumanoidRuntime as BaseHumanoidRuntime} from './humanoid-selection.js';
import {SLASH_SECONDS} from './authored-slash.js';
import {localSchema} from './motion-selection-math.js';
import {localBuildPoseCandidateBank,localSelectPoseStart,localSweptWeaponEvidence,localFootSliding,localJerk} from './motion-operational-math.js';

export const HUMANOID_OPERATIONAL_REVISION='motion-operational-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const rotationOf=bone=>{const q=bone.getWorldQuaternion(new T.Quaternion()),e=new T.Euler().setFromQuaternion(q,'YXZ');return[e.x,e.y,e.z];};
const pointOf=(runtime,c,name)=>{try{const p=runtime.point(c,name);return[p.x,p.y,p.z];}catch{return null;}};
const pointLike=value=>Array.isArray(value)||ArrayBuffer.isView(value)?{x:Number(value[0]),y:Number(value[1]),z:Number(value[2])}:value&&typeof value==='object'?{x:Number(value.x),y:Number(value.y),z:Number(value.z)}:null;
const trim=(rows,max=120)=>{while(rows.length>max)rows.shift();};
const weaponMass=weapon=>({fist:.7,sword:1,katana:.9,great:2.1,axe:1.8,spear:1.35}[weapon]??1);

export class HumanoidRuntime extends BaseHumanoidRuntime{
 constructor(api){super(api);this._operational={bank:null,foot:{left:[],right:[]},tracks:new Map(),semantic:[],current:null,lastClock:null};this.installImpactContactBridge();this.installSemanticBridge();}

 installImpactContactBridge(){
  const channels=globalThis.__RINNE_IMPACT_CHANNELS__??{};if(channels.__motionOperationalContact)return;const previous=channels['hit-reaction'];channels['hit-reaction']=beat=>{try{previous?.(beat);}catch{}if(beat?.actorId==null||beat?.targetId==null)return;let actors=[];try{actors=globalThis.__HUMANOID_LAB__?.actors?.()??[];}catch{}const attacker=actors.find(row=>String(row?.id)===String(beat.actorId)),target=actors.find(row=>String(row?.id)===String(beat.targetId));if(!attacker||!target)return;const a=pointLike(attacker.weaponBase),b=pointLike(attacker.weaponTip);if(!a||!b||![a.x,a.z,b.x,b.z,target.x,target.z].every(Number.isFinite))return;const sx=b.x-a.x,sz=b.z-a.z,len2=sx*sx+sz*sz,t=len2>1e-8?clamp(((target.x-a.x)*sx+(target.z-a.z)*sz)/len2):0,point={x:a.x+sx*t,y:Number.isFinite(a.y)&&Number.isFinite(b.y)?a.y+(b.y-a.y)*t:0,z:a.z+sz*t},nx=point.x-target.x,nz=point.z-target.z,n=Math.hypot(nx,nz),fallback=beat.direction??{x:0,z:1},normal=n>1e-6?{x:nx/n,z:nz/n}:{x:Number(fallback.x)||0,z:Number(fallback.z)||1},relativeSpeed=Math.hypot((Number(attacker.vx)||0)-(Number(target.vx)||0),(Number(attacker.vz)||0)-(Number(target.vz)||0)),strength=clamp(Number(beat.strength)||1,0,2.5);attacker._motionSweptContactEvidence={point,normal,relativeSpeed,penetration:clamp(.008+.008*strength,0,.032),penetrationEstimated:true,weaponMass:weaponMass(attacker.weapon),hitSerial:Number(beat.serial)||0,source:'authoritative-impact-weapon-segment',presentationOnly:true};};Object.defineProperty(channels,'__motionOperationalContact',{value:true});globalThis.__RINNE_IMPACT_CHANNELS__=channels;
 }

 installSemanticBridge(){
  const channels=globalThis.__RINNE_MOTION_EVENT_CHANNELS__??{},names=['foot-plant','weight-transfer','anticipation-end','weapon-release','contact','follow-through','handoff'];if(channels.__motionOperationalBridge)return;for(const name of names){const previous=channels[name];channels[name]=event=>{try{previous?.(event);}catch{}this._operational.semantic.push(event);trim(this._operational.semantic,32);try{globalThis.dispatchEvent?.(new CustomEvent('rinne:motion-presentation',{detail:event}));}catch{}};}Object.defineProperty(channels,'__motionOperationalBridge',{value:true});globalThis.__RINNE_MOTION_EVENT_CHANNELS__=channels;
 }

 setInteraction(actor,{schema,partner,anchorSelf,anchorPartner,metadata={}}={}){if(!actor||typeof actor!=='object')throw Error('Motion interaction actor required');const resolved=localSchema(schema,{partner,anchors:{self:anchorSelf,partner:anchorPartner}});actor._motionInteraction={schema:resolved.schema.id,partner,anchorSelf,anchorPartner,metadata:{...metadata},presentationOnly:true};return resolved;}
 clearInteraction(actor){if(actor&&typeof actor==='object')delete actor._motionInteraction;}

 candidateBank(){
  if(this._operational.bank)return this._operational.bank;const c=this.current,duration=id=>Number(c?.shared?.[id]?.clip?.duration??c?.shared?.[id]?.duration)||1;
  this._operational.bank=localBuildPoseCandidateBank({fps:60,samplesPerClip:5,clips:[
   {id:'idle-01',state:'idle',duration:duration('idle-01'),speed:0,yaw:0,continuity:1},
   {id:'walk',state:'move',duration:duration('walk'),speed:1.1,yaw:0,continuity:.96},
   {id:'run-slow',state:'move',duration:duration('run-slow'),speed:3,yaw:0,continuity:.90},
   {id:'slash',state:'attack',duration:SLASH_SECONDS,speed:.6,yaw:0,entryPhases:[0,.12,.24,.36],continuity:.88},
   {id:'slash-recovery',state:'recovery',duration:.34,speed:.2,yaw:0,entryPhases:[0,.25,.5,.75,1],continuity:.84}
  ]});return this._operational.bank;
 }

 poseStartSuggestion(a){const selection=this.current?.selectionMotion;if(!selection?.trajectory)return null;const speed=Math.hypot(Number(a?.vx)||0,Number(a?.vz)||0),support=this.current?.footLocks?.left?.locked&&!this.current?.footLocks?.right?.locked?'left':this.current?.footLocks?.right?.locked&&!this.current?.footLocks?.left?.locked?'right':selection.variation?.startFoot??'left',state=a?.attack?'attack':a?.recovery?'recovery':speed>.08?'move':'idle';try{return localSelectPoseStart({state,speed,yaw:Number(a?.yaw)||0,supportSide:support,trajectory:selection.trajectory,bank:this.candidateBank()});}catch{return null;}}

 recordKinematics(a,result){
  const c=this.current,clock=Number(a?._humanoidClock)||0;if(!Number.isFinite(clock)||this._operational.lastClock===clock)return;this._operational.lastClock=clock;c.root.updateWorldMatrix(true,true);
  for(const side of ['left','right']){const p=this.point(c,side+'Foot'),rows=this._operational.foot[side];rows.push({time:clock,x:p.x,z:p.z,planted:Boolean(c.footLocks?.[side]?.locked)});trim(rows,150);}
  const names=['hips','chest','head','leftLowerArm','rightLowerArm','leftLowerLeg','rightLowerLeg'];for(const name of names){const bone=c.bones[name];if(!bone)continue;const position=pointOf(this,c,name);if(!position)continue;const rows=this._operational.tracks.get(name)??[];rows.push({time:clock,position,rotation:rotationOf(bone)});trim(rows,90);this._operational.tracks.set(name,rows);}
  if(result?.b){const p=Array.isArray(result.b)||ArrayBuffer.isView(result.b)?Array.from(result.b):[result.b.x,result.b.y,result.b.z],rows=this._operational.tracks.get('weaponTip')??[];rows.push({time:clock,position:p.slice(0,3),rotation:null});trim(rows,90);this._operational.tracks.set('weaponTip',rows);}
 }

 diagnostics(){
  let footSliding=null,jerk=null;try{footSliding=localFootSliding(this._operational.foot);}catch{}try{const tracks=Object.fromEntries([...this._operational.tracks].filter(([,rows])=>rows.length>=4));if(Object.keys(tracks).length)jerk=localJerk(tracks);}catch{}
  return{footSliding,jerk,visualApprovalRequired:true};
 }

 sweptContact(a){const input=a?._motionSweptContactEvidence;if(!input)return null;try{return localSweptWeaponEvidence({...input,weaponMass:Number(input.weaponMass)||weaponMass(a.weapon)});}catch{return null;}}

 deviceCalibration({deviceClass='pixel-fold-class-30',physicalDevice=false,userAgent=globalThis.navigator?.userAgent??'',refreshHz=null,cohort=1}={}){const profile=this.current?.selectionMotion?.profile??null,layers=Array.isArray(profile?.layers)?profile.layers.map(row=>({layer:row.layer,meanMs:row.meanMs,maxMs:row.maxMs,count:row.count})):[],sampleCount=layers.reduce((n,row)=>Math.max(n,Number(row.count)||0),0),totalMeanMs=Number.isFinite(profile?.totalMeanMs)?profile.totalMeanMs:null,measuredHardware=Boolean(physicalDevice&&sampleCount>0&&totalMeanMs!==null&&String(userAgent).trim());return{schema:'motion-device-calibration',version:1,deviceClass:String(deviceClass),physicalDevice:Boolean(physicalDevice),measuredHardware,userAgent:String(userAgent).slice(0,400),refreshHz:Number.isFinite(refreshHz)&&refreshHz>0?refreshHz:null,cohort:Number.isSafeInteger(cohort)&&cohort>0?cohort:1,sampleCount,totalMeanMs,layers:layers.map(({layer,meanMs,maxMs})=>({layer,meanMs,maxMs})),notes:'runtime layer profile; physicalDevice must be explicitly asserted by device QA',designBudgetIsMeasurement:false};}

 sample(a,at=null,px=a.x,pz=a.z,commit=false){const result=super.sample(a,at,px,pz,commit);if(!result||!this.current)return result;if(commit){this.recordKinematics(a,result);const poseStart=this.poseStartSuggestion(a),sweptContact=this.sweptContact(a),diagnostics=this.diagnostics();this._operational.current={version:1,poseStart,sweptContact,diagnostics,semanticEvents:this._operational.semantic.slice(-8),candidateCount:this.candidateBank().candidates.length,advisory:true,gameplayAuthority:false};this.current.operationalMotion=this._operational.current;}return result;}

 report(){return{...super.report(),operational:{revision:HUMANOID_OPERATIONAL_REVISION,...this._operational.current,designDeviceCalibration:this.deviceCalibration()}};}
}
