import {createRinneWeapon} from '@soul/assets/equipment/three';
import {presentBattleFrame,presentBattleEvents} from './battle-presentation.js';
import {JOHAKYU_WEAPON_MOTIONS} from './motion-bindings.js';
import {combatStanceRootFrame} from './observed-locomotion.js';
import {createCanonicalPresentationDriver} from './driver.js';
import {resolveFatiguePresentation} from './fatigue.js';
import {sampleFatigueMotion} from './fatigue-motion.js';
import {createBattleObservation} from '@soul/shared-ui/johakyu-observation';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import {loadNocturneAssets,withTimeout} from './assets.js';
import {buildNocturneEnvironment} from './environment.js';
import {createTechniqueVfxRuntime} from './technique-vfx-runtime.js';
import {cameraForMotion} from './motion-camera.js';
import {impactReactionEnvelope,impactReactionProfile} from './impact-reaction.js';
import {activateSampledDownedAction,downedPresentationSample} from './downed-presentation.js';

export function createBattleRuntime({world,effects,stage,sound,notify,signal,rules=null,presentationPort=null,cameraPresentation=null}){
const V=THREE.Vector3,TAU=Math.PI*2;let disposed=false,rounds=0,allKills=0,renderedDeaths=0;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
let seed = 73917;
function rand() { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; }
const randRange = (a,b) => a + (b-a)*rand();

const trace = [];
function record(type,data={}) { trace.push({type,time:Math.round(game.time*100)/100,...data}); if(trace.length>160)trace.shift(); }
const game = {phase:'loading',time:0,wave:0,spawned:0,waveCount:0,spawnTimer:0,kills:0,damage:0,received:0,bursts:0,stance:'balanced',speed:1,energy:0,level:1,upgradeTime:0,banner:0,toast:0,shake:0,hitstop:0,cameraPunch:0,cameraImpulseX:0,cameraImpulseZ:0,cameraFocusX:0,cameraFocusZ:0,motionTargetId:null,ready:false,pausedFrom:'battle',high:stage.clientWidth>720,moveTarget:null,moveTime:0};
let scene,camera,renderer,composer,sun,heroLight,hero,manifest,techniqueVfx,clock=0,previous=0,frameCount=0,frameTime=0,fps=0,intro=0;
let W=Math.max(1,stage.clientWidth),H=Math.max(1,stage.clientHeight),dpr=Math.min(devicePixelRatio,1.5),models=new Map(),actors=[],projectiles=[],particles=[],rings=[],arcs=[],numbers=[],torches=[],loadedBytes=0;
const usedModels=new Set(),environmentMeshes=[],cameraTarget=new V(),tmp=new V(),ndc=new THREE.Vector2(),ray=new THREE.Raycaster(),groundPlane=new THREE.Plane(new V(0,1,0),0);
const fx=effects,ctx=fx.getContext('2d');if(!ctx)throw Error('2D effect canvas unavailable');
const styles={assault:{name:'猛攻の構え',damage:1.28,rate:.84,defense:1.15},balanced:{name:'均衡の構え',damage:1,rate:1,defense:1},guard:{name:'堅守の構え',damage:.87,rate:1.08,defense:.64}};
const startGlowColors={jo:new THREE.Color('#ff8f32'),ha:new THREE.Color('#ffa447'),kyu:new THREE.Color('#ffbb63'),other:new THREE.Color('#ff9b4d')},hitFlashColor=new THREE.Color('#ffe7c4');

function resize(){
 W=Math.max(1,stage.clientWidth);H=Math.max(1,stage.clientHeight);dpr=Math.min(devicePixelRatio,game.high?1.5:1);
 renderer.setPixelRatio(dpr);renderer.setSize(W,H,false);
 const size=W/H<.8?31:23;if(camera.isPerspectiveCamera)camera.aspect=W/H;else{camera.left=-size*W/H/2;camera.right=size*W/H/2;camera.top=size/2;camera.bottom=-size/2;}camera.updateProjectionMatrix();
 composer?.setPixelRatio(dpr);composer?.setSize(W,H);fx.width=Math.round(W*dpr);fx.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);
}
function makeRenderer(){
 scene=new THREE.Scene();scene.background=new THREE.Color('#0b2424');scene.fog=new THREE.FogExp2('#173432',.021);
 camera=presentationPort&&cameraPresentation?new THREE.PerspectiveCamera(40,W/H,.1,160):new THREE.OrthographicCamera(-20,20,12,-12,.1,160);
 renderer=new THREE.WebGLRenderer({canvas:world,antialias:true,powerPreference:'high-performance'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
 scene.add(new THREE.HemisphereLight('#b2d3d0','#142b26',1.5));
 sun=new THREE.DirectionalLight('#f4dab0',2.8);sun.position.set(-10,20,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-23;sun.shadow.camera.right=23;sun.shadow.camera.top=23;sun.shadow.camera.bottom=-23;sun.shadow.camera.near=1;sun.shadow.camera.far=65;sun.shadow.normalBias=.045;sun.shadow.bias=-.0003;scene.add(sun);
 const rim=new THREE.DirectionalLight('#6da7cc',1.6);rim.position.set(8,9,-14);scene.add(rim);
 heroLight=new THREE.PointLight('#ffd99c',13,11,2);scene.add(heroLight);
 composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));composer.addPass(new UnrealBloomPass(new THREE.Vector2(W,H),.22,.5,1.15));composer.addPass(new OutputPass());techniqueVfx=createTechniqueVfxRuntime({scene,random:rand});resize();
}

function collectFatigueRig(root){
 const rows=[];
 root.traverse(node=>{
  if(!node.isBone)return;
  const raw=String(node.name||'').toLowerCase(),name=raw.replace(/[^a-z0-9]/g,'');let kind=null;
  if(/spine|chest/.test(name))kind='spine';
  else if(/shoulder|clavicle/.test(name))kind='shoulder';
  else if(/upperarm/.test(name))kind='arm';
  else if(/neck|head/.test(name))kind='head';
  if(kind)rows.push({node,kind,side:/left|(^|[._-])l($|[._-])/.test(raw)?-1:1,x:0,z:0});
 });
 return rows;
}
function clearFatigueRig(a){
 for(const row of a.fatigueRig){if(row.x)row.node.rotation.x-=row.x;if(row.z)row.node.rotation.z-=row.z;row.x=0;row.z=0;}
}
function collectParryRig(root){
 const rows=[];
 root.traverse(node=>{
  if(!node.isBone)return;const raw=String(node.name||'').toLowerCase(),name=raw.replace(/[^a-z0-9]/g,'');let kind=null;
  if(/hips|pelvis/.test(name))kind='hips';else if(/upperleg|thigh/.test(name))kind='leg';
  if(kind)rows.push({node,kind,side:/left|(^|[._-])l($|[._-])/.test(raw)?-1:/right|(^|[._-])r($|[._-])/.test(raw)?1:0,x:0,y:0,z:0});
 });
 return rows;
}
function collectImpactRig(root){
 const rows=[];
 root.traverse(node=>{
  if(!node.isBone)return;const raw=String(node.name||'').toLowerCase(),name=raw.replace(/[^a-z0-9]/g,''),side=/left|(^|[._-])l($|[._-])/.test(raw)?-1:/right|(^|[._-])r($|[._-])/.test(raw)?1:0;let kind=null;
  if(/head/.test(name)&&!/headtop|headend/.test(name))kind='head';else if(/neck/.test(name))kind='neck';else if(/spine|chest/.test(name))kind='spine';else if(/hips|pelvis/.test(name))kind='hips';
  else if(/shoulder|clavicle/.test(name))kind='shoulder';else if(/upperarm/.test(name))kind='upperArm';else if(/lowerarm|forearm/.test(name))kind='lowerArm';else if(/hand|wrist/.test(name))kind='hand';
  else if(/upperleg|thigh/.test(name))kind='upperLeg';else if(/lowerleg|calf|shin/.test(name))kind='lowerLeg';else if(/foot|ankle/.test(name))kind='foot';
  if(kind)rows.push({node,kind,side,x:0,y:0,z:0});
 });
 return rows;
}
function clearImpactRig(a){for(const row of a.impactRig){if(row.x)row.node.rotation.x-=row.x;if(row.y)row.node.rotation.y-=row.y;if(row.z)row.node.rotation.z-=row.z;row.x=0;row.y=0;row.z=0;}}
function clearParryRig(a){
 for(const row of a.parryRig){if(row.x)row.node.rotation.x-=row.x;if(row.y)row.node.rotation.y-=row.y;if(row.z)row.node.rotation.z-=row.z;row.x=0;row.y=0;row.z=0;}
}
const BODY_CONTACT_PARTS=Object.freeze(['head','torso','leftArm','rightArm','leftLeg','rightLeg']),BODY_CONTACT_SKIN=.22,BODY_CONTACT_ASSIST=.2,WEAPON_TRACE_HISTORY=5;
function bodyBoneSide(raw){
 const text=String(raw||'').toLowerCase();if(/left|(^|[._-])l($|[._-])/.test(text))return'left';if(/right|(^|[._-])r($|[._-])/.test(text))return'right';return'';
}
function collectBodyContactRig(root){
 const rig=Object.fromEntries(BODY_CONTACT_PARTS.map(part=>[part,[]]));
 root.traverse(node=>{
  if(!node.isBone)return;const raw=String(node.name||'').toLowerCase(),name=raw.replace(/[^a-z0-9]/g,''),side=bodyBoneSide(raw);let part=null;
  if(/head/.test(name)&&!/headtop|headend/.test(name))part='head';
  else if(/spine|chest|hips|pelvis/.test(name))part='torso';
  else if(/upperarm|lowerarm|forearm|hand|wrist/.test(name))part=side==='left'?'leftArm':side==='right'?'rightArm':null;
  else if(/upperleg|thigh|lowerleg|calf|shin|foot|ankle/.test(name))part=side==='left'?'leftLeg':side==='right'?'rightLeg':null;
  if(part)rig[part].push(node);
 });
 return rig;
}
function bodyContactCapsules(a){
 if(!a?.bodyContactRig)return[];a.object.updateMatrixWorld(true);const scale=clamp((a.height||2.95)/2.95,.72,1.45),radii={head:.21,torso:.285,leftArm:.14,rightArm:.14,leftLeg:.165,rightLeg:.165},rows=[],covered=new Set();
 for(const part of BODY_CONTACT_PARTS){
  const points=(a.bodyContactRig[part]||[]).map(node=>node.getWorldPosition(new V())).sort((x,y)=>y.y-x.y),radius=radii[part]*scale;
  if(!points.length)continue;covered.add(part);
  if(points.length===1){const half=(part==='head'?.115:.145)*scale,lo=points[0].clone().add(new V(0,-half,0)),hi=points[0].clone().add(new V(0,half,0));rows.push({part,a:lo,b:hi,radius});continue;}
  for(let i=0;i<points.length-1;i++)if(points[i].distanceToSquared(points[i+1])>.00025)rows.push({part,a:points[i],b:points[i+1],radius});
 }
 const center=a.pos.clone(),yaw=a.object.rotation.y,right=new V(Math.cos(yaw),0,-Math.sin(yaw)),up=new V(0,1,0),h=a.height||2.5,add=(part,p0,p1,radius)=>{if(!covered.has(part))rows.push({part,a:p0,b:p1,radius});};
 add('head',center.clone().addScaledVector(up,h*.75),center.clone().addScaledVector(up,h*.9),h*.075);
 add('torso',center.clone().addScaledVector(up,h*.34),center.clone().addScaledVector(up,h*.7),h*.105);
 for(const [part,sign] of [['leftArm',-1],['rightArm',1]])add(part,center.clone().addScaledVector(up,h*.62).addScaledVector(right,sign*h*.075),center.clone().addScaledVector(up,h*.37).addScaledVector(right,sign*h*.18),h*.055);
 for(const [part,sign] of [['leftLeg',-1],['rightLeg',1]])add(part,center.clone().addScaledVector(up,h*.39).addScaledVector(right,sign*h*.055),center.clone().addScaledVector(up,h*.06).addScaledVector(right,sign*h*.085),h*.06);
 return rows;
}
function closestPointOnSegment(point,a,b,out){
 const ab=b.clone().sub(a),len=ab.lengthSq();if(len<1e-8)return out.copy(a);const t=clamp(point.clone().sub(a).dot(ab)/len,0,1);return out.copy(a).addScaledVector(ab,t);
}
function bladeCapsuleDistance(start,end,capsule){
 let best=Infinity,weaponPoint=null,bodyPoint=null;const nearest=new V();
 for(let i=0;i<=12;i++){const p=start.clone().lerp(end,i/12);closestPointOnSegment(p,capsule.a,capsule.b,nearest);const d=p.distanceTo(nearest);if(d<best){best=d;weaponPoint=p;bodyPoint=nearest.clone();}}
 for(const endpoint of [capsule.a,capsule.b]){const p=closestPointOnSegment(endpoint,start,end,new V()),d=p.distanceTo(endpoint);if(d<best){best=d;weaponPoint=p;bodyPoint=endpoint.clone();}}
 return{distance:best,weaponPoint,bodyPoint};
}
function expandedWeaponAxis(axis,padding){
 const dir=axis.end.clone().sub(axis.start),length=dir.length();if(length<1e-5)return{start:axis.start.clone(),end:axis.end.clone()};dir.multiplyScalar(1/length);return{start:axis.start.clone().addScaledVector(dir,-padding),end:axis.end.clone().addScaledVector(dir,padding)};
}
function sweptWeaponBodyContact(source,target){
 const row=source?.canonicalRow,action=row?.action,trace=source?.weaponTrace,currentAxis=trace?.axis??weaponAxis(source);if(!action?.motion?.offense||!currentAxis||action.targetId!==target?.canonicalId||target.dead)return null;
 const expected=Number(action.motion.contactProgress??.5),progress=Number(action.progress),windowStart=Math.max(.06,expected-.5),windowEnd=Math.min(.97,expected+.5),actorDistance=source.pos.distanceTo(target.pos);if(!Number.isFinite(progress)||progress<windowStart||progress>windowEnd||actorDistance>2.18)return null;
 const rawHistory=trace?.actionId===action.id&&trace.history?.length?trace.history:[currentAxis],padding=row.equipment?.weapon==='great'?.18:.14,history=rawHistory.map(axis=>expandedWeaponAxis(axis,padding)),capsules=bodyContactCapsules(target),weaponRadius=row.equipment?.weapon==='great'?.13:.1;let best=null;
 const pairs=history.length>1?history.slice(1).map((axis,index)=>[history[index],axis]):[[history[0],history[0]]];
 for(const [previous,current] of pairs)for(const t of [0,.0625,.125,.1875,.25,.3125,.375,.4375,.5,.5625,.625,.6875,.75,.8125,.875,.9375,1]){
  const start=previous.start.clone().lerp(current.start,t),end=previous.end.clone().lerp(current.end,t);
  for(const capsule of capsules){const hit=bladeCapsuleDistance(start,end,capsule),clearance=hit.distance-(capsule.radius+weaponRadius+BODY_CONTACT_SKIN);if(best&&clearance>=best.clearance)continue;best={clearance,part:capsule.part,weaponPoint:hit.weaponPoint,bodyPoint:hit.bodyPoint};}
 }
 if(!best||best.clearance>BODY_CONTACT_ASSIST)return null;const point=best.weaponPoint.clone().lerp(best.bodyPoint,.5),assisted=best.clearance>0;
 return{attackId:action.id,sourceId:source.canonicalId,targetId:target.canonicalId,bodyPart:best.part,point:{x:point.x,y:point.y,z:point.z},clearance:Number(best.clearance.toFixed(4)),engine:assisted?'weapon-body-sweep-assist':'weapon-body-sweep'};
}
function emitFatigueSweat(a,profile,dt){
 if(a.kind!=='hero'||!(profile.sweatInterval>0))return;
 a.sweatClock-=dt;if(a.sweatClock>0)return;
 a.sweatClock=profile.sweatInterval*randRange(.78,1.22);
 const pos=a.pos.clone().add(new V(randRange(-.11,.11),a.height*.82,randRange(-.08,.08)));
 particles.push({pos,vel:new V(randRange(-.08,.08),randRange(.12,.35),randRange(-.05,.05)),life:.48,max:.48,color:'#d7edf0',size:.72});
}
function applyFatigue(a,row,dt){
 const profile=resolveFatiguePresentation(row);
 if(a.fatigueBand!==profile.band||a.fatigueLocked!==profile.attackLocked){
  a.fatigueBand=profile.band;a.fatigueLocked=profile.attackLocked;a.fatigueSince=clock;a.sweatClock=0;
 }
 const sampled=sampleFatigueMotion(profile.band,Math.max(0,clock-a.fatigueSince));
 const gain=1-Math.exp(-Math.max(0,dt)*9),target={rootLean:sampled.rootLean,rootDrop:sampled.rootDrop,rootSway:sampled.rootSway,chestPitch:sampled.chestPitch,shoulderRoll:sampled.shoulderRoll,headPitch:sampled.headPitch,armDrop:sampled.armDrop,breath:sampled.breath};
 for(const key of Object.keys(target))a.fatiguePose[key]=lerp(a.fatiguePose[key]||0,target[key],gain);
 const pose=a.fatiguePose,blend=row.action?.motion?.offense ? .28 : 1;
 a.posture.rotation.x=pose.rootLean*blend;
 a.posture.rotation.y=0;
 a.posture.rotation.z=pose.rootSway*blend;
 a.posture.position.y=-pose.rootDrop*blend+pose.breath*.004;
 a.posture.position.z=pose.rootLean*.08*blend;
 a.posture.scale.set(1,1+pose.breath*.0036,1);
 for(const item of a.fatigueRig){
  let x=0,z=0;
  if(item.kind==='spine')x=pose.chestPitch*blend;
  else if(item.kind==='shoulder')z=item.side*pose.shoulderRoll*blend;
  else if(item.kind==='arm')z=item.side*pose.armDrop*blend;
  else if(item.kind==='head')x=pose.headPitch*blend;
  item.node.rotation.x+=x;item.node.rotation.z+=z;item.x=x;item.z=z;
 }
 emitFatigueSweat(a,profile,dt);
 sound.fatigue?.(a.canonicalId,{active:a.kind==='hero'&&profile.audioGain>0&&!row.dead&&!row.downed,gain:profile.audioGain,rate:profile.audioRate,x:a.pos.x,z:a.pos.z});
 a.fatiguePresentation={band:profile.band,attackLocked:profile.attackLocked,motionId:sampled.motionId,poseLabel:sampled.poseLabel,breath:Number(pose.breath.toFixed(3)),rigNodes:a.fatigueRig.length};
}
function recoilLocalDirection(a,direction){
 const yaw=a.object.rotation.y,dx=Number(direction?.x)||0,dz=Number(direction?.z)||0;return{x:dx*Math.cos(yaw)-dz*Math.sin(yaw),z:dx*Math.sin(yaw)+dz*Math.cos(yaw)};
}
function addImpactBone(row,x=0,y=0,z=0){row.node.rotation.x+=x;row.node.rotation.y+=y;row.node.rotation.z+=z;row.x+=x;row.y+=y;row.z+=z;}
function applyParryRecoil(a){
 const recoil=a.parryRecoil;if(!recoil)return;const progress=1-clamp(recoil.remaining/recoil.duration,0,1),weight=impactReactionEnvelope(progress,0),role=recoil.role||'attacker',side=recoil.side||1,local=recoilLocalDirection(a,recoil.direction);
 const dx=local.x||side*.25,dz=local.z||(role==='defender'?-.6:.6);
 if(role==='defender'){a.posture.position.x+=dx*.038*weight;a.posture.position.z+=dz*.038*weight;a.posture.rotation.x-=.034*weight;}
 else{a.posture.position.x+=dx*.072*weight;a.posture.position.z+=dz*.072*weight;a.posture.rotation.x+=.07*weight;a.posture.rotation.y+=side*.105*weight;}
 for(const item of a.impactRig){
  let x=0,y=0,z=0;
  if(role==='attacker'){
   if(item.kind==='upperArm'&&item.side===1){x=-.15*weight;y=side*.13*weight;z=side*.16*weight;}
   else if(item.kind==='lowerArm'&&item.side===1){x=-.18*weight;y=side*.1*weight;z=side*.19*weight;}
   else if(item.kind==='shoulder'&&item.side===1){x=-.09*weight;z=side*.11*weight;}
   else if(item.kind==='spine'){x=-.055*weight;y=side*.05*weight;}
   else if(item.kind==='hips'){y=side*.035*weight;}
   else if(item.kind==='head'){z=-side*.035*weight;}
  }else{
   if(item.kind==='hips'){x=-.035*weight;y=-side*.03*weight;}
   else if(item.kind==='upperLeg'){x=(item.side===side?.055:.018)*weight;z=-item.side*side*.02*weight;}
   else if(item.kind==='spine'){x=-.025*weight;}
   else if(item.kind==='shoulder'){z=-item.side*side*.025*weight;}
  }
  if(x||y||z)addImpactBone(item,x,y,z);
 }
}
function applyImpactRecoil(a){
 const recoil=a.impactRecoil;if(!recoil)return;const progress=1-clamp(recoil.remaining/recoil.duration,0,1),profile=impactReactionProfile({bodyPart:recoil.bodyPart||'torso',phase:recoil.phase||'ha',heavy:Boolean(recoil.heavy),strength:recoil.strength||1}),local=recoilLocalDirection(a,recoil.direction),forceSide=Math.sign(local.x)||recoil.side||profile.limbSide||1,forward=Math.sign(local.z)||1,rootWeight=impactReactionEnvelope(progress,0);
 a.posture.position.x+=local.x*profile.root.push*rootWeight;a.posture.position.z+=local.z*profile.root.push*rootWeight;a.posture.position.y-=profile.root.drop*rootWeight;
 a.posture.rotation.x+=profile.root.pitch*forward*rootWeight;a.posture.rotation.z+=profile.root.roll*forceSide*rootWeight;
 for(const item of a.impactRig)for(const entry of profile.bones){
  if(entry.kind!==item.kind)continue;if(entry.side==='impact'&&profile.limbSide&&item.side!==profile.limbSide)continue;
  const weight=impactReactionEnvelope(progress,entry.delay);if(weight<=0)continue;const lateral=profile.limbSide||forceSide;
  addImpactBone(item,entry.pitch*forward*weight,entry.yaw*forceSide*weight,entry.roll*lateral*weight);
 }
}

function actor(kind,position,boss=false,modelKey=null){
 const key=modelKey||(kind==='hero'?'adventurers/Knight':kind==='mage'?'skeletons/Skeleton_Mage':kind==='minion'?'skeletons/Skeleton_Minion':'skeletons/Skeleton_Warrior');
 const asset=models.get(key),root=cloneSkeleton(asset.scene),container=new THREE.Group(),posture=new THREE.Group();
 if(kind==='hero')for(const name of ['1H_Sword_Offhand','Rectangle_Shield','Round_Shield','Spike_Shield','2H_Sword']){const o=root.getObjectByName(name);if(o)o.visible=false;}
 if(kind!=='hero'&&kind!=='mage'){
  const sword=models.get('adventurers/Knight').scene.getObjectByName(boss?'2H_Sword':'1H_Sword');
  const socket=root.getObjectByName('handslotr')||root.getObjectByName('handslot.r');
  if(sword&&socket){const weapon=sword.clone(true);weapon.visible=true;weapon.traverse(o=>{if(o.isMesh)o.userData.assetSource='adventurers/Knight';});socket.add(weapon);}
 }
 const box=new THREE.Box3().setFromObject(root),height=kind==='hero'?2.95:boss?4.25:kind==='mage'?2.55:2.45;
 const scale=height/Math.max(.1,box.max.y-box.min.y);container.scale.setScalar(scale);posture.add(root);container.add(posture);container.position.copy(position);scene.add(container);
 const mats=[];
 root.traverse(o=>{if(o.isMesh){
  o.castShadow=true;o.receiveShadow=true;o.userData.assetSource=o.userData.assetSource||key;o.frustumCulled=false;
  const list=Array.isArray(o.material)?o.material:[o.material];
  const next=list.map(m=>{const n=m.clone();n.roughness=.74;n.metalness=.08;n.emissive=new THREE.Color('#000000');if(/Eyes/.test(o.name)){n.emissive.set(kind==='mage'?'#b870f1':'#c97450');n.emissiveIntensity=1.2;}mats.push({mat:n,base:n.emissive.clone(),power:n.emissiveIntensity});return n;});
  o.material=Array.isArray(o.material)?next:next[0];
 }});
 const a={kind,boss,root,posture,fatigueRig:collectFatigueRig(root),parryRig:collectParryRig(root),impactRig:collectImpactRig(root),bodyContactRig:collectBodyContactRig(root),canonicalRow:null,fatigueBand:'fresh',fatigueLocked:false,fatigueSince:0,sweatClock:0,fatiguePose:{rootLean:0,rootDrop:0,rootSway:0,chestPitch:0,shoulderRoll:0,headPitch:0,armDrop:0,breath:0},fatiguePresentation:null,object:container,pos:container.position,height,hp:kind==='hero'?220:boss?620:38+game.wave*8,maxHp:kind==='hero'?220:boss?620:38+game.wave*8,mixer:new THREE.AnimationMixer(root),clips:new Map(asset.animations.map(c=>[c.name,c])),action:null,actionName:'',attack:null,cd:randRange(.4,1.3),dead:false,deathTime:0,flash:0,startGlow:0,startGlowPhase:'jo',showHp:0,mats,damage:kind==='hero'?27:boss?18:kind==='mage'?10:7,speed:kind==='hero'?2.7:boss?1.2:kind==='mage'?1.1:1.55,attackSpeed:1,combo:0,spawn:kind==='hero'?0:.7,trail:[],reaction:null,reactionSerial:0,parryRecoil:null,impactRecoil:null,contactHold:null,contactSerial:0,weaponTrace:null,presentationActionId:null,presentationProgress:0,swingKey:null,effectKey:null,insightKey:null,afterglowKey:null,stepClock:0};
 actors.push(a);play(a,'Idle');if(kind!=='hero'){ring(a.pos,1.1,'#bf7dcb',.6);play(a,'Spawn_Ground_Skeletons',true,.8);}return a;
}
function play(a,name,once=false,duration=0){
 const clip=a.clips.get(name);if(!clip)throw Error('Missing NOCTURNE animation: '+a.kind+'/'+name);if(a.actionName===name&&!once)return;
 const next=a.mixer.clipAction(clip);next.reset();next.enabled=true;next.setEffectiveWeight(1);next.setEffectiveTimeScale(duration?clip.duration/duration:1);next.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,once?1:Infinity);next.clampWhenFinished=once;
 if(a.action&&a.action!==next)a.action.fadeOut(.13);next.fadeIn(.12).play();a.action=next;a.actionName=name;record('animation',{kind:a.kind,name,once});
}
function removeActor(a){rules?.release(a);sound.fatigue?.(a.canonicalId,{active:false});a.mixer.stopAllAction();a.mixer.uncacheRoot(a.root);scene.remove(a.object);for(const {mat} of a.mats)mat.dispose();}
function face(a,target,dt){const yaw=Math.atan2(target.x-a.pos.x,target.z-a.pos.z);const delta=Math.atan2(Math.sin(yaw-a.object.rotation.y),Math.cos(yaw-a.object.rotation.y));a.object.rotation.y+=delta*Math.min(1,dt*12);}
function move(a,target,dt,mult=1){
 const d=new V().subVectors(target,a.pos);d.y=0;const distance=d.length();if(distance<.08)return false;face(a,target,dt);d.multiplyScalar(Math.min(distance,a.speed*dt*mult)/distance);a.pos.add(d);const r=Math.hypot(a.pos.x,a.pos.z);if(r>8.75)a.pos.multiplyScalar(8.75/r);play(a,a.kind==='hero'?'Running_A':'Walking_D_Skeletons');return true;
}
function spatialPan(pos){
 if(!camera||!pos)return 0;const forward=new V();camera.getWorldDirection(forward);forward.y=0;if(forward.lengthSq()<.001)return 0;forward.normalize();
 const right=new V().crossVectors(forward,new V(0,1,0)).normalize(),delta=new V().subVectors(pos,cameraTarget);return clamp(delta.dot(right)/5.5,-.9,.9);
}
function kickCamera(source,target,power){
 if(!source||!target)return;const direction=new V().subVectors(target.pos,source.pos);direction.y=0;if(direction.lengthSq()<.001)return;direction.normalize();
 game.cameraImpulseX+=direction.x*power;game.cameraImpulseZ+=direction.z*power;
}
function pullCameraToContact(point,power){
 if(!point)return;const delta=point.clone().sub(cameraTarget);delta.y=0;const length=delta.length();if(length<.001)return;delta.multiplyScalar(Math.min(1,.9/length)*power);game.cameraFocusX+=delta.x;game.cameraFocusZ+=delta.z;
}
function visibleWeaponNode(a){
 if(!a?.root)return null;
 for(const name of ['1H_Sword','2H_Sword','RinneEquipment:dagger','RinneEquipment:spear','RinneEquipment:axe','RinneEquipment:staff']){const node=a.root.getObjectByName(name);if(node?.visible)return node;}
 return null;
}
function weaponAxis(a){
 const weapon=visibleWeaponNode(a);if(!weapon)return null;a.object.updateMatrixWorld(true);weapon.updateWorldMatrix(true,true);
 const points=[];
 weapon.traverse(node=>{
  if(!node.isMesh||node.visible===false||!node.geometry)return;
  if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();const box=node.geometry.boundingBox;if(!box)return;
  for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])points.push(new V(x,y,z).applyMatrix4(node.matrixWorld));
 });
 if(points.length<2)return null;
 let start=points[0],end=points[1],distance=-1;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){const d=points[i].distanceToSquared(points[j]);if(d>distance){distance=d;start=points[i];end=points[j];}}
 return{start:start.clone(),end:end.clone()};
}
function weaponTip(a){
 const axis=weaponAxis(a);if(!axis)return null;return axis.start.distanceToSquared(a.pos)>=axis.end.distanceToSquared(a.pos)?axis.start.clone():axis.end.clone();
}
function techniqueFxColor(archetype){return archetype==='precision'?'#d9efff':archetype==='heavy'?'#ffc27a':archetype==='counter'?'#fff0b8':archetype==='sweep'?'#f4d49a':'#f7cf80';}
function techniqueVfxContext(a,action,stage,origin=null){const presentation=action?.presentation,spec=presentation?.vfx?.[stage];if(!presentation||!spec?.effect)return null;const archetype=presentation.archetype||'flow',axis=weaponAxis(a);return{effectId:spec.effect,stage,origin:origin?.clone?.()||a.pos.clone().add(new V(0,a.height*.5,0)),actorOrigin:a.pos.clone(),axis,trace:a.weaponTrace?.history||[],yaw:a.object.rotation.y,color:techniqueFxColor(archetype),scale:Number(spec.scale)||1,archetype,grade:presentation.grade||'normal'};}
function emitTechniqueStageFx(a,action,stage,origin=null,extra={}){const context=techniqueVfxContext(a,action,stage,origin);if(!context)return;techniqueVfx.spawn(context.effectId,{...context,...extra});record('technique-vfx',{techniqueId:action.techniqueId,stageIndex:action.stageIndex,stage,archetype:context.archetype,effect:context.effectId,clip:action.presentationClip||action.motion?.clip||null});}
function emitTechniqueExecuteFx(a,action){emitTechniqueStageFx(a,action,'trail',a.pos.clone());}
function applyTechniquePresentationPose(a,row){const action=row.action,presentation=action?.presentation;if(!action?.motion?.offense||!presentation)return;const p=clamp(Number(a.presentationProgress??action.progress)||0,0,1),swing=Math.sin(Math.PI*clamp((p-.05)/.88,0,1)),anticipation=Math.sin(Math.PI*clamp(p/.3,0,1)),grade=presentation.grade==='ultimate'?1.35:presentation.grade==='secret'?1.2:1,archetype=presentation.archetype||'flow';if(archetype==='precision'){a.posture.position.z+=.26*swing*grade;a.posture.rotation.x-=.075*swing;}else if(archetype==='heavy'){a.posture.position.y-=.12*anticipation*grade;a.posture.position.z+=.16*swing;a.posture.rotation.x+=.12*anticipation;}else if(archetype==='sweep'){a.posture.rotation.y+=.42*swing*grade;a.posture.rotation.z+=Math.sin(p*TAU)*.065*swing;}else if(archetype==='counter'){a.posture.position.x+=Math.sin(p*Math.PI*2)*.11*swing;a.posture.rotation.y-=.22*swing;}else{a.posture.position.z+=.12*swing;a.posture.rotation.x-=.035*swing;}}
function bladeClashPoint(source,target,fallback){
 const a=weaponAxis(source),b=weaponAxis(target);if(!a||!b)return fallback.clone();
 const lineA=new THREE.Line3(a.start,a.end),lineB=new THREE.Line3(b.start,b.end),pa=a.start.clone().lerp(a.end,.5),pb=b.start.clone().lerp(b.end,.5);
 for(let i=0;i<3;i++){lineA.closestPointToPoint(pb,true,pa);lineB.closestPointToPoint(pa,true,pb);}
 return pa.clone().lerp(pb,.5);
}
function sampleWeaponTrace(a,dt){
 const axis=weaponAxis(a);if(!axis){a.weaponTrace=null;return null;}const actionId=a.canonicalRow?.action?.id??null,center=axis.start.clone().lerp(axis.end,.5),sameAction=a.weaponTrace?.actionId===actionId,previous=sameAction?(a.weaponTrace?.center??center):center,prior=sameAction?(a.weaponTrace?.history||[]):[],history=[...prior.slice(-(WEAPON_TRACE_HISTORY-1)),{start:axis.start.clone(),end:axis.end.clone()}];
 const velocity=center.clone().sub(previous);if(dt>1e-5)velocity.multiplyScalar(1/dt);
 a.weaponTrace={actionId,center:center.clone(),velocity,axis,previousAxis:history.length>1?history[history.length-2]:axis,history};return a.weaponTrace;
}
function deflectionFromBladeTrace(source,target,fallback='right'){
 const velocity=source?.weaponTrace?.velocity;if(!velocity||velocity.lengthSq()<.0025)return fallback;
 const yaw=target?.object?.rotation?.y??0,right=new V(Math.cos(yaw),0,-Math.sin(yaw)),lateral=velocity.dot(right);
 if(Math.abs(lateral)<.05)return fallback;return lateral>=0?'right':'left';
}
function syncContactPose(a,progress,hold=.09,clipOverride=null){
 const clipName=clipOverride||a?.canonicalRow?.action?.presentationClip||a?.actionName;if(!a||!clipName||!Number.isFinite(progress))return false;const clip=a.clips.get(clipName);if(!clip)return false;
 const p=clamp(progress,.02,.98);a.contactHold={clip:clipName,progress:p,remaining:hold,duration:hold,serial:++a.contactSerial};
 if(a.actionName!==clipName)play(a,clipName,true);a.action.paused=true;a.action.time=Math.min(clip.duration-.000001,p*clip.duration);a.mixer.update(0);a.object.updateMatrixWorld(true);return true;
}
function holdAuthoredContactPose(a,clip='Block_Hit',progress=.43,hold=.14){return syncContactPose(a,progress,hold,clip);}

