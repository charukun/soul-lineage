import * as THREE from 'three';
import { PoseSchedule } from '@soul/characters';
import { defs, muraBlocked } from '@soul/world/mura';
import { GLTFLoader } from '@soul/rendering';
import { createMuraModels } from '@soul/rendering/mura';
import { createMuraTerrain, flattenMuraModel } from '@soul/rendering/mura/terrain';
import { createAdaptiveQualityGovernor } from '@soul/rendering/adaptive-quality';
import { createMasterCharacterPool, shinoHumanoidFromGLTF } from '@soul/rendering/master-character';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import {
  RINNE_RUNTIME_CHARACTER_ASSET,
  createRinneEnemyCharacter,
  createRinneHeroCharacter,
  createRinneMotherCharacter,
  resolveRinneRuntimeCharacter,
  rinneRuntimeAgeMs
} from './character-presentation.js';
import { renderPixelRatio, targetFpsForView } from './performance.js';
import { cameraOffsetForPosition, createCameraPositionControl } from './camera-position-control.js';
import './camera-position-control.css';

const disposeObject=root=>root?.traverse?.(o=>{if(o.geometry?.dispose)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.dispose)m.dispose();});
const armorDye=Object.freeze({cloth:[1,1,1],light:[.72,.84,.78],heavy:[.68,.73,.82]});

async function createRuntimeCharacterPool(renderer){
  const loader=new GLTFLoader();
  loader.useCompressedTextures?.(renderer,{transcoderPath:'./basis/'});
  const gltf=await loader.loadAsync(RINNE_RUNTIME_CHARACTER_ASSET.url);
  const humanoid=await shinoHumanoidFromGLTF(gltf);
  const pool=createMasterCharacterPool({template:gltf.scene,humanoid,capacity:8});
  return{loader,pool,template:gltf.scene};
}

function poseHumanoid(bones,{moving=false,speed=0,combat=false,flash=0,carrier=false}={},time=0){
  const cadence=Math.min(12,6.4+Math.max(0,speed)*.85),stride=moving?Math.sin(time*cadence)*.42:0;
  if(bones.leftUpperLeg)bones.leftUpperLeg.rotation.x+=stride;
  if(bones.rightUpperLeg)bones.rightUpperLeg.rotation.x-=stride;
  if(bones.leftLowerLeg)bones.leftLowerLeg.rotation.x+=Math.max(0,-stride)*.28;
  if(bones.rightLowerLeg)bones.rightLowerLeg.rotation.x+=Math.max(0,stride)*.28;
  if(bones.leftUpperArm)bones.leftUpperArm.rotation.x-=stride*.42;
  if(bones.rightUpperArm)bones.rightUpperArm.rotation.x+=stride*.42;
  if(combat&&bones.spine)bones.spine.rotation.x-=.06;
  if(carrier&&bones.leftUpperArm&&bones.rightUpperArm){bones.leftUpperArm.rotation.z-=.18;bones.rightUpperArm.rotation.z+=.18;}
  if(flash&&bones.spine)bones.spine.rotation.z+=Math.sin(time*32)*.12*flash;
}

