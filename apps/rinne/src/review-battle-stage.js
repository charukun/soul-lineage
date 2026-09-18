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
  const camera=new THREE.PerspectiveCamera(40,1,.08,50);camera.position.set(0,5.2,10);
  const cameraLook=new THREE.Vector3(0,.95,0),cameraTargetPosition=new THREE.Vector3(),cameraTargetLook=new THREE.Vector3();camera.lookAt(cameraLook);
  scene.add(new THREE.HemisphereLight(0xdde8e3,0x24302d,2.35));
  const key=new THREE.DirectionalLight(0xffedca,3.4);key.position.set(-4,7,5);scene.add(key);
  const rim=new THREE.DirectionalLight(0x9bc7d1,1.5);rim.position.set(5,4,-4);scene.add(rim);

  const stageRoot=new THREE.Group();scene.add(stageRoot);
  const ground=new THREE.Mesh(new THREE.CircleGeometry(4.8,64),new THREE.MeshStandardMaterial({color:0x18211f,roughness:.94,metalness:.02}));
  ground.rotation.x=-Math.PI/2;stageRoot.add(ground);
  const contact=new THREE.Mesh(new THREE.RingGeometry(.7,.73,64),new THREE.MeshBasicMaterial({color:0x53615c,transparent:true,opacity:.38,side:THREE.DoubleSide}));
  contact.rotation.x=-Math.PI/2;contact.position.y=.012;stageRoot.add(contact);

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
  stageRoot.add(sides.hero.marker,sides.enemy.marker);

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
  }
  install('hero',sides.hero.requested);install('enemy',sides.enemy.requested);

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
    actor.sample(side.appearance,time,(bones,sampleTime)=>{
      addStride(bones,sampleTime,stride);
      if(!frame?.attack)addGuardPose(bones,sideKey);
      applyTidebreakPose(bones,frame);
      if(time<side.hitUntil&&bones.spine)bones.spine.rotation.z+=(sideKey==='hero'?-1:1)*.13;
    });
    actor.updateAttachments();side.marker.position.set(worldX,.018,worldZ);
  }

  let lastWidth=0,lastHeight=0,lastStatus='';
  function resize(){
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

  function updateCamera(core,dt,followCamera){
    const frame=reviewBattleCameraFrame(core,{follow:followCamera});
    cameraTargetPosition.set(frame.position.x,frame.position.y,frame.position.z);cameraTargetLook.set(frame.look.x,frame.look.y,frame.look.z);
    const step=Math.max(1/120,Math.min(.05,Number(dt)||1/60)),blend=1-Math.exp(-step*8);
    camera.position.lerp(cameraTargetPosition,blend);cameraLook.lerp(cameraTargetLook,blend);camera.lookAt(cameraLook);
    canvas.dataset.cameraFollow=followCamera?'on':'off';
  }

  function sync(core,dt=0,{followCamera=true}={}){
    resize();const now=performance.now()/1000;
    if(core){animateSide('hero',core.hero,core.enemy,now,dt);animateSide('enemy',core.enemy,core.hero,now,dt);}
    updateCamera(core,dt,followCamera);
    const heroActual=sides.hero.actor?.root?.userData?.characterModel||'';
    const enemyActual=sides.enemy.actor?.root?.userData?.characterModel||'';
    canvas.dataset.heroModel=heroActual;canvas.dataset.enemyModel=enemyActual;
    const ready=heroActual===sides.hero.requested&&enemyActual===sides.enemy.requested;
    canvas.dataset.battleModels=ready?'ready':'loading';canvas.dataset.battleGeometry='runtime-models';
    const status=ready?`${modelLabel(heroActual)} × ${modelLabel(enemyActual)}`:`モデル読込中 · ${modelLabel(sides.hero.requested)} × ${modelLabel(sides.enemy.requested)}`;
    if(status!==lastStatus){lastStatus=status;onStatus(status);}
    renderer.render(scene,camera);
  }

  return Object.freeze({
    models:REVIEW_BATTLE_MODELS,
    setModel(side,modelId){install(side,modelId);},
    resetRound(){for(const side of Object.values(sides)){side.previous=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on'});},
    dispose(){observer.disconnect();for(const side of Object.values(sides))if(side.actor)pool.despawn(side.actorId);runtime.dispose();ground.geometry.dispose();ground.material.dispose();contact.geometry.dispose();contact.material.dispose();for(const side of Object.values(sides)){side.marker.geometry.dispose();side.marker.material.dispose();}for(const source of equipmentAssets.values()){source.traverse(node=>{node.geometry?.dispose?.();const mats=Array.isArray(node.material)?node.material:[node.material];for(const mat of mats.filter(Boolean)){mat.map?.dispose?.();mat.dispose?.();}});}renderer.dispose();}
  });
}
