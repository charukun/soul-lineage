import * as THREE from 'three';
import {YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {createProtagonistCharacterPool} from './rebuild/protagonist-character-pool.js';
import {RINNE_PROTAGONIST_MODEL_ID} from './rebuild/protagonist-runtime-asset.js';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from './rebuild/tidebreak-pose.js';
import {reviewBattleCameraFrame,reviewBattleMultiHitFrame,reviewBattlePresentationFrame} from './review-battle-state.js';
import {REVIEW_MONSTER_MODELS,disposeReviewMonsterModel,loadReviewMonsterModel,updateReviewMonsterAnimation} from './review-battle-monster.js';

export const REVIEW_BATTLE_MODELS=REVIEW_MONSTER_MODELS;

const clamp=(value,lo,hi)=>Math.min(hi,Math.max(lo,value));
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
  const aura=new THREE.Group();aura.visible=false;const auraMaterial=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide});for(const radius of [.62,.82]){const ringMesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),auraMaterial.clone());ringMesh.rotation.x=-Math.PI/2;aura.add(ringMesh);}const auraLight=new THREE.PointLight(0x73bce5,0,3.4);auraLight.position.y=.85;aura.add(auraLight);stageRoot.add(aura);

  const [protagonistRuntime,monsterEnemy,monsterFlankA,monsterFlankB]=await Promise.all([
    createProtagonistCharacterPool(renderer),
    loadReviewMonsterModel('goblin-runt'),
    loadReviewMonsterModel('horn-brute'),
    loadReviewMonsterModel('maw-stalker')
  ]);
  const heroPool=protagonistRuntime.pool;
  const sides={
    hero:{key:'hero',actorId:'review-battle-hero',requested:RINNE_PROTAGONIST_MODEL_ID,actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-hero',0x51f15e)),previous:null,presentation:null,hp:null,hitUntil:0,marker:ring(0xd9b45b)},
    enemy:{key:'enemy',actorId:'review-battle-enemy',requested:'goblin-runt',actor:monsterEnemy,appearance:null,previous:null,presentation:null,hp:null,hitUntil:0,marker:ring(0x82aeb6)}
  };
  let encounterMode='duel',extras=[],cinematicUntil=0,techniquePlayback=null;
  stageRoot.add(sides.hero.marker,sides.enemy.marker);

  function install(sideKey,modelId){
    const side=sides[sideKey];
    if(!side)throw Error(`Unknown review battle side: ${sideKey}`);
    if(sideKey==='hero'){
      if(side.actor)heroPool.despawn(side.actorId);
      side.requested=RINNE_PROTAGONIST_MODEL_ID;
      side.actor=heroPool.spawn(side.actorId);
      side.actor.root.name='ReviewBattle:hero';side.actor.attachments.name='ReviewBattleAttachments:hero';
      stageRoot.add(side.actor.root,side.actor.attachments);
    }else{
      if(modelId!=='goblin-runt')throw Error(`Unknown review monster: ${modelId}`);
      side.requested='goblin-runt';side.actor=monsterEnemy;stageRoot.add(side.actor.root);
    }
    side.previous=null;side.presentation=null;side.hp=null;
    canvas.dataset[`${sideKey}RequestedModel`]=side.requested;
    if(encounterMode==='one-v-three')queueMicrotask(rebuildExtras);
  }
  install('hero',sides.hero.requested);install('enemy',sides.enemy.requested);

  function clearExtras(){for(const extra of extras)extra.actor?.root?.removeFromParent();extras=[];}
  function rebuildExtras(){
    clearExtras();if(encounterMode!=='one-v-three')return;
    const specs=[[monsterFlankA,0,1.35,1.35],[monsterFlankB,1,1.5,-1.25]];
    for(const [actor,index,offsetX,offsetZ] of specs){stageRoot.add(actor.root);extras.push({sideKey:'enemy',index,actorId:`review-battle-enemy-extra-${index}`,actor,offsetX,offsetZ,hitUntil:0,recoil:0});}
  }
  function setEncounterMode(mode){
    const next=mode==='one-v-three'?'one-v-three':'duel';if(next===encounterMode&&((next==='duel'&&extras.length===0)||(next==='one-v-three'&&extras.length===2)))return;
    encounterMode=next;rebuildExtras();canvas.dataset.encounterMode=encounterMode;
  }

  function setHeroWeapon(weapon='sword'){
    const actor=sides.hero.actor;if(!actor)return;actor.detachWeapon?.('reviewWeapon');if(weapon==='fist')return;
    const group=new THREE.Group(),metal=new THREE.MeshStandardMaterial({color:0xb7bec4,roughness:.3,metalness:.78}),wood=new THREE.MeshStandardMaterial({color:0x5b3d2b,roughness:.78});
    const length={dagger:.48,sword:.82,spear:1.55,great:1.18,axe:.92,staff:1.45}[weapon]||.82;
    const shaft=new THREE.Mesh(new THREE.CylinderGeometry(weapon==='great'?.045:.025,weapon==='great'?.055:.03,length,8),weapon==='staff'?wood:metal);shaft.rotation.z=Math.PI/2;group.add(shaft);
    if(weapon==='axe'){const head=new THREE.Mesh(new THREE.BoxGeometry(.16,.42,.08),metal);head.position.x=length*.42;group.add(head);}else if(weapon==='spear'){const tip=new THREE.Mesh(new THREE.ConeGeometry(.07,.28,8),metal);tip.rotation.z=-Math.PI/2;tip.position.x=length*.58;group.add(tip);}
    actor.attachWeapon('reviewWeapon',group,{bone:'rightHand',position:[0,.02,0],quaternion:[0,0,0,1],scale:1});
  }
  function animateSide(sideKey,state,target,time,dt){
    const side=sides[sideKey],actor=side.actor;if(!actor||!state)return;
    const x=Number(state.x)||0,z=Number(state.z)||0;
    const hit=Number.isFinite(state.hp)&&side.hp!==null&&state.hp<side.hp;
    if(hit)side.hitUntil=time+.14;
    side.hp=Number.isFinite(state.hp)?state.hp:side.hp;
    let frame=tidebreakFrameFromSnapshot(state,{targetId:target?.id||null,intent:'review-battle'});
    if(sideKey==='hero'&&techniquePlayback&&time<techniquePlayback.until){const elapsed=1-(techniquePlayback.until-time)/techniquePlayback.duration,steps=techniquePlayback.steps||[],index=Math.min(steps.length-1,Math.floor(Math.max(0,elapsed)*Math.max(1,steps.length))),step=steps[index];if(step)frame=tidebreakFrameFromSnapshot({...state,attack:step.kind,progress:(Math.max(0,elapsed)*Math.max(1,steps.length))%1,slot:techniquePlayback.phase},{targetId:target?.id||null,intent:'review-battle-inspiration'});}else if(sideKey==='hero'&&techniquePlayback&&time>=techniquePlayback.until)techniquePlayback=null;
    const presentation=reviewBattlePresentationFrame(state,target,side.presentation,dt,{hit});
    side.presentation=presentation;side.previous={x,z};
    const worldX=presentation.x,worldZ=presentation.z,stride=presentation.stride;
    actor.root.position.set(worldX,0,worldZ);actor.root.rotation.y=presentation.yaw;
    if(sideKey==='enemy'){
      updateReviewMonsterAnimation(actor,state,time,{hit:time<side.hitUntil});
    }else{
      actor.sample(side.appearance,time,(bones,sampleTime)=>{
        addStride(bones,sampleTime,stride);
        if(!frame?.attack)addGuardPose(bones,sideKey);
        applyTidebreakPose(bones,frame);
        if(time<side.hitUntil&&bones.spine)bones.spine.rotation.z-=.13;
      });
      actor.updateAttachments();
    }
    side.marker.position.set(worldX,.018,worldZ);
  }

  function animateExtras(core,time,dt){
    if(encounterMode!=='one-v-three'||!core)return;
    const multi=reviewBattleMultiHitFrame(core.hero,{encounterMode});
    for(const extra of extras){
      const source=core.enemy,target=core.hero,actor=extra.actor;if(!source||!actor)continue;
      if(multi.active&&time>=extra.hitUntil){extra.hitUntil=time+.16;extra.recoil=Math.max(extra.recoil,multi.recoil*(1-extra.index*.12));}
      extra.recoil=Math.max(0,extra.recoil-Math.max(1/240,Number(dt)||1/60)*1.7);
      const baseX=(Number(source.x)||0)*1.35+extra.offsetX,baseZ=(Number(source.z)||0)*1.15+extra.offsetZ,targetX=(Number(target?.x)||0)*1.35,targetZ=(Number(target?.z)||0)*1.15;
      const awayX=baseX-targetX,awayZ=baseZ-targetZ,awayLength=Math.max(.001,Math.hypot(awayX,awayZ)),x=baseX+awayX/awayLength*extra.recoil,z=baseZ+awayZ/awayLength*extra.recoil;
      actor.root.position.set(x,0,z);actor.root.rotation.y=Math.atan2(targetX-x,targetZ-z);
      updateReviewMonsterAnimation(actor,source,time+extra.index*.17,{hit:time<extra.hitUntil});
    }
    canvas.dataset.multiHit=multi.active?String(multi.count):'1';canvas.dataset.multiHitPhase=multi.active?multi.phase:'';
  }

  let lastWidth=0,lastHeight=0,lastStatus='';
  function resize(){
    const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight);
    if(width===lastWidth&&height===lastHeight)return;lastWidth=width;lastHeight=height;
    renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
  }
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();

  function updateCamera(core,dt,followCamera,cameraSystem){
    let frame=reviewBattleCameraFrame(core,{follow:followCamera,system:cameraSystem,encounterMode});
    const now=performance.now()/1000;
    if(now<cinematicUntil&&core?.hero&&core?.enemy){const hx=Number(core.hero.x||0)*1.35,hz=Number(core.hero.z||0)*1.15,ex=Number(core.enemy.x||0)*1.35,ez=Number(core.enemy.z||0)*1.15,dx=ex-hx,dz=ez-hz,len=Math.max(.01,Math.hypot(dx,dz)),rx=dz/len,rz=-dx/len;frame={position:{x:hx-dx/len*1.7+rx*.9,y:.62,z:hz-dz/len*1.7+rz*.9},look:{x:hx+dx*.58,y:1.02,z:hz+dz*.58},follow:true,system:'inspiration',count:encounterMode==='one-v-three'?3:1};}
    cameraTargetPosition.set(frame.position.x,frame.position.y,frame.position.z);cameraTargetLook.set(frame.look.x,frame.look.y,frame.look.z);
    const step=Math.max(1/120,Math.min(.05,Number(dt)||1/60)),blend=1-Math.exp(-step*8);
    camera.position.lerp(cameraTargetPosition,blend);cameraLook.lerp(cameraTargetLook,blend);camera.lookAt(cameraLook);
    canvas.dataset.cameraFollow=followCamera?'on':'off';
  }

  function sync(core,dt=0,{followCamera=true,encounterMode:requestedMode='duel',cameraSystem='rinne'}={}){
    setEncounterMode(requestedMode);resize();const now=performance.now()/1000;
    if(core){animateSide('hero',core.hero,core.enemy,now,dt);animateSide('enemy',core.enemy,core.hero,now,dt);animateExtras(core,now,dt);}
    updateCamera(core,dt,followCamera,cameraSystem);
    const cinematic=performance.now()/1000<cinematicUntil;aura.visible=cinematic;if(cinematic&&sides.hero.actor){aura.position.copy(sides.hero.actor.root.position);aura.position.y=.025;const pulse=.92+Math.sin(performance.now()*.018)*.08;aura.scale.setScalar(pulse);auraLight.intensity=1.5+Math.sin(performance.now()*.022)*.55;}
    const phaseHud=canvas.closest('.stage')?.querySelector('#battle-phase'),heroRoot=sides.hero.actor?.root;
    if(phaseHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=1.82;projected.project(camera);phaseHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');phaseHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');phaseHud.style.setProperty('bottom','auto','important');}
    const heroActual=sides.hero.actor?.root?.userData?.characterModel||'';
    const enemyActual=sides.enemy.actor?.root?.userData?.reviewMonsterSpecies||'';
    canvas.dataset.heroModel=heroActual;canvas.dataset.enemyModel=enemyActual;
    const ready=heroActual===RINNE_PROTAGONIST_MODEL_ID&&enemyActual===sides.enemy.requested;
    canvas.dataset.battleModels=ready?'ready':'loading';canvas.dataset.battleGeometry='runtime-monster-models';
    const modeLabel=encounterMode==='one-v-three'?'1v3':'1v1';
    const status=ready?`${modeLabel} · 主人公 × ${modelLabel(enemyActual)}`:`モデル読込中 · 主人公 × ${modelLabel(sides.enemy.requested)}`;
    if(status!==lastStatus){lastStatus=status;onStatus(status);}
    renderer.render(scene,camera);
  }

  return Object.freeze({
    models:REVIEW_BATTLE_MODELS,
    setModel(side,modelId){if(side==='hero')return;install(side,modelId);},
    setEncounterMode,
    setWeapon(weapon){setHeroWeapon(weapon);},
    triggerInspiration({steps=[],phase='ha',duration=1.35}={}){const now=performance.now()/1000;cinematicUntil=now+Math.max(.8,duration);techniquePlayback={steps,phase,duration:Math.max(.8,duration),until:now+Math.max(.8,duration)};canvas.closest('.stage')?.setAttribute('data-inspiration-cinematic','true');setTimeout(()=>canvas.closest('.stage')?.removeAttribute('data-inspiration-cinematic'),Math.max(800,duration*1000));},
    resetRound(){for(const side of Object.values(sides)){side.previous=null;side.presentation=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on',encounterMode});},
    dispose(){observer.disconnect();clearExtras();if(sides.hero.actor)heroPool.despawn(sides.hero.actorId);protagonistRuntime.dispose();for(const monster of [monsterEnemy,monsterFlankA,monsterFlankB])disposeReviewMonsterModel(monster);ground.geometry.dispose();ground.material.dispose();contact.geometry.dispose();contact.material.dispose();for(const side of Object.values(sides)){side.marker.geometry.dispose();side.marker.material.dispose();}renderer.dispose();}
  });
}
