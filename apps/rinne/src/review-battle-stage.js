import * as THREE from 'three';
import {KAYKIT_MODELS,YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {GLTFLoader} from '@soul/rendering';
import {createKaykitCharacterPools} from './rebuild/kaykit-character-pool.js';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from './rebuild/tidebreak-pose.js';
import {reviewBattleCameraFrame} from './review-battle-state.js';
import {hideEmbeddedCombatProps,reviewBattleEquipmentFor} from './review-battle-equipment.js';

export const REVIEW_BATTLE_MODELS=Object.freeze(KAYKIT_MODELS.map(model=>Object.freeze({id:model.id,label:model.label})));

const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
const REVIEW_EQUIPMENT_ASSETS=Object.freeze(['dagger','sword_1handed','shield_badge']);

async function loadReviewEquipment(){
  const loader=new GLTFLoader(),assets=new Map();
  await Promise.all(REVIEW_EQUIPMENT_ASSETS.map(async name=>{
    const gltf=await loader.loadAsync(`./simulator/assets/kaykit/${name}.gltf`);
    assets.set(name,gltf.scene);
  }));
  return assets;
}
function installReviewEquipment(actor,modelId,assets){
  const hidden=hideEmbeddedCombatProps(actor.visual);
  for(const row of reviewBattleEquipmentFor(modelId)){
    const source=assets.get(row.asset);if(!source)continue;
    const object=source.clone(true);object.rotation.set(...row.rotation);
    actor.attachWeapon(row.key,object,{bone:row.bone,position:[0,.02,0],quaternion:[0,0,0,1],scale:row.scale});
  }
  actor.root.userData.reviewHiddenCombatProps=hidden;
  actor.root.userData.reviewEquipment=reviewBattleEquipmentFor(modelId).map(row=>row.asset).join(',');
}
const modelLabel=id=>REVIEW_BATTLE_MODELS.find(row=>row.id===id)?.label||id;

function reviewerCharacter(id,seed){
  return createCharacter({id,seed,ageMs:28*YEAR_MS});
}

function addGuardPose(bones,side){
  if(bones.spine)bones.spine.rotation.x-=.055;
  if(bones.leftUpperArm){bones.leftUpperArm.rotation.x-=.18;bones.leftUpperArm.rotation.z+=side==='hero'?-.18:.18;}
  if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.28;bones.rightUpperArm.rotation.z+=side==='hero'?.16:-.16;}
}