function startAttack(a,target,options={}){
 a.combo++;let duration=(a.kind==='hero'?.88:1.22)*(a.kind==='hero'?styles[game.stance].rate/a.attackSpeed:1);
 const heavy=a.kind==='hero'&&a.combo%3===0,big=a.boss&&a.combo%3===0;if(big)duration=1.6;
 const action=rules?.begin(a,options)??null;
 if(rules?.ownsDamage&&!action){play(a,'Idle');return;}
 if(action)record('johakyu-action',{actorId:a.object.uuid,kind:a.kind,attackId:action.id,phase:action.phase,techniqueId:action.techniqueId,motion:action.clip});
 const name=action?.clip??(a.kind==='mage'?'Spellcast_Shoot':big?'2H_Melee_Attack_Chop':heavy?'1H_Melee_Attack_Slice_Horizontal':a.combo%2?'1H_Melee_Attack_Slice_Diagonal':'1H_Melee_Attack_Chop');
 a.attack={time:0,duration,target,hit:false,heavy:rules?false:heavy,big:rules?false:big,...(rules?{action}: {})};play(a,name,true,duration);a.trail=[];if(big)ring(a.pos,3.3,'#d45358',1.2,true);
}
function stepAttack(a,dt){
 const atk=a.attack;atk.time+=dt;if(!atk.target.dead)face(a,atk.target.pos,dt);
 if(atk.time>=atk.duration*.43&&!atk.hit){
  atk.hit=true;
  if(atk.action&&!atk.action.offense){/* Defensive/ready steps never deal damage. */}
  else if(a.kind==='mage'){
   const direction=new V().subVectors(hero.pos,a.pos).normalize();projectiles.push({pos:a.pos.clone().add(new V(0,1.5,0)),vel:direction.multiplyScalar(6),life:2.3,damage:a.damage});sound.note(610,.17,'sine',.14);
  }else if(a.kind==='hero'){
   const reach=atk.heavy?3.25:2.35;arc(a.pos,reach,a.object.rotation.y,atk.heavy?2.8:1.9,'#f7cf80',.32);let hits=0;
   for(const enemy of actors){
    if(enemy.kind==='hero'||enemy.dead)continue;
    const dist=enemy.pos.distanceTo(a.pos);const delta=Math.atan2(enemy.pos.x-a.pos.x,enemy.pos.z-a.pos.z)-a.object.rotation.y;
    if(dist<reach&&Math.cos(delta)>-.25){const crit=rand()<.16;damage(enemy,Math.round(a.damage*styles[game.stance].damage*(atk.heavy?1.3:1)*(crit?1.7:1)),a,crit);hits++;}
   }
   if(hits){sound.hit(atk.heavy);game.hitstop=atk.heavy?.055:.032;game.shake=atk.heavy?.12:.045;game.energy=clamp(game.energy+6,0,100);}
  }else if(atk.big){
   ring(a.pos,3.4,'#e47b5c',.5);burst(a.pos,30,'#da9365');if(hero.pos.distanceTo(a.pos)<3.5)damage(hero,a.damage*1.7,a);game.shake=.18;sound.hit(true);
  }else if(!hero.dead&&hero.pos.distanceTo(a.pos)<2.35){damage(hero,a.damage,a);arc(a.pos,1.9,a.object.rotation.y,1.5,'#c98a83',.2);sound.hit();}
 }
 if(atk.time>=atk.duration){rules?.complete(a,atk.action);a.attack=null;a.cd=a.kind==='hero'?.10:a.kind==='mage'?1.4:a.boss?.55:randRange(.65,1.2);play(a,'Idle');}
}
function damage(target,amount,source,critical=false){
 if(target.dead)return;
 if(target.kind==='hero')amount=Math.max(1,Math.round(amount*styles[game.stance].defense));
 if(rules)amount=Math.max(1,Math.round(amount*rules.damageScale(target)));
 if(rules?.ownsDamage){const result=rules.applyImpact(source,target,amount,source.attack?.action);if(!result.applied)return false;amount=result.dealt;}
 else rules?.impact(source,target,Math.min(target.hp,amount),source.attack?.action);
 if(rules&&source.attack?.action)record('johakyu-impact',{attackId:source.attack.action.id,sourceId:source.object.uuid,targetId:target.object.uuid,phase:source.attack.action.phase,damage:Math.min(target.hp,amount)});
 if(!rules?.ownsDamage)target.hp=Math.max(0,target.hp-amount);target.flash=.15;target.showHp=3;
 const away=new V().subVectors(target.pos,source.pos).setY(0).normalize();if(target.kind!=='hero')target.pos.addScaledVector(away,.16);
 const color=target.kind==='hero'?'#dc8c80':critical?'#fff1b8':'#dfd7bd';
 randRange(-15,15); // Preserve the original RNG stream without drawing damage numbers.
 burst(target.pos.clone().add(new V(0,1.1,0)),critical?16:7,target.kind==='hero'?'#c98171':'#e8bf75');
 if(target.kind==='hero')game.received+=amount;else game.damage+=amount;
 if(target.hp<=0){
  rules?.cancel(target,target.attack?.action);target.dead=true;target.attack=null;target.deathTime=0;play(target,target.kind==='hero'?'Death_A':'Death_C_Skeletons',true,1.3);
  if(target.kind==='hero'){record('defeat');game.phase='defeat-delay';game.endingDelay=1.6;}
  else{
   game.kills++;allKills++;game.energy=clamp(game.energy+9,0,100);if(!rules)hero.hp=Math.min(hero.maxHp,hero.hp+2.5);record('kill',{kind:target.kind,boss:target.boss,kills:game.kills});
   for(let i=0;i<5;i++)particles.push({pos:target.pos.clone().add(new V(0,.8,0)),vel:new V(randRange(-1,1),randRange(1,2),randRange(-1,1)),life:1.4,max:1.4,color:'#c2e0be',size:2,soul:true});
  }
 }
}
function ring(pos,radius,color,life=1,warn=false){rings.push({pos:pos.clone(),radius,color,life,max:life,warn});}
function arc(pos,radius,angle,sweep,color,life){arcs.push({pos:pos.clone(),radius,angle,sweep,color,life,max:life});}
function burst(pos,count,color){
 for(let i=0;i<count;i++){const angle=rand()*TAU,s=randRange(1,5);particles.push({pos:pos.clone(),vel:new V(Math.cos(angle)*s,randRange(1,4),Math.sin(angle)*s),life:randRange(.25,.7),max:.7,color,size:randRange(1,3)});}
 if(particles.length>260)particles.splice(0,particles.length-260);
}
function directedBurst(pos,count,color,direction){
 const force=direction?.clone?.()||new V(Number(direction?.x)||0,0,Number(direction?.z)||0);force.y*=.2;if(force.lengthSq()<.001)force.set(0,.1,1);force.normalize();
 for(let i=0;i<count;i++){const angle=rand()*TAU,spread=randRange(.35,1.45),speed=randRange(1.6,4.6),vel=force.clone().multiplyScalar(speed).add(new V(Math.cos(angle)*spread,randRange(.45,2.5),Math.sin(angle)*spread));particles.push({pos:pos.clone(),vel,life:randRange(.18,.48),max:.48,color,size:randRange(.7,1.8)});}
 if(particles.length>260)particles.splice(0,particles.length-260);
}
function castBurst(){
 game.energy=0;game.bursts++;game.shake=.2;game.hitstop=.075;ring(hero.pos,5,'#ffdb86',.85);ring(hero.pos,3.8,'#fff3c4',.55);burst(hero.pos.clone().add(new V(0,1,0)),42,'#ffe2a5');arc(hero.pos,4.5,0,TAU,'#f8da8e',.7);
 for(const a of actors)if(a.kind!=='hero'&&!a.dead&&a.pos.distanceTo(hero.pos)<5)damage(a,Math.round(hero.damage*2.4),hero,true);
 hero.hp=Math.min(hero.maxHp,hero.hp+18);toast('暁の一閃');sound.note(85,.8,'triangle',.8);record('burst');
}




