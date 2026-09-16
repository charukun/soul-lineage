import * as THREE from 'three';
import { defs, muraBlocked } from '@soul/world/mura';
import { createMuraModels } from '@soul/rendering/mura';
import { createMuraTerrain, flattenMuraModel } from '@soul/rendering/mura/terrain';
import { createAdaptiveQualityGovernor } from '@soul/rendering/adaptive-quality';
import { applyStylizedShading } from '@soul/rendering/stylized-shading';
import { createRinneCharacterStage } from './runtime-character-stage.js';
import { buildInteriors } from './locations.js';
import { renderPixelRatio, targetFpsForView } from './performance.js';
import { cameraOffsetForPosition, createCameraPositionControl } from './camera-position-control.js';
import { rinneCombatCameraFrame } from './combat-camera.js';
import './camera-position-control.css';

const disposeObject=root=>root?.traverse?.(o=>{if(o.geometry?.dispose)o.geometry.dispose();for(const m of Array.isArray(o.material)?o.material:[o.material])if(m?.dispose)m.dispose();});

function createSkirmishRenderer({characterStage,skirmishRoot,mat}){
  let current=null;const hostileModels=new Map();
  function hostileVisual(row){
    const g=new THREE.Group(),monster=row.kind==='monster',boar=row.label==='猪',bodyColor=monster?0x665780:boar?0x725444:0x696d66;
    const body=new THREE.Mesh(new THREE.SphereGeometry(monster?.62:.52,10,7),mat(bodyColor));body.scale.set(monster?1.2:1.45,monster?1.05:.72,monster?1.05:.78);body.position.y=monster?.7:.55;g.add(body);
    const head=new THREE.Mesh(new THREE.SphereGeometry(monster?.38:.31,9,6),mat(monster?0x745f8b:bodyColor));head.position.set(0,monster?.86:.62,.58);g.add(head);
    for(const x of[-.34,.34])for(const z of[-.32,.35]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,monster?.48:.42,6),mat(0x4c453e));leg.position.set(x,monster?.28:.24,z);g.add(leg);}
    if(monster){for(const x of[-.22,.22]){const horn=new THREE.Mesh(new THREE.ConeGeometry(.09,.42,6),mat(0xd3c8ae));horn.position.set(x,1.2,.57);horn.rotation.x=-.22;g.add(horn);}}
    else if(boar){for(const x of[-.24,.24]){const tusk=new THREE.Mesh(new THREE.ConeGeometry(.045,.28,6),mat(0xe5dec7));tusk.position.set(x,.58,.87);tusk.rotation.x=Math.PI/2;g.add(tusk);}}
    else{const tail=new THREE.Mesh(new THREE.ConeGeometry(.07,.52,6),mat(bodyColor));tail.position.set(0,.6,-.68);tail.rotation.x=-Math.PI/2.5;g.add(tail);}
    applyStylizedShading(g,'enemy');return g;
  }
  function update(skirmish){
    current=skirmish||null;characterStage.updateSkirmish(skirmish);
    for(const row of skirmish?.hostiles||[]){const model=hostileModels.get(row.id);if(!model)continue;model.position.set(row.x,0,row.z);model.rotation.y=Number.isFinite(row.yaw)?row.yaw:0;model.visible=!row.dead;model.scale.setScalar(row.flash>0?1.05:1);}
  }
  function sync(skirmish){
    current=skirmish||null;characterStage.syncSkirmish(skirmish);const ids=new Set((skirmish?.hostiles||[]).map(row=>row.id));
    for(const [id,model] of hostileModels)if(!ids.has(id)){model.removeFromParent();disposeObject(model);hostileModels.delete(id);}
    for(const row of skirmish?.hostiles||[]){if(hostileModels.has(row.id))continue;const model=hostileVisual(row);model.name=`VillageThreat:${row.id}`;skirmishRoot.add(model);hostileModels.set(row.id,model);}update(skirmish);
  }
  function dispose(){for(const model of hostileModels.values())disposeObject(model);hostileModels.clear();}
  return{sync,update,current:()=>current,dispose};
}