export async function createWorldRenderer({canvas,document:doc,layout,stations}){
  const renderWindow=doc.defaultView||globalThis,basePixelRatio=Number(renderWindow?.devicePixelRatio)||1,targetFps=targetFpsForView(renderWindow);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  const applyQuality=profile=>{const ratio=renderPixelRatio(basePixelRatio,profile.renderScale);renderer.setPixelRatio(ratio);canvas.dataset.renderQuality=profile.id;canvas.dataset.renderPixelRatio=String(ratio);};
  const qualityGovernor=createAdaptiveQualityGovernor({targetFps,onChange:snapshot=>applyQuality(snapshot.profile)});applyQuality(qualityGovernor.snapshot().profile);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x91d7f5);scene.fog=new THREE.FogExp2(0xcfe6ef,.0042);
  const camera=new THREE.PerspectiveCamera(43,1,.08,650);camera.position.set(12,13,17);
  scene.add(new THREE.HemisphereLight(0xfff0cb,0x7b6fa5,2.15));
  const sun=new THREE.DirectionalLight(0xffd493,2.65);sun.position.set(-12,25,15);scene.add(sun);

  const root=new THREE.Group(),land=new THREE.Group(),objects=new THREE.Group(),stationsRoot=new THREE.Group(),frontRoot=new THREE.Group();root.add(land,objects,stationsRoot);scene.add(root,frontRoot);frontRoot.visible=false;
  // Mura models are environment-only in Rinne. Runtime humanoids are exclusively created by the Character Presentation pool below.
  const models=createMuraModels(THREE,{createCanvas:()=>doc.createElement('canvas'),textileFibers:2800,textileBlotches:72}),cache=new Map();
  const getProp=kind=>{if(!cache.has('prop:'+kind))cache.set('prop:'+kind,flattenMuraModel(THREE,models.prop(kind,14)));return cache.get('prop:'+kind);};
  const terrain=createMuraTerrain({THREE,scene,outside:land,getProp,mat:models.mat,createCanvas:()=>doc.createElement('canvas')});
  for(const o of layout.objects){
    if(o.phase!=='built')continue;const key=`${o.kind}:${o.material}:${o.level}`;
    if(!cache.has(key))cache.set(key,flattenMuraModel(THREE,defs[o.kind].building?models.building(o.kind,o.material,o.level):models.prop(o.kind)));
    const n=cache.get(key).clone();n.position.set(o.x,.02,o.z);n.rotation.y=o.rot;n.userData.entityId=o.id;objects.add(n);
  }

  function mat(color,extra={}){return new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.08,...extra});}
  function box(parent,size,pos,color){const g=new THREE.BoxGeometry(...size),m=mat(color),mesh=new THREE.Mesh(g,m);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function cyl(parent,r,h,pos,color,segments=10){const g=new THREE.CylinderGeometry(r,r,h,segments),m=mat(color),mesh=new THREE.Mesh(g,m);mesh.position.set(...pos);parent.add(mesh);return mesh;}
  function blade(parent,length=.9,width=.09,color=0xd8d8cf){const g=new THREE.BoxGeometry(width,length,.055),m=mat(color,{metalness:.6,roughness:.3}),mesh=new THREE.Mesh(g,m);mesh.position.y=length/2+.18;parent.add(mesh);box(parent,[.34,.055,.09],[0,.18,0],0x8c724a);cyl(parent,.045,.3,[0,.03,0],0x5d4532,8);return mesh;}
  function weaponVisual(id,mini=false){const g=new THREE.Group(),s=mini?.58:1;
    if(id==='fist'){cyl(g,.08,.28,[0,.18,0],0x8a7050,8);box(g,[.28,.08,.12],[0,.34,0],0xb69a72);}
    else if(id==='dagger')blade(g,.48,.105);
    else if(id==='sword')blade(g,.9,.09);
    else if(id==='great'){blade(g,1.25,.16);g.scale.x=1.12;}
    else if(id==='spear'){cyl(g,.035,1.55,[0,.78,0],0x775b42,8);const tip=new THREE.Mesh(new THREE.ConeGeometry(.105,.32,6),mat(0xd8d8cf,{metalness:.6,roughness:.3}));tip.position.y=1.72;g.add(tip);}
    else if(id==='axe'){cyl(g,.045,1.15,[0,.58,0],0x775b42,8);box(g,[.38,.34,.08],[.15,1.03,0],0xbfc0b5);}
    else if(id==='staff'){cyl(g,.05,1.5,[0,.75,0],0x72523e,10);const orb=new THREE.Mesh(new THREE.SphereGeometry(.13,12,8),mat(0x8aa8a3,{emissive:0x304947,emissiveIntensity:.6}));orb.position.y=1.55;g.add(orb);}
    g.scale.setScalar(s);return g;
  }

  function rack(station){
    const g=new THREE.Group();g.position.set(station.x,0,station.z);g.userData.stationId=station.id;
    box(g,[1.25,.12,.52],[0,.52,0],0x6e5138);box(g,[.12,1.0,.12],[-.5,.52,0],0x59402e);box(g,[.12,1.0,.12],[.5,.52,0],0x59402e);
    if(station.equipment.weapon){const item=weaponVisual(station.equipment.weapon,true);item.position.set(0,.55,.02);item.rotation.z=-.18;g.add(item);}
    if(station.equipment.armor){const color={cloth:0xb68f7f,light:0x7e9090,heavy:0x687477}[station.equipment.armor];box(g,[.66,.62,.18],[0,.87,0],color);}
    if(Object.hasOwn(station.equipment,'shield')){const shield=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.08,12),mat(station.equipment.shield?0x80939d:0x685a4b));shield.rotation.x=Math.PI/2;shield.position.set(0,.82,0);g.add(shield);}
    stationsRoot.add(g);
  }
  stations.filter(s=>s.equipment).forEach(rack);

  const frontGround=new THREE.Mesh(new THREE.PlaneGeometry(17,14),mat(0x8d7ca8));frontGround.rotation.x=-Math.PI/2;frontRoot.add(frontGround);
  for(const x of[-7.2,7.2])for(let z=-5.5;z<=5.5;z+=2.2)box(frontRoot,[.7,1.2,.7],[x,.6,z],0x6e6682);
  for(const x of[-2.2,0,2.2])box(frontRoot,[1.4,.25,.7],[x,.12,-6.25],0xa47768);
  const rescuePad=new THREE.Mesh(new THREE.RingGeometry(.8,1.0,32),new THREE.MeshBasicMaterial({color:0xffd470,side:THREE.DoubleSide}));rescuePad.rotation.x=-Math.PI/2;rescuePad.position.set(0,.03,5.2);frontRoot.add(rescuePad);
  applyStylizedShading(root,'environment');applyStylizedShading(frontRoot,'environment');

  const runtimeCharacters=await createRuntimeCharacterPool(renderer),characterPool=runtimeCharacters.pool;
  let currentLifeKey='',heroDescriptor=null,motherDescriptor=null,currentFront=null,enemyRosterKey='';
  const enemyActors=new Map();
  const heroActor=characterPool.spawn('rinne-runtime-hero'),motherActor=characterPool.spawn('rinne-runtime-mother');
  heroActor.root.name='Player';motherActor.root.name='Mother';
  scene.add(heroActor.root,heroActor.attachments,motherActor.root,motherActor.attachments);
  applyStylizedShading(heroActor.root,'hero');applyStylizedShading(motherActor.root,'npc');
  const heroSchedule=new PoseSchedule(),motherSchedule=new PoseSchedule();let motherMotion={active:false,moving:false,speed:0};

  function bindLife(state){
    const key=`${state.id}:${state.seed}:${state.birthVillageId}`;if(key===currentLifeKey)return;
    currentLifeKey=key;heroDescriptor=createRinneHeroCharacter(state);motherDescriptor=createRinneMotherCharacter(state);
  }
  function appearanceFor(descriptor,extra={}){return resolveRinneRuntimeCharacter({...descriptor,...extra});}
  function sampleSlot(actor,schedule,presentation,dt,pose){
    actor.setVisible(presentation.render.visible!==false);
    const tick=schedule.advance(Math.max(0,dt||0),presentation.render.animationHz);
    if(tick!==null)actor.sample(presentation.appearance,tick===0?0:performance.now()/1000,pose);
  }

  function removeEnemy(id){const slot=enemyActors.get(id);if(!slot)return;characterPool.despawn(slot.poolId);enemyActors.delete(id);}
  function syncFront(front){
    currentFront=front;
    const enemies=front?.enemies||[],rosterKey=`${front?.stage??'none'}:${enemies.map(e=>e.id).join('|')}`;
    if(rosterKey!==enemyRosterKey){
      enemyRosterKey=rosterKey;const liveIds=new Set(enemies.map(e=>e.id));
      for(const id of [...enemyActors.keys()])if(!liveIds.has(id))removeEnemy(id);
      enemies.forEach((enemy,index)=>{
        if(enemyActors.has(enemy.id))return;
        const descriptor=createRinneEnemyCharacter(enemy,{lifeSeed:(front?.stage??0)+1,stage:front?.stage??0,index});
        const poolId=`rinne-runtime-${descriptor.character.id}`,actor=characterPool.spawn(poolId);
        actor.root.name=`Enemy:${enemy.id}`;frontRoot.add(actor.root,actor.attachments);applyStylizedShading(actor.root,'enemy');
        enemyActors.set(enemy.id,{actor,descriptor,poolId,schedule:new PoseSchedule()});
      });
    }
    updateFront(front);
  }
  function updateFront(front){
    currentFront=front;
    for(const enemy of front?.enemies||[]){const slot=enemyActors.get(enemy.id);if(!slot)continue;slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;slot.actor.setVisible(!enemy.dead);}
  }

  let equipmentWeapon=null,equipmentShield=null;
  function syncEquipment(equipment){
    if(equipment.weapon!==equipmentWeapon){
      const old=heroActor.detachWeapon('weapon');if(old)disposeObject(old);equipmentWeapon=equipment.weapon;
      if(equipment.weapon!=='fist'){
        const object=weaponVisual(equipment.weapon);object.rotation.z=-Math.PI/2;
        heroActor.attachWeapon('weapon',object,{bone:'rightHand',position:[0,.02,0],quaternion:[0,0,0,1],scale:.72});
      }
    }
    if(equipment.shield!==equipmentShield){
      const old=heroActor.detachWeapon('shield');if(old)disposeObject(old);equipmentShield=equipment.shield;
      if(equipment.shield){
        const shield=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.07,18),mat(0x78919c,{metalness:.35,roughness:.48}));shield.rotation.x=Math.PI/2;
        heroActor.attachWeapon('shield',shield,{bone:'leftHand',position:[0,.03,0],quaternion:[0,0,0,1],scale:.8});
      }
    }
  }

  const target=new THREE.Vector3(),desired=new THREE.Vector3(),moveVector=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),camOffset=new THREE.Vector3(10.5,11.5,14.5);let elapsed=0;
  const cameraControl=createCameraPositionControl({document:doc,container:canvas.parentElement,onChange:position=>{camOffset.set(...cameraOffsetForPosition(position));canvas.dataset.cameraPosition=String(Math.round(position*100));}});
  function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);resize();
  function cameraVector(axis){
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
    return moveVector.set(0,0,0).addScaledVector(right,axis.x).addScaledVector(forward,-axis.y).normalize();
  }
  function screenDirection(from,to){
    const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz);if(len<.001)return{x:0,y:-1,distance:0};
    camera.getWorldDirection(forward);forward.y=0;forward.normalize();right.crossVectors(forward,up).normalize();
    return{x:(dx*right.x+dz*right.z)/len,y:-(dx*forward.x+dz*forward.z)/len,distance:len};
  }
  function canMoveTo(x,z,radius=.32,zone='village'){if(zone==='frontier')return Math.abs(x)<7.15-radius&&z>-6.45+radius&&z<6.1-radius;return !muraBlocked(layout,x,z,radius);}
  function renderState(state,dt=0){
    elapsed+=dt;if(dt>0&&!doc.hidden)qualityGovernor.observeFrame(dt);bindLife(state);syncEquipment(state.equipment);
    heroDescriptor.character.ageMs=rinneRuntimeAgeMs(state.ageSeconds);heroDescriptor.character.lifeState='alive';
    const birth=state.phase==='birth',village=state.zone==='village';root.visible=village;frontRoot.visible=!village;
    heroActor.root.rotation.y=state.yaw;motherActor.root.rotation.y=state.yaw;
    if(birth&&village){motherActor.setVisible(true);motherActor.root.position.set(state.position.x,0,state.position.z);heroActor.root.position.set(state.position.x+Math.sin(state.yaw)*.24,1.02,state.position.z+Math.cos(state.yaw)*.24);}
    else{motherActor.setVisible(false);heroActor.root.position.set(state.position.x,0,state.position.z);}
    const heroPresentation=appearanceFor(heroDescriptor,{distance:0,visible:true,important:true});
    const dye=armorDye[state.equipment.armor]||armorDye.cloth;heroPresentation.appearance.dye=[...dye];
    sampleSlot(heroActor,heroSchedule,heroPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:state.moving,speed:state.moving?4.1:0,combat:Boolean(state.combat)},time));
    const motherPresentation=appearanceFor(motherDescriptor,{distance:.3,visible:birth&&village,important:true});
    sampleSlot(motherActor,motherSchedule,motherPresentation,dt,(bones,time)=>poseHumanoid(bones,{moving:motherMotion.active&&motherMotion.moving,speed:motherMotion.speed,carrier:true},time));
    for(const enemy of currentFront?.enemies||[]){
      const slot=enemyActors.get(enemy.id);if(!slot)continue;
      const distance=Math.hypot(enemy.x-state.position.x,enemy.z-state.position.z),presentation=appearanceFor(slot.descriptor,{distance,visible:!enemy.dead,important:(currentFront?.stage??0)>=5});
      sampleSlot(slot.actor,slot.schedule,presentation,dt,(bones,time)=>poseHumanoid(bones,{moving:Boolean(enemy.moving),speed:enemy.moving?3.6:0,combat:true,flash:enemy.flash||0},time));
      slot.actor.root.position.set(enemy.x,0,enemy.z);slot.actor.root.rotation.y=Number.isFinite(enemy.yaw)?enemy.yaw:0;
    }
    heroActor.updateAttachments();motherActor.updateAttachments();for(const slot of enemyActors.values())slot.actor.updateAttachments();
    target.set(state.position.x,1.15,state.position.z);desired.copy(target).add(camOffset);camera.position.lerp(desired,1-Math.pow(.001,Math.min(.05,dt||.016)));camera.lookAt(target);
    if(village){terrain.waterMat.uniforms.time.value=elapsed;terrain.motes.position.y=Math.sin(elapsed*.35)*.15;}
    renderer.render(scene,camera);
  }
  function setCarrierMotion({active=false,moving=false,speed=0}={}){motherMotion={active:Boolean(active),moving:Boolean(moving),speed:Math.max(0,Number(speed)||0)};}
  function dispose(){
    observer.disconnect();cameraControl.dispose();for(const id of [...enemyActors.keys()])removeEnemy(id);characterPool.dispose();runtimeCharacters.loader.disposeCompressedTextures?.();
    root.removeFromParent();frontRoot.removeFromParent();heroActor.root.removeFromParent();heroActor.attachments.removeFromParent();motherActor.root.removeFromParent();motherActor.attachments.removeFromParent();for(const v of cache.values())disposeObject(v);renderer.dispose();
  }
  return{THREE,scene,camera,renderState,cameraVector,screenDirection,canMoveTo,syncEquipment,syncFront,updateFront,setCarrierMotion,resize,qualitySnapshot:()=>qualityGovernor.snapshot(),dispose};
}