function spawnEnemy(){
 const a=rand()*TAU,r=randRange(6.8,8.5),kind=game.wave>1&&game.spawned%4===3?'mage':game.spawned%3===0?'warrior':'minion';
 const boss=game.wave===5&&game.spawned===game.waveCount-1;
 const unit=actor(rules?'warrior':boss?'warrior':kind,new V(Math.cos(a)*r,0,Math.sin(a)*r),boss);rules?.attach(unit);
 if(boss){game.boss=unit;record('boss-spawn');}
 game.spawned++;record('spawn',{kind:unit.kind,boss});
}
function wave(){game.wave++;game.waveCount=rules?1:[0,6,8,10,12,10][game.wave];game.spawned=0;game.spawnTimer=.8;game.phase='battle';record('wave',{wave:game.wave});notify('BATTLE');}
function toast(){} // Combat cue only; no text HUD in this stage.
function start(){
 for(const a of actors)removeActor(a);actors=[];particles=[];projectiles=[];arcs=[];rings=[];numbers=[];
 rules?.reset();rounds++;Object.assign(game,{phase:'battle',time:0,wave:0,kills:0,damage:0,received:0,bursts:0,energy:0,level:1,moveTarget:null,moveTime:0,boss:null,shake:0,hitstop:0,cameraPunch:0,cameraImpulseX:0,cameraImpulseZ:0,cameraFocusX:0,cameraFocusZ:0,motionTargetId:null,resetSeconds:0});
 hero=actor('hero',new V(0,0,2.5));rules?.attach(hero);hero.object.rotation.y=Math.PI;cameraTarget.copy(hero.pos).multiplyScalar(.15);wave();record('start',{round:rounds});
}
function chooseUpgrade(choice){
 if(game.phase!=='upgrade')return;
 if(choice==='power')hero.damage*=1.22;
 else if(choice==='vitality'){hero.maxHp+=40;hero.hp=Math.min(hero.maxHp,hero.hp+85);}else hero.attackSpeed*=1.15;
 hero.hp=Math.min(hero.maxHp,hero.hp+25);game.level++;record('upgrade',{choice});wave();
}
function ending(win){if(rules)for(const a of actors){rules.cancel(a,a.attack?.action);a.attack=null;}game.phase=win?'victory':'defeat';game.resetSeconds=3.2;notify('RESETTING');record(win?'victory':'defeat');if(win)play(hero,'Cheer');}