export async function createWorldRenderer({canvas,document:doc,layout,stations}){
  const renderWindow=doc.defaultView||globalThis,basePixelRatio=Number(renderWindow?.devicePixelRatio)||1,targetFps=targetFpsForView(renderWindow);
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance',alpha:false});
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.06;
  const applyQuality=profile=>{const ratio=renderPixelRatio(basePixelRatio,profile.renderScale);renderer.setPixelRatio(ratio);canvas.dataset.renderQuality=profile.id;canvas.dataset.renderPixelRatio=String(ratio);};
  const qualityGovernor=createAdaptiveQualityGovernor({targetFps,onChange:snapshot=>applyQuality(snapshot.profile)});applyQuality(qualityGovernor.snapshot().profile);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0x91d7f5);const outdoorSky=scene.background,indoorSky=new THREE.Color(0x544c62);scene.fog=new THREE.FogExp2(0xcfe6ef,.0042);
  const camera=new THREE.PerspectiveCamera(43,1,.08,650);camera.position.set(12,13,17);
  scene.add(new THREE.HemisphereLight(0xfff0cb,0x7b6fa5,2.15));
  const sun=new THREE.DirectionalLight(0xffd493,2.65);sun.position.set(-12,25,15);scene.add(sun);

  const root=new THREE.Group(),land=new THREE.Group(),objects=new THREE.Group(),stationsRoot=new THREE.Group(),interiorRoot=new THREE.Group(),skirmishRoot=new THREE.Group(),frontRoot=new THREE.Group();root.add(land,objects,stationsRoot);scene.add(root,interiorRoot,skirmishRoot,frontRoot);interiorRoot.visible=false;skirmishRoot.visible=false;frontRoot.visible=false;
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

  const interiors=buildInteriors(layout),interiorById=new Map(interiors.map(row=>[row.id,row])),interiorGroups=new Map();
  for(const interior of interiors){
    const g=new THREE.Group();g.name=`Interior:${interior.id}`;g.visible=false;g.userData.interiorId=interior.id;
    box(g,[Math.max(3,interior.w-1),.12,Math.max(3,interior.d-1)],[0,-.06,0],0x8f765c);
    box(g,[Math.max(3,interior.w-1),1.25,.18],[0,.62,-interior.d/2+.58],0x695847);
    box(g,[.18,1.25,Math.max(3,interior.d-1)],[-interior.w/2+.58,.62,0],0x695847);
    box(g,[.18,1.25,Math.max(3,interior.d-1)],[interior.w/2-.58,.62,0],0x695847);
    for(const item of interior.room){const prop=getProp(item.kind).clone();prop.position.set(item.x,.02,item.z);prop.rotation.y=item.rot;prop.userData.entityId=item.id;g.add(prop);}
    interiorRoot.add(g);interiorGroups.set(interior.id,g);
  }

  function rack(station){
    const g=new THREE.Group();g.position.set(station.x,0,station.z);g.userData.stationId=station.id;
    box(g,[1.25,.12,.52],[0,.52,0],0x6e5138);box(g,[.12,1.0,.12],[-.5,.52,0],0x59402e);box(g,[.12,1.0,.12],[.5,.52,0],0x59402e);
    if(station.equipment.weapon){const item=weaponVisual(station.equipment.weapon,true);item.position.set(0,.55,.02);item.rotation.z=-.18;g.add(item);}
    if(station.equipment.armor){const color={cloth:0xb68f7f,light:0x7e9090,heavy:0x687477}[station.equipment.armor];box(g,[.66,.62,.18],[0,.87,0],color);}
    if(Object.hasOwn(station.equipment,'shield')){const shield=new THREE.Mesh(new THREE.CylinderGeometry(.33,.33,.08,12),mat(station.equipment.shield?0x80939d:0x685a4b));shield.rotation.x=Math.PI/2;shield.position.set(0,.82,0);g.add(shield);}
    stationsRoot.add(g);
  }
  stations.filter(s=>s.equipment&&!s.interiorId).forEach(rack);
  for(const station of stations.filter(row=>row.trainingDummy&&!row.interiorId)){
    const g=new THREE.Group();g.position.set(station.x,0,station.z);g.userData.stationId=station.id;
    box(g,[1.4,.16,.8],[0,.08,0],0x66503b);cyl(g,.13,2.2,[0,1.12,0],0x765b3e,10);box(g,[1.55,.14,.14],[0,1.52,0],0x816344);
    const targetPad=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.16,16),mat(0xb68a58));targetPad.rotation.x=Math.PI/2;targetPad.position.set(0,1.15,.1);g.add(targetPad);
    box(g,[.28,.55,.22],[-.58,1.18,0],0x9b7650);box(g,[.28,.55,.22],[.58,1.18,0],0x9b7650);stationsRoot.add(g);
  }

  const frontGround=new THREE.Mesh(new THREE.PlaneGeometry(17,14),mat(0x8d7ca8));frontGround.rotation.x=-Math.PI/2;frontRoot.add(frontGround);
  for(const x of[-7.2,7.2])for(let z=-5.5;z<=5.5;z+=2.2)box(frontRoot,[.7,1.2,.7],[x,.6,z],0x6e6682);
  for(const x of[-2.2,0,2.2])box(frontRoot,[1.4,.25,.7],[x,.12,-6.25],0xa47768);
  const rescuePad=new THREE.Mesh(new THREE.RingGeometry(.8,1.0,32),new THREE.MeshBasicMaterial({color:0xffd470,side:THREE.DoubleSide}));rescuePad.rotation.x=-Math.PI/2;rescuePad.position.set(0,.03,5.2);frontRoot.add(rescuePad);
  applyStylizedShading(root,'environment');applyStylizedShading(interiorRoot,'environment');applyStylizedShading(frontRoot,'environment');

  const characterStage=await createRinneCharacterStage({renderer,scene,frontRoot,weaponVisual,mat,disposeObject});
  const {syncEquipment,setCarrierMotion,syncPeers}=characterStage;let currentFront=null;
  function syncFront(front){currentFront=front||null;characterStage.syncFront(front);}
  function updateFront(front){currentFront=front||null;characterStage.updateFront(front);}
  const skirmishRenderer=createSkirmishRenderer({characterStage,skirmishRoot,mat});

  const target=new THREE.Vector3(),cameraLook=new THREE.Vector3(),desired=new THREE.Vector3(),moveVector=new THREE.Vector3(),forward=new THREE.Vector3(),right=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),camOffset=new THREE.Vector3(10.5,11.5,14.5);let elapsed=0,cameraLookReady=false,lastSpace='';
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
  function interiorBlocked(interior,x,z,radius){
    if(!interior||Math.abs(x)>=interior.w/2-.7-radius||Math.abs(z)>=interior.d/2-.7-radius)return true;
    return interior.room.some(item=>{const d=defs[item.kind];if(!d)return false;const dx=x-item.x,dz=z-item.z,c=Math.cos(item.rot||0),s=Math.sin(item.rot||0),w=Math.min(2.3,d.w||1.2),depth=Math.min(2.3,d.d||1.2);return Math.abs(dx*c-dz*s)<w/2+radius*.72&&Math.abs(dx*s+dz*c)<depth/2+radius*.72;});
  }
  function canMoveTo(x,z,radius=.32,zone='village',interiorId=null){
    if(zone==='frontier')return Math.abs(x)<7.15-radius&&z>-6.45+radius&&z<6.1-radius;
    if(zone==='interior')return !interiorBlocked(interiorById.get(interiorId),x,z,radius);
    return !muraBlocked(layout,x,z,radius);
  }
  function renderState(state,dt=0){
    elapsed+=dt;if(dt>0&&!doc.hidden)qualityGovernor.observeFrame(dt);characterStage.render(state,dt);
    const village=state.zone==='village',inside=village&&!!state.interior,space=inside?`interior:${state.interior.buildingId}`:state.zone,spaceChanged=space!==lastSpace;lastSpace=space;
    root.visible=village&&!inside;interiorRoot.visible=inside;skirmishRoot.visible=village&&!inside;frontRoot.visible=state.zone==='frontier';scene.background=inside?indoorSky:outdoorSky;
    for(const [id,g] of interiorGroups)g.visible=inside&&id===state.interior?.buildingId;
    const combatFrame=state.zone==='frontier'?rinneCombatCameraFrame({player:state.position,enemies:currentFront?.enemies,targetId:state.combat?.targetId,active:!!state.combat}):null;cameraControl.setCombat(!!combatFrame);canvas.dataset.combatCamera=String(!!combatFrame);canvas.dataset.worldSpace=space;canvas.dataset.villageThreats=String(skirmishRenderer.current()?.hostiles?.filter(row=>!row.dead).length||0);
    if(combatFrame){target.set(combatFrame.look.x,combatFrame.look.y,combatFrame.look.z);desired.set(target.x+combatFrame.offset.x,target.y+combatFrame.offset.y,target.z+combatFrame.offset.z);}
    else{target.set(state.position.x,1.15,state.position.z);desired.copy(target).add(camOffset);if(inside)desired.y=Math.min(desired.y,9.5);}
    if(spaceChanged){camera.position.copy(desired);cameraLook.copy(target);cameraLookReady=true;}else{const step=Math.min(.05,dt||.016),positionBlend=1-Math.exp(-(combatFrame?5.6:6.9)*step),lookBlend=1-Math.exp(-(combatFrame?7.2:9.2)*step);camera.position.lerp(desired,positionBlend);if(!cameraLookReady){cameraLook.copy(target);cameraLookReady=true;}else cameraLook.lerp(target,lookBlend);}camera.lookAt(cameraLook);
    if(village&&!inside){terrain.waterMat.uniforms.time.value=elapsed;terrain.motes.position.y=Math.sin(elapsed*.35)*.15;}
    renderer.render(scene,camera);
  }
  function dispose(){
    observer.disconnect();cameraControl.dispose();skirmishRenderer.dispose();characterStage.dispose();
    root.removeFromParent();interiorRoot.removeFromParent();skirmishRoot.removeFromParent();frontRoot.removeFromParent();for(const v of cache.values())disposeObject(v);renderer.dispose();
  }
  return{THREE,scene,camera,renderState,cameraVector,screenDirection,canMoveTo,syncEquipment,syncFront,updateFront,syncSkirmish:skirmishRenderer.sync,updateSkirmish:skirmishRenderer.update,setCarrierMotion,syncPeers,resize,qualitySnapshot:()=>qualityGovernor.snapshot(),dispose};
}
