import * as THREE from 'three';
import {YEAR_MS,appearanceForCharacter,createCharacter} from '@soul/characters';
import {createProtagonistCharacterPool} from './rebuild/protagonist-character-pool.js';
import {RINNE_PROTAGONIST_MODEL_ID} from './rebuild/protagonist-runtime-asset.js';
import {applyTidebreakPose,tidebreakFrameFromSnapshot} from './rebuild/tidebreak-pose.js';
import {reviewBattleCameraFrame,reviewBattleMultiHitFrame,reviewBattlePresentationFrame} from './review-battle-state.js';
import {REVIEW_MONSTER_MODELS,disposeReviewMonsterModel,loadReviewMonsterModel,updateReviewMonsterAnimation} from './review-battle-monster.js';
import {REVIEW_INSPIRATION_TIMELINE,reviewInspirationSequenceFrame} from './review-battle-inspiration.js';

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

export async function createReviewBattleStage({canvas,onStatus=()=>{},onInspirationCue=()=>{}}={}){
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
  const inspirationFx=new THREE.Group();inspirationFx.visible=false;stageRoot.add(inspirationFx);
  const fxGold=new THREE.MeshBasicMaterial({color:0xf4d483,transparent:true,opacity:.75,depthWrite:false,side:THREE.DoubleSide}),fxBlue=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide});
  const fxRings=[];for(const radius of [.68,.92,1.18]){const mesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.035,48),fxGold.clone());mesh.rotation.x=-Math.PI/2;inspirationFx.add(mesh);fxRings.push(mesh);}
  const fxRays=[];for(let i=0;i<10;i++){const ray=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,1.5),fxBlue.clone());ray.position.y=.85;ray.rotation.y=(Math.PI*2*i)/10;ray.rotation.x=Math.PI/2;inspirationFx.add(ray);fxRays.push(ray);}
  const fxArc=new THREE.Mesh(new THREE.TorusGeometry(.9,.035,8,48,Math.PI*1.55),fxGold.clone());fxArc.position.y=1.05;fxArc.rotation.set(Math.PI/2,.2,-.55);inspirationFx.add(fxArc);
  const aura=new THREE.Group();aura.visible=false;const auraMaterial=new THREE.MeshBasicMaterial({color:0x73bce5,transparent:true,opacity:.46,depthWrite:false,side:THREE.DoubleSide});for(const radius of [.62,.82]){const ringMesh=new THREE.Mesh(new THREE.RingGeometry(radius,radius+.025,48),auraMaterial.clone());ringMesh.rotation.x=-Math.PI/2;aura.add(ringMesh);}const auraLight=new THREE.PointLight(0x73bce5,0,3.4);auraLight.position.y=.85;aura.add(auraLight);stageRoot.add(aura);

  const [protagonistRuntime,monsterEnemy,monsterFlankA,monsterFlankB]=await Promise.all([
    createProtagonistCharacterPool(renderer),
    loadReviewMonsterModel('skeleton-minion'),
    loadReviewMonsterModel('skeleton-warrior'),
    loadReviewMonsterModel('skeleton-rogue')
  ]);
  const heroPool=protagonistRuntime.pool;
  const sides={
    hero:{key:'hero',actorId:'review-battle-hero',requested:RINNE_PROTAGONIST_MODEL_ID,actor:null,appearance:appearanceForCharacter(reviewerCharacter('review-battle-hero',0x51f15e)),previous:null,presentation:null,hp:null,hitUntil:0,marker:ring(0xd9b45b)},
    enemy:{key:'enemy',actorId:'review-battle-enemy',requested:'skeleton-minion',actor:monsterEnemy,appearance:null,previous:null,presentation:null,hp:null,hitUntil:0,marker:ring(0x82aeb6)}
  };
  let encounterMode='duel',extras=[],cinematicUntil=0,techniquePlayback=null,cameraOrbit=0,cameraZoom=.82;
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
      if(modelId!=='skeleton-minion')throw Error(`Unknown review monster: ${modelId}`);
      side.requested='skeleton-minion';side.actor=monsterEnemy;stageRoot.add(side.actor.root);
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
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(time-techniquePlayback.startedAt):null;if(sideKey==='hero'&&techniquePlayback&&sequence?.stage==='execute'){const steps=techniquePlayback.steps||[],scaled=sequence.executeProgress*Math.max(1,steps.length),index=Math.min(steps.length-1,Math.floor(scaled)),step=steps[index];if(step)frame=tidebreakFrameFromSnapshot({...state,attack:step.kind,progress:scaled%1,slot:techniquePlayback.phase},{targetId:target?.id||null,intent:'review-battle-inspiration'});}
    const presentation=reviewBattlePresentationFrame(state,target,side.presentation,dt,{hit});
    side.presentation=presentation;side.previous={x,z};
    const worldX=presentation.x,worldZ=presentation.z,stride=presentation.stride;
    actor.root.position.set(worldX,0,worldZ);actor.root.rotation.y=presentation.yaw;
    if(sequence&&sequence.stage!=='done'&&target){const tx=(Number(target.x)||0)*1.35,tz=(Number(target.z)||0)*1.15,dx=worldX-tx,dz=worldZ-tz,len=Math.max(.001,Math.hypot(dx,dz));if(sideKey==='hero'&&sequence.spacing>0){actor.root.position.x+=dx/len*.72*sequence.spacing;actor.root.position.z+=dz/len*.72*sequence.spacing;}if(sideKey==='enemy'&&(sequence.stage==='stagger'||sequence.stage==='reveal')){actor.root.position.x-=dx/len*.18;actor.root.position.z-=dz/len*.18;actor.root.rotation.z=.12*Math.sin(sequence.progress*Math.PI);}}
    if(sideKey==='enemy'){
      updateReviewMonsterAnimation(actor,state,time,{hit:time<side.hitUntil});
    }else{
      actor.sample(side.appearance,time,(bones,sampleTime)=>{
        addStride(bones,sampleTime,stride);
        if(sequence?.stage==='reveal'){if(bones.spine)bones.spine.rotation.x-=.16;if(bones.rightUpperArm){bones.rightUpperArm.rotation.x-=.7;bones.rightUpperArm.rotation.z+=.35;}}
        if(sequence?.stage==='execute'&&bones.spine)bones.spine.rotation.y+=Math.sin(sequence.executeProgress*Math.PI*2)*.22;
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

  // Keep the complete inspiration exchange readable, especially on portrait phone viewports.
  function inspirationCameraFrame(core){
    const hero=sides.hero.actor?.root?.position,enemy=sides.enemy.actor?.root?.position;
    if(!hero||!enemy)return null;
    const points=[hero,enemy,...extras.map(extra=>extra.actor?.root?.position).filter(Boolean)];
    const hx=hero.x,hz=hero.z,ex=enemy.x,ez=enemy.z,dx=ex-hx,dz=ez-hz,len=Math.max(.01,Math.hypot(dx,dz));
    const lineX=dx/len,lineZ=dz/len,sideX=-lineZ,sideZ=lineX;
    let minLine=Infinity,maxLine=-Infinity,minSide=Infinity,maxSide=-Infinity;
    for(const point of points){
      const along=point.x*lineX+point.z*lineZ,across=point.x*sideX+point.z*sideZ;
      minLine=Math.min(minLine,along);maxLine=Math.max(maxLine,along);minSide=Math.min(minSide,across);maxSide=Math.max(maxSide,across);
    }
    const centerLine=(minLine+maxLine)*.5,centerSide=(minSide+maxSide)*.5;
    const centerX=lineX*centerLine+sideX*centerSide,centerZ=lineZ*centerLine+sideZ*centerSide;
    const aspect=Math.max(.46,Math.min(2.1,camera.aspect||1)),vFov=THREE.MathUtils.degToRad(camera.fov),hFov=2*Math.atan(Math.tan(vFov*.5)*aspect);
    const halfWidth=(maxLine-minLine)*.5+1.05,halfHeight=1.55;
    const horizontalDistance=halfWidth/Math.max(.12,Math.tan(hFov*.5)),verticalDistance=halfHeight/Math.tan(vFov*.5);
    const distance=clamp(Math.max(horizontalDistance,verticalDistance)+.55,5.8,12.5);
    return {
      position:{x:centerX+sideX*distance,y:3.25,z:centerZ+sideZ*distance},
      look:{x:centerX,y:1.05,z:centerZ},
      follow:true,system:'inspiration',count:points.length
    };
  }

  function updateCamera(core,dt,followCamera,cameraSystem){
    const wide=canvas.clientWidth/Math.max(1,canvas.clientHeight)>1.3;
    let frame=reviewBattleCameraFrame(core,{follow:followCamera,system:cameraSystem,encounterMode,wide});
    const now=performance.now()/1000,sequence=techniquePlayback?reviewInspirationSequenceFrame(now-techniquePlayback.startedAt):null;
    const step=Math.max(1/120,Math.min(.05,Number(dt)||1/60));
    if(core?.hero&&core?.enemy&&followCamera)canvas.dataset.heroComposition=cameraSystem==='demon'?'kuumetsu-shared':'hyakunen-shared';
    if(sequence&&sequence.stage!=='done'&&core?.hero&&core?.enemy){
      frame=inspirationCameraFrame(core)||frame;
    }else if(frame?.follow&&core?.hero&&core?.enemy){
      cameraOrbit=(cameraOrbit+step*.05)%(Math.PI*2);
      const ox=frame.position.x-frame.look.x,oz=frame.position.z-frame.look.z,c=Math.cos(cameraOrbit),sn=Math.sin(cameraOrbit);
      frame={...frame,position:{...frame.position,x:frame.look.x+ox*c-oz*sn,z:frame.look.z+ox*sn+oz*c}};
    }
    if(frame?.position&&frame?.look&&frame.system!=='inspiration'){
      const dx=frame.position.x-frame.look.x,dy=frame.position.y-frame.look.y,dz=frame.position.z-frame.look.z;
      frame={...frame,position:{x:frame.look.x+dx*cameraZoom,y:frame.look.y+dy*cameraZoom,z:frame.look.z+dz*cameraZoom}};
    }
    cameraTargetPosition.set(frame.position.x,frame.position.y,frame.position.z);cameraTargetLook.set(frame.look.x,frame.look.y,frame.look.z);
    const blend=1-Math.exp(-step*(frame.system==='inspiration'?13:8));
    camera.position.lerp(cameraTargetPosition,blend);cameraLook.lerp(cameraTargetLook,blend);camera.lookAt(cameraLook);
    canvas.dataset.cameraFollow=followCamera?'on':'off';canvas.dataset.cameraZoom=cameraZoom.toFixed(2);
  }

  function sync(core,dt=0,{followCamera=true,encounterMode:requestedMode='duel',cameraSystem='rinne'}={}){
    setEncounterMode(requestedMode);resize();const now=performance.now()/1000;
    if(core){animateSide('hero',core.hero,core.enemy,now,dt);animateSide('enemy',core.enemy,core.hero,now,dt);animateExtras(core,now,dt);}
    updateCamera(core,dt,followCamera,cameraSystem);
    const sequence=techniquePlayback?reviewInspirationSequenceFrame(now-techniquePlayback.startedAt):null,cinematic=Boolean(sequence&&sequence.stage!=='done');aura.visible=cinematic;inspirationFx.visible=cinematic;
    if(cinematic&&sides.hero.actor){aura.position.copy(sides.hero.actor.root.position);aura.position.y=.025;inspirationFx.position.copy(sides.hero.actor.root.position);const pulse=.92+Math.sin(performance.now()*.018)*.08;aura.scale.setScalar(pulse);auraLight.intensity=1.8+Math.sin(performance.now()*.022)*.7;const intensity=sequence.stage==='reveal'||sequence.stage==='execute'?1:sequence.progress*.55;for(const [index,mesh] of fxRings.entries()){mesh.scale.setScalar(.7+intensity*(.8+index*.18));mesh.material.opacity=.18+intensity*.62;mesh.rotation.z+=.008*(index+1);}for(const [index,ray] of fxRays.entries()){ray.visible=intensity>.25;ray.scale.z=.45+intensity*(1.1+(index%3)*.15);ray.material.opacity=.15+intensity*.55;}fxArc.visible=sequence.stage==='reveal'||sequence.stage==='execute';fxArc.rotation.z+=.035;fxArc.material.opacity=.35+intensity*.6;
      for(const cue of ['camera','spacing','stagger','reveal','execute'])if(now-techniquePlayback.startedAt>=REVIEW_INSPIRATION_TIMELINE[cue]&&!techniquePlayback.emitted.has(cue)){techniquePlayback.emitted.add(cue);onInspirationCue(cue,techniquePlayback);}
    }
    if(techniquePlayback&&sequence?.stage==='done'){if(!techniquePlayback.emitted.has('done')){techniquePlayback.emitted.add('done');onInspirationCue('done',techniquePlayback);}techniquePlayback=null;aura.visible=false;inspirationFx.visible=false;}
    const phaseHud=canvas.closest('.stage')?.querySelector('#battle-phase'),signHud=canvas.closest('.stage')?.querySelector('#battle-sign'),heroRoot=sides.hero.actor?.root;
    if(phaseHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=.16;projected.project(camera);phaseHud.dataset.phaseAnchor='feet';phaseHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');phaseHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');phaseHud.style.setProperty('bottom','auto','important');}
    if(signHud&&heroRoot){const projected=heroRoot.position.clone();projected.y+=2.18;projected.project(camera);signHud.dataset.signAnchor='head';signHud.style.setProperty('left',`${(projected.x*.5+.5)*100}%`,'important');signHud.style.setProperty('top',`${(-projected.y*.5+.5)*100}%`,'important');}
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
    zoomBy(delta=0){cameraZoom=clamp(cameraZoom+Number(delta||0),.58,1.65);return cameraZoom;},
    setZoom(value=.82){cameraZoom=clamp(Number(value)||.82,.58,1.65);return cameraZoom;},
    cameraAngle(){return Math.atan2(camera.position.x-cameraLook.x,camera.position.z-cameraLook.z);},
    triggerInspiration({id='',name='',steps=[],phase='ha',duration=REVIEW_INSPIRATION_TIMELINE.end}={}){const now=performance.now()/1000,total=Math.max(REVIEW_INSPIRATION_TIMELINE.end,Number(duration)||0);techniquePlayback={id,name,steps,phase,duration:total,startedAt:now,until:now+total,emitted:new Set(['spark'])};cinematicUntil=now+total;canvas.closest('.stage')?.setAttribute('data-inspiration-cinematic','true');onInspirationCue('spark',techniquePlayback);setTimeout(()=>canvas.closest('.stage')?.removeAttribute('data-inspiration-cinematic'),total*1000+120);},
    resetRound(){cameraOrbit=0;for(const side of Object.values(sides)){side.previous=null;side.presentation=null;side.hp=null;side.hitUntil=0;}},
    sync,
    snapshot(){return Object.freeze({heroModel:canvas.dataset.heroModel||'',enemyModel:canvas.dataset.enemyModel||'',ready:canvas.dataset.battleModels==='ready',cameraFollow:canvas.dataset.cameraFollow==='on',encounterMode});},
    dispose(){observer.disconnect();clearExtras();if(sides.hero.actor)heroPool.despawn(sides.hero.actorId);protagonistRuntime.dispose();for(const monster of [monsterEnemy,monsterFlankA,monsterFlankB])disposeReviewMonsterModel(monster);ground.geometry.dispose();ground.material.dispose();contact.geometry.dispose();contact.material.dispose();for(const side of Object.values(sides)){side.marker.geometry.dispose();side.marker.material.dispose();}renderer.dispose();}
  });
}