function simulate(dt){
 rules?.beginStep();
 if((game.phase==='victory'||game.phase==='defeat')&&(game.resetSeconds-=dt)<=0)start();
 const battle=game.phase==='battle';
 if(battle){
  game.time+=dt;game.spawnTimer-=dt;
  const alive=actors.filter(a=>a.kind!=='hero'&&!a.dead);
  if(game.spawned<game.waveCount&&game.spawnTimer<=0&&alive.length<7){spawnEnemy();game.spawnTimer=game.spawned<3?.5:1.8;}
  if(game.spawned===game.waveCount&&!actors.some(a=>a.kind!=='hero'&&!a.dead)){
   if(game.wave===(rules?1:5))ending(true);
   else{game.phase='upgrade';game.upgradeTime=3.2;play(hero,'Idle');record('wave-clear',{wave:game.wave});}
  }
  if(!rules&&game.energy>=100&&!hero.dead)castBurst();
  if(!rules&&game.stance==='guard')hero.hp=Math.min(hero.maxHp,hero.hp+dt*.9);game.moveTime-=dt;
 }
 if(game.phase==='upgrade'){
  game.upgradeTime-=dt;
  if(game.upgradeTime<=0)chooseUpgrade(hero.hp/hero.maxHp<.6?'vitality':'power');
 }
 if(game.phase==='defeat-delay'){game.endingDelay-=dt;if(game.endingDelay<=0)ending(false);}
 for(const a of actors){
  a.mixer.update(dt);
  if(a.dead){a.deathTime+=dt;if(a.deathTime>1.5&&a.kind!=='hero')a.pos.y-=dt*.65;continue;}
  a.flash=Math.max(0,a.flash-dt);a.showHp=Math.max(0,a.showHp-dt);
  for(const {mat,base,power} of a.mats){mat.emissive.copy(a.flash>0?new THREE.Color('#ffe7c4'):base);mat.emissiveIntensity=a.flash>0?1.7:power;}
  if(!battle||(rules&&game.phase!=='battle'))continue;
  if(a.spawn>0){a.spawn-=dt;continue;}
  rules?.step(a,dt);
  if(rules?.reaction(a)){play(a,rules.reaction(a).mode==='parry'?'Block_Hit':'Blocking');continue;}
  if(a.attack){stepAttack(a,dt);continue;}a.cd-=dt;
  if(rules){
   const target=a.kind==='hero'?actors.filter(e=>e.kind!=='hero'&&!e.dead&&e.spawn<=0).sort((x,y)=>x.pos.distanceToSquared(a.pos)-y.pos.distanceToSquared(a.pos))[0]:hero.dead?null:hero;
   if(!target){play(a,'Idle');continue;}
   const intent=rules.intent(a,target);face(a,target.pos,dt);
   if(intent.mode==='approach')move(a,target.pos,dt);
   else if(intent.mode==='space'){const back=a.pos.clone().add(new V().subVectors(a.pos,target.pos).normalize().multiplyScalar(2));move(a,back,dt,.6);}
   else if(intent.mode==='guard'||intent.mode==='parry')play(a,intent.mode==='parry'?'Block_Hit':'Blocking');
   else if(intent.mode==='wait'||a.cd>0)play(a,'Idle');
   else startAttack(a,target,{counter:intent.mode==='counter'});
   continue;
  }
  if(a.kind==='hero'){
   const target=actors.filter(e=>e.kind!=='hero'&&!e.dead&&e.spawn<=0).sort((a,b)=>a.pos.distanceToSquared(hero.pos)-b.pos.distanceToSquared(hero.pos))[0];
   if(game.moveTarget&&game.moveTime>0&&hero.pos.distanceTo(game.moveTarget)>.25){move(a,game.moveTarget,dt);continue;}
   if(target){const dist=a.pos.distanceTo(target.pos);face(a,target.pos,dt);if(dist>1.85)move(a,target.pos,dt);else if(a.cd<=0)startAttack(a,target);else play(a,'Idle');}else play(a,'Idle');
  }else if(!hero.dead){
   const dist=a.pos.distanceTo(hero.pos),range=a.kind==='mage'?5.8:a.boss?2.2:1.72;face(a,hero.pos,dt);
   if(dist>range)move(a,hero.pos,dt);
   else if(a.kind==='mage'&&dist<3){const back=a.pos.clone().add(new V().subVectors(a.pos,hero.pos).normalize().multiplyScalar(2));move(a,back,dt,.6);if(a.cd<=0)startAttack(a,hero);}
   else if(a.cd<=0)startAttack(a,hero);else play(a,'Idle');
  }
 }
 // Mathematical collision circles, not generated 3D proxy meshes.
 if(battle){
  const live=actors.filter(a=>!a.dead);
  for(let i=0;i<live.length;i++)for(let j=i+1;j<live.length;j++){
   const a=live[i],b=live[j],dx=a.pos.x-b.pos.x,dz=a.pos.z-b.pos.z,dist=Math.hypot(dx,dz),gap=a.boss||b.boss?1.25:1.05;
   if(dist<gap&&dist>.001){const push=(gap-dist)*.5,factor=a.kind==='hero'?.3:1;a.pos.x+=dx/dist*push*factor;a.pos.z+=dz/dist*push*factor;b.pos.x-=dx/dist*push;b.pos.z-=dz/dist*push;}
  }
 }
 for(const p of projectiles){p.life-=dt;p.pos.addScaledVector(p.vel,dt);if(!hero.dead&&Math.hypot(p.pos.x-hero.pos.x,p.pos.z-hero.pos.z)<.85){damage(hero,p.damage,{pos:p.pos});p.life=-1;}}
 projectiles=projectiles.filter(p=>p.life>0);
 for(const p of particles){p.life-=dt;if(p.soul&&p.life<.9)p.vel.lerp(new V().subVectors(hero.pos.clone().add(new V(0,1,0)),p.pos).multiplyScalar(5),dt*9);else p.vel.y-=dt*6;p.pos.addScaledVector(p.vel,dt);}
 particles=particles.filter(p=>p.life>0);
 for(const n of numbers)n.life-=dt;numbers=numbers.filter(n=>n.life>0);
 for(const r of rings)r.life-=dt;rings=rings.filter(r=>r.life>0);
 for(const a of arcs)a.life-=dt;arcs=arcs.filter(a=>a.life>0);
 for(const a of [...actors])if(a.dead&&a.kind!=='hero'&&a.deathTime>3){removeActor(a);actors.splice(actors.indexOf(a),1);}
 game.shake=Math.max(0,game.shake-dt*.9);
}



function project(pos){const v=pos.clone().project(camera);return{x:(v.x*.5+.5)*W,y:(-.5*v.y+.5)*H,z:v.z};}
function groundPath(pos,radius,begin=0,end=TAU){
 ctx.beginPath();const steps=Math.ceil((end-begin)*12);
 for(let i=0;i<=steps;i++){const a=begin+(end-begin)*i/steps,p=project(new V(pos.x+Math.sin(a)*radius,pos.y+.045,pos.z+Math.cos(a)*radius));i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}
 if(end-begin>=TAU-.01)ctx.closePath();
}
function glow(x,y,r,color,alpha=1){
 if(r<=0)return;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(1,'transparent');ctx.globalAlpha=alpha;ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);ctx.globalAlpha=1;
}
function drawEffects(){
 ctx.clearRect(0,0,W,H);const scale=camera.isPerspectiveCamera?H/Math.max(.01,2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*camera.position.distanceTo(cameraTarget)):H/(camera.top-camera.bottom);
 // Environmental/legacy overlay cues remain 2D; technique VFX render as materialized Three.js effects in the world scene.
 for(const t of torches){
  const p=project(new V(t.x,.6,t.z)),flicker=1+Math.sin(clock*7+t.seed)*.12;
  ctx.globalCompositeOperation='screen';glow(p.x,p.y,scale*2.3,'#ea731a',.22*flicker);glow(p.x,p.y,scale*.42,'#ffd38a',.85);ctx.globalCompositeOperation='source-over';
  for(let i=0;i<4;i++){const phase=(clock*.6+i*.25+t.seed)%1,q=project(new V(t.x+Math.sin(clock*2+i)*.11,.3+phase*1.5,t.z));ctx.fillStyle='#ffd08e';ctx.globalAlpha=(1-phase)*.75;ctx.beginPath();ctx.ellipse(q.x,q.y,scale*.045,scale*.13*(1-phase),Math.sin(clock+i)*.3,0,TAU);ctx.fill();}ctx.globalAlpha=1;
 }
 for(let i=0;i<34;i++){
  const x=Math.sin(i*124.7)*18+Math.sin(clock*.07+i)*2,z=Math.cos(i*48.3)*18,y=1+(Math.sin(clock*.16+i)*.5+.5)*3.5,p=project(new V(x,y,z));
  ctx.fillStyle=i%3?'#c7d4b9':'#e6d19a';ctx.globalAlpha=(.18+.16*Math.sin(clock+i))*(i%3?.55:1);ctx.beginPath();ctx.arc(p.x,p.y,i%3?.75:1.3,0,TAU);ctx.fill();
 }ctx.globalAlpha=1;
 for(const r of rings){
  const f=1-r.life/r.max;groundPath(r.pos,r.radius*(r.warn?1:.2+.8*f));ctx.strokeStyle=r.color;ctx.lineWidth=r.warn?1.5:3*(1-f)+1;ctx.globalAlpha=r.warn?.2+f*.55:(1-f)*.8;ctx.stroke();
  if(r.warn){ctx.fillStyle=r.color;ctx.globalAlpha=.04+f*.09;ctx.fill();}ctx.globalAlpha=1;
 }
 ctx.globalCompositeOperation='screen';
 for(const a of arcs){
  const f=1-a.life/a.max,start=a.angle-a.sweep*.6+f*.8;groundPath(a.pos,a.radius*(.88+f*.17),start,start+a.sweep);ctx.strokeStyle=a.color;ctx.lineWidth=Math.max(1,scale*.15*(1-f));ctx.globalAlpha=(1-f)*.86;ctx.shadowColor=a.color;ctx.shadowBlur=14;ctx.stroke();groundPath(a.pos,a.radius*.85,start+.3,start+a.sweep);ctx.lineWidth=Math.max(1,scale*.045);ctx.globalAlpha=(1-f)*.75;ctx.stroke();
 }ctx.shadowBlur=0;ctx.globalAlpha=1;
 for(const p of projectiles){
  const pt=project(p.pos);glow(pt.x,pt.y,20,'#b271ee',.75);ctx.fillStyle='#e4bcff';ctx.beginPath();ctx.arc(pt.x,pt.y,3.5,0,TAU);ctx.fill();const tail=project(p.pos.clone().addScaledVector(p.vel,-.16));ctx.beginPath();ctx.moveTo(tail.x,tail.y);ctx.lineTo(pt.x,pt.y);ctx.strokeStyle='#b871eb';ctx.lineWidth=2;ctx.stroke();
 }
 for(const p of particles){const pt=project(p.pos);ctx.globalAlpha=Math.min(1,p.life/p.max);ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(pt.x,pt.y,p.size,0,TAU);ctx.fill();}
 ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
 const mist=ctx.createLinearGradient(0,H*.18,0,H*.9);mist.addColorStop(0,'#739d970b');mist.addColorStop(.5,'transparent');mist.addColorStop(1,'#2c726807');ctx.fillStyle=mist;ctx.fillRect(0,0,W,H);
}