function addStride(bones,time,amount){
  if(amount<=0)return;
  const stride=Math.sin(time*8.2)*.34*amount;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;
  if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.4;
  if(bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.4;
}

function ring(color){
  const mesh=new THREE.Mesh(
    new THREE.RingGeometry(.46,.54,40),
    new THREE.MeshBasicMaterial({color,transparent:true,opacity:.66,side:THREE.DoubleSide,depthWrite:false})
  );
  mesh.rotation.x=-Math.PI/2;mesh.position.y=.018;return mesh;
}

export async function createReviewBattleStage({canvas,onStatus=()=>{}}={}){
  if(!canvas)throw Error('Review battle canvas is required');
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=1.04;
  renderer.setPixelRatio(Math.min(Number(globalThis.devicePixelRatio)||1,1.5));

  const scene=new THREE.Scene();scene.background=new THREE.Color(0x0b1110);scene.fog=new THREE.Fog(0x0b1110,10,24);
  const camera=new THREE.PerspectiveCamera(43,1,.08,50);camera.position.set(0,5.2,10);
  const cameraLook=new THREE.Vector3(0,.95,0),cameraTargetPosition=new THREE.Vector3(),cameraTargetLook=new THREE.Vector3();camera.lookAt(cameraLook);
  scene.add(new THREE.HemisphereLight(0xdde8e3,0x24302d,2.35));
  const key=new THREE.DirectionalLight(0xffedca,3.4);key.position.set(-4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9bc7d1,1.5);rim.position.set(5,4,-4);scene.add(rim);

  const stageRoot=new THREE.Group();scene.add(stageRoot);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4.8,64),new THREE.MeshStandardMaterial({color:0x18211f,roughness:.94,metalness:.02}));
  ground.rotation.x=-Math.PI/2;stageRoot.add(ground);
  const contact=new THREE.Mesh(new THREE.RingGeometry(.7,.73,64),new THREE.MeshBasicMaterial({color:0x53615c,transparent:true,opacity:.38,side:THREE.DoubleSide}));
  contact.rotation.x=-Math.PI/2;contact.position.y=.012;stageRoot.add(contact);

  const techniqueRoot=new THREE.Group();techniqueRoot.name='ReviewTechniquePreview';techniqueRoot.visible=false;stageRoot.add(techniqueRoot);
  const techniqueRingMaterial=new THREE.MeshBasicMaterial({color:0xc7a15d,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const techniqueArcMaterial=new THREE.MeshBasicMaterial({color:0xe3c77f,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const techniqueBurstMaterial=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:0,side:THREE.DoubleSide,depthWrite:false,blending:THREE.AdditiveBlending});
  const techniqueRing=new THREE.Mesh(new THREE.RingGeometry(.48,.64,48),techniqueRingMaterial);techniqueRing.rotation.x=-Math.PI/2;techniqueRing.position.y=.035;
  const techniqueArc=new THREE.Mesh(new THREE.TorusGeometry(.86,.052,7,40,Math.PI*1.42),techniqueArcMaterial);techniqueArc.position.y=1.02;techniqueArc.rotation.z=-.75;
  const techniqueBurst=new THREE.Mesh(new THREE.RingGeometry(.12,.34,40),techniqueBurstMaterial);techniqueBurst.position.y=.98;
  techniqueRoot.add(techniqueRing,techniqueArc,techniqueBurst);
  let techniquePreview=null;

  const [runtime,equipmentAssets]=await Promise.all([
    createKaykitCharacterPools(renderer,{onProgress:snapshot=>{
      if(snapshot?.state==='loading')onStatus(`モデル準備中 · ${modelLabel(snapshot.modelId)}`);
    }}),
    loadReviewEquipment()
  ]);
  const pool=runtime.pool;
  const sides={
    hero:{key:'hero',actorId:'review-battle-hero',requested:'kaykit.rogue.v1',actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-hero',0x51f15e)),previous:null,hp:null,hitUntil:0,marker:ring(0xd9b45b)},
    enemy:{key:'enemy',actorId:'review-battle-enemy',requested:'kaykit.knight.v1',actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-enemy',0x91cafe)),previous:null,hp:null,hitUntil:0,marker:ring(0x82aeb6)}
  };
  let encounterMode='duel',extras=[];
  stageRoot.add(sides.hero.marker,sides.enemy.marker);
  const previewColors=Object.freeze({jo:0x73bce5,ha:0xc7a15d,kyu:0xe27658});
  function triggerTechnique({id='',name='技',phase='jo'}={}){
    const selected=['jo','ha','kyu'].includes(phase)?phase:'jo',startedAt=performance.now()/1000,color=previewColors[selected];
    techniquePreview={id:String(id||''),name:String(name||'技'),phase:selected,startedAt,duration:1.22,variant:Math.floor(Math.random()*3)};
    techniqueRingMaterial.color.setHex(color);techniqueArcMaterial.color.setHex(color);techniqueBurstMaterial.color.setHex(selected==='jo'?0x9bd7f1:selected==='kyu'?0xffb08e:0xe3c77f);
    techniqueRoot.visible=true;canvas.dataset.reviewTechnique=techniquePreview.name;canvas.dataset.reviewTechniquePhase=selected;
    return Object.freeze({durationMs:Math.round(techniquePreview.duration*1000),impactDelayMs:selected==='kyu'?390:selected==='ha'?330:285});
  }
  function clearTechnique(){techniquePreview=null;techniqueRoot.visible=false;techniqueRingMaterial.opacity=0;techniqueArcMaterial.opacity=0;techniqueBurstMaterial.opacity=0;}
  function previewProgress(time){if(!techniquePreview)return null;const t=(time-techniquePreview.startedAt)/techniquePreview.duration;if(t<0)return 0;if(t>=1){clearTechnique();return null;}return clamp(t,0,1);}
  function applyTechniquePose(bones,time){
    const t=previewProgress(time);if(t==null||!techniquePreview)return;
    const strike=Math.sin(Math.PI*t),weight=techniquePreview.phase==='kyu'?1.2:techniquePreview.phase==='ha'?1.04:.9,variant=techniquePreview.variant;
    if(variant===0){if(bones.spine){bones.spine.rotation.y+=.52*strike*weight;bones.spine.rotation.z-=.12*strike;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.72*strike*weight;bones.rightUpperArm.rotation.z-=.48*strike;}if(bones.leftUpperArm)bones.leftUpperArm.rotation.z+=.2*strike;}
    else if(variant===1){if(bones.spine){bones.spine.rotation.x+=.16*strike;bones.spine.rotation.y-=.28*strike*weight;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=1.02*strike*weight;bones.rightUpperArm.rotation.y+=.18*strike;}if(bones.rightLowerArm)bones.rightLowerArm.rotation.x-=.42*strike;}
    else{if(bones.spine){bones.spine.rotation.x-=.12*strike;bones.spine.rotation.y+=.2*strike;}if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=1.25*strike*weight;bones.rightUpperArm.rotation.z+=.26*strike;}if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=.36*strike;}
    if(bones.hips)bones.hips.rotation.y-=.18*strike*weight;if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=.12*strike;if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=.08*strike;
  }
  function updateTechniqueFx(time){
    const t=previewProgress(time),actor=sides.hero.actor;if(t==null||!techniquePreview||!actor){techniqueRoot.visible=false;return;}
    techniqueRoot.visible=true;techniqueRoot.position.copy(actor.root.position);techniqueRoot.rotation.y=actor.root.rotation.y;
    const pulse=Math.sin(Math.PI*t),fade=Math.pow(1-t,.72);
    const ringScale=.72+t*1.35;techniqueRing.scale.setScalar(ringScale);techniqueRingMaterial.opacity=.58*fade;
    techniqueArc.rotation.z=-.9+t*2.2+techniquePreview.variant*.24;techniqueArc.scale.setScalar(.78+pulse*.52);techniqueArcMaterial.opacity=.88*pulse;
    techniqueBurst.scale.setScalar(.7+t*1.7);techniqueBurstMaterial.opacity=.78*pulse*fade;
  }

  function install(sideKey,modelId){
    const side=sides[sideKey];
    if(!side||!REVIEW_BATTLE_MODELS.some(row=>row.id===modelId))throw Error(`Unknown review battle model: ${modelId}`);
    if(side.actor)pool.despawn(side.actorId);
    side.requested=modelId;runtime.manifestation.focusModel(modelId,320);
    side.actor=pool.spawn(side.actorId,modelId);
    side.actor.root.name=`ReviewBattle:${sideKey}`;side.actor.attachments.name=`ReviewBattleAttachments:${sideKey}`;
    installReviewEquipment(side.actor,modelId,equipmentAssets);
    stageRoot.add(side.actor.root,side.actor.attachments);side.previous=null;side.hp=null;
    canvas.dataset[`${sideKey}RequestedModel`]=modelId;
    if(encounterMode==='melee')queueMicrotask(rebuildExtras);
  }
  install('hero',sides.hero.requested);install('enemy',sides.enemy.requested);

  function clearExtras(){
    for(const extra of extras){pool.despawn(extra.actorId);extra.actor?.root?.removeFromParent();extra.actor?.attachments?.removeFromParent();}
    extras=[];
  }
  function rebuildExtras(){
    clearExtras();
    if(encounterMode!=='melee')return;
    const specs=[['hero',0,-1.55,1.25,0x13579bdf],['hero',1,-1.65,-1.2,0x2468ace0],['enemy',0,1.55,1.25,0x10293847],['enemy',1,1.65,-1.2,0x56473829]];
    for(const [sideKey,index,offsetX,offsetZ,seed] of specs){
      const base=sides[sideKey],actorId=`review-battle-${sideKey}-extra-${index}`,actor=pool.spawn(actorId,base.requested);
      actor.root.name=`ReviewBattleExtra:${sideKey}:${index}`;actor.attachments.name=`ReviewBattleExtraAttachments:${sideKey}:${index}`;
      installReviewEquipment(actor,base.requested,equipmentAssets);stageRoot.add(actor.root,actor.attachments);
      extras.push({sideKey,index,actorId,actor,offsetX,offsetZ,appearance:appearanceForCharacter(reviewerCharacter(actorId,seed))});
    }
  }
  function setEncounterMode(mode){
    const next=mode==='melee'?'melee':'duel';if(next===encounterMode&&((next==='duel'&&extras.length===0)||(next==='melee'&&extras.length===4)))return;
    encounterMode=next;rebuildExtras();canvas.dataset.encounterMode=encounterMode;
  }

  function animateSide(sideKey,state,target,time,dt){
    const side=sides[sideKey],actor=side.actor;if(!actor||!state)return;
    const x=Number(state.x)||0,z=Number(state.z)||0;
    const previous=side.previous||{x,z},distance=Math.hypot(x-previous.x,z-previous.z),stride=clamp(distance/Math.max(.001,dt||1/60)*.18,0,1);
    side.previous={x,z};
    if(Number.isFinite(state.hp)&&side.hp!==null&&state.hp<side.hp)side.hitUntil=time+.14;
    side.hp=Number.isFinite(state.hp)?state.hp:side.hp;
    const frame=tidebreakFrameFromSnapshot(state,{targetId:target?.id||null,intent:'review-battle'});
    const worldX=x*1.35,worldZ=z*1.15,targetX=(Number(target?.x)||0)*1.35,targetZ=(Number(target?.z)||0)*1.15,yaw=Math.atan2(targetX-worldX,targetZ-worldZ);
    actor.root.position.set(worldX,0,worldZ);actor.root.rotation.y=yaw;
    if(sideKey==='hero'&&techniquePreview){const t=previewProgress(time);if(t!=null){const lunge=Math.sin(Math.PI*t)*(techniquePreview.phase==='kyu'?.34:techniquePreview.phase==='ha'?.27:.21);actor.root.position.x+=Math.sin(yaw)*lunge;actor.root.position.z+=Math.cos(yaw)*lunge;}}
    actor.sample(side.appearance,time,(bones,sampleTime)=>{
      addStride(bones,sampleTime,stride);
      if(!frame?.attack)addGuardPose(bones,sideKey);
      applyTidebreakPose(bones,frame);
      if(sideKey==='hero')applyTechniquePose(bones,time);
      if(time<side.hitUntil&&bones.spine)bones.spine.rotation.z+=(sideKey==='hero'?-1:1)*.13;
    });
    actor.updateAttachments();side.marker.position.set(worldX,.018,worldZ);
  }

  function animateExtras(core,time){
    if(encounterMode!=='melee'||!core)return;
    for(const extra of extras){
      const source=extra.sideKey==='hero'?core.hero:core.enemy,target=extra.sideKey==='hero'?core.enemy:core.hero,actor=extra.actor;if(!source||!actor)continue;
      const x=(Number(source.x)||0)*1.35+extra.offsetX,z=(Number(source.z)||0)*1.15+extra.offsetZ,targetX=(Number(target?.x)||0)*1.35,targetZ=(Number(target?.z)||0)*1.15;
      actor.root.position.set(x,0,z);actor.root.rotation.y=Math.atan2(targetX-x,targetZ-z);
      const frame=tidebreakFrameFromSnapshot(source,{targetId:target?.id||null,intent:'review-battle-melee'});
      actor.sample(extra.appearance,time+extra.index*.17,(bones,sampleTime)=>{addStride(bones,sampleTime,.2);if(!frame?.attack)addGuardPose(bones,extra.sideKey);applyTidebreakPose(bones,frame);});
      actor.updateAttachments();
    }
  }

  let lastWidth=0,lastHeight=0,lastStatus='';
  function resize(){
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

  function updateCamera(core,dt,followCamera,cameraSystem){
    const frame=reviewBattleCameraFrame(core,{follow:followCamera,system:cameraSystem,encounterMode});
    cameraTargetPosition.set(frame.position.x,frame.position.y,frame.position.z);cameraTargetLook.set(frame.look.x,frame.look.y,frame.look.z);
    const step=Math.max(1/120,Math.min(.05,Number(dt)||1/60)),positionBlend=1-Math.exp(-step*(cameraSystem==='rinne'?5.6:8)),lookBlend=1-Math.exp(-step*(cameraSystem==='rinne'?7.2:8));
    camera.position.lerp(cameraTargetPosition,positionBlend);cameraLook.lerp(cameraTargetLook,lookBlend);camera.lookAt(cameraLook);
    canvas.dataset.cameraFollow=followCamera?'on':'off';canvas.dataset.cameraSystem=cameraSystem;
  }

  function sync(core,dt=0,{followCamera=true,encounterMode:requestedMode='duel',cameraSystem='rinne'}={}){
    setEncounterMode(requestedMode);resize();const now=performance.now()/1000;
    if(core){animateSide('hero',core.hero,core.enemy,now,dt);animateSide('enemy',core.enemy,core.hero,now,dt);animateExtras(core,now);}
    updateTechniqueFx(now);updateCamera(core,dt,followCamera,cameraSystem);
    const heroActual=sides.hero.actor?.root?.userData?.characterModel||'';
    const enemyActual=sides.enemy.actor?.root?.userData?.characterModel||'';
    canvas.dataset.heroModel=heroActual;canvas.dataset.enemyModel=enemyActual;
    const ready=heroActual===sides.hero.requested&&enemyActual===sides.enemy.requested;
    canvas.dataset.battleModels=ready?'ready':'loading';canvas.dataset.battleGeometry='runtime-models';
    const modeLabel=encounterMode==='melee'?'乱戦 3v3':'タイマン';
    const status=ready?`${modeLabel} · ${modelLabel(heroActual)} × ${modelLabel(enemyActual)}`:`モデル読込中 · ${modelLabel(sides.hero.requested)} × ${modelLabel(sides.enemy.requested)}`;
    if(status!==lastStatus){lastStatus=status;onStatus(status);}
    renderer.render(scene,camera);
  }

  return Object.freeze({
    models:REVIEW_BATTLE_MODELS,
    setModel(side,modelId){install(side,modelId);},
    setEncounterMode,
    triggerTechnique,
    clearTechnique,
    resetRound(){clearTechnique();for(const side of Object.values(sides)){side.previous=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on',encounterMode});},
    dispose(){observer.disconnect();clearExtras();clearTechnique();for(const side of Object.values(sides))if(side.actor)pool.despawn(side.actorId);runtime.dispose();ground.geometry.dispose();ground.material.dispose();contact.geometry.dispose();contact.material.dispose();techniqueRing.geometry.dispose();techniqueRingMaterial.dispose();techniqueArc.geometry.dispose();techniqueArcMaterial.dispose();techniqueBurst.geometry.dispose();techniqueBurstMaterial.dispose();for(const side of Object.values(sides)){side.marker.geometry.dispose();side.marker.material.dispose();}for(const source of equipmentAssets.values()){source.traverse(node=>{node.geometry?.dispose?.();const mats=Array.isArray(node.material)?node.material:[node.material];for(const mat of mats.filter(Boolean)){mat.map?.dispose?.();mat.dispose?.();}});}renderer.dispose();}
  });
}
