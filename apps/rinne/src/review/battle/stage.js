import * as THREE from 'three';
import {YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {createProtagonistCharacterPool} from '../../rebuild/protagonist-character-pool.js';
import {RINNE_PROTAGONIST_MODEL_ID} from '../../rebuild/protagonist-runtime-asset.js';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from '../../rebuild/tidebreak-pose.js';
import {reviewBattleCameraFrame,reviewBattlePresentationFrame} from './state.js';
import {REVIEW_MONSTER_MODELS,disposeReviewMonsterModel,loadReviewMonsterModel,updateReviewMonsterAnimation} from './monster.js';
import {REVIEW_INSPIRATION_TIMELINE,reviewInspirationSequenceFrame} from './inspiration.js';
import {createInspirationMotionLab,createInspirationVfxLab} from './choreography-lab.js';
import {applyReviewCombatMotion} from './hero-motion.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';
import {resolveTechniquePresentation} from '@soul/johakyu-presentation/technique-presentation';
import {createSnapCameraControl,tiltCameraOffsetForZoom} from '@soul/rendering/snap-camera-control';
import {createCameraDirector,externalCameraShot} from '@soul/rendering/camera-director';
import {actorScreenSafety,applyCameraPresentation} from '@soul/rendering/camera-presentation-three';
import '@soul/rendering/snap-camera-control.css';

export const REVIEW_BATTLE_MODELS=REVIEW_MONSTER_MODELS;
const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const modelLabel=id=>REVIEW_BATTLE_MODELS.find(row=>row.id===id)?.label||id;
const reviewerCharacter=(id,seed)=>createCharacter({id,seed,ageMs:28*YEAR_MS});

function addGuardPose(bones,side){
  if(bones.spine)bones.spine.rotation.x-=.055;
  if(bones.leftUpperArm){bones.leftUpperArm.rotation.x-=.18;bones.leftUpperArm.rotation.z+=side==='hero'?-.18:.18;}
  if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.28;bones.rightUpperArm.rotation.z+=side==='hero'?.16:-.16;}
}
function addStride(bones,time,amount){
  if(amount<=0)return;const stride=Math.sin(time*8.2)*.34*amount;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.4;if(bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.4;
}
function disposeNode(root){root.traverse(node=>{node.geometry?.dispose?.();const materials=Array.isArray(node.material)?node.material:[node.material];for(const material of materials.filter(Boolean))material.dispose?.();});root.clear();}
function addBox(group,size,position,material){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);group.add(mesh);return mesh;}
function addCylinder(group,radius,height,position,material){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,height,10),material);mesh.position.set(...position);group.add(mesh);return mesh;}
function addCone(group,radius,height,position,material){const mesh=new THREE.Mesh(new THREE.ConeGeometry(radius,height,10),material);mesh.position.set(...position);group.add(mesh);return mesh;}