function renderCamera(dt){
 if(!hero)return;intro+=dt;const isTitle=game.phase==='title';
 const opponent=actors.filter(a=>a!==hero&&!a.dead).sort((a,b)=>a.pos.distanceToSquared(hero.pos)-b.pos.distanceToSquared(hero.pos))[0]??null;
 const motionCamera=!isTitle?cameraForMotion(hero):null,actionTargetId=hero.canonicalRow?.action?.targetId||null;
 if(actionTargetId)game.motionTargetId=actionTargetId;
 const rememberedOpponent=game.motionTargetId?actors.find(a=>a!==hero&&a.canonicalId===game.motionTargetId):null;
 const cinematicOpponent=motionCamera?(rememberedOpponent??actors.filter(a=>a!==hero).sort((a,b)=>a.pos.distanceToSquared(hero.pos)-b.pos.distanceToSquared(hero.pos))[0]??null):null;
 const focusOpponent=motionCamera?cinematicOpponent:opponent,spread=focusOpponent?hero.pos.distanceTo(focusOpponent.pos):0,midpoint=focusOpponent?hero.pos.clone().lerp(focusOpponent.pos,.5):hero.pos.clone();
 const targetBlend=clamp(Number(motionCamera?.shot?.targetBlend)||0,0,.72);
 const desired=isTitle?new V(-2,.6,0):motionCamera?hero.pos.clone().lerp(focusOpponent?.pos??hero.pos,targetBlend).add(new V(0,motionCamera.shot.focusHeight,0)):midpoint.add(new V(0,.65,-.35));desired.x+=game.cameraFocusX;desired.z+=game.cameraFocusZ;
 const desiredZoom=isTitle?1:clamp((W/H<.8?1.02:1.08)-Math.max(0,spread-1.8)*.055+game.cameraPunch,.82,1.12);
 const baseAngle=isTitle?.62+Math.sin(intro*.045)*.08:.65,approach=isTitle?1+Math.max(0,1-intro/7)*.32:1;
 const motionBasisYaw=motionCamera?.shot?.basis==='target'&&focusOpponent?Math.atan2(focusOpponent.pos.x-hero.pos.x,focusOpponent.pos.z-hero.pos.z):hero.object.rotation.y;
 if(presentationPort&&cameraPresentation){
  const subject=a=>a?{id:a.canonicalId||a.object.uuid,position:{x:a.pos.x,y:a.pos.y,z:a.pos.z},yaw:a.object.rotation.y,height:a.height,focusHeight:a.height*.58,radius:a.height*.3,weaponRadius:a.height*.65}:null;
  const direction=motionCamera?motionBasisYaw+motionCamera.shot.angle:baseAngle;
  const distance=motionCamera?.shot.distance??23*approach;
  const authoredPosition={x:desired.x+Math.sin(direction)*distance+game.cameraImpulseX,y:desired.y+(motionCamera?.shot.height??22*approach),z:desired.z+Math.cos(direction)*distance+game.cameraImpulseZ};
  if(game.shake>0){authoredPosition.x+=Math.sin(clock*93)*game.shake;authoredPosition.y+=Math.cos(clock*84)*game.shake*.5;}
  const shot=cameraPresentation.presentExternal({camera,actor:subject(hero),target:subject(focusOpponent),position:authoredPosition,lookTarget:desired,worldHeight:motionCamera?Math.max(3,motionCamera.shot.distance*2*Math.tan(Math.PI/9))/desiredZoom:(W/H<.8?31:23)*approach/desiredZoom,dt,source:'johakyu-driven',space:'frontier',mode:motionCamera?'cinematic':'combat'});
  cameraTarget.set(shot.lookTarget.x,shot.lookTarget.y,shot.lookTarget.z);
 }else{
  cameraTarget.lerp(desired,1-Math.exp(-dt*3.8));
  camera.zoom=lerp(camera.zoom,desiredZoom,1-Math.exp(-dt*7));camera.updateProjectionMatrix();
  const direction=motionCamera?motionBasisYaw+motionCamera.shot.angle:baseAngle,distance=motionCamera?.shot.distance??23*approach;
  camera.position.lerp(new V(cameraTarget.x+Math.sin(direction)*distance+game.cameraImpulseX,cameraTarget.y+(motionCamera?.shot.height??22*approach),cameraTarget.z+Math.cos(direction)*distance+game.cameraImpulseZ),1-Math.exp(-dt*5.6));
  if(game.shake>0){camera.position.x+=Math.sin(clock*93)*game.shake;camera.position.y+=Math.cos(clock*84)*game.shake*.5;}
 }
 game.cameraImpulseX*=Math.exp(-dt*13);game.cameraImpulseZ*=Math.exp(-dt*13);game.cameraFocusX*=Math.exp(-dt*18);game.cameraFocusZ*=Math.exp(-dt*18);game.cameraPunch=Math.max(0,game.cameraPunch-dt*.34);
 camera.lookAt(cameraTarget);camera.updateMatrixWorld();heroLight.position.copy(hero.pos).add(new V(0,3.5,0));for(const t of torches)t.light.intensity=30+Math.sin(clock*7+t.seed)*5;
}


