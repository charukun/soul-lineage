import * as T from '../vendor/three.js';
import {clone as cloneSkeleton} from '../vendor/SkeletonUtils.js';
import {GLTFLoader} from '../vendor/GLTFLoader.js';
import {VRMLoaderPlugin,VRMUtils} from '../vendor/three-vrm.module.js';
import {createRetargetedClips} from './motions.js';
import {retargetBank} from './extension-functions.js';
import catalog from './manifest.js';
import motionCatalog from './motion-catalog.js';
import {profiles,weaponSockets} from './rig-profiles.js';
const clamp=T.MathUtils.clamp, PI=Math.PI, TAU=2*PI, v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x)};
const Q=()=>new T.Quaternion(), M=()=>new T.Matrix4();
function socketOrientation(dir,roll=0){dir=dir.clone().normalize();let z=v(0,0,1);if(Math.abs(z.dot(dir))>.92)z=v(0,1,0);const x=dir.clone().cross(z).normalize();z=x.clone().cross(dir).normalize();return Q().setFromRotationMatrix(M().makeBasis(x,dir,z)).multiply(Q().setFromAxisAngle(v(0,1,0),roll));}
const CARRY_OFFSET=[-.24,.05,-.08],CARRY_EULER=[-2.10,.08,-.18];
function keys(rows,p){if(p<=rows[0][0])return rows[0][1].slice();if(p>=rows.at(-1)[0])return rows.at(-1)[1].slice();let i=0;while(p>rows[i+1][0])i++;const a=rows[i],b=rows[i+1],t=smooth((p-a[0])/(b[0]-a[0]));return a[1].map((x,j)=>T.MathUtils.lerp(x,b[1][j],t));}
function trackPose(bones){const out={};for(const [n,b] of Object.entries(bones))out[n]={p:b.position.clone(),q:b.quaternion.clone()};return out;}
function applyPose(bones,p){for(const [n,t] of Object.entries(p)){if(bones[n]){bones[n].position.copy(t.p);bones[n].quaternion.copy(t.q);}}}
function poseClip(name,bones,pose){const tracks=[];for(const [n,b]of Object.entries(bones)){tracks.push(new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',[0,1],[...pose[n].q.toArray(),...pose[n].q.toArray()]));if(n==='hips')tracks.push(new T.VectorKeyframeTrack(b.uuid+'.position',[0,1],[...pose[n].p.toArray(),...pose[n].p.toArray()]));}return new T.AnimationClip(name,1,tracks);}
function evaluateTracks(clip,t,bonesByName){for(const tr of clip.tracks){const dot=tr.name.lastIndexOf('.'),name=tr.name.slice(0,dot),prop=tr.name.slice(dot+1),node=bonesByName[name];if(!node)continue;const value=(tr._tbInterpolator??=tr.createInterpolant()).evaluate(clamp(t,0,clip.duration));if(prop==='quaternion')node.quaternion.fromArray(value).normalize();else if(prop==='position')node.position.fromArray(value);}}
export class HumanoidRuntime{
 constructor(api){this.api=api;this.catalog=catalog;this.current=null;this.token=0;this.clock=0;this.errors=[];this.modelId='A';this.ready=false;this.height=2.02;this.motionSource='Expanded Review';this.sourceInfo={models:5,embeddedAnimations:0,sharedVRMA:13,reviewAuthored:5,sourceAttack:'unarmed jab/cross',sourceDeath:false};this.testOverride=null;}
 async load(id){const m=catalog.find(x=>x.id===id);if(!m)throw Error('未知のHumanoid: '+id);if(this.current?.id===id)return this.current;const token=++this.token;this.api.status?.(m.name+'：モデル・モーションを展開中');
  const loader=new GLTFLoader();loader.register(p=>new VRMLoaderPlugin(p));const boot=window.__RINNE_BOOT__;
  await boot?.step({stage:'model',message:m.name+' のデータを読み込んでいます'});
  const report=p=>boot?.progress({stage:'model',message:m.name+' のデータを読み込んでいます',...p,unit:'bytes'});
  const data=boot?await boot.readAsset(id,m.file,report):window.assetBuffer?await window.assetBuffer(id):await(await fetch(m.file)).arrayBuffer();
  await boot?.step({stage:'model',message:m.name+' の形・骨格・テクスチャを組み立てています'});
  const gltf=await loader.parseAsync(data,'');const vrm=gltf.userData.vrm;if(!vrm)throw Error('VRM Humanoid情報がありません');VRMUtils.rotateVRM0(vrm);if(vrm.lookAt)vrm.lookAt.autoUpdate=false;vrm.update(0);vrm.scene.updateMatrixWorld(true);
  const bbox=new T.Box3().setFromObject(vrm.scene),sourceHeight=bbox.max.y-bbox.min.y;
  const bones={},raw={},byName={};for(const name of Object.keys(vrm.humanoid.normalizedHumanBones)){const b=vrm.humanoid.getNormalizedBoneNode(name);if(b){bones[name]=b;raw[name]=vrm.humanoid.getRawBoneNode(name);byName[b.name]=b;byName[b.uuid]=b;}}
  const required=['hips','spine','head',...['left','right'].flatMap(s=>['UpperArm','LowerArm','Hand','UpperLeg','LowerLeg','Foot'].map(n=>s+n))];const missing=required.filter(n=>!bones[n]);if(missing.length)throw Error('不足ボーン: '+missing.join(','));
  const rest=trackPose(bones),review=createRetargetedClips(vrm),shared=await retargetBank(vrm);applyPose(bones,rest);vrm.update(0);vrm.scene.updateMatrixWorld(true);
  await boot?.step({stage:'render',message:'武器・姿勢・描画の準備を仕上げています'});
  const unit=this.height/sourceHeight,root=new T.Group();root.name='TidebreakHumanoid:'+id;root.add(vrm.scene);vrm.scene.position.y=-bbox.min.y;root.scale.setScalar(unit);root.updateMatrixWorld(true);
  const c={id,m,vrm,gltf,bones,raw,byName,rest,review,shared,root,unit,sourceHeight,floorOffset:-bbox.min.y,profile:profiles[id]||profiles.A,mixer:new T.AnimationMixer(vrm.scene),actions:new Map(),state:null,phase:0,clock:0,blending:null,lastActual:null,lastActorId:null,footLocks:{},generated:{},socketReports:{},sockets:{},shadowMeshes:[],materials:[],lastDrawClock:-1,echoes:[],resetSpring:true,materialState:[]};
  // Calibrate neutral anatomy at source scale; all production poses are sampled under unit actor root.
  root.scale.setScalar(1);root.updateMatrixWorld(true);
  c.neutralPoints={};for(const n of ['hips','head','leftHand','rightHand','leftUpperArm','rightUpperArm','leftFoot','rightFoot','leftUpperLeg','rightUpperLeg'])c.neutralPoints[n]=bones[n].getWorldPosition(v());
  c.shoulderY=(c.neutralPoints.leftUpperArm.y+c.neutralPoints.rightUpperArm.y)/2;c.legLength=c.neutralPoints.hips.y-(c.neutralPoints.leftFoot.y+c.neutralPoints.rightFoot.y)/2;
  for(const side of ['right','left'])this.calibrateSocket(c,side);
  c.locomotion=this.measureLocomotion(c);c.generated.Death=this.makeDeath(c);applyPose(bones,rest);vrm.update(0);root.scale.setScalar(unit);root.updateMatrixWorld(true);
  vrm.scene.traverse(o=>{if(o.isMesh){o.frustumCulled=false;for(const mat of Array.isArray(o.material)?o.material:[o.material]){if(!c.materials.includes(mat))c.materials.push(mat);if(mat.map)mat.map.anisotropy=2;}const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking,side:T.DoubleSide,alphaTest:.35,map:(Array.isArray(o.material)?o.material[0]:o.material)?.map||null});let proxy;if(o.isSkinnedMesh){proxy=new T.SkinnedMesh(o.geometry,depth);proxy.bind(o.skeleton,o.bindMatrix);proxy.bindMode=o.bindMode;}else proxy=new T.Mesh(o.geometry,depth);proxy.frustumCulled=false;proxy.matrixAutoUpdate=false;proxy.userData.source=o;c.shadowMeshes.push(proxy);}});
  c.materialState=c.materials.map(m=>({m,color:m.color?.clone(),shade:m.shadeColorFactor?.clone(),opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite}));
  if(token!==this.token){this.dispose(c);return null;}const old=this.current;this.current=c;this.modelId=id;this.ready=true;this.api.attach?.(c);if(old)this.dispose(old);this.api.status?.(m.name+' · Humanoid '+Object.keys(bones).length+' bones');return c;
 }
 calibrateSocket(c,side){const hand=c.raw[side+'Hand'],nh=c.bones[side+'Hand'],hp=hand.getWorldPosition(v()),hq=hand.getWorldQuaternion(Q()),nq=nh.getWorldQuaternion(Q());const knuckle=n=>c.raw[side+n]?.getWorldPosition(v());const middle=knuckle('MiddleProximal')||knuckle('IndexProximal'),index=knuckle('IndexProximal'),little=knuckle('LittleProximal');let long=middle?.clone().sub(hp)||v(side==='right'?-1:1,0,0).multiplyScalar(.075);
  const across=(index&&little?index.clone().sub(little):v(0,1,0)).normalize();const X=long.clone().normalize(),Y=across.addScaledVector(X,-across.dot(X)).normalize(),Z=X.clone().cross(Y).normalize();const worldQ=Q().setFromRotationMatrix(M().makeBasis(X,Y,Z));const inset=c.profile.palmInset;const center=hp.clone().addScaledVector(long,c.profile.palmAlong).addScaledVector(Z,side==='right'?-inset:inset);
  const localP=hand.worldToLocal(center.clone()),localQ=hq.clone().invert().multiply(worldQ);const socket=new T.Group();socket.name='WeaponSocket_'+side;socket.position.copy(localP);socket.quaternion.copy(localQ);hand.add(socket);
  const np=nh.worldToLocal(center.clone()),nrot=nq.clone().invert().multiply(worldQ);c.sockets[side]={node:socket,normOffset:np,normRotation:nrot,rawOffset:localP,rawRotation:localQ,palmLength:long.length()};c.socketReports[side]={bone:hand.name,normalizedBone:nh.name,position:localP.toArray(),quaternion:localQ.toArray(),palmLength:long.length(),calibration:'Index/Middle/Little proximal palm basis + model profile'};
 }
 dispose(c){this.clearEchoes(c);c.mixer.stopAllAction();c.mixer.uncacheRoot(c.vrm.scene);c.root.removeFromParent();for(const s of c.shadowMeshes){s.removeFromParent();s.material.dispose();}VRMUtils.deepDispose(c.vrm.scene);}
 resetRoot(c){c.root.position.set(0,0,0);c.root.quaternion.identity();c.root.scale.setScalar(1);c.root.updateMatrixWorld(true);}
 resetBones(c){applyPose(c.bones,c.rest);}
 point(c,name){return c.bones[name].getWorldPosition(v());}
 aim(c,bone,child,target){const b=c.bones[bone],ch=c.bones[child],direction=target.clone().sub(b.getWorldPosition(v())).applyQuaternion(b.parent.getWorldQuaternion(Q()).invert()).normalize();b.quaternion.setFromUnitVectors(ch.position.clone().normalize(),direction);b.updateWorldMatrix(false,true);}
 solve(c,side,limb,target,pole){const [an,bn,en]=limb==='leg'?[side+'UpperLeg',side+'LowerLeg',side+'Foot']:[side+'UpperArm',side+'LowerArm',side+'Hand'];const A=this.point(c,an),B=this.point(c,bn),C=this.point(c,en),l1=A.distanceTo(B),l2=B.distanceTo(C),d=target.clone().sub(A),r=clamp(d.length(),Math.abs(l1-l2)+.0001,l1+l2-.0002);d.normalize();const dest=A.clone().addScaledVector(d,r),bend=pole.clone().addScaledVector(d,-pole.dot(d));if(bend.lengthSq()<.00001)bend.set(0,0,1);bend.normalize();const x=(l1*l1-l2*l2+r*r)/(2*r),h=Math.sqrt(Math.max(0,l1*l1-x*x)),joint=A.clone().addScaledVector(d,x).addScaledVector(bend,h);this.aim(c,an,bn,joint);this.aim(c,bn,en,dest);return dest;}
 setWorldQ(c,name,q){const b=c.bones[name];b.quaternion.copy(b.parent.getWorldQuaternion(Q()).invert()).multiply(q);b.updateWorldMatrix(false,true);}
 curl(c,side,amount=1){const sign=side==='left'?-1:1;for(const finger of ['Index','Middle','Ring','Little'])for(const [seg,k]of [['Proximal',1.10],['Intermediate',1.30],['Distal',.85]]){const b=c.bones[side+finger+seg];if(b)b.quaternion.setFromAxisAngle(v(0,1,0),sign*k*amount);}for(const [seg,k]of [['Metacarpal',.35],['Proximal',.70],['Distal',.55]]){const b=c.bones[side+'Thumb'+seg];if(b)b.quaternion.setFromAxisAngle(v(0,1,0),sign*k*amount);}}
 makeDeath(c){this.resetRoot(c);const tracks={},times=[],duration=1.20,steps=48;for(const n of Object.keys(c.bones))tracks[n]=[];const hips=[];for(let i=0;i<=steps;i++){const t=i/steps;times.push(t*duration);this.resetBones(c);evaluateTracks(c.review.clips['Hit Reaction'],Math.min(.65,t*1.3),c.byName);const drop=smooth((t-.10)/.72),roll=smooth((t-.25)/.65),h=c.bones.hips;c.root.updateMatrixWorld(true);
  h.position.y=c.rest.hips.p.y-(c.legLength*.77)*drop;h.position.x=c.rest.hips.p.x+.20*c.legLength*roll;const flip=c.vrm.meta.metaVersion==='1'?-1:1;h.quaternion.setFromEuler(new T.Euler(.18*drop*flip,0,-1.18*roll*flip,'YXZ'));if(c.bones.spine)c.bones.spine.quaternion.setFromEuler(new T.Euler(.18*flip,0,-.28*roll*flip));for(const side of ['left','right']){const s=side==='left'?1:-1;const ul=c.bones[side+'UpperLeg'],ll=c.bones[side+'LowerLeg'];ul.quaternion.setFromEuler(new T.Euler(-.65*drop*flip,0,s*.20*drop*flip));ll.quaternion.setFromEuler(new T.Euler(1.14*drop*flip,0,0));}for(const[n,b]of Object.entries(c.bones))tracks[n].push(...b.quaternion.toArray());hips.push(...h.position.toArray());}
  const out=Object.entries(c.bones).map(([n,b])=>new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,tracks[n]));out.push(new T.VectorKeyframeTrack(c.bones.hips.uuid+'.position',times,hips));return new T.AnimationClip('Tidebreak_Death_Authored',duration,out);
 }
 // Source body/root/leg animation is retained. Armed upper-body keys below are new work,
 // intentionally independent of Tidebreak's old procedural hand/tip animation.
 combatPose(c,weapon,kind,p,baseTime=0){const H=c.shoulderY,L=c.legLength,s=L/.82,def=!!this.api.strikes[kind]?.defense||['none','ready','retreat'].includes(kind),attack=!!kind&&!def;
  if(attack){evaluateTracks(c.review.clips.Attack,clamp(p,0,1)*2.3,c.byName);}else evaluateTracks(c.shared['idle-01'],baseTime%c.shared['idle-01'].duration,c.byName);
  c.root.updateMatrixWorld(true);
  if(weapon==='fist')return;
  const spec=weaponSockets[weapon]||weaponSockets.sword;
  let grip=v(-.19*s,H-.37*s,.35*s),dir=v(.16,.92,.38),roll=0;
  if(spec.two){grip=v(-.02*s,H-.45*s,.43*s);dir=v(.04,.48,.87);}
  if(weapon==='great'||weapon==='axe'){grip=v(-.14*s,H-.30*s,.32*s);dir=v(-.32,.94,-.15);}
  if(weapon==='spear'){grip=v(-.12*s,H-.42*s,.27*s);dir=v(.02,.10,1);}
  if(attack){let row=this.attackPath(weapon,kind,p,H,s);grip.fromArray(row.grip);dir.fromArray(row.dir);roll=row.roll||0;
   const flip=c.vrm.meta.metaVersion==='1'?-1:1;const twist=row.twist||0;c.bones.hips.quaternion.setFromEuler(new T.Euler(-.035*flip,twist*.36,0,'YXZ'));c.bones.spine.quaternion.setFromEuler(new T.Euler(-.07*flip,twist*.42,0,'YXZ'));if(c.bones.chest)c.bones.chest.quaternion.setFromEuler(new T.Euler(-.025*flip,twist*.22,0,'YXZ'));c.bones.head.quaternion.setFromEuler(new T.Euler(.035*flip,-twist*.43,0,'YXZ'));
  }
  c.root.updateMatrixWorld(true);
  this.attachHands(c,weapon,grip,dir,roll,1);
 }
 attackPath(weapon,kind,p,H,s){let phase=p,index=0;const windows=this.api.windows[kind]||[this.api.clips[kind]?.active||[.34,.68]];if(windows.length>1){index=windows.findIndex((w,i)=>p<(w[1]+(windows[i+1]?.[0]??1))/2);if(index<0)index=windows.length-1;const lo=index?((windows[index-1][1]+windows[index][0])/2):0,hi=index===windows.length-1?1:(windows[index][1]+windows[index+1][0])/2;phase=(p-lo)/(hi-lo);}
  const w=windows[index],hit=(w[0]+w[1])/2;let contact=windows.length===1?(this.api.clips[kind]?.contact??hit):.5;contact=clamp(contact,.3,.7);let swing=phase<contact?smooth((phase-.13)/(contact-.13)):.5+.5*smooth((phase-contact)/(Math.min(.92,contact+.29)-contact));if(phase<contact)swing*=.5;swing=clamp(swing,0,1);
  let isThrust=/thrust|pierce|sky|straight|oneinch/i.test(kind)||weapon==='spear'&&!/sweep|wheel|round|spin/.test(kind);let heavy=/heavy|leap|meteor/.test(kind),reverse=/back|Return|uppercut/.test(kind)||(index%2===1),low=/sweep/.test(kind),spin=/spin|round|wheel/.test(kind);
  if(isThrust){const ext=Math.sin(clamp((phase-.15)/.7,0,1)*PI),z=.20+.38*ext;return{grip:[-.035*s,H-.29*s,z*s],dir:[0,.05,1],twist:-.22+.47*ext};}
  if(kind==='pommel'){return{grip:[-.04*s,H-.33*s,(.25+.31*Math.sin(p*PI))*s],dir:[.09,.25,-1],twist:.15*Math.sin(p*PI)};}
  const start=reverse?-1.55:1.55,end=reverse?1.50:-1.50,yaw=T.MathUtils.lerp(start,end,swing);
  let dir;if(heavy){const theta=swing<.5?T.MathUtils.lerp(-1.10,Math.PI/2,swing*2):T.MathUtils.lerp(Math.PI/2,2.10,(swing-.5)*2);dir=[0,Math.cos(theta),Math.sin(theta)];}else{dir=[Math.sin(yaw),low?-.23:(reverse?(-.4+swing*.95):(.5-swing*.64)),Math.cos(yaw)];}
  if(spin){const yaw=(phase-.5)*TAU*1.12;dir=[Math.sin(yaw),.12,Math.cos(yaw)];}
  const gx=-.03+.28*Math.sin(yaw),gy=H-(heavy?(.19+.12*swing):low?.55:.30)*s,gz=.26+.24*Math.sin(swing*PI);return{grip:[gx*s,gy,gz*s],dir,twist:T.MathUtils.lerp(-.45,.55,swing)*(reverse?-1:1),roll:weapon==='katana'?PI/2:0};
 }
 attachHands(c,weapon,grip,dir,roll=0,weight=1,forcedQ=null,supportWeight=1){const spec=weaponSockets[weapon]||weaponSockets.sword;const wanted=forcedQ?.clone()||socketOrientation(dir,roll);
  // Project the shared grip into the intersection of both anatomical reach spheres.
  // This preserves arm lengths and prevents an unreachable support hand from floating.
  grip=grip.clone();if(spec.two&&supportWeight>0){const constraints=['right','left'].map(side=>{const hs=c.sockets[side],hq=wanted.clone().multiply(hs.normRotation.clone().invert()),offset=hs.normOffset.clone().applyQuaternion(hq),delta=side==='left'?v(...spec.left).sub(v(...spec.grip)).multiplyScalar(spec.scale/c.unit).applyQuaternion(wanted):v(),upper=this.point(c,side+'UpperArm'),lower=this.point(c,side+'LowerArm'),end=this.point(c,side+'Hand');return{strength:side==='left'?supportWeight:1,center:upper.clone().add(offset).sub(delta),radius:(upper.distanceTo(lower)+lower.distanceTo(end))*.965};});for(let i=0;i<20;i++)for(const k of constraints){const delta=grip.clone().sub(k.center),d=delta.length();if(d>k.radius)grip.lerp(k.center.clone().addScaledVector(delta,k.radius/d),k.strength);}}
  const drive=(side,target,q)=>{const socket=c.sockets[side],handQ=q.clone().multiply(socket.normRotation.clone().invert()),offset=socket.normOffset.clone().applyQuaternion(handQ),wrist=target.clone().sub(offset);const sign=side==='right'?-1:1;this.solve(c,side,'arm',wrist,v(sign*.55,-.95,-.12));this.setWorldQ(c,side+'Hand',handQ);this.curl(c,side,weight);};
  drive('right',grip,wanted);if(weapon==='sword')drive('left',v(.24*c.legLength/.82,c.shoulderY-.36*c.legLength/.82,.31*c.legLength/.82),Q());c.root.updateMatrixWorld(true);const right=this.normalSocket(c,'right');const weaponM=right.clone().multiply(M().makeTranslation(...spec.grip.map(n=>-n/c.unit))).scale(v(spec.scale/c.unit,spec.scale/c.unit,spec.scale/c.unit));if(spec.two&&supportWeight>0){const names=['UpperArm','LowerArm','Hand'].map(n=>'left'+n),before=names.map(n=>c.bones[n].quaternion.clone()),left=v(...spec.left).applyMatrix4(weaponM);drive('left',left,wanted);if(supportWeight<1)names.forEach((n,i)=>c.bones[n].quaternion.copy(before[i].slerp(c.bones[n].quaternion.clone(),supportWeight)));}
 }
 normalSocket(c,side){const b=c.bones[side+'Hand'],s=c.sockets[side];return b.matrixWorld.clone().multiply(M().compose(s.normOffset,s.normRotation,v(1,1,1)));}
 descriptor(a,at){const c=this.current,offset=at!=null&&a.attack?at-a.attack.t:0;let clock=(a._humanoidClock||0)+offset;if(this.testOverride)return{...this.testOverride,key:'test:'+this.testOverride.key,clock};if(a.dead)return{key:'death:'+a.id,type:'death',time:a.deadTime||0,clock};if(a.reaction)return{key:'hit:'+a.id+':'+(a._hitSerial||0),type:'hit',time:a.reaction.t/Math.max(.1,a.reaction.duration)*1.3,clock};if(a.recovery)return{key:'recover:'+a.recovery.recipe.receive,type:'recovery',time:a.recovery.t/a.recovery.duration*1.8,clock};if(a.attack)return{key:'attack:'+a.attack.id,type:'attack',kind:a.attack.kind,time:this.api.progress(a,at),clock};if(a.parryMotion)return{key:'parry:'+a.parryMotion.sourceId,type:'parry',time:a.parryMotion.t/a.parryMotion.duration,clock};if(a.zanshin)return{key:'zanshin:'+a.zanshin.id,type:'zanshin',emote:a.zanshin.id,time:a.zanshin.t/a.zanshin.duration,clock};const speed=Math.hypot(a.vx||0,a.vz||0);if(speed>.10)return{key:'move',type:speed>2.4?'run':'walk',time:a._humanoidPhase||0,clock,speed};return{key:a.combatReady||a.weaponTransition?'combat':'idle',type:a.combatReady||a.weaponTransition?'combat':'idle',time:clock,clock};}
 action(c,clip){if(!c.actions.has(clip.uuid)){const a=c.mixer.clipAction(clip);a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true;c.actions.set(clip.uuid,a);}return c.actions.get(clip.uuid);}
 sample(a,at=null,px=a.x,pz=a.z,commit=false){const c=this.current;if(!c||!a.hero)return null;this.resetRoot(c);this.resetBones(c);const d=this.descriptor(a,at),weapon=a.weapon||'sword';if(c.lastActorId!==a.id){this.clearEchoes(c);c.state=null;c.lastActual=null;c.footLocks={};c.lastActorId=a.id;c.resetSpring=true;}let clip,time=0;
  if(d.type==='death'){clip=c.generated.Death;time=Math.min(d.time,clip.duration);}
  else if(d.type==='hit'||d.type==='recovery'){clip=c.review.clips['Hit Reaction'];time=d.time;}
  else if(d.type==='walk'||d.type==='run'){clip=c.shared[d.type==='run'?'run-slow':'walk'];time=((d.time%1+1)%1)*clip.duration;}
  else if(d.type==='attack'){if(weapon==='fist'){clip=c.generated['fist:'+d.kind]??=this.bakeFist(c,d.kind);time=d.time;}
   else{const k=weapon+':'+d.kind;clip=c.generated[k]??=this.bakeArmed(c,weapon,d.kind);time=d.time;}}
  else if(d.type==='parry'){clip=c.generated[weapon+':parry']??=this.bakeArmed(c,weapon,'parry');time=d.time;}
  else if(d.type==='zanshin'){const id=d.emote||'quiet';clip=c.generated['emote:'+weapon+':'+id]??=this.bakeEmote(c,weapon,id);time=clamp(d.time,0,1);}
  else if(weapon==='fist'&&d.type==='combat'){clip=c.review.clips.Attack;time=.23+.012*Math.sin(d.clock*2.1);}
  else{clip=c.shared['idle-01'];time=d.time%clip.duration;}
  if(!clip)throw Error('Animation Clip未解決: '+d.type);
  if(c.state!==d.key){if(c.blending){c.mixer.uncacheClip(c.blending.clip);c.actions.delete(c.blending.clip.uuid);}c.blending=c.lastActual?{pose:c.lastActual,clip:poseClip('Transition:'+d.key,c.bones,c.lastActual),start:d.clock,duration:d.type==='hit'?.08:d.type==='death'?.12:d.type==='attack'?.10:.18}:null;c.state=d.key;}
  c.mixer.stopAllAction();this.resetBones(c);const action=this.action(c,clip);action.reset().play();action.paused=true;action.time=clamp(time,0,clip.duration);let weight=c.blending?smooth((d.clock-c.blending.start)/c.blending.duration):1;action.setEffectiveWeight(weight);
  if(c.blending&&weight<1){const old=this.action(c,c.blending.clip);old.reset().play();old.paused=true;old.time=0;old.setEffectiveWeight(1-weight);}c.mixer.update(0);c.root.updateMatrixWorld(true);
  // Armed clip already contains both gripping hands. Non-attack layers retain source legs/torso.
  if(!['attack','death','zanshin'].includes(d.type)&&weapon!=='fist'&&((a.weaponDraw??1)>0||d.type==='combat')){
   const srcPose=trackPose(c.bones),H=c.shoulderY,s=c.legLength/.82,ready=d.type==='combat'||d.type==='parry'||d.type==='recovery'||a.combatReady;
   let grip=v(-.20*s,H-(ready?.37:.65)*s,(ready?.34:.13)*s),dir=v(.1,ready?.90:-.75,ready?.40:.50);
   if(weaponSockets[weapon].two){grip=v(-.03*s,H-.43*s,.42*s);dir=weapon==='spear'?v(.03,.12,1):v(.04,.57,.82);}if(['great','axe'].includes(weapon)){grip=v(-.12*s,H-.33*s,.33*s);dir=v(-.30,.91,-.12);}
   if(d.type==='walk'||d.type==='run'){grip.y+=Math.sin((a._humanoidPhase||0)*TAU*2)*.018*s;grip.z+=Math.sin((a._humanoidPhase||0)*TAU)*.025*s;}
   let desiredQ=null,supportWeight=1;const draw=clamp(a.weaponDraw??1,0,1);
   if(draw<1&&!['hit','recovery','parry','zanshin'].includes(d.type)){
    // Reach to the hip socket first. Only then transfer the weapon to the hand.
    // Both attachment frames coincide at the hand-off; no floating interpolation of the weapon.
    const carryGrip=this.point(c,'hips').add(v(...CARRY_OFFSET).multiplyScalar(1/c.unit)),carryQ=Q().setFromEuler(new T.Euler(...CARRY_EULER));
    if(draw<=.25){const start=this.normalSocket(c,'right'),startP=v(),startQ=Q(),startScale=v();start.decompose(startP,startQ,startScale);const reach=smooth(draw/.25);grip=startP.lerp(carryGrip,reach);desiredQ=startQ.slerp(carryQ,reach);}
    else{const lift=smooth((draw-.25)/.75),combatQ=socketOrientation(dir);grip=carryGrip.lerp(grip,lift);grip.y+=Math.sin(lift*PI)*.13*s;desiredQ=carryQ.slerp(combatQ,lift);}
    supportWeight=smooth((draw-.30)/.45);
   }
   this.attachHands(c,weapon,grip,dir,0,1,desiredQ,supportWeight);
   // Preserve snapshot transition on the upper body as well (IK never pops at the state boundary).
   if((a.weaponDraw??1)>=1&&c.blending&&weight<1)for(const side of ['left','right'])for(const bone of ['UpperArm','LowerArm','Hand']){const n=side+bone;const targetQ=c.bones[n].quaternion.clone();c.bones[n].quaternion.copy(c.blending.pose?.[n]?.q||srcPose[n].q).slerp(targetQ,weight);}
  }else if(weapon==='fist'){this.curl(c,'right',1);this.curl(c,'left',1);}
  c.root.updateMatrixWorld(true);
  if(weaponSockets[weapon]?.two&&d.type!=='death'&&(a.weaponDraw??1)>=.75){const m=this.normalSocket(c,'right'),gp=v(),gq=Q(),gs=v();m.decompose(gp,gq,gs);this.attachHands(c,weapon,gp,v(0,1,0).applyQuaternion(gq),0,1,gq);c.root.updateMatrixWorld(true);}
  // Keep soles above the ground; this only moves visual hips, never actor/collision root.
  if(d.type!=='death')this.ground(c,a,d,commit);else{this.curl(c,'right',1);c.root.updateMatrixWorld(true);const low=Math.min(...['head','hips','leftHand','rightHand','leftFoot','rightFoot','leftLowerLeg','rightLowerLeg'].map(n=>this.point(c,n).y-(n==='head'?.10:n==='hips'?.085:.025)));c.bones.hips.position.y+=(.025-low)*smooth((d.time-.25)/.60);c.root.updateMatrixWorld(true);}
  c.root.position.set(px,.065+(a.air||0),pz);c.root.rotation.set(0,a.yaw,0);c.root.scale.setScalar(c.unit);c.root.updateMatrixWorld(true);
  const spec=weaponSockets[weapon]||weaponSockets.sword,right=this.normalSocket(c,'right'),left=this.normalSocket(c,'left');const sp=v(),sq=Q(),ss=v();right.decompose(sp,sq,ss);let sm=M().compose(sp,sq,v(1,1,1)).multiply(M().makeTranslation(...spec.grip.map(n=>-n))).scale(v(spec.scale,spec.scale,spec.scale));
  if(weapon==='fist'){const active=this.api.hand(d.kind,d.time)==='left'?left:right;const b=c.bones[(this.api.hand(d.kind,d.time)==='left'?'left':'right')+'Hand'],el=c.bones[(this.api.hand(d.kind,d.time)==='left'?'left':'right')+'LowerArm'];const forward=b.getWorldPosition(v()).sub(el.getWorldPosition(v())).normalize(),X=v(0,1,0).cross(forward).normalize(),Y=forward.clone().cross(X).normalize();sm=M().makeBasis(X,Y,forward).setPosition(new T.Vector3().setFromMatrixPosition(active));}
  const p=this.api.progress(a,at),kind=a.attack?.kind,w=this.api.weapons[weapon],group=this.api.window(kind,p);let A,B,radius=w.width;
  if(weapon==='fist'){A=v(0,0,.035).applyMatrix4(sm);B=v(0,0,.20).applyMatrix4(sm);radius=.135;}
  else if(kind==='pommel'){const back={sword:-.26,great:-.45,axe:-.43,spear:-.69,katana:-.35}[weapon];A=v(0,back+.18,0).applyMatrix4(sm);B=v(0,back-.035,0).applyMatrix4(sm);radius=.135;}
  else{A=v(0,kind==='spearwheel'?-.65:w.base,0).applyMatrix4(sm);B=v(weapon==='katana'?.19:0,w.tip,0).applyMatrix4(sm);}
  let attachment='rightHand';let carry=null;
  if(weapon!=='fist'){
   const hp=c.bones.hips.getWorldPosition(v()),yaw=Q().setFromAxisAngle(v(0,1,0),a.yaw),offset=v(...CARRY_OFFSET).applyQuaternion(yaw),cq=yaw.clone().multiply(Q().setFromEuler(new T.Euler(...CARRY_EULER)));carry=M().compose(hp.clone().add(offset),cq,v(1,1,1)).multiply(M().makeTranslation(...spec.grip.map(n=>-n)));
   if(!a.attack&&!a.recovery&&!a.reaction&&!a.dead&&!a.zanshin&&(a.weaponDraw??1)<=.25){sm=carry.clone();A=v(0,w.base,0).applyMatrix4(sm);B=v(weapon==='katana'?.19:0,w.tip,0).applyMatrix4(sm);attachment='hips';}
  }
  const active=!!a.attack&&!a.dead&&p>=(this.api.clips[kind]?.active[0]??2)&&p<=(this.api.clips[kind]?.active[1]??3)&&group>=0;
  const result={supportAttached:!!spec.two&&(a.weaponDraw??1)>=.75&&d.type!=='death',attachment,carry:carry?.toArray()||null,sm:sm.toArray(),leftSocket:left.toArray(),rightSocket:right.toArray(),weaponBase:A.toArray(),weaponTip:B.toArray(),a:A.toArray(),b:B.toArray(),radius,active,phase:p,group,descriptor:d,clip:clip.name,blend:weight};
  if(commit){c.lastActual=trackPose(c.bones);c.lastResult=result;if(c.resetSpring||(c.lastCommittedRoot&&Math.hypot(px-c.lastCommittedRoot[0],pz-c.lastCommittedRoot[1])>1.25)){c.vrm.update(0);c.vrm.springBoneManager?.reset();c.resetSpring=false;c.lastDrawClock=a._humanoidClock||0;}c.lastCommittedRoot=[px,pz];c.vrm.update(Math.min(.033,Math.max(0,(a._humanoidClock||0)-c.lastDrawClock)));c.root.updateMatrixWorld(true);c.lastDrawClock=a._humanoidClock||0;c.vrm.expressionManager?.setValue('blink',a.dead?1:Math.max(0,1-Math.abs(((a._humanoidClock||0)%4.7)-4.3)/.10));for(const proxy of c.shadowMeshes){proxy.matrix.copy(proxy.userData.source.matrixWorld);proxy.matrixWorldNeedsUpdate=true;proxy.visible=!(a.dead&&a.deadTime>1.53);}this.checkSocket(c,result,weapon);const flash=clamp((a.flash||0)*6.5,0,.84);for(const t of c.materialState){if(t.color)t.m.color.copy(t.color).lerp(new T.Color(1,1,.96),flash);if(t.shade)t.m.shadeColorFactor.copy(t.shade).lerp(new T.Color(1,1,.96),flash);/* Keep MToon's original opaque/cutout render modes: changing them mid-death sorts outlines through the body. Visibility ends with the original replacement interval. */}}
  return result;
 }
 ground(c,a,d,commit){c.root.updateMatrixWorld(true);const left=this.point(c,'leftFoot'),right=this.point(c,'rightFoot');const restL=c.neutralPoints.leftFoot,restR=c.neutralPoints.rightFoot;const floor=Math.min(restL.y,restR.y);let min=Math.min(left.y,right.y),delta=floor-min;if(delta>-.015&&delta<.45){c.bones.hips.position.y+=delta;c.root.updateMatrixWorld(true);}
  // In-place VRMA + distance phase. World-space support IK removes creeping at stops.
  if(['walk','run'].includes(d.type)&&!a.air){
   const sy=Math.sin(a.yaw),cy=Math.cos(a.yaw),vx=(a.vx||0)*cy-(a.vz||0)*sy,vz=(a.vx||0)*sy+(a.vz||0)*cy,angle=Math.atan2(vx,Math.abs(vz)+.001);
   for(const side of ['left','right']){const foot=this.point(c,side+'Foot'),neutral=c.neutralPoints[side+'Foot'],diff=foot.clone().sub(neutral),target=neutral.clone().add(v(diff.x+Math.sin(angle)*diff.z,diff.y,Math.cos(angle)*diff.z));this.solve(c,side,'leg',target,v(0,0,1));}
  }
  if((['walk','run'].includes(d.type)||(d.type==='attack'&&d.time>.44&&d.time<.82))&&!a.air){
   c.root.updateMatrixWorld(true);const positions={left:this.point(c,'leftFoot'),right:this.point(c,'rightFoot')};const low=Math.min(positions.left.y,positions.right.y);const cy=Math.cos(a.yaw),sy=Math.sin(a.yaw);
   const world=p=>v(a.x+(p.x*cy+p.z*sy)*c.unit,.065+p.y*c.unit,a.z+(-p.x*sy+p.z*cy)*c.unit);
   const local=p=>{const x=(p.x-a.x)/c.unit,z=(p.z-a.z)/c.unit;return v(x*cy-z*sy,(p.y-.065)/c.unit,x*sy+z*cy);};
   for(const side of ['left','right']){const f=positions[side],support=f.y<=low+.012;let lock=c.footLocks[side];if(commit&&!support){delete c.footLocks[side];lock=null;}if(support){if(!lock&&commit){lock=world(f);c.footLocks[side]=lock;}if(lock&&world(f).distanceTo(lock)<.30){const footQ=c.bones[side+'Foot'].getWorldQuaternion(Q());this.solve(c,side,'leg',local(lock),v(0,0,1));this.setWorldQ(c,side+'Foot',footQ);}else if(commit)c.footLocks[side]=world(f);}}
  }else if(commit)c.footLocks={};
  if(['idle','combat','parry'].includes(d.type)&&!a.air){for(const side of ['left','right']){const target=c.neutralPoints[side+'Foot'].clone();target.z+=side==='left'?.10:-.10;this.solve(c,side,'leg',target,v(0,0,1));}}
 }
 // Preserve the Review's authored jab/cross trajectories. In multi-hit skills, blend
 // the end and anticipation POSES in the gaps, never rewind source time across a punch.
 bakeFist(c,kind){this.resetRoot(c);const source=c.review.clips.Attack,list=this.api.windows[kind]||[[...(this.api.clips[kind]?.active||[.3,.7]),'right']],times=[],data={},hips=[];for(const n of Object.keys(c.bones))data[n]=[];
  const sourcePose=t=>{this.resetBones(c);evaluateTracks(source,t,c.byName);return trackPose(c.bones);};
  const blend=(a,b,t)=>{for(const n of Object.keys(c.bones)){c.bones[n].quaternion.copy(a[n].q).slerp(b[n].q,t);c.bones[n].position.copy(a[n].p).lerp(b[n].p,t);}};
  const src=w=>w[2]==='left'?[.23,.48,.76]:[.80,1.06,1.45],guard=sourcePose(.23);
  for(let i=0;i<=90;i++){const p=i/90;times.push(p);let idx=list.findIndex(w=>p>=w[0]&&p<=w[1]);
   if(idx>=0){const w=list[idx],s=src(w),contact=(w[0]+w[1])/2,t=p<=contact?T.MathUtils.lerp(s[0],s[1],smooth((p-w[0])/(contact-w[0]))):T.MathUtils.lerp(s[1],s[2],smooth((p-contact)/(w[1]-contact)));this.resetBones(c);evaluateTracks(source,t,c.byName);}
   else{let next=list.findIndex(w=>p<w[0]);if(next===0){blend(guard,sourcePose(src(list[0])[0]),smooth(p/list[0][0]));}else if(next<0){const end=list.at(-1);blend(sourcePose(src(end)[2]),guard,smooth((p-end[1])/(1-end[1])));}else{const a=list[next-1],b=list[next];blend(sourcePose(src(a)[2]),sourcePose(src(b)[0]),smooth((p-a[1])/(b[0]-a[1])));}}
   for(const[n,b]of Object.entries(c.bones)){const q=b.quaternion.toArray(),out=data[n];if(out.length&&q.reduce((sum,x,k)=>sum+x*out[out.length-4+k],0)<0)for(let k=0;k<4;k++)q[k]*=-1;out.push(...q);}hips.push(...c.bones.hips.position.toArray());
  }const tracks=Object.entries(c.bones).map(([n,b])=>new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,data[n]));tracks.push(new T.VectorKeyframeTrack(c.bones.hips.uuid+'.position',times,hips));return new T.AnimationClip('Expanded Review Attack / hit-window blend / '+kind,1,tracks);
 }

 bakeArmed(c,weapon,kind){this.resetRoot(c);const times=[],data={},hips=[],count=90;for(const n of Object.keys(c.bones))data[n]=[];for(let i=0;i<=count;i++){times.push(i/count);this.resetBones(c);this.combatPose(c,weapon,kind,i/count);for(const[n,b]of Object.entries(c.bones)){const q=b.quaternion.toArray(),out=data[n];if(out.length&&q.reduce((sum,x,k)=>sum+x*out[out.length-4+k],0)<0)for(let k=0;k<4;k++)q[k]*=-1;out.push(...q);}hips.push(...c.bones.hips.position.toArray());}const tracks=Object.entries(c.bones).map(([n,b])=>new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,data[n]));tracks.push(new T.VectorKeyframeTrack(c.bones.hips.uuid+'.position',times,hips));return new T.AnimationClip('Tidebreak armed / '+weapon+' / '+kind,1,tracks);}
 measureLocomotion(c){this.resetRoot(c);const out={};for(const [name,id]of [['walk','walk'],['run','run-slow']]){const clip=c.shared[id],samples=[];for(let i=0;i<=96;i++){this.resetBones(c);evaluateTracks(clip,clip.duration*i/96,c.byName);c.root.updateMatrixWorld(true);samples.push(['left','right'].map(side=>this.point(c,side+'Foot').toArray()));}const floor=Math.min(...samples.flatMap(x=>x.map(p=>p[1]))),slopes=[];for(let i=1;i<samples.length;i++)for(let side=0;side<2;side++){const a=samples[i-1][side],b=samples[i][side];if(Math.min(a[1],b[1])<floor+.04&&b[2]<a[2]-.0001)slopes.push((a[2]-b[2])*96*c.unit);}slopes.sort((a,b)=>a-b);const cycleDistance=clamp(slopes[Math.floor(slopes.length/2)]||1.1,.45,3.0);out[name]={clip:id,duration:clip.duration,cycleDistance,method:'measured low-foot backward velocity; distance-matched phase; bounded world support IK'};}return out;}
 tick(a,dt){if(!a?.hero)return;this.clock+=dt;this.updateEchoes();a._humanoidClock=(a._humanoidClock||0)+dt;const speed=Math.hypot(a.vx||0,a.vz||0);if(!a.attack&&!a.dead&&!a.recovery)a._humanoidPhase=(a._humanoidPhase||0)+speed*dt/(this.current?.locomotion[speed>2.4?'run':'walk'].cycleDistance||1.16)*((a.vx||0)*Math.sin(a.yaw)+(a.vz||0)*Math.cos(a.yaw)<-.07?-1:1);}
 checkSocket(c,result,weapon){const world=c.sockets.right.node.getWorldPosition(v()),expected=new T.Vector3().setFromMatrixPosition(new T.Matrix4().fromArray(result.rightSocket));c.socketError=world.distanceTo(expected);const spec=weaponSockets[weapon];if(spec?.two&&result.supportAttached&&result.attachment!=='hips'){const l=c.sockets.left.node.getWorldPosition(v()),grip=v(...spec.left).applyMatrix4(new T.Matrix4().fromArray(result.sm));c.secondaryGripError=l.distanceTo(grip);}else c.secondaryGripError=null;c.finite=Object.values(c.bones).every(b=>b.position.toArray().concat(b.quaternion.toArray()).every(Number.isFinite));}
 render(a){const c=this.current;if(!c)return;const r=this.sample(a,null,a.x,a.z,true);c.root.visible=!(a.dead&&a.deadTime>1.55);return r;}
 // Original game triggers/lifetimes still drive afterimages. Meshes and textures are shared;
 // only skeleton transforms and a bounded transparent material are owned by each snapshot.
 captureEcho(a){const c=this.current;if(!c)return;this.sample(a,null,a.x,a.z,true);const excluded=[];c.root.traverse(o=>{if(o.name==='ReviewLookAtProxy')excluded.push({node:o,parent:o.parent});});for(const e of excluded)e.node.removeFromParent();let node;try{node=cloneSkeleton(c.root);}finally{for(const e of excluded)e.parent.add(e.node);}const material=new T.MeshBasicMaterial({color:0x9fbfff,transparent:true,opacity:.065,depthWrite:false,side:T.DoubleSide});node.name='HumanoidMotionEcho';node.traverse(o=>{if(o.isMesh){o.material=material;o.frustumCulled=false;}});node.updateMatrixWorld(true);this.api.echo?.(node);c.echoes.push({node,material,born:this.clock,life:.36});while(c.echoes.length>8){const old=c.echoes.shift();old.node.removeFromParent();old.material.dispose();}}
 updateEchoes(visible=true){const c=this.current;if(!c)return;for(let i=c.echoes.length-1;i>=0;i--){const e=c.echoes[i],age=this.clock-e.born;if(!visible||age>=e.life){e.node.removeFromParent();e.material.dispose();c.echoes.splice(i,1);}else e.material.opacity=.065*(1-age/e.life);}}
 clearEchoes(c=this.current){if(!c)return;for(const e of c.echoes||[]){e.node.removeFromParent();e.material.dispose();}c.echoes=[];}
 bakeEmote(c,weapon,id){this.resetRoot(c);const times=[],data={},hips=[],count=60;for(const n of Object.keys(c.bones))data[n]=[];for(let i=0;i<=count;i++){const p=i/count,e=Math.sin(PI*smooth(p)),H=c.shoulderY,s=c.legLength/.82;times.push(p);this.resetBones(c);
  if(id==='triumph')evaluateTracks(c.shared['success-cheer'],p*Math.min(2.5,c.shared['success-cheer'].duration),c.byName);
  else this.combatPose(c,weapon,null,0,p*1.7);
  c.root.updateMatrixWorld(true);
  const flip=c.vrm.meta.metaVersion==='1'?-1:1;
  if(id==='salute'){c.bones.spine.quaternion.multiply(Q().setFromEuler(new T.Euler(-.20*e*flip,0,0)));c.bones.head.quaternion.multiply(Q().setFromEuler(new T.Euler(-.16*e*flip,0,0)));}
  c.root.updateMatrixWorld(true);
  if(weapon!=='fist'){
   let grip=v(-.18*s,H-.38*s,.32*s),dir=v(.15,.94,.25);
   if(id==='flourish'){const angle=-.6+e*TAU*.7;grip.x-=.14*e*s;dir=v(Math.sin(angle)*.64,.55,Math.cos(angle)*.64);}
   if(id==='triumph'){grip=v(-.15*s,H+(.38*e-.20)*s,.25*s);dir=v(-.10,1,.15);}
   if(id==='vow'){grip.y-=.25*e*s;dir=v(-.3,-.65,.64);}
   this.attachHands(c,weapon,grip,dir,0,1);
   if((id==='vow'||id==='salute')&&!weaponSockets[weapon].two){const target=v(.045*s,H-.24*s,.17*s);this.solve(c,'left','arm',target,v(.6,-1,0));}
  }else{this.curl(c,'left',1);this.curl(c,'right',1);}
  for(const[n,b]of Object.entries(c.bones)){const q=b.quaternion.toArray(),out=data[n];if(out.length&&q.reduce((sum,x,k)=>sum+x*out[out.length-4+k],0)<0)for(let k=0;k<4;k++)q[k]*=-1;out.push(...q);}hips.push(...c.bones.hips.position.toArray());
 }const tracks=Object.entries(c.bones).map(([n,b])=>new T.QuaternionKeyframeTrack(b.uuid+'.quaternion',times,data[n]));tracks.push(new T.VectorKeyframeTrack(c.bones.hips.uuid+'.position',times,hips));return new T.AnimationClip('Tidebreak Zanshin / '+weapon+' / '+id,1,tracks);}

 report(){const c=this.current;if(!c)return{ready:false,errors:this.errors};return{ready:this.ready,id:c.id,runtimeVersion:'expanded-humanoid-1.0',echoes:c.echoes.length,source:this.sourceInfo,unit:c.unit,sourceHeight:c.sourceHeight,normalizedHeight:this.height,bones:Object.keys(c.bones).length,builtIn:c.gltf.animations.length,vrma:Object.keys(c.shared),generated:Object.keys(c.generated),sockets:c.socketReports,socketError:c.socketError,secondaryGripError:c.secondaryGripError,locomotion:c.locomotion,finite:c.finite,attachment:c.lastResult?.attachment,animation:c.lastResult?.descriptor,clip:c.lastResult?.clip,root:c.root.position.toArray(),quaternions:Object.fromEntries(Object.entries(c.bones).map(([n,b])=>[n,b.quaternion.toArray()])),bindBoundsMin:new T.Box3().setFromObject(c.root).min.toArray(),errors:this.errors};}
}
export {catalog,motionCatalog,profiles,weaponSockets};
