import * as THREE from 'three';
import {YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {createProtagonistCharacterPool} from './rebuild/protagonist-character-pool.js';
import {RINNE_PROTAGONIST_MODEL_ID} from './rebuild/protagonist-runtime-asset.js';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from './rebuild/tidebreak-pose.js';
import {reviewBattleCameraFrame,reviewBattlePresentationFrame} from './review-battle-state.js';
import {REVIEW_MONSTER_MODELS,disposeReviewMonsterModel,loadReviewMonsterModel,updateReviewMonsterAnimation} from './review-battle-monster.js';
import {REVIEW_INSPIRATION_TIMELINE,reviewInspirationSequenceFrame} from './review-battle-inspiration.js';
import {applyReviewCombatMotion} from './review-battle-hero-motion.js';
import {createReviewStageLifecycle} from '@soul/shared-ui/review-shell';

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
function ring(color){
  const mesh=new THREE.Mesh(new THREE.RingGeometry(.46,.54,40),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.52,side:THREE.DoubleSide,depthWrite:false}));
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.018;return mesh;
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
  const cameraLook=new THREE.Vector3(0,.95,0),cameraTargetPosition=new THREE.Vector3(),cameraTargetLook=new THREE.Vector3();camera.lookAt(cameraLook);
  scene.add(new THREE.HemisphereLight(0xdde8e3,0x24302d,2.35));const key=new THREE.DirectionalLight(0xffedca,3.4);key.position.set(-4,7,5);scene.add(key);const rim=new THREE.DirectionalLight(0x9bc7d1,1.5);rim.position.set(5,4,-4);scene.add(rim);

  const stageRoot=new THREE.Group();scene.add(stageRoot);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4.8,64),new THREE.MeshStandardMaterial({color:0x18211f,roughness:.94,metalness:.02}));ground.rotation.x=-Math.PI/2;stageRoot.add(ground);
  const inspirationFx=new THREE.Group();inspirationFx.visible=false;stageRoot.add(inspirationFx);
  const fxGold=new THREE.MeshBasicMaterial({color:0xf4d483,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}),fxBlue=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide});
  const fxRings=[];for(const radius of [.68,.92,1.18]){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.035,48),fxGold.clone());mesh.rotation.x=-Math.PI/2;inspirationFx.add(mesh);fxRings.push(mesh);}
  const fxRays=[];for(let i=0;i<10;i++){const ray=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,1.5),fxBlue.clone());ray.position.y=.85;ray.rotation.y=(Math.PI*2*i)/10;ray.rotation.x=Math.PI/2;inspirationFx.add(ray);fxRays.push(ray);}
  const fxArc=new THREE.Mesh(new THREE.TorusGeometry(.9,.035,8,48,Math.PI*1.55),fxGold.clone());fxArc.position.y=1.05;fxArc.rotation.set(Math.PI/2,.2,-.55);inspirationFx.add(fxArc);
  const aura=new THREE.Group();aura.visible=false;const auraMaterial=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide});for(const radius of [.62,.82]){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),auraMaterial.clone());mesh.rotation.x=-Math.PI/2;aura.add(mesh);}const auraLight=new THREE.PointLight(0x73bce5,0,3.4);auraLight.position.y=.85;aura.add(auraLight);stageRoot.add(aura);

  const [protagonistRuntime,...monsters]=await Promise.all([createProtagonistCharacterPool(renderer),loadReviewMonsterModel('skeleton-minion'),loadReviewMonsterModel('skeleton-warrior'),loadReviewMonsterModel('skeleton-rogue')]);
  const heroPool=protagonistRuntime.pool,hero={actorId:'review-battle-hero',actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-hero',0x51f15e)),presentation:null,hp:null,hitUntil:0,marker:ring(0xd9b45b)};
  hero.actor=heroPool.spawn(hero.actorId);hero.actor.root.name='ReviewBattle:hero';hero.actor.attachments.name='ReviewBattleAttachments:hero';stageRoot.add(hero.actor.root,hero.actor.attachments,hero.marker);
  const enemies=monsters.map((actor,index)=>({actor,requested:REVIEW_MONSTER_MODELS[index]?.id||'skeleton-minion',presentation:null,hp:null,hitUntil:0,marker:ring(index?0x617d86:0x82aeb6)}));
  stageRoot.add(enemies[0].actor.root,enemies[0].marker);
  const heroWeaponRig={rightHand:hero.actor.bones?.rightHand||null,rightLowerArm:hero.actor.bones?.rightLowerArm||null},enemyWeaponRigs=enemies.map(side=>weaponRigFor(side.actor.root));
  const weaponVisuals=[hero,...enemies].map(()=>{const group=new THREE.Group();stageRoot.add(group);return{group,weapon:''};});
  let encounterMode='duel',techniquePlayback=null,cameraOrbit=0,cameraZoom=.82,impactKick=0,impactYaw=0,lastImpactSerial=0;
  const impactBursts=[];

  function setEncounterMode(mode){
    encounterMode=mode==='one-v-three'?'one-v-three':'duel';
    for(let i=1;i<enemies.length;i++){if(encounterMode==='one-v-three'){stageRoot.add(enemies[i].actor.root,enemies[i].marker);}else{enemies[i].actor.root.removeFromParent();enemies[i].marker.removeFromParent();weaponVisuals[i+1].group.visible=false;}}
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
  function animateHero(state,target,time,dt){
    if(!state)return;const hit=Number.isFinite(state.hp)&&hero.hp!==null&&state.hp<hero.hp;if(hit)hero.hitUntil=time+.15;hero.hp=Number.isFinite(state.hp)?state.hp:hero.hp;
    const presentation=reviewBattlePresentationFrame(state,target,hero.presentation,dt,{hit});hero.presentation=presentation;hero.actor.root.position.set(presentation.x,0,presentation.z);hero.actor.root.rotation.y=presentation.yaw;
    let frame=tidebreakFrameFromSnapshot(state,{targetId:target?.id||null,intent:'review-battle'});
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(time-techniquePlayback.startedAt):null;
    if(techniquePlayback&&sequence?.stage==='execute'){const steps=techniquePlayback.steps||[],scaled=sequence.executeProgress*Math.max(1,steps.length),index=Math.min(steps.length-1,Math.floor(scaled)),step=steps[index];if(step)frame=tidebreakFrameFromSnapshot({...state,attack:step.kind,progress:scaled%1,slot:techniquePlayback.phase},{targetId:target?.id||null,intent:'review-battle-inspiration'});}
    if(sequence&&sequence.stage!=='done'&&target&&sequence.spacing>0){const dx=hero.actor.root.position.x-(Number(target.x)||0),dz=hero.actor.root.position.z-(Number(target.z)||0),len=Math.max(.001,Math.hypot(dx,dz));hero.actor.root.position.x+=dx/len*1.72*sequence.spacing;hero.actor.root.position.z+=dz/len*1.72*sequence.spacing;hero.actor.root.position.y+=Math.sin(Math.min(1,sequence.backstepProgress||0)*Math.PI)*.07;}
    hero.actor.sample(hero.appearance,time,(bones,sampleTime)=>{addStride(bones,sampleTime,presentation.stride);if(sequence?.stage==='reveal'){if(bones.spine)bones.spine.rotation.x-=.16;if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.7;bones.rightUpperArm.rotation.z+=.35;}}if(sequence?.stage==='execute'&&bones.spine)bones.spine.rotation.y+=Math.sin(sequence.executeProgress*Math.PI*2)*.22;if(!frame?.attack)addGuardPose(bones,'hero');applyTidebreakPose(bones,frame);applyReviewCombatMotion(bones,frame,sequence,sampleTime);if(time<hero.hitUntil&&bones.spine)bones.spine.rotation.z-=.13;});
    hero.actor.updateAttachments();hero.actor.root.updateMatrixWorld(true);hero.marker.position.set(hero.actor.root.position.x,.018,hero.actor.root.position.z);updateWeaponVisual(weaponVisuals[0],state,heroWeaponRig);
  }
  function animateEnemy(index,state,target,time,dt){
    const side=enemies[index];if(!side||!state)return;const hit=Number.isFinite(state.hp)&&side.hp!==null&&state.hp<side.hp;if(hit)side.hitUntil=time+.16;side.hp=Number.isFinite(state.hp)?state.hp:side.hp;
    const presentation=reviewBattlePresentationFrame(state,target,side.presentation,dt,{hit});side.presentation=presentation;side.actor.root.position.set(presentation.x,state.downed?.24:0,presentation.z);side.actor.root.rotation.y=presentation.yaw;side.actor.root.rotation.z=state.downed?-Math.PI*.46:0;updateReviewMonsterAnimation(side.actor,state,time,{hit:time<side.hitUntil,downed:Boolean(state.downed)});side.actor.root.updateMatrixWorld(true);side.marker.position.set(presentation.x,.018,presentation.z);updateWeaponVisual(weaponVisuals[index+1],state,enemyWeaponRigs[index]);
  }

  let lastStatus='';
  const stageLifecycle=createReviewStageLifecycle({canvas,stage:canvas.closest('.review-surface__stage'),onResize:({width,height,aspect})=>{renderer.setSize(width,height,false);camera.aspect=aspect;camera.updateProjectionMatrix();},render:()=>renderer.render(scene,camera)});

  function inspirationCameraFrame(){
    const heroPoint=hero.actor?.root?.position;if(!heroPoint)return null;
    const activeEnemies=enemies.filter(side=>side.actor?.root?.parent===stageRoot).map(side=>side.actor.root.position);
    if(!activeEnemies.length)return null;
    const enemyPoint=activeEnemies[0],points=[heroPoint,...activeEnemies],hx=heroPoint.x,hz=heroPoint.z,ex=enemyPoint.x,ez=enemyPoint.z,dx=ex-hx,dz=ez-hz,len=Math.max(.01,Math.hypot(dx,dz));
    const lineX=dx/len,lineZ=dz/len,sideX=-lineZ,sideZ=lineX;let minLine=Infinity,maxLine=-Infinity,minSide=Infinity,maxSide=-Infinity;
    for(const point of points){const along=point.x*lineX+point.z*lineZ,across=point.x*sideX+point.z*sideZ;minLine=Math.min(minLine,along);maxLine=Math.max(maxLine,along);minSide=Math.min(minSide,across);maxSide=Math.max(maxSide,across);}
    const centerLine=(minLine+maxLine)*.5,centerSide=(minSide+maxSide)*.5,centerX=lineX*centerLine+sideX*centerSide,centerZ=lineZ*centerLine+sideZ*centerSide;
    const aspect=Math.max(.46,Math.min(2.1,camera.aspect||1)),vFov=THREE.MathUtils.degToRad(camera.fov),hFov=2*Math.atan(Math.tan(vFov*.5)*aspect),halfWidth=(maxLine-minLine)*.5+1.05,halfHeight=1.55;
    const horizontalDistance=halfWidth/Math.max(.12,Math.tan(hFov*.5)),verticalDistance=halfHeight/Math.tan(vFov*.5),distance=clamp(Math.max(horizontalDistance,verticalDistance)+.55,5.8,12.5);
    return{position:{x:centerX+sideX*distance,y:3.25,z:centerZ+sideZ*distance},look:{x:centerX,y:1.05,z:centerZ},follow:true,system:'inspiration',count:points.length};
  }

  function updateCamera(core,dt,followCamera,cameraSystem){
    const wide=canvas.clientWidth/Math.max(1,canvas.clientHeight)>1.3;let frame=reviewBattleCameraFrame(core,{follow:followCamera,system:cameraSystem,encounterMode,wide});
    const now=performance.now()/1000,sequence=techniquePlayback?reviewInspirationSequenceFrame(now-techniquePlayback.startedAt):null,step=Math.max(1/120,Math.min(.05,Number(dt)||1/60));
    if(core?.hero&&core?.enemy&&followCamera)canvas.dataset.heroComposition=cameraSystem==='demon'?'kuumetsu-shared':'hyakunen-shared';
    if(sequence&&sequence.stage!=='done'&&core?.hero&&core?.enemy)frame=inspirationCameraFrame()||frame;
    else if(frame?.follow&&core?.hero&&core?.enemy){
      cameraOrbit=(cameraOrbit+step*.05)%(Math.PI*2);const ox=frame.position.x-frame.look.x,oz=frame.position.z-frame.look.z,c=Math.cos(cameraOrbit),sn=Math.sin(cameraOrbit);
      frame={...frame,position:{...frame.position,x:frame.look.x+ox*c-oz*sn,z:frame.look.z+ox*sn+oz*c}};
    }
    if(frame?.position&&frame?.look&&frame.system!=='inspiration'){const dx=frame.position.x-frame.look.x,dy=frame.position.y-frame.look.y,dz=frame.position.z-frame.look.z;frame={...frame,position:{x:frame.look.x+dx*cameraZoom,y:frame.look.y+dy*cameraZoom,z:frame.look.z+dz*cameraZoom}};}
    if(impactKick>0)frame={...frame,position:{...frame.position,x:frame.position.x-Math.sin(impactYaw)*impactKick,z:frame.position.z-Math.cos(impactYaw)*impactKick}};
    cameraTargetPosition.set(frame.position.x,frame.position.y,frame.position.z);cameraTargetLook.set(frame.look.x,frame.look.y,frame.look.z);const blend=1-Math.exp(-step*(frame.system==='inspiration'?13:8));camera.position.lerp(cameraTargetPosition,blend);cameraLook.lerp(cameraTargetLook,blend);camera.lookAt(cameraLook);canvas.dataset.cameraFollow=followCamera?'on':'off';canvas.dataset.cameraZoom=cameraZoom.toFixed(2);
  }

  function sync(core,dt=0,{followCamera=true,encounterMode:requestedMode='duel',cameraSystem='rinne'}={}){
    setEncounterMode(requestedMode);stageLifecycle.refresh();const realNow=performance.now()/1000,simTime=Number(core?.time)||realNow,rows=core?.enemies||[core?.enemy].filter(Boolean);
    if(core){animateHero(core.hero,rows[0],simTime,dt);for(let i=0;i<Math.min(rows.length,enemies.length);i++)animateEnemy(i,rows[i],core.hero,simTime+i*.03,dt);for(let i=rows.length;i<enemies.length;i++)weaponVisuals[i+1].group.visible=false;for(const impact of core.impacts||[])presentImpact(impact);}
    updateImpacts(dt);updateCamera(core,dt,followCamera,cameraSystem);
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(realNow-techniquePlayback.startedAt):null,cinematic=Boolean(sequence&&sequence.stage!=='done');aura.visible=cinematic;inspirationFx.visible=cinematic;
    if(cinematic&&hero.actor){aura.position.copy(hero.actor.root.position);aura.position.y=.025;inspirationFx.position.copy(hero.actor.root.position);const pulse=.92+Math.sin(performance.now()*.018)*.08;aura.scale.setScalar(pulse);auraLight.intensity=1.8+Math.sin(performance.now()*.022)*.7;const intensity=sequence.stage==='reveal'||sequence.stage==='execute'?1:sequence.progress*.55;for(const [index,mesh] of fxRings.entries()){mesh.scale.setScalar(.7+intensity*(.8+index*.18));mesh.material.opacity=.18+intensity*.62;mesh.rotation.z+=.008*(index+1);}for(const [index,ray] of fxRays.entries()){ray.visible=intensity>.25;ray.scale.z=.45+intensity*(1.1+(index%3)*.15);ray.material.opacity=.15+intensity*.55;}fxArc.visible=sequence.stage==='reveal'||sequence.stage==='execute';fxArc.rotation.z+=.035;fxArc.material.opacity=.35+intensity*.6;for(const cue of ['camera','spacing','stagger','reveal','execute'])if(realNow-techniquePlayback.startedAt>=REVIEW_INSPIRATION_TIMELINE[cue]&&!techniquePlayback.emitted.has(cue)){techniquePlayback.emitted.add(cue);onInspirationCue(cue,techniquePlayback);}}
    if(techniquePlayback&&sequence?.stage==='done'){if(!techniquePlayback.emitted.has('done')){techniquePlayback.emitted.add('done');onInspirationCue('done',techniquePlayback);}techniquePlayback=null;aura.visible=false;inspirationFx.visible=false;}
    const signHud=canvas.closest('.stage')?.querySelector('#battle-sign'),bulbHud=canvas.closest('.stage')?.querySelector('#battle-lightbulb'),heroRoot=hero.actor?.root;if(signHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=2.18;projected.project(camera);signHud.dataset.signAnchor='head';signHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');signHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');}if(bulbHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=2.5;projected.project(camera);bulbHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');bulbHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');}
    const heroActual=hero.actor?.root?.userData?.characterModel||'',enemyActual=enemies[0].actor?.root?.userData?.reviewMonsterSpecies||'';canvas.dataset.heroModel=heroActual;canvas.dataset.enemyModel=enemyActual;
    const ready=heroActual===RINNE_PROTAGONIST_MODEL_ID&&enemyActual===enemies[0].requested;canvas.dataset.battleModels=ready?'ready':'loading';canvas.dataset.battleGeometry='tidebreak-authoritative-contact';
    const modeLabel=encounterMode==='one-v-three'?'1v3':'1v1',status=ready?`${modeLabel} · 主人公 × ${modelLabel(enemyActual)} · Tidebreak contact`:`モデル読込中 · 主人公 × ${modelLabel(enemies[0].requested)}`;if(status!==lastStatus){lastStatus=status;onStatus(status);}renderer.render(scene,camera);
  }

  return Object.freeze({
    models:REVIEW_BATTLE_MODELS,
    setModel(side,modelId){if(side==='enemy'&&modelId!=='skeleton-minion')throw Error(`Unknown review monster: ${modelId}`);},
    setEncounterMode,
    setWeapon(){},
    presentImpact,
    presentFinisherImpact,
    zoomBy(delta=0){cameraZoom=clamp(cameraZoom+Number(delta||0),.58,1.65);return cameraZoom;},
    setZoom(value=.82){cameraZoom=clamp(Number(value)||.82,.58,1.65);return cameraZoom;},
    cameraAngle(){return Math.atan2(camera.position.x-cameraLook.x,camera.position.z-cameraLook.z);},
    triggerInspiration({id='',name='',steps=[],phase='ha',duration=REVIEW_INSPIRATION_TIMELINE.end}={}){const now=performance.now()/1000,total=Math.max(REVIEW_INSPIRATION_TIMELINE.end,Number(duration)||0);techniquePlayback={id,name,steps,phase,duration:total,startedAt:now,until:now+total,emitted:new Set(['spark'])};canvas.closest('.stage')?.setAttribute('data-inspiration-cinematic','true');onInspirationCue('spark',techniquePlayback);setTimeout(()=>canvas.closest('.stage')?.removeAttribute('data-inspiration-cinematic'),total*1000+120);},
    resetRound(){cameraOrbit=0;impactKick=0;lastImpactSerial=0;hero.presentation=null;hero.hp=null;for(const side of enemies){side.presentation=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on',encounterMode,geometry:canvas.dataset.battleGeometry||''});},
    dispose(){stageLifecycle.destroy();heroPool.despawn(hero.actorId);protagonistRuntime.dispose();for(const monster of monsters)disposeReviewMonsterModel(monster);for(const entry of weaponVisuals)disposeNode(entry.group);for(const row of impactBursts){row.mesh.geometry.dispose();row.mesh.material.dispose();}ground.geometry.dispose();ground.material.dispose();for(const side of [hero,...enemies]){side.marker.geometry.dispose();side.marker.material.dispose();}for(const mesh of [...fxRings,...fxRays,fxArc]){mesh.geometry.dispose();mesh.material.dispose();}for(const node of aura.children){node.geometry?.dispose?.();node.material?.dispose?.();}renderer.dispose();}
  });
}