function fail(error){game.ready=false;game.phase='error';renderer?.setAnimationLoop(null);sound.pause();record('error',{message:String(error?.message||error)});notify('ERROR',String(error?.message||error));}
function draw(dt=1/60){techniqueVfx?.update(dt);renderCamera(dt);renderer.info.autoReset=false;renderer.info.reset();if(game.high)composer.render();else renderer.render(scene,camera);drawEffects();if(actors.some(a=>a.dead&&a.deathTime>0&&a.deathTime<1.3))renderedDeaths++;}
function frame(now){
 if(disposed||!game.ready)return;
 const elapsed=previous?(now-previous)/1000:1/60;previous=now;if(document.hidden)return;
 const realDt=Math.max(0,Math.min(.05,elapsed));clock+=realDt;let dt=realDt;
 if(game.hitstop>0){game.hitstop=Math.max(0,game.hitstop-realDt);dt*=.12;}
 try{simulate(dt);draw(realDt);frameCount++;frameTime+=elapsed;if(frameTime>.5){fps=Math.round(frameCount/frameTime);frameCount=0;frameTime=0;}}catch(error){fail(error);}
}
async function prepare(){
 makeRenderer();notify('ASSET_LOADING');
 const loaded=await loadNocturneAssets({loader:new GLTFLoader(),signal,onProgress:(completed,total)=>notify('ASSET_LOADING',completed+'/'+total)});
 if(disposed||signal.aborted)return;
 models=loaded.models;loadedBytes=loaded.byteLength;for(const key of models.keys())usedModels.add(key);
 for(const [key,gltf] of models){gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh){o.userData.assetSource=key;o.castShadow=true;o.receiveShadow=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.map)m.map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());}});}
 buildNocturneEnvironment({THREE,V,TAU,models,scene,environmentMeshes,torches,rand,randRange});
 game.ready=true;start();renderCamera(0);await withTimeout(renderer.compileAsync(scene,camera),20000,'Shader preparation timed out');
 if(disposed||signal.aborted)return;
 notify('READY');draw();notify('BATTLE');previous=performance.now();renderer.setAnimationLoop(frame);record('ready',{models:usedModels.size});
}
function metrics(){return {ready:game.ready,phase:game.phase,rounds,totalKills:allKills,kills:game.kills,damage:game.damage,received:game.received,wave:game.wave,time:game.time,hp:hero?.hp,models:usedModels.size,loadedBytes,actors:actors.length,activeAnimations:actors.filter(a=>a.action?.isRunning()).length,sampledAnimations:actors.filter(a=>a.action?.paused&&(a.presentationActionId||a.canonicalAction?.startsWith('phase-cue:'))).length,renderedDeaths,frames:renderer?.info.render.frame||0,drawCalls:renderer?.info.render.calls||0,triangles:renderer?.info.render.triangles||0,fps,techniqueVfx:techniqueVfx?.metrics()??null,audio:sound.metrics(),webgl2:!!renderer?.getContext().texStorage2D};}
// The main-game path never invokes start(), simulate(), damage() or a native RAF.
// It borrows only the accepted assets, actor factory, animation mixer and VFX.
function createDrivenPort(){
 const bindings=new Map(),coverNodes=new Map();let lastFrame=null,selfBinding=null,portraitTarget=null,portraitPixels=null;
 const equipmentNames=['Knife','Knife_Offhand','1H_Crossbow','2H_Crossbow','Throwable','1H_Sword','1H_Sword_Offhand','2H_Sword','Badge_Shield','Rectangle_Shield','Round_Shield','Spike_Shield',...['dagger','spear','axe','staff'].map(id=>'RinneEquipment:'+id)];
 const weaponMesh={fist:null,sword:'1H_Sword',great:'2H_Sword',dagger:'RinneEquipment:dagger',spear:'RinneEquipment:spear',axe:'RinneEquipment:axe',staff:'RinneEquipment:staff'};
 function disposeScabbard(a){
   const scabbard=a.scabbard;if(!scabbard)return;
   scabbard.group.removeFromParent();
   for(const mesh of scabbard.meshes){mesh.geometry?.dispose();mesh.material?.dispose();}
   a.scabbard=null;a.sheathMotion=null;
 }
 function armRig(a,side){
   a.sheathArmRig??={};if(a.sheathArmRig[side])return a.sheathArmRig[side];
   const socket=a.root.getObjectByName('handslot.'+side)||a.root.getObjectByName('handslot'+side);if(!socket)return null;
   const bones=[];let node=socket.parent;while(node&&node!==a.root&&bones.length<5){if(node.isBone)bones.push(node);node=node.parent;}
   return a.sheathArmRig[side]={socket,bones};
 }
 function sheathBodyRig(a){
   if(a.sheathBodyRig)return a.sheathBodyRig;
   let hips=null;a.root.traverse(node=>{if(node.isBone&&!hips&&/hips|pelvis/i.test(String(node.name||'')))hips=node;});
   return a.sheathBodyRig={hips};
 }
 function bladeAxisForSheath(a,weapon){
   a.object.updateMatrixWorld(true);weapon.updateWorldMatrix(true,true);
   const inverse=weapon.matrixWorld.clone().invert(),box=new THREE.Box3(),point=new THREE.Vector3();let found=false;
   weapon.traverse(node=>{
     if(!node.isMesh||node.visible===false||!node.geometry)return;
     if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();const bounds=node.geometry.boundingBox;if(!bounds)return;found=true;
     for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){point.set(x,y,z).applyMatrix4(node.matrixWorld).applyMatrix4(inverse);box.expandByPoint(point);}
   });
   if(!found||box.isEmpty())return null;
   const size=box.getSize(new THREE.Vector3()),center=box.getCenter(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
   const start=center.clone(),end=center.clone();start[axis]=box.min[axis];end[axis]=box.max[axis];start.applyMatrix4(weapon.matrixWorld);end.applyMatrix4(weapon.matrixWorld);
   const hand=armRig(a,'r')?.socket?.getWorldPosition(new THREE.Vector3())||weapon.parent?.getWorldPosition(new THREE.Vector3())||a.pos,startIsHilt=start.distanceToSquared(hand)<=end.distanceToSquared(hand);
   const hilt=(startIsHilt?start:end).clone(),tip=(startIsHilt?end:start).clone();return{hilt,tip,length:hilt.distanceTo(tip),direction:tip.clone().sub(hilt).normalize()};
 }
 function leftHipSheathFrame(a){
   a.object.updateMatrixWorld(true);const hips=sheathBodyRig(a).hips;if(!hips)return null;hips.updateWorldMatrix(true,true);
   const highest=bones=>bones?.map(node=>node.getWorldPosition(new THREE.Vector3())).sort((x,y)=>y.y-x.y)[0]||null,leftLeg=highest(a.bodyContactRig?.leftLeg),rightLeg=highest(a.bodyContactRig?.rightLeg);
   const yaw=a.object.rotation.y,fallbackRight=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),leftWorld=leftLeg&&rightLeg?leftLeg.clone().sub(rightLeg).setY(0):fallbackRight.clone().multiplyScalar(-1);
   if(leftWorld.lengthSq()<.0001)leftWorld.copy(fallbackRight).multiplyScalar(-1);leftWorld.normalize();
   const forwardWorld=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw)).normalize(),hipWorld=hips.getWorldPosition(new THREE.Vector3()),mouthWorld=hipWorld.clone().addScaledVector(leftWorld,a.height*.16).add(new THREE.Vector3(0,a.height*.025,0)).addScaledVector(forwardWorld,a.height*.015);
   const directionWorld=forwardWorld.clone().multiplyScalar(-.94).addScaledVector(leftWorld,.16).add(new THREE.Vector3(0,-.23,0)).normalize();
   return{hips,mouthWorld,directionWorld,leftWorld,forwardWorld};
 }
 function applyWorldBoneDelta(a,bone,delta,weight=1){
   if(!bone?.parent)return;const applied=new THREE.Quaternion().identity().slerp(delta,clamp(weight,0,1)),parentWorld=bone.parent.getWorldQuaternion(new THREE.Quaternion()),boneWorld=bone.getWorldQuaternion(new THREE.Quaternion()),nextWorld=applied.multiply(boneWorld);
   bone.quaternion.copy(parentWorld.invert().multiply(nextWorld));a.object.updateMatrixWorld(true);
 }
 function solveArmToTarget(a,rig,endPoint,target,weight=1){
   if(!rig?.bones?.length)return;const chain=rig.bones.slice(1,4);
   for(let pass=0;pass<3;pass++)for(const bone of chain){
     a.object.updateMatrixWorld(true);const end=endPoint(),origin=bone.getWorldPosition(new THREE.Vector3()),from=end.clone().sub(origin),to=target.clone().sub(origin);if(from.lengthSq()<1e-6||to.lengthSq()<1e-6)continue;
     from.normalize();to.normalize();const full=new THREE.Quaternion().setFromUnitVectors(from,to),angle=2*Math.acos(clamp(full.w,-1,1)),limit=.38*weight,delta=angle>limit&&angle>1e-5?new THREE.Quaternion().identity().slerp(full,limit/angle):full;applyWorldBoneDelta(a,bone,delta,.9);
   }
 }
 function alignBladeToSheath(a,rig,weapon,direction,weight){
   const hand=rig?.bones?.[0];if(!hand)return;const axis=bladeAxisForSheath(a,weapon);if(!axis)return;
   const full=new THREE.Quaternion().setFromUnitVectors(axis.direction,direction),angle=2*Math.acos(clamp(full.w,-1,1)),limit=.5*weight,delta=angle>limit&&angle>1e-5?new THREE.Quaternion().identity().slerp(full,limit/angle):full;applyWorldBoneDelta(a,hand,delta,.92);
 }
 function ensureScabbard(a,weaponId,frame,length){
   const {hips,mouthWorld,directionWorld}=frame;if(!hips)return null;
   if(a.scabbard?.weaponId!==weaponId||a.scabbard?.parent!==hips){
     disposeScabbard(a);const worldScale=hips.getWorldScale(new THREE.Vector3()),scale=Math.max(.001,(worldScale.x+worldScale.y+worldScale.z)/3),bodyLength=Math.max(length/scale*.94,.72),width=Math.max(.075,Math.min(bodyLength*.085,.14)),depth=width*.72;
     const bodyMaterial=new THREE.MeshStandardMaterial({color:0x2d2926,roughness:.8,metalness:.12}),trimMaterial=new THREE.MeshStandardMaterial({color:0xa88652,roughness:.5,metalness:.42});
     const group=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(width,bodyLength,depth),bodyMaterial),mouthTrim=new THREE.Mesh(new THREE.BoxGeometry(width*1.36,width*.22,depth*1.32),trimMaterial),tipTrim=new THREE.Mesh(new THREE.BoxGeometry(width*1.08,width*.16,depth*1.08),trimMaterial);
     body.position.y=bodyLength*.5;tipTrim.position.y=bodyLength;for(const mesh of [body,mouthTrim,tipTrim]){mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.assetSource='procedural:scabbard';}
     group.add(body,mouthTrim,tipTrim);hips.add(group);a.scabbard={weaponId,parent:hips,group,meshes:[body,mouthTrim,tipTrim]};
   }
   hips.updateWorldMatrix(true,true);const localMouth=hips.worldToLocal(mouthWorld.clone()),worldQuat=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),directionWorld),parentQuat=hips.getWorldQuaternion(new THREE.Quaternion());
   a.scabbard.group.position.copy(localMouth);a.scabbard.group.quaternion.copy(parentQuat.invert().multiply(worldQuat));return a.scabbard;
 }
 function moveBladeToSheath(a,progress,key){
   const weaponId=a.canonicalRow?.equipment?.weapon,name=weaponMesh[weaponId];if(!name||!['sword','dagger','great'].includes(weaponId))return;
   const weapon=a.root.getObjectByName(name),right=armRig(a,'r'),frame=leftHipSheathFrame(a);if(!weapon?.visible||!right?.socket||!frame)return;const axis=bladeAxisForSheath(a,weapon);if(!axis)return;
   ensureScabbard(a,weaponId,frame,axis.length);const {mouthWorld,directionWorld,leftWorld,forwardWorld}=frame;
   if(a.sheathMotion?.key!==key)a.sheathMotion={key,startHilt:axis.hilt.clone()};const motion=a.sheathMotion,smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
   const entry=mouthWorld.clone().addScaledVector(directionWorld,-axis.length*.92),clearance=entry.clone().addScaledVector(leftWorld,-a.height*.075).addScaledVector(forwardWorld,a.height*.07).add(new THREE.Vector3(0,a.height*.055,0));
   let target;if(progress<.3)target=motion.startHilt.clone().lerp(clearance,smooth(progress/.3));else if(progress<.6)target=clearance.clone().lerp(entry,smooth((progress-.3)/.3));else target=entry.clone().lerp(mouthWorld,smooth((progress-.6)/.4));
   const alignWeight=smooth(clamp((progress-.1)/.44,0,1));for(let pass=0;pass<2;pass++){alignBladeToSheath(a,right,weapon,directionWorld,alignWeight);solveArmToTarget(a,right,()=>bladeAxisForSheath(a,weapon)?.hilt??right.socket.getWorldPosition(new THREE.Vector3()),target,.72+.28*alignWeight);}
   const left=armRig(a,'l');if(left&&!a.canonicalRow?.equipment?.shield){const hold=mouthWorld.clone().addScaledVector(directionWorld,.08).addScaledVector(leftWorld,.025),leftWeight=smooth(clamp((progress-.14)/.34,0,1));solveArmToTarget(a,left,()=>left.socket.getWorldPosition(new THREE.Vector3()),hold,leftWeight*.82);}
 }
 function moveBladeFromSheath(a,row,dt){
   if(!a.sheathed&&!a.drawMotion)return;
   const weaponId=row.equipment?.weapon,name=weaponMesh[weaponId],weapon=name?a.root.getObjectByName(name):null,right=armRig(a,'r'),frame=leftHipSheathFrame(a);
   if(!weapon?.visible||!right?.socket||!frame){a.sheathed=false;a.drawMotion=null;return;}
   const combatReady=Boolean(row.action||row.combatReady);
   if(!a.drawMotion&&combatReady)a.drawMotion={key:row.action?.id||('ready:'+String(row.id||a.canonicalId||'')),elapsed:0,duration:.44};
   const axis=bladeAxisForSheath(a,weapon);if(!axis)return;ensureScabbard(a,weaponId,frame,axis.length);
   const {mouthWorld,directionWorld,leftWorld,forwardWorld}=frame,smooth=value=>{const t=clamp(value,0,1);return t*t*(3-2*t);};
   let progress=0;if(a.drawMotion){a.drawMotion.elapsed+=Math.max(0,dt);progress=clamp(a.drawMotion.elapsed/a.drawMotion.duration,0,1);if(row.action){const contact=Math.max(.18,Number(row.action.motion?.contactProgress)||.5),forced=clamp((Number(row.action.progress)||0)/(contact*.62),0,1);progress=Math.max(progress,forced);}}
   const authoredHilt=axis.hilt.clone(),entry=mouthWorld.clone().addScaledVector(directionWorld,-axis.length*.9),clearance=entry.clone().addScaledVector(leftWorld,-a.height*.08).addScaledVector(forwardWorld,a.height*.08).add(new THREE.Vector3(0,a.height*.045,0));
   let target;if(!a.drawMotion)target=mouthWorld;else if(progress<.56)target=mouthWorld.clone().lerp(entry,smooth(progress/.56));else if(progress<.82)target=entry.clone().lerp(clearance,smooth((progress-.56)/.26));else target=clearance.clone().lerp(authoredHilt,smooth((progress-.82)/.18));
   const alignWeight=a.drawMotion?1-smooth(clamp((progress-.56)/.44,0,1)):1;
   for(let pass=0;pass<2;pass++){alignBladeToSheath(a,right,weapon,directionWorld,alignWeight);solveArmToTarget(a,right,()=>bladeAxisForSheath(a,weapon)?.hilt??right.socket.getWorldPosition(new THREE.Vector3()),target,a.drawMotion?.9:1);}
   const left=armRig(a,'l');if(left&&!row.equipment?.shield){const hold=mouthWorld.clone().addScaledVector(directionWorld,.08).addScaledVector(leftWorld,.025),leftWeight=a.drawMotion?1-smooth(clamp((progress-.45)/.42,0,1)):1;solveArmToTarget(a,left,()=>left.socket.getWorldPosition(new THREE.Vector3()),hold,leftWeight*.8);}
   if(a.drawMotion&&progress>=1){a.drawMotion=null;a.sheathed=false;}
 }
 function updateCombatReadyWeapon(a,row,dt){
   const sheathable=a.kind==='hero'&&['sword','dagger','great'].includes(row.equipment?.weapon);
   if(!sheathable)return;
   if(row.phaseCue?.phase==='zanshin'){a.autoSheath=null;return;}
   const ready=Boolean(row.action||row.combatReady);
   if(ready){
     if(a.autoSheath){a.autoSheath=null;a.sheathed=true;}
     if(a.sheathed||a.drawMotion)moveBladeFromSheath(a,row,dt);
     return;
   }
   if(a.drawMotion){a.drawMotion=null;a.sheathed=false;}
   if(a.sheathed){moveBladeFromSheath(a,row,0);return;}
   const key='range:'+String(row.id||a.canonicalId||'');
   if(a.autoSheath?.key!==key)a.autoSheath={key,elapsed:0,duration:.52};
   a.autoSheath.elapsed+=Math.max(0,dt);
   const progress=clamp(a.autoSheath.elapsed/a.autoSheath.duration,0,1);
   moveBladeToSheath(a,progress,key);
   if(progress>=1){a.autoSheath=null;a.sheathed=true;a.sheathMotion=null;}
 }
 const driver=createCanonicalPresentationDriver({
  appearanceKey:row=>[row.kind,row.boss,row.kind==='hero'?row.equipment.armor:null].join(':'),
  supports(row){
   if(!Object.hasOwn(weaponMesh,row.equipment?.weapon))return {supported:false,reason:'unaccepted-equipment:'+row.equipment?.weapon};
   const key=row.kind==='hero'?(row.equipment.armor==='heavy'?'adventurers/Knight':'adventurers/Rogue'):row.kind==='mage'?'skeletons/Skeleton_Mage':'skeletons/Skeleton_Warrior';
   const asset=models.get(key);if(!asset)return {supported:false,reason:'missing-model:'+key};
   const actionClip=row.action?.presentationClip??row.action?.motion?.clip;
   if(row.action&&(!row.action.legal||!row.action.motion?.supported||!asset.animations.some(clip=>clip.name===actionClip)))return {supported:false,reason:'unaccepted-motion:'+row.action?.motion?.kind};
   if(row.phaseCue?.clip&&!asset.animations.some(clip=>clip.name===row.phaseCue.clip))return {supported:false,reason:'unaccepted-phase-cue:'+row.phaseCue.phase};
   if(row.locomotion?.clip&&!asset.animations.some(clip=>clip.name===row.locomotion.clip))return {supported:false,reason:'unaccepted-locomotion:'+row.locomotion.kind};
   return {supported:true};
  },
  spawn(row){const a=actor(row.kind==='hero'?'hero':'enemy',new V(row.position.x,0,row.position.z),Boolean(row.boss),row.kind==='hero'?(row.equipment.armor==='heavy'?'adventurers/Knight':'adventurers/Rogue'):null);a.spawnStyle=row.spawnStyle||null;a.spawn=a.spawnStyle==='battlebk-ground'&&a.kind!=='hero'?.7:0;a.canonicalAction=a.spawn>0?'spawn:battlebk-ground':null;a.canonicalId=row.id;a.combatReadyWeight=0;a.autoSheath=null;if(a.kind==='hero'&&['sword','dagger','great'].includes(row.equipment?.weapon))a.sheathed=true;bindings.set(row.id,a);
    // Bind the few authored attack clips while the actor spawns, before its first technique.
    for(const name of new Set([...Object.values(JOHAKYU_WEAPON_MOTIONS[row.equipment.weapon]||{}),'Block_Attack'])){const clip=a.clips.get(name);if(clip)a.mixer.clipAction(clip);}
    return a;},
  remove(a){disposeScabbard(a);removeActor(a);actors.splice(actors.indexOf(a),1);bindings.delete(a.canonicalId);},
  self(a){hero=a;selfBinding=a;},
  update(a,row,dt,{initial}){
   if(Number.isFinite(row.battleTime)){const previous=a.lastBattleTime??row.battleTime;a.lastBattleTime=row.battleTime;dt=Math.max(0,row.battleTime-previous);}
   a.canonicalRow=row;a.pos.set(row.position.x,0,row.position.z);a.object.rotation.y=row.yaw;a.hp=row.hp;a.maxHp=row.maxHp;a.dead=row.dead||row.downed;clearFatigueRig(a);clearParryRig(a);clearImpactRig(a);const contactHeld=Boolean(a.contactHold?.remaining>0);if(a.spawn>0)a.spawn=Math.max(0,a.spawn-dt);const reactionDt=contactHeld?0:dt;if(a.reaction){a.reaction.remaining=Math.max(0,a.reaction.remaining-reactionDt);if(a.reaction.remaining<=0)a.reaction=null;}if(a.parryRecoil){a.parryRecoil.remaining=Math.max(0,a.parryRecoil.remaining-reactionDt);if(a.parryRecoil.remaining<=0)a.parryRecoil=null;}if(a.impactRecoil){a.impactRecoil.remaining=Math.max(0,a.impactRecoil.remaining-reactionDt);if(a.impactRecoil.remaining<=0)a.impactRecoil=null;}if(a.contactHold){a.contactHold.remaining=Math.max(0,a.contactHold.remaining-dt);if(a.contactHold.remaining<=0)a.contactHold=null;}
   const zanshinActive=row.phaseCue?.phase==='zanshin';
   if(a.wasZanshin&&!zanshinActive){a.sheathed=true;a.sheathMotion=null;a.drawMotion=null;}
   a.wasZanshin=zanshinActive;
   if(a.scabbard&&a.scabbard.weaponId!==row.equipment.weapon){disposeScabbard(a);a.sheathed=false;a.drawMotion=null;}
   const equipmentKey=row.equipment.weapon+':'+row.equipment.shield;
   if(a.equipmentKey!==equipmentKey){
    for(const name of equipmentNames){const node=a.root.getObjectByName(name);if(node)node.visible=false;}
    const name=weaponMesh[row.equipment.weapon];
    if(name){let node=a.root.getObjectByName(name);if(!node){node=name.startsWith('RinneEquipment:')?createRinneWeapon(THREE,row.equipment.weapon):models.get('adventurers/Knight').scene.getObjectByName(name)?.clone(true);if(name.startsWith('RinneEquipment:')){node.rotation.x=Math.PI/2;node.scale.setScalar(.85);}const socket=a.root.getObjectByName('handslot.r')||a.root.getObjectByName('handslotr');if(!node||!socket)throw Error('Missing authored equipment socket');node.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;o.userData.assetSource='adventurers/Knight';const mats=(Array.isArray(o.material)?o.material:[o.material]).map(m=>{const mat=m.clone();mat.roughness=.74;mat.metalness=.08;mat.emissive=new THREE.Color('#000000');a.mats.push({mat,base:mat.emissive.clone(),power:mat.emissiveIntensity});return mat;});o.material=Array.isArray(o.material)?mats:mats[0];});socket.add(node);}node.visible=true;}
    if(row.equipment.shield){let shield=a.root.getObjectByName('Round_Shield');if(!shield){shield=models.get('adventurers/Knight').scene.getObjectByName('Round_Shield')?.clone(true);const socket=a.root.getObjectByName('handslot.l')||a.root.getObjectByName('handslotl');if(!shield||!socket)throw Error('Missing authored shield socket');socket.add(shield);}shield.visible=true;}
    a.equipmentKey=equipmentKey;
   }
   const action=row.action,terminal=row.dead?(a.kind==='hero'?'Death_A':'Death_C_Skeletons'):row.downed?'Lie_Down':null,spawnClip=!terminal&&a.spawnStyle==='battlebk-ground'&&a.spawn>0?'Spawn_Ground_Skeletons':null,contactClip=!terminal&&!spawnClip?a.contactHold?.clip:null,reactionClip=!terminal&&!spawnClip&&!contactClip?a.reaction?.clip:null,phaseCue=!terminal&&!spawnClip&&!reactionClip&&!contactClip&&!action?row.phaseCue:null,phaseCueClip=phaseCue?.clip??null,actionClip=action?.presentationClip??action?.motion.clip,locomotionClip=!spawnClip&&!phaseCue&&!action&&row.moving?(row.locomotion?.clip||null):null;
   const clip=terminal||spawnClip||contactClip||reactionClip||phaseCueClip||actionClip||locomotionClip||(row.hit?'Hit_A':row.moving?(a.kind==='hero'?'Running_A':'Walking_D_Skeletons'):row.resting?'Sit_Floor_Idle':'Idle');
   const key=terminal||(spawnClip?'spawn:battlebk-ground':contactClip?('contact:'+a.contactHold.serial+':'+contactClip):reactionClip?('reaction:'+a.reaction.serial+':'+reactionClip):phaseCue?('phase-cue:'+phaseCue.key+':'+phaseCueClip):((action?.id||(locomotionClip?('locomotion:'+(row.locomotion?.kind||'observed')+':'+locomotionClip):clip))+':'+(action?.step??0)));
   if(a.canonicalAction!==key){if(row.downed&&!row.dead&&terminal){const downClip=a.clips.get(clip);if(!downClip)throw Error('Missing NOCTURNE animation: '+a.kind+'/'+clip);const downAction=a.mixer.clipAction(downClip);activateSampledDownedAction(a.mixer,downAction);a.action=downAction;a.actionName=clip;record('animation',{kind:a.kind,name:clip,once:true});}else play(a,clip,Boolean(terminal||spawnClip||reactionClip||contactClip||action||row.hit),spawnClip?.8:0);a.canonicalAction=key;a.deathTime=0;if(action&&!terminal&&!spawnClip&&!reactionClip&&!contactClip){a.startGlow=.18;a.startGlowPhase=action.phase;}}
   if(row.downed&&!row.dead&&terminal){const sample=downedPresentationSample(row,a.clips.get(terminal)?.duration);a.presentationActionId=null;a.action.paused=true;a.action.setEffectiveWeight?.(1);a.action.time=sample.time;a.mixer.update(0);a.object.updateMatrixWorld(true);}
   else if(spawnClip&&!terminal){a.presentationActionId=null;a.action.paused=false;a.mixer.update(dt);}
   else if(contactClip&&!terminal){const held=a.contactHold;a.action.paused=true;a.action.time=Math.min(a.clips.get(contactClip).duration-.000001,held.progress*a.clips.get(contactClip).duration);a.mixer.update(0);}
   else if(reactionClip&&!terminal){a.action.paused=false;a.mixer.update(dt);}
   else if(phaseCue&&!terminal){const cueProgress=clamp(Number(phaseCue.progress)||0,0,1),cueEase=cueProgress*cueProgress*(3-2*cueProgress),poseStart=clamp(Number(phaseCue.poseStart)||0,0,.95),poseEnd=clamp(Number(phaseCue.poseEnd)||.7,poseStart,.98),pose=lerp(poseStart,poseEnd,cueEase);a.presentationActionId=null;a.action.paused=true;a.action.time=Math.min(a.clips.get(phaseCueClip).duration-.000001,pose*a.clips.get(phaseCueClip).duration);a.mixer.update(0);if(phaseCue.phase==='zanshin')moveBladeToSheath(a,cueProgress,phaseCue.key);}
   else if(action&&!terminal){
    const canonicalProgress=Math.max(0,action.progress);if(a.presentationActionId!==action.id){a.presentationActionId=action.id;a.presentationProgress=canonicalProgress;}
    a.presentationProgress=action.poseProgress??canonicalProgress;const segment=action.presentation?.segment,sampleStart=clamp(Number(segment?.sampleStart)||0,0,.95),sampleEnd=clamp(Number(segment?.sampleEnd)||1,sampleStart+.01,.999),sampleProgress=lerp(sampleStart,sampleEnd,a.presentationProgress);a.action.paused=true;a.action.time=Math.min(a.clips.get(clip).duration-.000001,sampleProgress*a.clips.get(clip).duration);a.mixer.update(dt);
    const swingAt=action.choreography?.timeline.commit??Math.max(.08,Math.min(.28,Number(action.motion?.contactProgress??.5)-.22)),swing=action.presentation?.sfx?.swing;
    if(action.motion?.offense&&canonicalProgress>=swingAt&&a.swingKey!==action.id){a.swingKey=action.id;sound.swing?.({pan:spatialPan(a.pos),gain:Number(swing?.gain)||.66,rate:Number(swing?.pitch)||1});}
    const effectAt=action.choreography?.timeline.execute??Math.max(.12,Math.min(.42,Number(action.motion?.contactProgress??.5)-.12));if(action.motion?.offense&&canonicalProgress>=effectAt&&a.effectKey!==action.id){a.effectKey=action.id;emitTechniqueExecuteFx(a,action);}
    const afterglowAt=action.choreography?.timeline.recovery??Math.max(.7,Math.min(.9,Number(action.motion?.contactProgress??.5)+.24));if(action.motion?.offense&&canonicalProgress>=afterglowAt&&a.afterglowKey!==action.id){a.afterglowKey=action.id;emitTechniqueStageFx(a,action,'afterglow',a.pos.clone().add(new V(0,a.height*.38,0)));}
   }else{
    a.presentationActionId=null;a.action.paused=false;if(initial&&terminal)a.action.time=a.clips.get(clip).duration-.000001;a.mixer.update(dt);
    if(row.moving&&!terminal){a.stepClock-=dt;if(a.stepClock<=0){a.stepClock=.34;sound.footstep?.({pan:spatialPan(a.pos),rate:a.kind==='hero'?1.04:.94});}}else a.stepClock=0;
   }
   applyFatigue(a,row,dt);a.combatReadyWeight+=(Number(Boolean(row.combatReady))-a.combatReadyWeight)*(1-Math.exp(-Math.max(0,dt)*10));const readyFrame=combatStanceRootFrame({active:a.combatReadyWeight>.001,held:a.combatReadyWeight,attack:Boolean(row.action?.motion?.offense),progress:row.action?.progress});a.posture.position.y-=readyFrame.drop;a.posture.rotation.x-=readyFrame.pitch;applyTechniquePresentationPose(a,row);applyImpactRecoil(a);applyParryRecoil(a);if(!terminal)updateCombatReadyWeapon(a,row,dt);sampleWeaponTrace(a,dt);
   if(terminal)a.deathTime+=dt;
   a.flash=Math.max(0,a.flash-dt);a.startGlow=Math.max(0,a.startGlow-dt);const startColor=startGlowColors[a.startGlowPhase]||startGlowColors.other;for(const {mat,base,power} of a.mats){if(a.flash>0){mat.emissive.copy(hitFlashColor);mat.emissiveIntensity=1.7;}else if(a.startGlow>0){mat.emissive.copy(startColor);mat.emissiveIntensity=Math.max(power,1.5*a.startGlow/.18);}else{mat.emissive.copy(base);mat.emissiveIntensity=power;}}
  },
  sampleBodyContacts(){
   const rows=[];for(const source of bindings.values()){const action=source.canonicalRow?.action;if(!action?.motion?.offense)continue;const target=bindings.get(action.targetId);if(!target)continue;const hit=sweptWeaponBodyContact(source,target);if(hit)rows.push(hit);}return rows;
  },
  impact(event,source,target){
   const point=event.contactPoint,stop=clamp(Number(event.impact?.hitstop??event.hitstop)||.045,.025,.14),phase=event.phase==='kyu'||event.phase==='finisher'?'kyu':event.phase==='jo'?'jo':'ha';
   if(event.type==='clash'){
    const fallback=point?new V(point.x,Math.min(source?.height||target.height,target.height)*.58,point.z):target.pos.clone().add(new V(0,target.height*.58,0)),clash=source?bladeClashPoint(source,target,fallback):fallback,pan=spatialPan(clash);
    syncContactPose(source,event.sourceContactProgress??.5,stop,event.presentation?.clip);syncContactPose(target,event.otherContactProgress??.5,stop,event.otherPresentation?.clip||'Block_Hit');
    const normal=new V(event.direction?.x||target.pos.x-source.pos.x,0,event.direction?.z||target.pos.z-source.pos.z).normalize(),side=new V(normal.z,0,-normal.x);
    source.parryRecoil={remaining:.24,duration:.24,side:-1,role:'attacker',direction:{x:-normal.x,z:-normal.z}};target.parryRecoil={remaining:.24,duration:.24,side:1,role:'attacker',direction:{x:normal.x,z:normal.z}};
    directedBurst(clash,14,'#fff0b8',side);if(source)arc(source.pos,Math.max(1.45,source.pos.distanceTo(target.pos)*.58),source.object.rotation.y,.72,'#fff0b8',.14);
    sound.parry?.({pan,gain:1.04,rate:1.02,strong:true});game.hitstop=Math.max(game.hitstop,stop);game.cameraPunch=Math.max(game.cameraPunch,.018);game.shake=Math.max(game.shake,.004);pullCameraToContact(clash,.065);kickCamera(source,target,.055);
    record('canonical-clash',{techniqueId:event.techniqueId,stageIndex:event.stageIndex,contactTime:event.time,hitstop:stop,attackId:event.attackId,otherAttackId:event.otherAttackId,sourceId:event.sourceId,targetId:event.targetId,contactPoint:point||null,contactDistance:event.contactDistance||null,poseClip:event.presentation?.clip||null});return;
   }
   if(['guard','parry'].includes(event.type)){
    const parry=event.type==='parry',strongParry=parry&&event.strongParry===true,fallback=point?new V(point.x,Math.min(source?.height||target.height,target.height)*.58,point.z):target.pos.clone().add(new V(0,target.height*.58,0)),clash=source?bladeClashPoint(source,target,fallback):fallback,visualDirection=event.parryDirection||deflectionFromBladeTrace(source,target,'right'),pan=spatialPan(clash),normal=new V(event.direction?.x||target.pos.x-source.pos.x,0,event.direction?.z||target.pos.z-source.pos.z).normalize(),lateral=new V(normal.z,0,-normal.x).multiplyScalar(visualDirection==='left'?-1:1);
    syncContactPose(source,event.sourceContactProgress??.5,stop,event.presentation?.clip);syncContactPose(target,event.defenseContactProgress??.45,stop,target?.canonicalRow?.action?.presentationClip||'Block_Hit');
    if(parry){source.parryRecoil={remaining:strongParry?.25:.19,duration:strongParry?.25:.19,side:visualDirection==='left'?-1:1,role:'attacker',direction:{x:-normal.x,z:-normal.z}};target.parryRecoil={remaining:.18,duration:.18,side:visualDirection==='left'?1:-1,role:'defender',direction:{x:-normal.x,z:-normal.z}};}
    else{target.impactRecoil={remaining:.24,duration:.24,strength:event.reactionSeverity,bodyPart:'torso',phase,heavy:Boolean(event.impact?.heavy),direction:event.direction,side:0};}
    directedBurst(clash,parry?(strongParry?14:10):7,parry?'#fff0b8':'#d9c486',parry?lateral:normal);if(source)arc(source.pos,Math.max(1.55,source.pos.distanceTo(target.pos)*.62),source.object.rotation.y,parry?.72:1.02,'#f7cf80',.16);
    if(parry)sound.parry?.({pan,gain:strongParry?1.1:.96,rate:strongParry?.98:1.08,strong:strongParry});else sound.guard?.({pan});game.hitstop=Math.max(game.hitstop,stop);game.cameraPunch=Math.max(game.cameraPunch,parry?(strongParry?.022:.012):.01);game.shake=Math.max(game.shake,strongParry?.006:0);if(parry)pullCameraToContact(clash,strongParry?.075:.05);kickCamera(source,target,parry?(strongParry?.07:.04):.055);
    record('canonical-defense',{techniqueId:event.techniqueId,stageIndex:event.stageIndex,contactTime:event.time,hitstop:stop,type:event.type,attackId:event.attackId,sourceId:event.sourceId,targetId:event.targetId,strongParry,exchangeContinuity:event.exchangeContinuity||null,contactPoint:point||null,bladeClash:[Number(clash.x.toFixed(3)),Number(clash.y.toFixed(3)),Number(clash.z.toFixed(3))],contactDistance:event.contactDistance||null,parryDirection:event.parryDirection||null,visualDeflection:visualDirection,sourceContactProgress:event.sourceContactProgress??null,defenseContactProgress:event.defenseContactProgress??null});return;
   }
   if(!['player-hit','enemy-hit','finisher'].includes(event.type))return;
   const presentation=event.presentation||source?.canonicalRow?.action?.presentation||null,archetype=presentation?.archetype||null,impactSpec=presentation?.sfx?.impact,finisher=event.type==='finisher',impactScale=clamp(Math.max(finisher?1.35:0,Number(presentation?.vfx?.impact?.scale)||1),.5,1.8),secondaryScale=clamp(Math.max(finisher?.45:0,Number(presentation?.vfx?.secondary?.scale)||.24),.08,.8);
   target.flash=finisher?.26:.2;const heavy=event.impact?event.impact.heavy:archetype==='heavy'||finisher||event.counter,impactPoint=point?new V(point.x,point.y,point.z):target.pos.clone().add(new V(0,target.height*.55,0)),pan=spatialPan(impactPoint),reactionClip=['head','leftArm','rightArm'].includes(event.bodyPart)?'Hit_B':'Hit_A',color=techniqueFxColor(archetype||'flow'),phaseReaction=phase==='kyu'?1.18:phase==='jo'?.86:1.04,recoilStrength=(finisher?1.48:event.counter?1.32:heavy?1.05:.72)*phaseReaction,recoilDuration=finisher?.56:event.counter?.48:heavy?.42:.31,recoilSide=event.bodyPart==='leftArm'||event.bodyPart==='leftLeg'?-1:event.bodyPart==='rightArm'||event.bodyPart==='rightLeg'?1:0;
   syncContactPose(source,event.sourceContactProgress??event.choreography?.contactProgress??.5,stop,event.presentation?.clip);holdAuthoredContactPose(target,reactionClip,.1,stop);
   target.reaction={clip:reactionClip,remaining:finisher?.52:event.counter?.44:heavy?.4:.28,serial:++target.reactionSerial};target.impactRecoil={remaining:recoilDuration,duration:recoilDuration,strength:event.impact?.reactionSeverity??recoilStrength,side:recoilSide,direction:event.impact?.direction,bodyPart:event.bodyPart||'torso',phase,heavy:Boolean(heavy||event.impact?.deepHit)};
   if(source&&event.impact)source.impactRecoil={remaining:.16,duration:.16,strength:event.sourceKick*.62,direction:{x:-event.direction.x,z:-event.direction.z},side:0,bodyPart:'rightArm',phase,heavy:false};
   const impactEffect=presentation?.vfx?.impact,secondaryEffect=presentation?.vfx?.secondary,vfxDirection=event.direction||{x:target.pos.x-source.pos.x,z:target.pos.z-source.pos.z};
   if(impactEffect?.effect)techniqueVfx.spawn(impactEffect.effect,{stage:'impact',origin:impactPoint,color,scale:impactScale,archetype:archetype||'flow',finisher,direction:vfxDirection,trajectory:event.choreography?.bladeTrajectory});
   if(secondaryEffect?.effect)techniqueVfx.spawn(secondaryEffect.effect,{stage:'secondary',origin:impactPoint,color:'#f3e7d2',scale:secondaryScale,archetype:archetype||'flow',finisher,direction:vfxDirection});
   record('technique-vfx-impact',{techniqueId:event.techniqueId||null,impactEffect:impactEffect?.effect||null,secondaryEffect:secondaryEffect?.effect||null,archetype:archetype||'flow',finisher});
   const material=target?.canonicalRow?.equipment?.armor==='heavy'?'armor':'flesh';sound.impact?.({pan,heavy,counter:Boolean(event.counter),gain:Number(impactSpec?.gain)||null,rate:Number(impactSpec?.pitch)||1,material,phase});game.hitstop=Math.max(game.hitstop,stop);game.cameraPunch=Math.max(game.cameraPunch,finisher?.055:event.counter?.042:heavy?.028:.01);game.shake=Math.max(game.shake,finisher?.008:phase==='kyu'?.006:heavy?.004:0);kickCamera(source,target,finisher?.27:phase==='kyu'?.22:heavy?.17:.07);
   record('canonical-impact',{stageIndex:event.stageIndex,contactTime:event.time,hitstop:stop,attackId:event.attackId,sourceId:event.sourceId,targetId:event.targetId,bodyPart:event.bodyPart,finisher,counter:Boolean(event.counter),reactionClip,recoilDuration,recoilStrength,techniqueId:event.techniqueId||null,archetype,effect:presentation?.vfx?.impact?.effect||null,soundRole:impactSpec?.role||null});
  },
  environment(obstacles,shots){
   const ids=new Set(obstacles.map(row=>row.id));for(const [id,node] of coverNodes)if(!ids.has(id)){scene.remove(node);coverNodes.delete(id);}
   for(const row of obstacles){let node=coverNodes.get(row.id);if(!node){node=new THREE.Group();const rock=models.get('nature/stone_largeB').scene.clone(true),box=new THREE.Box3().setFromObject(rock),size=box.getSize(new V()),center=box.getCenter(new V());rock.scale.set(row.w/size.x,row.h/size.y,row.d/size.z);rock.position.set(-center.x*rock.scale.x,-box.min.y*rock.scale.y,-center.z*rock.scale.z);node.add(rock);scene.add(node);coverNodes.set(row.id,node);}node.position.set(row.x,0,row.z);}
   projectiles=shots.map(row=>({pos:new V(row.x,1.3,row.z),life:1}));
  },
  clear(){particles=[];rings=[];arcs=[];numbers=[];projectiles=[];techniqueVfx?.clear();hero=null;selfBinding=null;for(const node of coverNodes.values())scene?.remove(node);coverNodes.clear();},
  draw(snapshot,dt){
   lastFrame=snapshot;clock+=dt;game.time+=dt;game.phase=snapshot.status;game.shake=Math.max(0,game.shake-dt*.9);game.hitstop=Math.max(0,game.hitstop-dt);
   for(const p of particles){p.life-=dt;p.vel.y-=dt*6;p.pos.addScaledVector(p.vel,dt);}particles=particles.filter(p=>p.life>0);
   for(const row of [...rings,...arcs])row.life-=dt;rings=rings.filter(row=>row.life>0);arcs=arcs.filter(row=>row.life>0);draw(dt);
  }
 });
 async function prepareDriven({assetBase}={}){
  makeRenderer();notify('ASSET_LOADING');
  const loaded=await loadNocturneAssets({loader:new GLTFLoader(),signal,base:assetBase,onProgress:(done,total)=>notify('ASSET_LOADING',done+'/'+total)});
  if(disposed||signal.aborted)return;
  models=loaded.models;loadedBytes=loaded.byteLength;for(const key of models.keys())usedModels.add(key);
  for(const [key,gltf]of models){gltf.scene.updateMatrixWorld(true);gltf.scene.traverse(o=>{if(o.isMesh){o.userData.assetSource=key;o.castShadow=true;o.receiveShadow=true;}});}
  buildNocturneEnvironment({THREE,V,TAU,models,scene,environmentMeshes,torches,rand,randRange});
  game.ready=true;game.phase='battle';await withTimeout(renderer.compileAsync(scene,camera),20000,'Shader preparation timed out');notify('READY');
 }
 function renderSelfPortrait(canvas){
  if(!canvas||!selfBinding||!renderer||!scene)return false;
  const width=Math.max(32,Math.floor(Number(canvas.width)||96)),height=Math.max(32,Math.floor(Number(canvas.height)||96));
  if(!portraitTarget||portraitTarget.width!==width||portraitTarget.height!==height){portraitTarget?.dispose();portraitTarget=new THREE.WebGLRenderTarget(width,height,{depthBuffer:true,stencilBuffer:false});portraitTarget.texture.colorSpace=THREE.SRGBColorSpace;portraitPixels=new Uint8Array(width*height*4);}
  const portraitCamera=new THREE.PerspectiveCamera(27,width/height,.1,20),focus=selfBinding.pos.clone().add(new V(0,selfBinding.height*.66,0)),yaw=selfBinding.object.rotation.y,front=new V(Math.sin(yaw),0,Math.cos(yaw));
  portraitCamera.position.copy(focus).addScaledVector(front,selfBinding.height*.76).add(new V(0,selfBinding.height*.035,0));portraitCamera.lookAt(focus);portraitCamera.layers.set(7);portraitCamera.updateMatrixWorld();
  selfBinding.object.traverse(node=>node.layers?.enable(7));scene.traverse(node=>{if(node.isLight)node.layers.enable(7);});
  const targetBefore=renderer.getRenderTarget(),clearBefore=renderer.getClearColor(new THREE.Color()).clone(),alphaBefore=renderer.getClearAlpha(),autoBefore=renderer.autoClear;
  try{
   renderer.setRenderTarget(portraitTarget);renderer.setClearColor('#13231f',1);renderer.autoClear=true;renderer.clear(true,true,true);renderer.render(scene,portraitCamera);renderer.readRenderTargetPixels(portraitTarget,0,0,width,height,portraitPixels);
   const context=canvas.getContext('2d');if(!context)return false;const image=context.createImageData(width,height);
   for(let y=0;y<height;y++){const source=(height-1-y)*width*4,dest=y*width*4;image.data.set(portraitPixels.subarray(source,source+width*4),dest);}
   context.putImageData(image,0,0);return true;
  }catch{return false;}finally{renderer.setRenderTarget(targetBefore);renderer.setClearColor(clearBefore,alphaBefore);renderer.autoClear=autoBefore;}
 }
 return Object.freeze({prepare:prepareDriven,present:(snapshot,dt,events)=>driver.present(presentBattleFrame(snapshot),dt,presentBattleEvents(events||[])),renderSelfPortrait,resize,
  cameraVector(axis){const forward=new V();camera.getWorldDirection(forward);forward.y=0;forward.normalize();return new V().crossVectors(forward,new V(0,1,0)).multiplyScalar(axis.x).addScaledVector(forward,-axis.y).normalize();},
  anchor(){if(!hero)return null;return project(hero.pos.clone().add(new V(0,hero.height,0)));},
  footAnchor(){if(!selfBinding)return null;return project(selfBinding.pos.clone().add(new V(0,.03,0)));},
  metrics:()=>({...metrics(),...driver.metrics(),authority:'rinne-domain',cameraProjection:camera?.isPerspectiveCamera?'perspective':'orthographic',sharedCamera:Boolean(cameraPresentation)}),snapshot:()=>lastFrame,
  clear:()=>driver.reset(),dispose(){portraitTarget?.dispose();portraitTarget=null;portraitPixels=null;driver.dispose();destroy();}});
}
if(presentationPort)presentationPort.install(createDrivenPort());