function rebuildWeaponVisual(entry,weapon){
  disposeNode(entry.group);entry.weapon=weapon;
  const metal=new THREE.MeshStandardMaterial({color:0xc6d0d4,roughness:.26,metalness:.78}),edge=new THREE.MeshStandardMaterial({color:0xe8ece8,roughness:.18,metalness:.86}),wood=new THREE.MeshStandardMaterial({color:0x5c4632,roughness:.8,metalness:.02}),dark=new THREE.MeshStandardMaterial({color:0x26333a,roughness:.55,metalness:.38}),gold=new THREE.MeshStandardMaterial({color:0xb89454,roughness:.42,metalness:.55});
  if(weapon==='fist'){const fist=new THREE.Mesh(new THREE.SphereGeometry(.11,12,8),dark);fist.position.y=.43;groupAdd(entry.group,fist);return;}
  if(weapon==='spear'||weapon==='staff'){
    addCylinder(entry.group,weapon==='staff'?.035:.027,.86,[0,-.05,0],wood);
    if(weapon==='spear'){addCone(entry.group,.075,.18,[0,.43,0],edge);addCylinder(entry.group,.05,.055,[0,.32,0],gold);}
    else{const cap=new THREE.Mesh(new THREE.SphereGeometry(.065,10,7),gold);cap.position.y=.43;entry.group.add(cap);}
    return;
  }
  if(weapon==='axe'){
    addCylinder(entry.group,.035,.78,[0,-.08,0],wood);addBox(entry.group,[.27,.18,.07],[.10,.32,0],metal);addBox(entry.group,[.05,.20,.075],[-.055,.31,0],gold);return;
  }
  const great=weapon==='great',dagger=weapon==='dagger',katana=weapon==='katana';
  addBox(entry.group,[great?.14:dagger?.085:.095,great?.70:dagger?.57:.66,great?.045:.032],[0,.12,0],katana?edge:metal);
  addBox(entry.group,[great?.31:dagger?.18:.24,.035,.055],[0,-.25,0],gold);
  addCylinder(entry.group,great?.048:.038,great?.22:dagger?.18:.21,[0,-.38,0],dark);
}
function groupAdd(group,node){group.add(node);}
const WEAPON_VISUAL_REACH=Object.freeze({fist:.22,dagger:.56,sword:.92,great:1.22,spear:1.46,axe:.88,staff:1.28,katana:.98});
const normalizeBoneName=value=>String(value||'').toLowerCase().replace(/[^a-z0-9]/g,'');
function weaponRigFor(root){
  let rightHand=null,rightLowerArm=null;
  root?.traverse?.(node=>{if(!node?.isBone)return;const name=normalizeBoneName(node.name);if(!rightHand&&['righthand','handr'].some(key=>name===key||name.endsWith(key)))rightHand=node;if(!rightLowerArm&&['rightlowerarm','lowerarmr','rightforearm','forearmr'].some(key=>name===key||name.endsWith(key)))rightLowerArm=node;});
  return{rightHand,rightLowerArm};
}
function updateWeaponVisual(entry,state,rig){
  const segment=state?.weaponSegment;if(!segment||state?.dead){entry.group.visible=false;return;}
  const weapon=segment.weapon||'sword';if(entry.weapon!==weapon)rebuildWeaponVisual(entry,weapon);
  let a=null,b=null,binding='segment-fallback';
  if(rig?.rightHand&&rig?.rightLowerArm){
    const hand=new THREE.Vector3(),forearm=new THREE.Vector3();rig.rightHand.getWorldPosition(hand);rig.rightLowerArm.getWorldPosition(forearm);
    const dir=hand.clone().sub(forearm),armLength=dir.length();
    if(armLength>.025){dir.multiplyScalar(1/armLength);const reach=WEAPON_VISUAL_REACH[weapon]||.9,back=weapon==='fist'?.06:Math.min(.2,reach*.2);a=hand.clone().addScaledVector(dir,-back);b=hand.clone().addScaledVector(dir,reach-back);binding='right-hand-bone';}
  }
  if(!a||!b){const start=segment.visualBase||segment.base,end=segment.visualTip||segment.tip;if(Array.isArray(start)&&Array.isArray(end)){a=new THREE.Vector3(Number(start[0])||0,Number(start[1])||0,Number(start[2])||0);b=new THREE.Vector3(Number(end[0])||0,Number(end[1])||0,Number(end[2])||0);}}
  if(!a||!b){entry.group.visible=false;return;}
  const dir=b.clone().sub(a),length=dir.length();if(length<.02){entry.group.visible=false;return;}
  entry.group.visible=true;entry.group.position.copy(a).add(b).multiplyScalar(.5);entry.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());entry.group.scale.set(1,length,1);
  entry.group.userData.weaponBinding=binding;entry.group.userData.contactActive=Boolean(segment.active);entry.group.userData.contactBase=segment.base;entry.group.userData.contactTip=segment.tip;
}