function inspectActors(){return actors.map(a=>({kind:a.kind,hp:a.hp,dead:a.dead,deathTime:a.deathTime,position:a.pos.toArray(),animation:a.actionName,animationTime:a.action?.time||0,attack:a.attack?.time||0,fatigue:a.fatiguePresentation}));}
function inspectBattle(bootEpoch){
 if(!game.ready||disposed)return null;
 return createBattleObservation({authority:rules?'johakyu-review':'native-demo',battleId:`battle2:${bootEpoch}:${rounds}`,timeSeconds:game.time,status:game.phase,
  actors:actors.map(a=>({id:rules?.inspect(a).id??a.object.uuid,side:a.kind==='hero'?'hero':'enemy',position:a.pos.toArray(),hp:a.hp,maxHp:a.maxHp,dead:rules?.inspect(a).dead??a.dead,incapacitated:rules?.inspect(a).incapacitated??a.dead,body:rules?.inspect(a).body??null,stamina:rules?.inspect(a).stamina??null,phase:rules?.inspect(a).phase??null,techniqueId:rules?.inspect(a).techniqueId??null,animation:a.actionName})),events:rules?.snapshot().events??[]});
}
function advance(seconds){if(!game.ready||disposed||!Number.isFinite(seconds)||seconds<=0||seconds>30)throw Error('Invalid evidence advancement');for(let i=0;i<Math.ceil(seconds*60);i++){simulate(1/60);clock+=1/60;}draw();return metrics();}
function destroy(){
 if(disposed)return;disposed=true;game.ready=false;renderer?.setAnimationLoop(null);
 for(const a of actors)removeActor(a);actors=[];techniqueVfx?.dispose();techniqueVfx=null;
 const geometries=new Set(),materials=new Set(),textures=new Set();
 const gather=root=>root?.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
 gather(scene);for(const gltf of models.values())gather(gltf.scene);for(const r of [...textures,...materials,...geometries])r.dispose();
 for(const p of composer?.passes||[])p.dispose?.();composer?.dispose();renderer?.dispose();models.clear();
}
return Object.freeze({prepare,resize,metrics,inspectActors,inspectBattle,advance,destroy,fail,trace});

}