export async function createReviewBattleStage({canvas,onStatus=()=>{},onInspirationCue=()=>{}}={}){
  if(!canvas)throw Error('Review battle canvas is required');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.04;renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio)||1,1.5));

  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1110);scene.fog=new THREE.Fog(0x0b1110,10,24);
  const camera=new THREE.PerspectiveCamera(40,1,.08,50);camera.position.set(0,5.2,10);
  const cameraLook=new THREE.Vector3(0,.95,0);camera.lookAt(cameraLook);
  scene.add(new THREE.HemisphereLight(0xdde8e3,0x24302d,2.35));const key=new THREE.DirectionalLight(0xffedca,3.4);key.position.set(-4,7,5);scene.add(key);const rim=new THREE.DirectionalLight(0x9bc7d1,1.5);rim.position.set(5,4,-4);scene.add(rim);

  const stageRoot=new THREE.Group();scene.add(stageRoot);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4.8,64),new THREE.MeshStandardMaterial({color:0x18211f,roughness:.94,metalness:.02}));ground.rotation.x=-Math.PI/2;stageRoot.add(ground);

  const [protagonistRuntime,...monsters]=await Promise.all([createProtagonistCharacterPool(renderer),loadReviewMonsterModel('skeleton-minion'),loadReviewMonsterModel('skeleton-warrior'),loadReviewMonsterModel('skeleton-rogue')]);
  const heroPool=protagonistRuntime.pool,hero={actorId:'review-battle-hero',actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-hero',0x51f15e)),presentation:null,hp:null,hitUntil:0};
  hero.actor=heroPool.spawn(hero.actorId);hero.actor.root.name='ReviewBattle:hero';hero.actor.attachments.name='ReviewBattleAttachments:hero';stageRoot.add(hero.actor.root,hero.actor.attachments);
  const enemies=monsters.map((actor,index)=>({actor,requested:REVIEW_MONSTER_MODELS[index]?.id||'skeleton-minion',presentation:null,hp:null,hitUntil:0}));
  stageRoot.add(enemies[0].actor.root);
  const heroWeaponRig={rightHand:hero.actor.bones?.rightHand||null,rightLowerArm:hero.actor.bones?.rightLowerArm||null},enemyWeaponRigs=enemies.map(side=>weaponRigFor(side.actor.root));
  const weaponVisuals=[hero,...enemies].map(()=>{const group=new THREE.Group();stageRoot.add(group);return{group,weapon:''};});
  const inspirationMotion=await createInspirationMotionLab({heroRoot:hero.actor.root,enemyRoots:enemies.map(side=>side.actor.visual)});
  const inspirationVfx=await createInspirationVfxLab({renderer,document,onError:error=>{canvas.dataset.inspirationVfx='fallback';console.warn('Inspiration authored VFX unavailable:',error);}});
  canvas.dataset.inspirationMotion=inspirationMotion.ready?'lab':'fallback';canvas.dataset.inspirationVfx=inspirationVfx.snapshot().phase==='ready'?'lab':'fallback';
  let encounterMode='duel',techniquePlayback=null,cameraOrbit=0,cameraZoom=.82,impactKick=0,impactYaw=0,lastImpactSerial=0;
  const cameraDirector=createCameraDirector({profile:'current3d'});let cameraScreenSafety=null,lastCameraPresentation=null;
  const cameraPresentationSnapshot=()=>lastCameraPresentation?structuredClone(lastCameraPresentation):null;canvas.cameraPresentation=cameraPresentationSnapshot;
  const cameraStage=canvas.closest('.stage')||canvas.parentElement,cameraHost=cameraStage?.querySelector?.('[data-camera-control-host]')||cameraStage;
  const cameraControl=createSnapCameraControl({document:canvas.ownerDocument||document,container:cameraHost,initialZoom:.82,minZoom:.58,maxZoom:1.65,onChange:state=>{cameraOrbit=state.yaw;cameraZoom=state.zoom;canvas.dataset.cameraStep=String(state.index);canvas.dataset.cameraZoom=state.zoom.toFixed(2);}});
  cameraControl.element.dataset.reviewBattleCamera='true';
  const reviewCameraSubject=(row,id)=>{const weapon=String(row?.weaponSegment?.weapon||row?.weapon||'sword');return{id,position:{x:Number(row?.x)||0,y:0,z:Number(row?.z)||0},yaw:Number(row?.yaw)||0,height:1.9,radius:.5,weaponRadius:WEAPON_VISUAL_REACH[weapon]||.9};};
  const impactBursts=[],inspirationHandPoint=new THREE.Vector3(),inspirationEnemyPoint=new THREE.Vector3(),inspirationBladeA=new THREE.Vector3(),inspirationBladeB=new THREE.Vector3();
  function heroWeaponPoint(target=inspirationHandPoint){const hand=heroWeaponRig.rightHand;if(hand?.getWorldPosition){hand.getWorldPosition(target);return target;}target.copy(hero.actor.root.position);target.y+=1.05;return target;}
  function nearMissVector(target,sequence,side=1){
    const segment=target?.weaponSegment,start=segment?.visualBase||segment?.base,end=segment?.visualTip||segment?.tip,active=Boolean(segment?.active);
    let px=0,pz=0;
    if(Array.isArray(start)&&Array.isArray(end)){
      inspirationBladeA.set(Number(start[0])||0,Number(start[1])||0,Number(start[2])||0);inspirationBladeB.set(Number(end[0])||0,Number(end[1])||0,Number(end[2])||0);
      const dx=inspirationBladeB.x-inspirationBladeA.x,dz=inspirationBladeB.z-inspirationBladeA.z,len=Math.max(.001,Math.hypot(dx,dz));px=-dz/len;pz=dx/len;
    }else{
      const dx=(Number(target?.x)||0)-hero.actor.root.position.x,dz=(Number(target?.z)||0)-hero.actor.root.position.z,len=Math.max(.001,Math.hypot(dx,dz));px=-dz/len;pz=dx/len;
    }
    const amount=Math.max(Number(sequence?.nearMiss)||0,active?.98:0)*(active?.34:.24);
    return{x:px*side*amount,z:pz*side*amount,amount,active};
  }
  function blendCameraFrames(a,b,t){
    if(!a||!b)return a||b;const u=clamp(Number(t)||0,0,1),mix=(x,y)=>x+(y-x)*u;
    return{...a,position:{x:mix(a.position.x,b.position.x),y:mix(a.position.y,b.position.y),z:mix(a.position.z,b.position.z)},look:{x:mix(a.look.x,b.look.x),y:mix(a.look.y,b.look.y),z:mix(a.look.z,b.look.z)},roll:mix(Number(a.roll)||0,Number(b.roll)||0),lock:u>.92?(b.lock||a.lock):a.lock};
  }

  function setEncounterMode(mode){
    encounterMode=mode==='one-v-three'?'one-v-three':'duel';
    for(let i=1;i<enemies.length;i++){if(encounterMode==='one-v-three'){stageRoot.add(enemies[i].actor.root);}else{enemies[i].actor.root.removeFromParent();weaponVisuals[i+1].group.visible=false;}}
    canvas.dataset.encounterMode=encounterMode;
  }
  function presentImpact(impact){
    if(!impact||impact.serial===lastImpactSerial)return;lastImpactSerial=impact.serial;
    const point=impact.point||[0,.8,0],guard=Boolean(impact.guard),power=Math.max(.4,Number(impact.power)||.7),material=new THREE.MeshBasicMaterial({color:guard?0xf0c96d:0xffe2a0,transparent:true,opacity:.92,depthWrite:false,side:THREE.DoubleSide});
    const mesh=new THREE.Mesh(new THREE.RingGeometry(.06,.095,20),material);mesh.position.set(Number(point[0])||0,Number(point[1])||.8,Number(point[2])||0);mesh.quaternion.copy(camera.quaternion);stageRoot.add(mesh);impactBursts.push({mesh,age:0,life:.18,power});
    impactKick=Math.max(impactKick,.035+power*.028);impactYaw=Number(impact.yaw)||0;
  }
  function presentFinisherImpact(core,targetIndex=0){const rows=core?.enemies||[core?.enemy].filter(Boolean),target=rows[targetIndex]||rows.at(-1);if(!target)return;presentImpact({serial:++lastImpactSerial,point:[Number(target.x)||0,.58,Number(target.z)||0],guard:false,power:1.55,yaw:Number(core?.hero?.yaw)||0});}
  function updateImpacts(dt){
    const step=Math.max(1/240,Math.min(.05,Number(dt)||1/60));impactKick*=Math.exp(-step*18);
    for(let i=impactBursts.length-1;i>=0;i--){const row=impactBursts[i];row.age+=step;const u=clamp(row.age/row.life,0,1);row.mesh.scale.setScalar(.7+u*5*row.power);row.mesh.material.opacity=(1-u)*.9;if(u>=1){row.mesh.removeFromParent();row.mesh.geometry.dispose();row.mesh.material.dispose();impactBursts.splice(i,1);}}
  }
  function animateHero(state,target,time,dt,playbackTime=time){
    if(!state)return;const hit=Number.isFinite(state.hp)&&hero.hp!==null&&state.hp<hero.hp;if(hit)hero.hitUntil=time+.15;hero.hp=Number.isFinite(state.hp)?state.hp:hero.hp;
    const presentation=reviewBattlePresentationFrame(state,target,hero.presentation,dt,{hit});hero.presentation=presentation;hero.actor.root.position.set(presentation.x,0,presentation.z);hero.actor.root.rotation.y=presentation.yaw;
    let frame=tidebreakFrameFromSnapshot(state,{targetId:target?.id||null,intent:'review-battle'});
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(playbackTime-techniquePlayback.startedAt):null;
    if(techniquePlayback&&sequence?.executeProgress>0&&sequence.stage!=='done'){const steps=techniquePlayback.steps||[],scaled=sequence.executeProgress*Math.max(1,steps.length),index=Math.min(steps.length-1,Math.floor(scaled)),step=steps[index];if(step)frame=tidebreakFrameFromSnapshot({...state,attack:step.kind,progress:scaled%1,slot:techniquePlayback.phase},{targetId:target?.id||null,intent:'review-battle-inspiration'});}
    if(sequence&&sequence.stage!=='done'&&target&&sequence.spacing>0){const dx=hero.actor.root.position.x-(Number(target.x)||0),dz=hero.actor.root.position.z-(Number(target.z)||0),len=Math.max(.001,Math.hypot(dx,dz));hero.actor.root.position.x+=dx/len*1.72*sequence.spacing;hero.actor.root.position.z+=dz/len*1.72*sequence.spacing;hero.actor.root.position.y+=Math.sin(Math.min(1,sequence.backstepProgress||0)*Math.PI)*.07;}
    const nearMiss=sequence&&target?nearMissVector(target,sequence,techniquePlayback?.nearMissSide||1):null;if(nearMiss?.amount){hero.actor.root.position.x+=nearMiss.x;hero.actor.root.position.z+=nearMiss.z;}
    if(sequence?.strikeTravel>0&&target){const dx=(Number(target.x)||0)-hero.actor.root.position.x,dz=(Number(target.z)||0)-hero.actor.root.position.z,len=Math.max(.001,Math.hypot(dx,dz)),travel=Math.min(1.12,Math.max(0,len-.86))*sequence.strikeTravel;hero.actor.root.position.x+=dx/len*travel;hero.actor.root.position.z+=dz/len*travel;}
    hero.actor.sample(hero.appearance,time,(bones,sampleTime)=>{addStride(bones,sampleTime,presentation.stride);if(nearMiss?.amount){const lean=(techniquePlayback?.nearMissSide||1)*nearMiss.amount/.34;if(bones.hips)bones.hips.rotation.y+=lean*.07;if(bones.spine)bones.spine.rotation.z+=lean*.12;if(bones.head)bones.head.rotation.z-=lean*.075;}if(sequence?.stage==='reveal'){if(bones.spine)bones.spine.rotation.x-=.16;if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.7;bones.rightUpperArm.rotation.z+=.35;}}if(sequence?.executeProgress>0&&sequence.stage!=='done'&&bones.spine)bones.spine.rotation.y+=Math.sin(sequence.executeProgress*Math.PI*2)*.22;if(!frame?.attack)addGuardPose(bones,'hero');applyTidebreakPose(bones,frame);applyReviewCombatMotion(bones,frame,sequence,sampleTime);if(time<hero.hitUntil&&bones.spine)bones.spine.rotation.z-=.13;});
    if(sequence&&sequence.stage!=='done')inspirationMotion.applyHero(sequence,{side:techniquePlayback?.nearMissSide||1,weapon:state.weapon||'sword',steps:techniquePlayback?.steps||[],techniqueId:techniquePlayback?.id||'',techniqueName:techniquePlayback?.name||'',phase:techniquePlayback?.phase||'ha'});
    hero.actor.updateAttachments();hero.actor.root.updateMatrixWorld(true);updateWeaponVisual(weaponVisuals[0],state,heroWeaponRig);
  }
  function animateEnemy(index,state,target,time,dt){
    const side=enemies[index];if(!side||!state)return;const hit=Number.isFinite(state.hp)&&side.hp!==null&&state.hp<side.hp;if(hit)side.hitUntil=time+.16;side.hp=Number.isFinite(state.hp)?state.hp:side.hp;
    const presentation=reviewBattlePresentationFrame(state,target,side.presentation,dt,{hit});side.presentation=presentation;side.actor.root.position.set(presentation.x,state.downed?.24:0,presentation.z);side.actor.root.rotation.y=presentation.yaw;side.actor.root.rotation.z=state.downed?-Math.PI*.46:0;updateReviewMonsterAnimation(side.actor,state,time,{hit:time<side.hitUntil,downed:Boolean(state.downed)});
    const sequence=index===0&&techniquePlayback?reviewInspirationSequenceFrame(performance.now()/1000-techniquePlayback.startedAt):null;if(sequence?.targetStagger>0&&!state.downed&&target){const dx=side.actor.root.position.x-(Number(target.x)||0),dz=side.actor.root.position.z-(Number(target.z)||0),len=Math.max(.001,Math.hypot(dx,dz)),stagger=sequence.targetStagger,recoil=Number(sequence.impactRecoil)||0;side.actor.root.position.x+=dx/len*(.24*stagger+.58*recoil);side.actor.root.position.z+=dz/len*(.24*stagger+.58*recoil);side.actor.root.rotation.z+=(techniquePlayback?.nearMissSide||1)*(.075*stagger+.19*recoil);side.actor.root.rotation.x=-.065*stagger-.12*recoil;}
    if(sequence&&sequence.stage!=='done')inspirationMotion.applyEnemy(sequence,index);
    side.actor.root.updateMatrixWorld(true);updateWeaponVisual(weaponVisuals[index+1],state,enemyWeaponRigs[index]);
  }

  let lastStatus='';
  const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});

  function inspirationCameraFrame(sequence){
    const heroPoint=hero.actor?.root?.position;if(!heroPoint)return null;
    const activeEnemies=enemies.filter(side=>side.actor?.root?.parent===stageRoot).map(side=>side.actor.root.position);
    if(!activeEnemies.length)return null;
    const enemyPoint=activeEnemies[0],dx=enemyPoint.x-heroPoint.x,dz=enemyPoint.z-heroPoint.z,len=Math.max(.01,Math.hypot(dx,dz)),forwardX=dx/len,forwardZ=dz/len,sideX=-forwardZ,sideZ=forwardX;
    const portrait=canvas.clientWidth/Math.max(1,canvas.clientHeight)<.82,progress=clamp(Number(sequence?.progress)||0,0,1),stage=sequence?.stage||'premonition';
    const hand=heroWeaponPoint(inspirationHandPoint);inspirationEnemyPoint.set(enemyPoint.x,1.02,enemyPoint.z);
    const close=portrait?{behind:3.45,lateral:3.10,height:2.20}:{behind:3.15,lateral:3.25,height:2.02};
    const mid=portrait?{behind:3.95,lateral:3.55,height:2.42}:{behind:3.65,lateral:3.55,height:2.22};
    const wideFrame=portrait?{behind:5.00,lateral:4.55,height:2.72}:{behind:4.45,lateral:4.45,height:2.48};
    let framing=mid;
    if(stage==='camera'||stage==='silence'||stage==='reveal')framing=close;
    else if(stage==='execute'){const release=clamp(Number(sequence?.cameraRelease)||0,0,1);framing={behind:mid.behind+(wideFrame.behind-mid.behind)*release,lateral:mid.lateral+(wideFrame.lateral-mid.lateral)*release,height:mid.height+(wideFrame.height-mid.height)*release};}
    else if(stage==='impact')framing=wideFrame;
    else if(stage==='settle')framing={behind:wideFrame.behind*.84+mid.behind*.16,lateral:wideFrame.lateral*.84+mid.lateral*.16,height:wideFrame.height*.84+mid.height*.16};
    const position={x:heroPoint.x-forwardX*framing.behind+sideX*framing.lateral,y:framing.height,z:heroPoint.z-forwardZ*framing.behind+sideZ*framing.lateral};
    let look;
    if(stage==='camera')look={x:hand.x,y:hand.y,z:hand.z};
    else if(stage==='spacing')look={x:hand.x+(inspirationEnemyPoint.x-hand.x)*progress,y:hand.y+(inspirationEnemyPoint.y-hand.y)*progress,z:hand.z+(inspirationEnemyPoint.z-hand.z)*progress};
    else if(stage==='stagger'||stage==='silence')look={x:hand.x*.78+inspirationEnemyPoint.x*.22,y:hand.y*.78+inspirationEnemyPoint.y*.22,z:hand.z*.78+inspirationEnemyPoint.z*.22};
    else{const targetBias=stage==='impact'?.72:stage==='execute'?.58:.48;look={x:heroPoint.x+(enemyPoint.x-heroPoint.x)*targetBias,y:.9+(stage==='impact'?.08:0),z:heroPoint.z+(enemyPoint.z-heroPoint.z)*targetBias};}
    const roll=stage==='premonition'?-.012*(sequence?.nearMiss||0):stage==='camera'?-.018:stage==='spacing'?-.03:stage==='stagger'?-.045:stage==='silence'?-.052:stage==='execute'?-.07*(1-progress*.35):stage==='impact'?-.045:-.018*(1-progress);
    return{position,look,follow:true,system:'inspiration',lock:stage==='camera'?'weapon-focus':stage==='spacing'?'target-focus':stage==='stagger'?'insight-lock':'insight-strike',count:activeEnemies.length,roll};
  }

  function updateCamera(core,dt,followCamera,cameraSystem){
    const wide=canvas.clientWidth/Math.max(1,canvas.clientHeight)>1.3,baseFrame=reviewBattleCameraFrame(core,{follow:followCamera,system:cameraSystem,encounterMode,wide});let frame=baseFrame;
    const now=performance.now()/1000,sequence=techniquePlayback?reviewInspirationSequenceFrame(now-techniquePlayback.startedAt):null,step=Math.max(1/120,Math.min(.05,Number(dt)||1/60));
    if(core?.hero&&core?.enemy&&followCamera)canvas.dataset.heroComposition=cameraSystem==='demon'?'kuumetsu-shared':'hyakunen-shared';
    if(sequence&&sequence.stage!=='done'&&core?.hero&&core?.enemy){const cinematicFrame=inspirationCameraFrame(sequence)||frame;frame=sequence.stage==='afterglow'?blendCameraFrames(cinematicFrame,baseFrame,sequence.progress):cinematicFrame;}
    if(impactKick>0)frame={...frame,position:{...frame.position,x:frame.position.x-Math.sin(impactYaw)*impactKick,z:frame.position.z-Math.cos(impactYaw)*impactKick}};

    const cameraProfile=techniquePlayback?.presentation?.camera,fovTarget=sequence&&sequence.stage!=='done'?(sequence.stage==='impact'?cameraProfile?.impactFov:sequence.stage==='execute'?cameraProfile?.executionFov:sequence.stage==='settle'||sequence.stage==='afterglow'?cameraProfile?.settleFov:cameraProfile?.anticipationFov)||sequence.cameraFov:40;
    const enemyState=(core?.enemies||[core?.enemy]).filter(Boolean)[0]||null,actor=reviewCameraSubject(core?.hero,'review-battle-hero'),target=enemyState?reviewCameraSubject(enemyState,'review-battle-enemy'):null;
    const authored=frame.system==='inspiration'||frame.finisher||!frame.follow;
    let cameraInput;
    if(authored){
      const zoom=frame.system==='inspiration'?1:cameraZoom,offset=tiltCameraOffsetForZoom({x:frame.position.x-frame.look.x,y:frame.position.y-frame.look.y,z:frame.position.z-frame.look.z},zoom),position={x:frame.look.x+offset.x*zoom,y:frame.look.y+offset.y*zoom,z:frame.look.z+offset.z*zoom};
      cameraInput={mode:frame.system==='inspiration'||frame.finisher?'cinematic':'combat',actor,target,aspect:camera.aspect,space:'review-battle',screenSafety:cameraScreenSafety,authoredShot:externalCameraShot({position,lookTarget:frame.look,fov:fovTarget})};
    }else{
      const offset={x:frame.position.x-frame.look.x,y:frame.position.y-frame.look.y,z:frame.position.z-frame.look.z};
      cameraInput={mode:'combat',actor,target,aspect:camera.aspect,space:'review-battle',screenSafety:cameraScreenSafety,combatFrame:{look:frame.look,offset:tiltCameraOffsetForZoom(offset,cameraZoom)},yawOffset:cameraOrbit,framing:{zoom:cameraZoom}};
    }
    const presentation=cameraDirector.update(cameraInput,step);applyCameraPresentation(camera,presentation);cameraLook.set(presentation.lookTarget.x,presentation.lookTarget.y,presentation.lookTarget.z);
    if(frame.system==='inspiration'&&frame.roll)camera.rotateZ(frame.roll);
    cameraScreenSafety=actorScreenSafety(camera,target?[actor,target]:[actor]);lastCameraPresentation={camera:{...presentation,screenSafety:cameraScreenSafety},actor,target,renderer:'review-battle'};
    canvas.dataset.cameraDirector='shared';canvas.dataset.cameraFollow=followCamera?'on':'off';canvas.dataset.cameraLock=frame.lock||'scene';canvas.dataset.cameraMode=frame.finisher?'finisher':frame.system;canvas.dataset.cameraZoom=cameraZoom.toFixed(2);if(sequence&&sequence.stage!=='done')canvas.dataset.inspirationFocus=sequence.focus;else delete canvas.dataset.inspirationFocus;
  }

  function sync(core,dt=0,{followCamera=true,encounterMode:requestedMode='duel',cameraSystem='rinne'}={}){
    setEncounterMode(requestedMode);stageLifecycle.refresh();const realNow=performance.now()/1000,simTime=Number(core?.time)||realNow,rows=core?.enemies||[core?.enemy].filter(Boolean);
    if(core){animateHero(core.hero,rows[0],simTime,dt,realNow);for(let i=0;i<Math.min(rows.length,enemies.length);i++)animateEnemy(i,rows[i],core.hero,simTime+i*.03,dt);for(let i=rows.length;i<enemies.length;i++)weaponVisuals[i+1].group.visible=false;for(const impact of core.impacts||[])presentImpact(impact);}
    updateImpacts(dt);updateCamera(core,dt,followCamera,cameraSystem);
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(realNow-techniquePlayback.startedAt):null,cinematic=Boolean(sequence&&sequence.stage!=='done'),hudStage=canvas.closest('.stage');if(hudStage){if(cinematic)hudStage.dataset.inspirationBeat=sequence.stage;else delete hudStage.dataset.inspirationBeat;}
    const beat=sequence?.stage||'done',heroRoot=hero.actor?.root,enemyRoot=enemies[0]?.actor?.root;if(hudStage&&sequence)hudStage.style.setProperty('--inspiration-progress',String(sequence.progress));
    if(cinematic&&heroRoot&&enemyRoot){
      const handPoint=heroWeaponPoint(inspirationHandPoint);inspirationEnemyPoint.set(enemyRoot.position.x,1.05,enemyRoot.position.z);
      const heroRotation={x:0,y:Number(core?.hero?.yaw)||0,z:0},enemyRotation={x:0,y:Number(core?.enemy?.yaw)||0,z:0};
      const anchors={hero:{position:{x:handPoint.x,y:handPoint.y,z:handPoint.z},rotation:heroRotation}};
      inspirationVfx.frame(dt,anchors);
      for(const cue of ['camera','spacing','stagger','silence','reveal','titleEnd','execute','impact','settle','afterglow'])if(realNow-techniquePlayback.startedAt>=REVIEW_INSPIRATION_TIMELINE[cue]&&!techniquePlayback.emitted.has(cue)){
        techniquePlayback.emitted.add(cue);
        if(cue==='silence')inspirationVfx.insight(handPoint,heroRotation,techniquePlayback.presentation);
        if(cue==='execute')inspirationVfx.trail(handPoint,heroRotation,techniquePlayback.presentation);
        if(cue==='impact'){inspirationVfx.hit(inspirationEnemyPoint,enemyRotation,techniquePlayback.presentation);impactKick=Math.max(impactKick,techniquePlayback.presentation?.camera?.shake||.075);impactYaw=Number(core?.hero?.yaw)||0;}
        onInspirationCue(cue,techniquePlayback);
      }
    }else inspirationVfx.frame(dt,null);
    if(techniquePlayback&&sequence?.stage==='done'){if(!techniquePlayback.emitted.has('done')){techniquePlayback.emitted.add('done');onInspirationCue('done',techniquePlayback);}techniquePlayback=null;inspirationVfx.clear();inspirationMotion.reset();if(hudStage){delete hudStage.dataset.inspirationBeat;hudStage.style.removeProperty('--inspiration-progress');}}
    const signHud=hudStage?.querySelector('#battle-sign'),bulbHud=hudStage?.querySelector('#battle-lightbulb'),inspirationHud=hudStage?.querySelector('#battle-inspiration');if(signHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=2.18;projected.project(camera);signHud.dataset.signAnchor='head';signHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');signHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');}if(bulbHud&&heroRoot){const point=heroWeaponPoint(inspirationHandPoint).clone();point.project(camera);bulbHud.style.setProperty('left',`${(point.x*.5+.5)*100}%`,'important');bulbHud.style.setProperty('top',`${(-point.y*.5+.5)*100}%`,'important');}if(inspirationHud&&heroRoot&&enemyRoot){const midpoint=heroRoot.position.clone().lerp(enemyRoot.position,.56);midpoint.y+=1.62;midpoint.project(camera);const left=clamp((midpoint.x*.5+.5)*100,24,76),top=clamp((-midpoint.y*.5+.5)*100,16,42);inspirationHud.dataset.inspirationAnchor='impact-space';inspirationHud.dataset.inspirationSide='center';inspirationHud.style.setProperty('left',`${left}%`,'important');inspirationHud.style.setProperty('top',`${top}%`,'important');}
    const heroActual=hero.actor?.root?.userData?.characterModel||'',enemyActual=enemies[0].actor?.root?.userData?.reviewMonsterSpecies||'';canvas.dataset.heroModel=heroActual;canvas.dataset.enemyModel=enemyActual;
    const ready=heroActual===RINNE_PROTAGONIST_MODEL_ID&&enemyActual===enemies[0].requested;canvas.dataset.battleModels=ready?'ready':'loading';canvas.dataset.battleGeometry='tidebreak-authoritative-contact';
    const modeLabel=encounterMode==='one-v-three'?'1v3':'1v1',status=ready?`${modeLabel} · 主人公 × ${modelLabel(enemyActual)} · Tidebreak contact`:`モデル読込中 · 主人公 × ${modelLabel(enemies[0].requested)}`;if(status!==lastStatus){lastStatus=status;onStatus(status);}renderer.render(scene,camera);inspirationVfx.draw(camera);renderer.resetState();
  }

  return Object.freeze({
    models:REVIEW_BATTLE_MODELS,
    setModel(side,modelId){if(side==='enemy'&&modelId!=='skeleton-minion')throw Error(`Unknown review monster: ${modelId}`);},
    setEncounterMode,
    setWeapon(){},
    presentImpact,
    presentFinisherImpact,
    zoomBy(delta=0){return cameraControl.setZoom(cameraZoom+Number(delta||0)).zoom;},
    setZoom(value=.82){return cameraControl.setZoom(value).zoom;},
    cameraAngle(){return Math.atan2(camera.position.x-cameraLook.x,camera.position.z-cameraLook.z);},
    triggerInspiration({id='',name='',steps=[],phase='ha',weapon='sword',grade='normal',duration=REVIEW_INSPIRATION_TIMELINE.end}={}){const now=performance.now()/1000,total=Math.max(REVIEW_INSPIRATION_TIMELINE.end,Number(duration)||0),nearMissSide=String(id||name).length%2?1:-1,presentation=resolveTechniquePresentation({techniqueId:id||name,weapon,phase,steps,grade});techniquePlayback={id,name,steps,phase,weapon,grade,presentation,duration:total,startedAt:now,until:now+total,nearMissSide,emitted:new Set(['spark'])};canvas.closest('.stage')?.setAttribute('data-inspiration-cinematic','true');onInspirationCue('spark',techniquePlayback);setTimeout(()=>canvas.closest('.stage')?.removeAttribute('data-inspiration-cinematic'),total*1000+120);},
    resetRound(){impactKick=0;lastImpactSerial=0;inspirationVfx.clear();inspirationMotion.reset();hero.presentation=null;hero.hp=null;for(const side of enemies){side.presentation=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on',cameraDirector:canvas.dataset.cameraDirector||'',encounterMode,geometry:canvas.dataset.battleGeometry||''});},
    dispose(){if(canvas.cameraPresentation===cameraPresentationSnapshot)delete canvas.cameraPresentation;cameraDirector.reset();cameraControl.dispose();stageLifecycle.destroy();inspirationVfx.dispose();inspirationMotion.reset();heroPool.despawn(hero.actorId);protagonistRuntime.dispose();for(const monster of monsters)disposeReviewMonsterModel(monster);for(const entry of weaponVisuals)disposeNode(entry.group);for(const row of impactBursts){row.mesh.geometry.dispose();row.mesh.material.dispose();}ground.geometry.dispose();ground.material.dispose();renderer.dispose();}
  });
}
